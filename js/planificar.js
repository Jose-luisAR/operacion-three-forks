/* Operación Three Forks — vista de planificación (Leaflet sobre HiRISE). */
(function () {
  const D = window.DATOS;
  const L_ = D.limites;
  let mapa, capas = {}, marcadores = {}, marcadorHabitat, alCambiar, zoomCtl, nodoNorte;

  const ll = (lon, lat) => { const p = Geo.aPx(lon, lat); return [-p.y, p.x]; };

  function iconoTubo(p, incluida, siguiente) {
    const cls = ['mk-tubo', incluida ? '' : 'mk-fuera', siguiente ? 'mk-sig' : ''].join(' ');
    return L.divIcon({ className: '', html: `<span class="${cls}">${p.etiqueta}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
  }
  function iconoCiencia(p, incluida) {
    return L.divIcon({ className: '', html: `<span class="mk-ciencia ${incluida ? '' : 'mk-fuera'}"><i>${p.etiqueta}</i><em>${p.nombre}<span class="mk-largo"> · ${I18N.t('mk.sinVisitar')}</span></em></span>`, iconSize: [40, 40], iconAnchor: [20, 20] });
  }
  const iconoHabitat = () => L.divIcon({
    className: '',
    html: `<span class="mk-habitat"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 12 L12 4 L20 12 M7 10 V20 H17 V10" fill="none" stroke="#15110E" stroke-width="2.4" stroke-linejoin="round"/></svg></span><span class="mk-habitat__txt">${I18N.t('mk.habitat')}</span>`,
    iconSize: [36, 36], iconAnchor: [18, 18],
  });

  function popupParada(p, incluida) {
    if (p.tipo === 'tubo') {
      const t = p.ref;
      return `<div class="pop"><b>${I18N.t('pop.tubo', { n: t.num, nombre: t.nombre })}</b>
        <span>${t.designacion} · ${I18N.t('tipo.' + t.tipo)}</span>
        <span>${I18N.t('pop.soles', { a: t.sol_toma, b: t.sol_deposito })}</span>
        <span>${I18N.t('pop.azimut', { az: t.azimut, el: t.elev_m.toFixed(1) })}</span>
        <button type="button" class="btn btn--linea btn--chico" data-alternar="${p.id}">${I18N.t(incluida ? 'pop.quitar' : 'pop.agregar')}</button></div>`;
    }
    return `<div class="pop"><b>${I18N.t('pop.ciencia', { n: p.nombre })}</b>
      <span>${I18N.t('pop.cienciaDesc')}</span>
      <span>${I18N.t('crater.tarea')}.</span>
      <button type="button" class="btn btn--linea btn--chico" data-alternar="${p.id}">${I18N.t(incluida ? 'pop.quitar' : 'pop.agregar')}</button></div>`;
  }

  function iniciar(estado, onCambio) {
    alCambiar = onCambio;
    mapa = L.map('mapa', {
      crs: L.CRS.Simple, minZoom: -3, maxZoom: 3, zoomSnap: 0.25, zoomDelta: 0.5,
      attributionControl: true, zoomControl: false,
    });
    const limites = [[-L_.alto_px, 0], [0, L_.ancho_px]];
    const C = D.imagenes.contexto_limites;
    const no = Geo.aPx(C.oeste, C.norte), se = Geo.aPx(C.este, C.sur);
    const limCtx = [[-se.y, no.x], [-no.y, se.x]];
    L.imageOverlay(D.imagenes.contexto, limCtx, { attribution: 'HiRISE: NASA/JPL/UArizona · Mars Trek' }).addTo(mapa);
    L.imageOverlay(D.imagenes.hirise, limites).addTo(mapa);
    mapa.setMaxBounds(limCtx);
    mapa.options.maxBoundsViscosity = 1;
    const ajustarMin = () => mapa.setMinZoom(Math.ceil(mapa.getBoundsZoom(limCtx, true) * 4) / 4);
    ajustarMin();
    mapa.on('resize', ajustarMin);
    mapa.fitBounds([[-920, 760], [-300, 1440]]);
    zoomCtl = L.control.zoom({ position: 'topright', zoomInTitle: I18N.t('mapa.acercar'), zoomOutTitle: I18N.t('mapa.alejar') }).addTo(mapa);

    capas.rover = L.layerGroup().addTo(mapa);
    L.polyline(D.recorrido.map(r => ll(r.lon, r.lat)), { color: '#FFFFFF', opacity: 0.6, weight: 2, dashArray: '2 7', lineCap: 'round', interactive: false })
      .addTo(capas.rover);
    capas.ruta = L.layerGroup().addTo(mapa);
    capas.alcance = L.layerGroup();
    capas.tubos = L.layerGroup().addTo(mapa);
    capas.ciencia = L.layerGroup().addTo(mapa);

    estado.paradas.forEach(p => {
      const m = L.marker(ll(p.lon, p.lat), { icon: p.tipo === 'tubo' ? iconoTubo(p, true, false) : iconoCiencia(p, true), keyboard: true, title: p.nombre, riseOnHover: true });
      m.bindPopup('', { maxWidth: 260 });
      m.on('popupopen', () => m.setPopupContent(popupParada(p, estado.incluidas.has(p.id))));
      marcadores[p.id] = m;
      m.addTo(p.tipo === 'tubo' ? capas.tubos : capas.ciencia);
    });

    marcadorHabitat = L.marker(ll(estado.habitat.lon, estado.habitat.lat), { icon: iconoHabitat(), draggable: true, title: I18N.t('mk.habitatTit'), zIndexOffset: 1000 }).addTo(mapa);
    marcadorHabitat.on('dragend', () => {
      const p = marcadorHabitat.getLatLng();
      const x = Math.min(Math.max(p.lng, no.x), se.x), y = Math.min(Math.max(-p.lat, no.y), se.y);
      alCambiar({ habitat: Geo.pxALonLat(x, y) });
    });

    mapa.getContainer().addEventListener('click', e => {
      const b = e.target.closest('[data-alternar]');
      if (b) { alCambiar({ alternar: b.dataset.alternar }); mapa.closePopup(); }
    });

    escala().addTo(mapa);
    const norte = L.control({ position: 'topright' });
    norte.onAdd = () => { const d = L.DomUtil.create('div', 'norte'); d.textContent = 'N'; d.title = I18N.t('mapa.norte'); nodoNorte = d; return d; };
    norte.addTo(mapa);

    document.querySelectorAll('[data-capa]').forEach(c => c.addEventListener('change', () => {
      const g = capas[c.dataset.capa];
      if (c.checked) g.addTo(mapa); else mapa.removeLayer(g);
    }));
  }

  /* Barra de escala en metros que se ajusta al zoom. */
  function escala() {
    const c = L.control({ position: 'bottomleft' });
    c.onAdd = () => {
      const d = L.DomUtil.create('div', 'escala');
      const act = () => {
        const pxPorM = Math.pow(2, mapa.getZoom()) / ((Geo.mPorPxX + Geo.mPorPxY) / 2);
        const opciones = [5, 10, 20, 50, 100];
        const m = opciones.find(o => o * pxPorM >= 70) || 100;
        d.innerHTML = `<div style="width:${Math.round(m * pxPorM)}px"></div><span>${m} m</span>`;
      };
      mapa.on('zoomend', act); act();
      return d;
    };
    return c;
  }

  function actualizar(estado, plan) {
    const sig = plan.orden[0] && plan.orden[0].id;
    estado.paradas.forEach(p => {
      const inc = estado.incluidas.has(p.id);
      marcadores[p.id].setIcon(p.tipo === 'tubo' ? iconoTubo(p, inc, false) : iconoCiencia(p, inc));
    });
    capas.ruta.clearLayers();
    const pts = [plan.inicio].concat(plan.orden, [plan.inicio]).map(p => ll(p.lon, p.lat));
    L.polyline(pts, { color: '#0E3440', weight: 9, opacity: 0.7, lineJoin: 'round', interactive: false }).addTo(capas.ruta);
    L.polyline(pts, { color: '#7FD3EE', weight: 4, lineJoin: 'round', interactive: false }).addTo(capas.ruta);
    capas.alcance.clearLayers();
    const r = plan.maxCasa / ((Geo.mPorPxX + Geo.mPorPxY) / 2);
    L.circle(ll(plan.inicio.lon, plan.inicio.lat), { radius: r, color: '#F2A93B', weight: 2, dashArray: '6 6', fill: false, interactive: false }).addTo(capas.alcance);
    marcadorHabitat.setLatLng(ll(estado.habitat.lon, estado.habitat.lat));
    marcadorHabitat.setIcon(iconoHabitat());
    const el = marcadorHabitat.getElement(); if (el) el.title = I18N.t('mk.habitatTit');
    if (zoomCtl) {
      const c = zoomCtl.getContainer();
      const zi = c.querySelector('.leaflet-control-zoom-in'), zo = c.querySelector('.leaflet-control-zoom-out');
      zi.title = I18N.t('mapa.acercar'); zi.setAttribute('aria-label', zi.title);
      zo.title = I18N.t('mapa.alejar'); zo.setAttribute('aria-label', zo.title);
    }
    if (nodoNorte) nodoNorte.title = I18N.t('mapa.norte');
    return sig;
  }

  function enfocar(id) {
    const m = marcadores[id];
    if (!m) return;
    mapa.flyTo(m.getLatLng(), Math.max(mapa.getZoom(), 1), { duration: 0.6 });
    m.openPopup();
  }

  function redimensionar() { if (mapa) mapa.invalidateSize(); }

  window.Planificar = { iniciar, actualizar, enfocar, redimensionar };
})();
