/* Operation Three Forks — stops, optimal route and time budget. */
(function () {
  const D = window.DATA;
  const A = D.assumptions;

  /* Every possible stop, with its position in meters. */
  function baseStops() {
    const tubes = D.tubes.map(t => ({
      id: 'T' + t.num, type: 'tube', num: t.num, label: String(t.num),
      name: t.name, ref: t, lon: t.lon, lat: t.lat, ...Geo.toWorld(t.lon, t.lat),
    }));
    const science = D.targets.map(o => ({
      id: 'C' + o.id, type: 'science', label: o.id, name: o.name,
      ref: o, lon: o.lon, lat: o.lat, ...Geo.toWorld(o.lon, o.lat),
    }));
    return tubes.concat(science);
  }

  /* Length of a closed loop start → stops → start. */
  function loopLength(start, order) {
    let total = 0, prev = start;
    for (const p of order) { total += Geo.distance(prev, p); prev = p; }
    return total + Geo.distance(prev, start);
  }

  /* Nearest neighbor from every starting stop, then 2-opt improvement:
     optimal or near-optimal for about a dozen stops. */
  function optimize(start, stops) {
    if (stops.length < 2) return stops.slice();
    let best = null, bestLen = Infinity;
    for (let first = 0; first < stops.length; first++) {
      const left = stops.slice();
      const order = [left.splice(first, 1)[0]];
      while (left.length) {
        const last = order[order.length - 1];
        let k = 0, dk = Infinity;
        left.forEach((p, i) => { const d = Geo.distance(last, p); if (d < dk) { dk = d; k = i; } });
        order.push(left.splice(k, 1)[0]);
      }
      let improved = true, o = order;
      while (improved) {
        improved = false;
        for (let i = 0; i < o.length - 1; i++) {
          for (let j = i + 1; j < o.length; j++) {
            const cand = o.slice(0, i).concat(o.slice(i, j + 1).reverse(), o.slice(j + 1));
            if (loopLength(start, cand) < loopLength(start, o) - 1e-6) { o = cand; improved = true; }
          }
        }
      }
      const len = loopLength(start, o);
      if (len < bestLen) { bestLen = len; best = o; }
    }
    return best;
  }

  function stopMinutes(p) { return p.type === 'tube' ? A.min_per_tube : A.min_per_sample; }

  /* Full plan: order, legs, times and timeline segments. */
  function plan(habitat, included) {
    const start = { ...Geo.toWorld(habitat.lon, habitat.lat), lon: habitat.lon, lat: habitat.lat, type: 'habitat', name: 'Habitat' };
    const order = optimize(start, included);
    const v = A.walk_speed_m_s;
    const segments = [];
    let prev = start, total = 0, minutes = 0, maxFromHome = 0;
    order.forEach(p => {
      const d = Geo.distance(prev, p);
      total += d; minutes += d / v / 60;
      segments.push({ type: 'walk', min: d / v / 60 });
      segments.push({ type: p.type, min: stopMinutes(p), stop: p });
      minutes += stopMinutes(p);
      maxFromHome = Math.max(maxFromHome, Geo.distance(start, p));
      p.leg = d;
      prev = p;
    });
    const back = Geo.distance(prev, start);
    total += back; minutes += back / v / 60;
    segments.push({ type: 'walk', min: back / v / 60, back: true });
    return { start, order, total, minutes, back, maxFromHome, segments };
  }

  function addTime(hhmm, minutes) {
    const [h, m] = hhmm.split(':').map(Number);
    const t = Math.round(h * 60 + m + minutes);
    const hh = Math.floor(t / 60) % 24, mm = ((t % 60) + 60) % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function duration(min) {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
  }

  window.Route = { baseStops, optimize, plan, addTime, duration, stopMinutes };
})();
