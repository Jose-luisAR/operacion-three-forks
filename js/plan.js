/* Operation Three Forks — planning view (Leaflet on top of HiRISE). */
(function () {
  const D = window.DATA;
  const B = D.bounds;
  let map, layers = {}, markers = {}, habitatMarker, onChange;

  /* Leaflet uses [y, x] in a simple pixel frame; y grows upward, so flip it. */
  const ll = (lon, lat) => { const p = Geo.toPx(lon, lat); return [-p.y, p.x]; };

  function tubeIcon(p, included) {
    return L.divIcon({ className: '', html: `<span class="mk-tube ${included ? '' : 'mk-off'}">${p.label}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
  }
  function scienceIcon(p, included) {
    return L.divIcon({ className: '', html: `<span class="mk-science ${included ? '' : 'mk-off'}"><i>${p.label}</i><em>${p.name}<span class="mk-long"> · unvisited</span></em></span>`, iconSize: [40, 40], iconAnchor: [20, 20] });
  }
  const habitatIcon = L.divIcon({
    className: '',
    html: '<span class="mk-habitat"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 12 L12 4 L20 12 M7 10 V20 H17 V10" fill="none" stroke="#15110E" stroke-width="2.4" stroke-linejoin="round"/></svg></span><span class="mk-habitat__label">Habitat (assumed)</span>',
    iconSize: [36, 36], iconAnchor: [18, 18],
  });

  function stopPopup(p, included) {
    const toggle = `<button type="button" class="btn btn--outline btn--small" data-toggle="${p.id}">${included ? 'Remove from route' : 'Add to route'}</button>`;
    if (p.type === 'tube') {
      const t = p.ref;
      return `<div class="pop"><b>Tube ${t.num} · ${t.name}</b>
        <span>${t.designation} · ${t.kind}</span>
        <span>Collected on sol ${t.sol_collected} · deposited on sol ${t.sol_deposited}</span>
        <span>Tube azimuth ${t.azimuth}° · elevation ${t.elev_m.toFixed(1)} m</span>${toggle}</div>`;
    }
    return `<div class="pop"><b>${p.name} · new science</b>
      <span>Small crater visible in HiRISE, off the rover’s traverse.</span>
      <span>Soil sample from the rim and a photo of the crater interior.</span>${toggle}</div>`;
  }

  function init(state, changeHandler) {
    onChange = changeHandler;
    map = L.map('map', {
      crs: L.CRS.Simple, minZoom: -3, maxZoom: 3, zoomSnap: 0.25, zoomDelta: 0.5,
      attributionControl: true, zoomControl: false,
    });
    const detail = [[-B.height_px, 0], [0, B.width_px]];
    const C = D.images.context_bounds;
    const nw = Geo.toPx(C.west, C.north), se = Geo.toPx(C.east, C.south);
    const context = [[-se.y, nw.x], [-nw.y, se.x]];
    L.imageOverlay(D.images.context, context, { attribution: 'HiRISE: NASA/JPL/UArizona · Mars Trek' }).addTo(map);
    L.imageOverlay(D.images.hirise, detail).addTo(map);
    map.setMaxBounds(context);
    map.options.maxBoundsViscosity = 1;
    const fitMinZoom = () => map.setMinZoom(Math.ceil(map.getBoundsZoom(context, true) * 4) / 4);
    fitMinZoom();
    map.on('resize', fitMinZoom);
    map.fitBounds([[-920, 760], [-300, 1440]]);
    L.control.zoom({ position: 'topright' }).addTo(map);

    layers.rover = L.layerGroup().addTo(map);
    L.polyline(D.traverse.map(r => ll(r.lon, r.lat)), { color: '#FFFFFF', opacity: 0.6, weight: 2, dashArray: '2 7', lineCap: 'round', interactive: false })
      .addTo(layers.rover);
    layers.route = L.layerGroup().addTo(map);
    layers.reach = L.layerGroup();
    layers.tubes = L.layerGroup().addTo(map);
    layers.science = L.layerGroup().addTo(map);

    state.stops.forEach(p => {
      const m = L.marker(ll(p.lon, p.lat), { icon: p.type === 'tube' ? tubeIcon(p, true) : scienceIcon(p, true), keyboard: true, title: p.name, riseOnHover: true });
      m.bindPopup('', { maxWidth: 260 });
      m.on('popupopen', () => m.setPopupContent(stopPopup(p, state.included.has(p.id))));
      markers[p.id] = m;
      m.addTo(p.type === 'tube' ? layers.tubes : layers.science);
    });

    habitatMarker = L.marker(ll(state.habitat.lon, state.habitat.lat), { icon: habitatIcon, draggable: true, title: 'Habitat: drag it to change the starting point', zIndexOffset: 1000 }).addTo(map);
    habitatMarker.on('dragend', () => {
      const p = habitatMarker.getLatLng();
      const x = Math.min(Math.max(p.lng, nw.x), se.x), y = Math.min(Math.max(-p.lat, nw.y), se.y);
      onChange({ habitat: Geo.pxToLonLat(x, y) });
    });

    map.getContainer().addEventListener('click', e => {
      const b = e.target.closest('[data-toggle]');
      if (b) { onChange({ toggle: b.dataset.toggle }); map.closePopup(); }
    });

    scaleBar().addTo(map);
    const north = L.control({ position: 'topright' });
    north.onAdd = () => { const d = L.DomUtil.create('div', 'north'); d.textContent = 'N'; d.title = 'North is up'; return d; };
    north.addTo(map);

    document.querySelectorAll('[data-layer]').forEach(c => c.addEventListener('change', () => {
      const g = layers[c.dataset.layer];
      if (c.checked) g.addTo(map); else map.removeLayer(g);
    }));
  }

  /* Scale bar in meters that follows the zoom level. */
  function scaleBar() {
    const c = L.control({ position: 'bottomleft' });
    c.onAdd = () => {
      const d = L.DomUtil.create('div', 'scale');
      const update = () => {
        const pxPerM = Math.pow(2, map.getZoom()) / ((Geo.mPerPxX + Geo.mPerPxY) / 2);
        const m = [5, 10, 20, 50, 100].find(o => o * pxPerM >= 70) || 100;
        d.innerHTML = `<div style="width:${Math.round(m * pxPerM)}px"></div><span>${m} m</span>`;
      };
      map.on('zoomend', update); update();
      return d;
    };
    return c;
  }

  function update(state, plan) {
    state.stops.forEach(p => {
      const inc = state.included.has(p.id);
      markers[p.id].setIcon(p.type === 'tube' ? tubeIcon(p, inc) : scienceIcon(p, inc));
    });
    layers.route.clearLayers();
    const pts = [plan.start].concat(plan.order, [plan.start]).map(p => ll(p.lon, p.lat));
    L.polyline(pts, { color: '#0E3440', weight: 9, opacity: 0.7, lineJoin: 'round', interactive: false }).addTo(layers.route);
    L.polyline(pts, { color: '#7FD3EE', weight: 4, lineJoin: 'round', interactive: false }).addTo(layers.route);
    layers.reach.clearLayers();
    const r = plan.maxFromHome / ((Geo.mPerPxX + Geo.mPerPxY) / 2);
    L.circle(ll(plan.start.lon, plan.start.lat), { radius: r, color: '#F2A93B', weight: 2, dashArray: '6 6', fill: false, interactive: false }).addTo(layers.reach);
    habitatMarker.setLatLng(ll(state.habitat.lon, state.habitat.lat));
  }

  function focus(id) {
    const m = markers[id];
    if (!m) return;
    map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 1), { duration: 0.6 });
    m.openPopup();
  }

  function resize() { if (map) map.invalidateSize(); }

  window.PlanView = { init, update, focus, resize };
})();
