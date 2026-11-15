/* Operation Three Forks — GPS-style navigation during the walk. */
(function () {
  const D = window.DATA;
  const A = D.assumptions;
  const $ = id => document.getElementById(id);
  const demoReserve = () => Number($('selReserve').value) || A.suit_reserve_min;

  /* Ground images, drawn in meters: context (1.3 m/px) under detail (25 cm). */
  const detailImg = new Image();
  detailImg.src = D.images.hirise;
  detailImg.onload = () => draw();
  const contextImg = new Image();
  contextImg.src = D.images.context;
  contextImg.onload = () => draw();
  const CB = D.images.context_bounds;
  const ctxNW = Geo.toWorld(CB.west, CB.north), ctxSE = Geo.toWorld(CB.east, CB.south);
  function drawGround(x) {
    if (contextImg.complete && contextImg.naturalWidth) x.drawImage(contextImg, ctxNW.e, ctxNW.s, ctxSE.e - ctxNW.e, ctxSE.s - ctxNW.s);
    if (detailImg.complete && detailImg.naturalWidth) x.drawImage(detailImg, 0, 0, Geo.widthM, Geo.heightM);
  }

  const traverseM = D.traverse.map(r => Geo.toWorld(r.lon, r.lat));

  let w = null;            // walk state
  let lastFrame = 0, raf = 0, geoWatch = null;

  /* ---------- state ---------- */
  function newWalk(plan) {
    const home = { e: plan.start.e, s: plan.start.s };
    w = {
      plan, home,
      pos: { ...home },
      heading: plan.order.length ? Geo.bearing(home, plan.order[0]) : 0,
      shownHeading: null,
      idx: 0,
      done: new Set(),
      clock: 0,                    // EVA minutes elapsed
      walked: 0,
      reserve: demoReserve(),
      speedFactor: Number($('selSpeed').value),
      mode: document.querySelector('input[name=mode]:checked').value,
      paused: false,
      zoom: 9,                     // screen px per meter
      returning: false,
      oneMoreOnly: false,
      alertShown: false,
      card: null,                  // 'arrival' | 'preview' | 'end' | 'alert'
      cardStop: null,
      yard: null,
    };
    w.shownHeading = w.heading;
    hideCards();
    $('btnPause').textContent = 'Pause';
    if (w.mode === 'yard') startYard(); else stopYard();
    updatePanels();
  }

  const homeStop = () => ({ ...w.home, type: 'habitat', name: 'Habitat', label: 'H' });
  function target() {
    if (w.returning || w.idx >= w.plan.order.length) return homeStop();
    return w.plan.order[w.idx];
  }
  function afterTarget() {
    if (w.returning) return null;
    if (w.oneMoreOnly) return homeStop();
    if (w.idx + 1 < w.plan.order.length) return w.plan.order[w.idx + 1];
    if (w.idx < w.plan.order.length) return homeStop();
    return null;
  }
  const speed = () => A.walk_speed_m_s;
  const walkMinutes = m => m / speed() / 60;

  function remaining() {
    let d = 0, min = 0, prev = w.pos;
    if (!w.returning) {
      const end = w.oneMoreOnly ? w.idx + 1 : w.plan.order.length;
      for (let i = w.idx; i < end; i++) {
        const p = w.plan.order[i];
        d += Geo.distance(prev, p); min += Route.stopMinutes(p); prev = p;
      }
    }
    d += Geo.distance(prev, w.home);
    return { d, min: min + walkMinutes(d) };
  }

  /* Return rule: minutes left before the astronaut must head home. */
  function returnSlack() {
    const left = w.reserve - w.clock;
    const needed = walkMinutes(Geo.distance(w.pos, w.home)) * (1 + A.return_margin);
    return left - needed;
  }

  /* ---------- loop ---------- */
  function loop(t) {
    const dt = lastFrame ? Math.min((t - lastFrame) / 1000, 0.25) : 0;
    lastFrame = t;
    if (w && !w.paused && !w.card) step(dt);
    if (w) {
      const diff = Geo.angleDiff(w.shownHeading, w.heading);
      w.shownHeading = (w.shownHeading + diff * Math.min(1, dt * 5) + 360) % 360;
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  function step(dt) {
    const dest = target();
    if (w.mode === 'sim') {
      w.clock += dt * w.speedFactor / 60;
      const stride = speed() * w.speedFactor * dt;
      const d = Geo.distance(w.pos, dest);
      if (d > 0.05) w.heading = Geo.bearing(w.pos, dest);
      if (stride >= d) { w.walked += d; w.pos = { e: dest.e, s: dest.s }; arrive(dest); }
      else { w.walked += stride; w.pos = Geo.advance(w.pos, w.heading, stride); }
    } else {
      w.clock += dt / 60;
      if (Geo.distance(w.pos, dest) < 4) arrive(dest);
    }
    checkReturn();
    updatePanels();
  }

  function checkReturn() {
    if (w.returning || w.alertShown || w.card) return;
    if (returnSlack() <= 15) { w.alertShown = true; showAlert(); }
  }

  /* ---------- arrival ---------- */
  function arrive(dest) {
    if (dest.type === 'habitat') return showEnd();
    showStop(dest, 'arrival');
  }

  const cell = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  const check = txt => `<li><label><input type="checkbox"><span>${txt}</span></label></li>`;

  function showStop(p, mode) {
    w.card = mode; w.cardStop = p;
    setMedia(p, 'sat');
    $('arrBadge').textContent = mode === 'arrival' ? 'You’ve arrived' : 'Your next stop';
    if (p.type === 'tube') {
      const t = p.ref;
      $('arrTitle').textContent = `Tube ${t.num} · ${t.name}`;
      $('arrHint').textContent = `Look for a shiny metal tube the size of a marker pen, pointing ${t.azimuth}° (${Geo.compassPoint(t.azimuth)}). The white line on the satellite view shows its direction; the rover photo shows the tube on the ground.`;
      $('arrData').innerHTML = cell('Designation', t.designation) + cell('Contents', t.kind) +
        cell('Collected / deposited', `sol ${t.sol_collected} / sol ${t.sol_deposited}`) +
        cell('Rover when dropped', `${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}`);
      $('arrSteps').innerHTML = check('Photo of the tube in place') + check('Pick it up with the tongs, without touching the tip') + check(`Store it in case ${t.num}`);
      $('arrScience').innerHTML = '<b>New science here</b><span>Take soil 1 m from the tube: each tube reaches Earth with its context.</span>';
      $('arrDone').textContent = `Tube ${t.num} collected`;
    } else {
      $('arrTitle').textContent = `${p.name} · new science`;
      $('arrHint').textContent = 'Small crater visible in HiRISE, in an area the rover never visited.';
      $('arrData').innerHTML = cell('Position', `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`) + cell('Status', 'Unvisited');
      $('arrSteps').innerHTML = check('Panoramic photo of the crater') + check('Soil sample from the rim') + check('Note color and texture in the logbook');
      $('arrScience').innerHTML = '<b>Why it matters</b><span>No instrument has ever touched this spot.</span>';
      $('arrDone').textContent = `${p.name} sampled`;
    }
    $('arrDone').hidden = mode !== 'arrival';
    $('arrClose').textContent = mode === 'arrival' ? 'View map' : 'Keep walking';
    $('arrival').hidden = false;
    $('arrDone').focus({ preventScroll: true });
  }

  /* ---------- images of each stop ---------- */
  let mediaStop = null, mediaView = 'sat';
  /* Real photo for a stop: the tube's own Front Hazcam frame, or the final
     Mastcam-Z panorama at the habitat. Science targets have none. */
  function photoFor(p) {
    if (p.type === 'habitat') return { src: D.images.final_panorama.src, caption: D.images.final_panorama.caption, alt: 'Mastcam-Z panorama of the Three Forks depot' };
    if (p.type === 'tube' && p.ref.photo) {
      return { src: p.ref.photo.src, caption: `Front Hazcam, sol ${p.ref.photo.sol} · tube ${p.ref.num} on the ground`, alt: `Perseverance Front Hazcam photo of tube ${p.ref.num}, ${p.ref.name}, lying on the ground` };
    }
    return null;
  }
  function setMedia(p, view) {
    mediaStop = p;
    const photo = photoFor(p);
    const tab = $('tabRover');
    tab.disabled = !photo;
    tab.textContent = photo ? 'Rover photo' : 'No rover photo';
    tab.title = photo ? '' : 'The rover was never here: that is why it is new science';
    showMedia(photo ? view : 'sat');
  }
  function showMedia(view) {
    mediaView = view;
    const p = mediaStop, photo = photoFor(p);
    const sat = view === 'sat' || !photo;
    $('tabSat').setAttribute('aria-pressed', String(sat));
    $('tabRover').setAttribute('aria-pressed', String(!sat));
    $('arrSat').hidden = !sat; $('arrPhoto').hidden = sat;
    $('arrival').classList.toggle('arrival--photo', !sat);
    if (sat) {
      drawSatellite(p);
      $('arrCredit').textContent = 'HiRISE 25 cm · 40 m across · north up';
    } else {
      if (!$('arrPhoto').src.endsWith(photo.src)) $('arrPhoto').src = photo.src;
      $('arrPhoto').alt = photo.alt;
      $('arrCredit').textContent = photo.caption;
    }
  }
  function drawSatellite(p) {
    const c = $('arrSat'), x = c.getContext('2d');
    const k = c.width / 40;                      // 40 m across
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#0B0908'; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, c.width / 2 - p.e * k, c.height / 2 - p.s * k);
    drawGround(x);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2 / k; x.setLineDash([2 / k, 7 / k]); polyline(x, traverseM); x.setLineDash([]);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const cx = c.width / 2, cy = c.height / 2;
    // other tubes nearby
    D.tubes.forEach(t => {
      const m = Geo.toWorld(t.lon, t.lat); const sx = cx + (m.e - p.e) * k, sy = cy + (m.s - p.s) * k;
      if (p.type === 'tube' && t.num === p.num) return;
      if (sx < 0 || sy < 0 || sx > c.width || sy > c.height) return;
      x.fillStyle = 'rgba(242,169,59,.8)'; x.strokeStyle = '#2A1A05'; x.lineWidth = 2;
      x.beginPath(); x.arc(sx, sy, 11, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#2A1A05'; x.font = '700 12px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.num, sx, sy + 0.5);
    });
    if (p.type === 'tube') {
      // tube orientation (PDS azimuth), exaggerated so it can be seen
      const r = p.ref.azimuth * Math.PI / 180, half = 26;
      x.strokeStyle = '#FFFFFF'; x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - Math.sin(r) * half, cy + Math.cos(r) * half); x.lineTo(cx + Math.sin(r) * half, cy - Math.cos(r) * half); x.stroke();
      x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(cx + Math.sin(r) * half, cy - Math.cos(r) * half, 5, 0, 7); x.fill();
    }
    x.strokeStyle = p.type === 'science' ? '#B9E58A' : p.type === 'habitat' ? '#F2E6D8' : '#F2A93B';
    x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 44, 0, 7); x.stroke();
    // 5 m scale bar (bottom right)
    const by = c.height - 30, bx1 = c.width - 24, bx0 = bx1 - 5 * k;
    x.fillStyle = 'rgba(21,17,14,.85)'; x.beginPath(); x.roundRect(bx0 - 14, by - 34, 5 * k + 28, 48, 8); x.fill();
    x.strokeStyle = '#F2E6D8'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(bx0, by - 8); x.lineTo(bx0, by); x.lineTo(bx1, by); x.lineTo(bx1, by - 8); x.stroke();
    x.fillStyle = '#F2E6D8'; x.font = '600 16px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillText('5 m', (bx0 + bx1) / 2, by - 12);
  }

  function completeStop() {
    const p = target();
    w.done.add(p.id);
    w.clock += Route.stopMinutes(p);
    w.idx++;
    if (w.oneMoreOnly) { w.returning = true; w.oneMoreOnly = false; }
    closeCard();
    checkReturn();
  }

  function showEnd() {
    const tubes = [...w.done].filter(id => id[0] === 'T').length;
    const samples = [...w.done].filter(id => id[0] === 'C').length;
    setMedia(homeStop(), 'rover');
    w.card = 'end';
    $('arrBadge').textContent = 'Back at the habitat';
    $('arrTitle').textContent = 'Walk complete';
    $('arrHint').textContent = tubes === D.tubes.length ? 'All 10 Three Forks tubes are safe.' : 'You got back in time. The remaining tubes are left for the next walk.';
    $('arrData').innerHTML = cell('Tubes', `${tubes} of ${D.tubes.length}`) + cell('New samples', samples) +
      cell('Distance walked', Math.round(w.walked) + ' m') + cell('Duration', Route.duration(w.clock));
    $('arrSteps').innerHTML = '';
    $('arrScience').innerHTML = '<b>Next step</b><span>Tubes and new samples travel together: each human sample has its rover tube as a reference.</span>';
    $('arrDone').hidden = true;
    $('arrClose').textContent = 'Close';
    $('arrival').hidden = false;
    w.paused = true;
  }

  function closeCard() {
    $('arrival').hidden = true; $('alert').hidden = true;
    w.card = null;
    updatePanels();
  }
  function hideCards() { $('arrival').hidden = true; $('alert').hidden = true; }

  /* ---------- return alert ---------- */
  function showAlert() {
    w.card = 'alert';
    const m = Math.max(0, Math.floor(returnSlack()));
    const home = Geo.distance(w.pos, w.home);
    const pct = Math.round(A.return_margin * 100);
    $('alertTitle').textContent = m > 0 ? `Head back in ${m} min` : 'Head back now';
    $('alertText').textContent = `At today’s pace, in ${m} minutes your suit reserve will be just enough to return to the habitat (${Math.round(home)} m, ${Math.ceil(walkMinutes(home))} min) with a ${pct}% margin.`;
    $('alertNote').textContent = `* Suit consumables are simulated. The return rule uses the real distance to the habitat and a ${pct}% margin.`;
    const next = w.idx < w.plan.order.length ? w.plan.order[w.idx] : null;
    const b = $('alertContinue');
    if (next) {
      const extraM = Geo.distance(w.pos, next) + Geo.distance(next, w.home) - home;
      const extraMin = walkMinutes(extraM) + Route.stopMinutes(next);
      const fits = m - extraMin * (1 + A.return_margin) > 0;
      const name = next.type === 'tube' ? `Tube ${next.num}` : next.name;
      b.textContent = fits ? `Go to ${name} first (+${Math.round(extraM)} m, +${Math.round(extraMin)} min) and return` : `Not enough reserve to go to ${name}`;
      b.disabled = !fits; b.hidden = false;
    } else b.hidden = true;
    $('alert').hidden = false;
    drawAlertMap();
  }

  function drawAlertMap() {
    const c = $('alertMap'), x = c.getContext('2d');
    const a = w.pos, b = w.home;
    const k = Math.max(c.width / (ctxSE.e - ctxNW.e), Math.min(c.width / (Math.abs(a.e - b.e) + 30), c.height / (Math.abs(a.s - b.s) + 30)));
    const clamp = (v, side, min, max) => Math.min(Math.max(v, min + side / 2 / k), max - side / 2 / k);
    const ce = clamp((a.e + b.e) / 2, c.width, ctxNW.e, ctxSE.e), cs = clamp((a.s + b.s) / 2, c.height, ctxNW.s, ctxSE.s);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, c.width / 2 - ce * k, c.height / 2 - cs * k);
    drawGround(x);
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(14,52,64,.75)'; x.lineWidth = 14 / k; polyline(x, [a, b]);
    x.strokeStyle = '#7FD3EE'; x.lineWidth = 6 / k; x.setLineDash([14 / k, 10 / k]); polyline(x, [a, b]); x.setLineDash([]);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const pa = { x: c.width / 2 + (a.e - ce) * k, y: c.height / 2 + (a.s - cs) * k };
    const pb = { x: c.width / 2 + (b.e - ce) * k, y: c.height / 2 + (b.s - cs) * k };
    house(x, pb.x, pb.y, 26);
    x.fillStyle = '#7FD3EE'; x.strokeStyle = '#fff'; x.lineWidth = 5;
    x.beginPath(); x.arc(pa.x, pa.y, 13, 0, 7); x.fill(); x.stroke();
  }

  /* ---------- backyard mode (real GPS) ---------- */
  function startYard() {
    const status = $('yardStatus');
    if (!('geolocation' in navigator)) { status.textContent = 'This browser has no GPS.'; return; }
    if (!window.isSecureContext) { status.textContent = 'GPS only works when the app is opened from an https link (for example, GitHub Pages).'; return; }
    status.textContent = 'Looking for GPS signal… go outdoors.';
    w.yard = { earthOrigin: null, marsOrigin: { ...w.pos }, lastFix: null };
    geoWatch = navigator.geolocation.watchPosition(p => {
      const { latitude: la, longitude: lo, accuracy } = p.coords;
      if (!w.yard.earthOrigin) w.yard.earthOrigin = { la, lo };
      const o = w.yard.earthOrigin;
      const dE = (lo - o.lo) * 111320 * Math.cos(o.la * Math.PI / 180);
      const dN = (la - o.la) * 110540;
      const pos = { e: w.yard.marsOrigin.e + dE, s: w.yard.marsOrigin.s - dN };
      w.walked += Geo.distance(w.pos, pos);
      w.pos = pos;
      const last = w.yard.lastFix;
      if (!last) w.yard.lastFix = { ...pos };
      else if (Geo.distance(last, pos) >= 1.5) { w.heading = Geo.bearing(last, pos); w.yard.lastFix = { ...pos }; }
      status.textContent = `GPS on · accuracy ±${Math.round(accuracy)} m. Every meter in the yard is a meter in Jezero.`;
    }, err => { status.textContent = 'Could not use GPS: ' + err.message; }, { enableHighAccuracy: true, maximumAge: 1000 });
  }
  function stopYard() {
    if (geoWatch !== null) navigator.geolocation.clearWatch(geoWatch);
    geoWatch = null;
    $('yardStatus').textContent = '';
  }

  /* ---------- panels ---------- */
  function side(rel) {
    const a = Math.abs(rel);
    if (a < 30) return 'ahead';
    if (a > 150) return 'behind';
    return rel > 0 ? 'on your right' : 'on your left';
  }
  function turn(diff) {
    if (Math.abs(diff) < 25) return { txt: 'go straight', icon: 'straight' };
    if (Math.abs(diff) > 140) return { txt: 'turn around', icon: 'uturn' };
    return diff > 0 ? { txt: 'turn right', icon: 'right' } : { txt: 'turn left', icon: 'left' };
  }
  function stopName(p) {
    if (p.type === 'tube') return `Tube ${p.num} · ${p.name}`;
    if (p.type === 'science') return `${p.name} · new science`;
    return 'Habitat';
  }

  const ICONS = {
    straight: '<path d="M26 44 V10 M14 22 L26 10 L38 22"/>',
    right: '<path d="M18 44 V24 Q18 16 26 16 H40 M32 8 L40 16 L32 24"/>',
    left: '<path d="M34 44 V24 Q34 16 26 16 H12 M20 8 L12 16 L20 24"/>',
    uturn: '<path d="M18 44 V20 Q18 10 27 10 Q36 10 36 20 V30 M28 24 L36 32 L44 24"/>',
    home: '<path d="M10 26 L26 10 L42 26 M15 22 V42 H37 V22"/>',
  };

  function updatePanels() {
    if (!w) return;
    const dest = target();
    const d = Geo.distance(w.pos, dest);
    const g = w.mode === 'sim' || d < 3 ? { icon: 'straight' } : turn(Geo.angleDiff(w.heading, Geo.bearing(w.pos, dest)));
    $('turnIcon').innerHTML = ICONS[dest.type === 'habitat' ? 'home' : g.icon];
    $('insDist').textContent = d < 10 ? d.toFixed(1) + ' m' : Math.round(d) + ' m';
    $('insDest').textContent = w.returning ? 'Straight back to habitat' : stopName(dest);
    const then = afterTarget();
    if (then && dest.type !== 'habitat') {
      const diff = Geo.angleDiff(Geo.bearing(w.pos, dest), Geo.bearing(dest, then));
      $('insThen').textContent = `Then ${turn(diff).txt}: ${then.type === 'habitat' ? 'habitat' : then.name} in ${Math.round(Geo.distance(dest, then))} m`;
      $('insThen').hidden = false;
    } else $('insThen').hidden = true;
    $('instruction').classList.toggle('instruction--return', w.returning);

    // Nearby: what is around, relative to the walking direction
    const things = [];
    w.plan.order.forEach(p => { if (p !== dest) things.push({ p, name: p.type === 'tube' ? `Tube ${p.num}` : p.name, done: w.done.has(p.id) }); });
    if (dest.type !== 'habitat') things.push({ p: w.home, name: 'Habitat' });
    const close = things.map(c => ({ ...c, d: Geo.distance(w.pos, c.p) })).filter(c => c.d < 35 && c.d > 1).sort((a, b) => a.d - b.d).slice(0, 2);
    const chips = close.map(c => `<span class="chip chip--float">${c.name}${c.done ? ' ✓' : ''} · ${Math.round(c.d)} m ${side(Geo.angleDiff(w.heading, Geo.bearing(w.pos, c.p)))}</span>`);
    let tracks = Infinity;
    traverseM.forEach((r, i) => { if (i) tracks = Math.min(tracks, segmentDistance(w.pos, traverseM[i - 1], r)); });
    if (tracks < 6) chips.push('<span class="chip chip--float">Rover tracks nearby</span>');
    chips.unshift(`<span class="chip chip--float">${window.App.terrain}</span>`);
    $('nearby').innerHTML = chips.join('');

    const rest = remaining();
    $('sheetEta').textContent = Route.addTime(A.start_time, w.clock + rest.min);
    $('sheetHome').textContent = `${Math.round(Geo.distance(w.pos, w.home))} m from home`;
    const totalTubes = w.plan.order.filter(p => p.type === 'tube').length;
    const totalSci = w.plan.order.filter(p => p.type === 'science').length;
    $('sheetTubes').textContent = `${[...w.done].filter(i => i[0] === 'T').length}/${totalTubes}`;
    $('sheetSamples').textContent = `${[...w.done].filter(i => i[0] === 'C').length}/${totalSci}`;
    const o2 = Math.max(0, 1 - w.clock / w.reserve);
    $('sheetO2').textContent = Math.round(o2 * 100) + ' %';
    $('sheetO2').classList.toggle('low', returnSlack() <= 15);
    $('sheetClock').textContent = Route.addTime(A.start_time, w.clock);
  }

  function segmentDistance(p, a, b) {
    const dx = b.e - a.e, dy = b.s - a.s, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.e - a.e) * dx + (p.s - a.s) * dy) / l2)) : 0;
    return Math.hypot(p.e - (a.e + t * dx), p.s - (a.s + t * dy));
  }

  /* ---------- heading-up map ---------- */
  function polyline(x, pts) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p.e, p.s) : x.moveTo(p.e, p.s)); x.stroke(); }
  function house(x, cx, cy, size) {
    x.fillStyle = '#F2E6D8'; x.strokeStyle = '#15110E'; x.lineWidth = 3;
    x.beginPath(); x.roundRect(cx - size / 2, cy - size / 2, size, size, 6); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(cx - size * 0.3, cy); x.lineTo(cx, cy - size * 0.28); x.lineTo(cx + size * 0.3, cy);
    x.moveTo(cx - size * 0.2, cy - 0.05 * size); x.lineTo(cx - size * 0.2, cy + size * 0.28); x.lineTo(cx + size * 0.2, cy + size * 0.28); x.lineTo(cx + size * 0.2, cy - 0.05 * size);
    x.lineWidth = 2.2; x.stroke();
  }

  function draw() {
    const c = $('navCanvas');
    if (!w || !c || $('navView').hidden) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = c.clientWidth, ch = c.clientHeight;
    if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
    const x = c.getContext('2d');
    const cx = cw / 2, cy = ch * 0.6, k = w.zoom;
    const th = -w.shownHeading * Math.PI / 180;
    const cos = Math.cos(th), sin = Math.sin(th);
    const toScreen = p => {
      const dx = (p.e - w.pos.e) * k, dy = (p.s - w.pos.s) * k;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    };

    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#0B0908'; x.fillRect(0, 0, cw, ch);
    x.save();
    x.translate(cx, cy); x.rotate(th); x.scale(k, k); x.translate(-w.pos.e, -w.pos.s);
    drawGround(x);
    x.lineCap = 'round'; x.lineJoin = 'round';
    // rover traverse
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2 / k; x.setLineDash([2 / k, 7 / k]); polyline(x, traverseM); x.setLineDash([]);
    // full route, faint
    x.strokeStyle = 'rgba(127,211,238,.28)'; x.lineWidth = 3 / k; polyline(x, [w.home].concat(w.plan.order, [w.home]));
    // what is left
    const left = [w.pos];
    if (!w.returning) { const end = w.oneMoreOnly ? w.idx + 1 : w.plan.order.length; for (let i = w.idx; i < end; i++) left.push(w.plan.order[i]); }
    left.push(w.home);
    x.strokeStyle = 'rgba(14,52,64,.8)'; x.lineWidth = 9 / k; polyline(x, left);
    x.strokeStyle = '#7FD3EE'; x.lineWidth = 4.5 / k; polyline(x, left);
    x.restore();

    // markers, always upright
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dest = target();
    w.plan.order.forEach(p => {
      const s = toScreen(p), done = w.done.has(p.id), isDest = p === dest;
      if (s.x < -40 || s.y < -40 || s.x > cw + 40 || s.y > ch + 40) return;
      if (p.type === 'tube') {
        x.fillStyle = done ? '#6B625B' : '#F2A93B';
        x.strokeStyle = isDest ? '#FFFFFF' : '#2A1A05'; x.lineWidth = isDest ? 3 : 2;
        x.beginPath(); x.arc(s.x, s.y, isDest ? 13 : 10, 0, 7); x.fill(); x.stroke();
        x.fillStyle = done ? '#F2E6D8' : '#2A1A05'; x.font = '700 11px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(done ? '✓' : String(p.num), s.x, s.y + 0.5);
      } else {
        x.strokeStyle = done ? '#6B625B' : '#B9E58A'; x.lineWidth = 3;
        x.beginPath(); x.arc(s.x, s.y, 18, 0, 7); x.stroke();
        x.fillStyle = done ? '#9A8F86' : '#B9E58A'; x.font = '700 13px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(p.label, s.x, s.y);
      }
      if (isDest || (!done && p.type === 'science')) tag(x, s.x + 16, s.y - 16, p.type === 'tube' ? `${p.num} · ${p.name}` : p.name, isDest);
    });
    const sh = toScreen(w.home);
    house(x, sh.x, sh.y, 30);
    // astronaut
    x.save(); x.translate(cx, cy);
    x.fillStyle = 'rgba(127,211,238,.18)'; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill();
    x.fillStyle = '#7FD3EE'; x.strokeStyle = '#FFFFFF'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, -18); x.lineTo(14, 16); x.lineTo(0, 9); x.lineTo(-14, 16); x.closePath(); x.fill(); x.stroke();
    x.restore();
    // compass
    x.save(); x.translate(cw - 34, 250); x.rotate(th);
    x.fillStyle = 'rgba(21,17,14,.85)'; x.beginPath(); x.arc(0, 0, 20, 0, 7); x.fill();
    x.fillStyle = '#FF8A65'; x.beginPath(); x.moveTo(0, -15); x.lineTo(5, -3); x.lineTo(-5, -3); x.fill();
    x.fillStyle = '#F2E6D8'; x.font = '700 11px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', 0, 6);
    x.restore();
  }

  function tag(x, px, py, txt, strong) {
    x.font = (strong ? '600 13px' : '500 12px') + ' Barlow, sans-serif';
    const width = x.measureText(txt).width + 14;
    x.fillStyle = 'rgba(21,17,14,.88)';
    x.beginPath(); x.roundRect(px, py - 11, width, 22, 6); x.fill();
    x.fillStyle = '#F2E6D8'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(txt, px + 7, py);
  }

  /* ---------- controls ---------- */
  function bind() {
    $('btnPause').addEventListener('click', () => {
      w.paused = !w.paused;
      $('btnPause').textContent = w.paused ? 'Resume' : 'Pause';
    });
    $('btnPhoto').addEventListener('click', () => { const d = target(); if (d.type !== 'habitat') showStop(d, 'preview'); });
    $('arrDone').addEventListener('click', completeStop);
    $('tabSat').addEventListener('click', () => showMedia('sat'));
    $('tabRover').addEventListener('click', () => showMedia('rover'));
    $('arrClose').addEventListener('click', () => {
      if (w.card === 'arrival') { $('arrival').hidden = true; w.paused = true; w.card = null; $('btnPause').textContent = 'Resume'; }
      else closeCard();
    });
    $('alertReturn').addEventListener('click', () => { w.returning = true; w.oneMoreOnly = false; closeCard(); });
    $('alertContinue').addEventListener('click', () => { w.oneMoreOnly = true; closeCard(); });
    $('zoomIn').addEventListener('click', () => { w.zoom = Math.min(30, w.zoom * 1.4); });
    $('zoomOut').addEventListener('click', () => { w.zoom = Math.max(1.5, w.zoom / 1.4); });
    $('selSpeed').addEventListener('change', e => { w.speedFactor = Number(e.target.value); });
    $('selReserve').addEventListener('change', () => { w.reserve = demoReserve(); w.alertShown = false; updatePanels(); });
    document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', e => {
      w.mode = e.target.value;
      if (w.mode === 'yard') startYard(); else stopYard();
    }));
    $('btnRestart').addEventListener('click', () => newWalk(w.plan));
    window.addEventListener('resize', draw);
  }
  function open(plan) {
    newWalk(plan);
    if (!raf) { lastFrame = 0; raf = requestAnimationFrame(loop); }
  }
  function close() {
    stopYard();
    cancelAnimationFrame(raf); raf = 0;
  }
  /* After the assumptions change, refresh what is on screen. */
  function refresh() {
    if (!w) return;
    w.reserve = demoReserve();
    if (w.card === 'alert') showAlert();
    updatePanels();
  }

  window.NavView = { open, close, bind, refresh, state: () => w };
})();
