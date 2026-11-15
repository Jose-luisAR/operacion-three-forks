/* Operation Three Forks — shared state, adjustable assumptions and the link
   between the planning and navigation views. */
(function () {
  const D = window.DATA;
  const A = D.assumptions;
  const $ = id => document.getElementById(id);

  /* Terrain: elevation range measured by the rover at the depot. */
  const elevs = D.traverse.filter(r => r.sol >= 652 && r.sol <= 693).map(r => r.elev);
  const relief = Math.max(...elevs) - Math.min(...elevs);
  const terrain = `Flat terrain · ±${(relief / 2).toFixed(1)} m`;

  /* Mission assumptions: original values (from the data script) and user edits. */
  const KEYS = ['walk_speed_m_s', 'min_per_tube', 'min_per_sample', 'suit_reserve_min', 'return_margin'];
  const ORIGINAL = {};
  KEYS.forEach(k => { ORIGINAL[k] = A[k]; });

  const stops = Route.baseStops();
  const state = {
    stops,
    habitat: { ...A.habitat },
    included: new Set(stops.map(p => p.id)),
    plan: null,
  };

  // Remember the last plan in this browser, when storage is available.
  const STORE = 'threeforks.plan.v2';
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && saved.habitat) { state.habitat = saved.habitat; state.included = new Set(saved.included); }
    if (saved && saved.assumptions) KEYS.forEach(k => { if (typeof saved.assumptions[k] === 'number') A[k] = saved.assumptions[k]; });
  } catch (e) { /* no storage: use the default plan */ }
  function save() {
    const assumptions = {}; KEYS.forEach(k => { assumptions[k] = A[k]; });
    try { localStorage.setItem(STORE, JSON.stringify({ habitat: state.habitat, included: [...state.included], assumptions })); } catch (e) { /* ignore */ }
  }

  function recalc() {
    const chosen = stops.filter(p => state.included.has(p.id));
    state.plan = Route.plan(state.habitat, chosen);
    renderPlan();
    PlanView.update(state, state.plan);
    save();
  }

  function renderPlan() {
    const P = state.plan;
    $('statDist').textContent = Math.round(P.total) + ' m';
    $('statTime').textContent = Route.duration(P.minutes);
    $('statStops').textContent = P.order.length;
    $('overWarning').hidden = P.minutes <= A.suit_reserve_min;
    const items = P.order.map(p => {
      const badge = p.type === 'tube' ? `<span class="badge badge--tube">${p.num}</span>` : `<span class="badge badge--science">${p.label}</span>`;
      const name = p.type === 'tube'
        ? `${p.name}${p.ref.kind !== 'rock core' ? ` <small>(${p.ref.kind})</small>` : ''}`
        : `${p.name} · new sample`;
      return `<li><button type="button" data-goto="${p.id}">${badge}<span>${name}</span><span class="muted">${Math.round(p.leg)} m</span></button></li>`;
    });
    items.push(`<li><div class="stops__back"><span class="badge badge--home">H</span><span>Back to habitat</span><span class="muted">${Math.round(P.back)} m</span></div></li>`);
    const out = stops.filter(p => !state.included.has(p.id));
    if (out.length) items.push(`<li class="stops__out">Not in this route: ${out.map(p => `<button type="button" class="link" data-toggle-list="${p.id}">${p.type === 'tube' ? p.num + ' ' + p.name : p.name}</button>`).join(', ')}</li>`);
    $('stopList').innerHTML = items.join('');

    const pct = Math.round(A.return_margin * 100);
    $('safeDist').textContent = `${Math.round(P.maxFromHome)} m at most. Return rule: the reserve must always be enough to get back with a ${pct}% margin.`;
    $('safeTerrain').textContent = `Flat at the depot: elevation measured by the rover varies ${relief.toFixed(1)} m (${Math.min(...elevs).toFixed(1)} m).`;
    $('safeLight').textContent = `Sunrise ${D.meda.sunrise.slice(0, 5)}, sunset ${D.meda.sunset.slice(0, 5)} (MEDA, sol ${D.meda.sol}).`;

    // Timeline inside the suit reserve
    const total = Math.max(A.suit_reserve_min, P.minutes);
    const segs = P.segments.map(s => {
      const width = Math.max(0.3, s.min / total * 100);
      const txt = s.stop && width > 3 ? (s.stop.type === 'tube' ? s.stop.num : s.stop.label) : '';
      const title = s.stop ? `${s.stop.name}: ${Math.round(s.min)} min` : `Walk ${Math.round(s.min)} min`;
      return `<div class="seg seg--${s.type}" style="width:${width}%" title="${title}">${txt}</div>`;
    });
    const reserve = Math.max(0, A.suit_reserve_min - P.minutes);
    if (reserve > 0) segs.push(`<div class="seg seg--reserve" style="flex:1">reserve ${Route.duration(reserve)}</div>`);
    $('tlBar').innerHTML = segs.join('');
    $('tlBar').classList.toggle('over', P.minutes > A.suit_reserve_min);
    $('tlStart').textContent = `Departure ${A.start_time} LMST`;
    $('tlReturn').textContent = `Estimated return ${Route.addTime(A.start_time, P.minutes)}`;
    $('tlLimit').textContent = `Suit limit ${Route.addTime(A.start_time, A.suit_reserve_min)} (assumed)`;
  }

  /* ---------- adjustable assumptions ---------- */
  const FORMAT = {
    walk_speed_m_s: v => `${v.toFixed(1)} m/s`,
    min_per_tube: v => `${v} min`,
    min_per_sample: v => `${v} min`,
    suit_reserve_min: v => Route.duration(v),
    return_margin: v => `${Math.round(v * 100)} %`,
  };
  const OUTPUT = { walk_speed_m_s: 'outSpeed', min_per_tube: 'outTube', min_per_sample: 'outSample', suit_reserve_min: 'outReserve', return_margin: 'outMargin' };

  function renderAssumptions() {
    document.querySelectorAll('[data-assumption]').forEach(inp => {
      const k = inp.dataset.assumption;
      inp.value = A[k];
      $(OUTPUT[k]).textContent = FORMAT[k](A[k]);
      inp.setAttribute('aria-valuetext', FORMAT[k](A[k]));
    });
    $('btnReset').hidden = KEYS.every(k => A[k] === ORIGINAL[k]);
    $('optReservePlan').textContent = `Same as the plan (${Route.duration(A.suit_reserve_min)})`;
    $('assumptionList').innerHTML = [
      'Habitat location (can be moved on the map).',
      `Walking speed: ${A.walk_speed_m_s.toFixed(1)} m/s.`,
      `Time per tube: ${A.min_per_tube} min; per new sample: ${A.min_per_sample} min.`,
      `Suit reserve: ${Route.duration(A.suit_reserve_min)}; return margin: ${Math.round(A.return_margin * 100)}%.`,
      'Targets A and B: small craters picked from the HiRISE image, off the rover’s traverse.',
    ].map(x => `<li>${x}</li>`).join('');
  }

  function change(c) {
    if (c.habitat) state.habitat = c.habitat;
    if (c.toggle) {
      if (state.included.has(c.toggle)) state.included.delete(c.toggle); else state.included.add(c.toggle);
    }
    recalc();
  }

  function init() {
    $('chipTemp').textContent = `MEDA sol ${D.meda.sol}: ${Math.round(D.meda.min_temp)} / ${Math.round(D.meda.max_temp)} °C`;
    $('chipPressure').textContent = `${Math.round(D.meda.pressure)} Pa`;
    $('chipSunset').textContent = `Sunset ${D.meda.sunset.slice(0, 5)} LMST`;
    renderAssumptions();

    PlanView.init(state, change);
    recalc();
    NavView.bind();

    document.querySelectorAll('[data-assumption]').forEach(inp => inp.addEventListener('input', () => {
      A[inp.dataset.assumption] = Number(inp.value);
      renderAssumptions();
      recalc();
      NavView.refresh();
    }));
    $('btnReset').addEventListener('click', () => {
      KEYS.forEach(k => { A[k] = ORIGINAL[k]; });
      renderAssumptions();
      recalc();
      NavView.refresh();
    });

    $('stopList').addEventListener('click', e => {
      const b = e.target.closest('[data-goto]');
      if (b) PlanView.focus(b.dataset.goto);
      const t = e.target.closest('[data-toggle-list]');
      if (t) change({ toggle: t.dataset.toggleList });
    });
    $('btnSources').addEventListener('click', () => $('dlgSources').showModal());
    $('btnStart').addEventListener('click', () => {
      if (!state.plan.order.length) return;
      $('planView').hidden = true; $('navView').hidden = false;
      NavView.open(state.plan);
    });
    $('btnBack').addEventListener('click', () => {
      NavView.close();
      $('navView').hidden = true; $('planView').hidden = false;
      PlanView.resize();
    });

    // Installable and offline when served over https.
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  window.App = { state, terrain };
  document.addEventListener('DOMContentLoaded', init);
})();
