/* Operación Three Forks — estado general, supuestos ajustables, idioma y unión de las dos vistas. */
(function () {
  const D = window.DATOS;
  const S = D.supuestos;
  const $ = id => document.getElementById(id);
  const t = (k, v) => I18N.t(k, v);

  /* Terreno: variación de elevación medida por el rover en el depósito. */
  const elevs = D.recorrido.filter(r => r.sol >= 652 && r.sol <= 693).map(r => r.elev);
  const variacion = Math.max(...elevs) - Math.min(...elevs);
  const terreno = () => t('terreno.chip', { v: (variacion / 2).toFixed(1) });

  /* Supuestos de la misión: valores originales (del script) y los que el usuario ajuste. */
  const CLAVES = ['velocidad_m_s', 'min_por_tubo', 'min_por_muestra', 'duracion_eva_min', 'margen_regreso'];
  const ORIGINAL = {};
  CLAVES.forEach(k => { ORIGINAL[k] = S[k]; });

  const paradas = Ruta.paradasBase();
  const estado = {
    paradas,
    habitat: { ...S.habitat },
    incluidas: new Set(paradas.map(p => p.id)),
    plan: null,
  };

  // Recordar el último plan y los supuestos en este navegador (si se puede).
  try {
    const g = JSON.parse(localStorage.getItem('threeforks.plan') || 'null');
    if (g && g.habitat) { estado.habitat = g.habitat; estado.incluidas = new Set(g.incluidas); }
    if (g && g.supuestos) CLAVES.forEach(k => { if (typeof g.supuestos[k] === 'number') S[k] = g.supuestos[k]; });
  } catch (e) { /* sin almacenamiento: se usa el plan por defecto */ }
  function guardar() {
    const sup = {}; CLAVES.forEach(k => { sup[k] = S[k]; });
    try { localStorage.setItem('threeforks.plan', JSON.stringify({ habitat: estado.habitat, incluidas: [...estado.incluidas], supuestos: sup })); } catch (e) { /* nada */ }
  }

  function recalcular() {
    const elegidas = paradas.filter(p => estado.incluidas.has(p.id));
    estado.plan = Ruta.planificar(estado.habitat, elegidas);
    pintarPlan();
    Planificar.actualizar(estado, estado.plan);
    guardar();
  }

  function pintarPlan() {
    const P = estado.plan;
    $('cifDist').textContent = Math.round(P.total) + ' m';
    $('cifTiempo').textContent = Ruta.duracion(P.minutos);
    $('cifParadas').textContent = P.orden.length;
    $('avisoExcede').hidden = P.minutos <= S.duracion_eva_min;
    const lista = P.orden.map(p => {
      const insignia = p.tipo === 'tubo' ? `<span class="insignia insignia--tubo">${p.num}</span>` : `<span class="insignia insignia--ciencia">${p.etiqueta}</span>`;
      const nombre = p.tipo === 'tubo'
        ? `${p.nombre}${p.ref.tipo !== 'núcleo de roca' ? ` <small>(${t('tipo.' + p.ref.tipo)})</small>` : ''}`
        : t('lista.muestra', { n: p.nombre });
      return `<li><button type="button" data-ir="${p.id}">${insignia}<span>${nombre}</span><span class="tenue">${Math.round(p.tramo)} m</span></button></li>`;
    });
    lista.push(`<li><div class="paradas__regreso"><span class="insignia insignia--casa">H</span><span>${t('lista.regreso')}</span><span class="tenue">${Math.round(P.regreso)} m</span></div></li>`);
    const fuera = paradas.filter(p => !estado.incluidas.has(p.id));
    if (fuera.length) lista.push(`<li class="paradas__fuera">${t('lista.fuera')} ${fuera.map(p => `<button type="button" class="enlace" data-alternar-lista="${p.id}">${p.tipo === 'tubo' ? p.num + ' ' + p.nombre : p.nombre}</button>`).join(', ')}</li>`);
    $('listaParadas').innerHTML = lista.join('');

    const pct = Math.round(S.margen_regreso * 100);
    $('segDist').textContent = t('seg.distTxt', { m: Math.round(P.maxCasa), p: pct });
    $('segTerreno').textContent = t('seg.terrenoTxt', { v: variacion.toFixed(1), e: Math.min(...elevs).toFixed(1) });
    $('segLuz').textContent = t('seg.luzTxt', { a: D.meda.sunrise.slice(0, 5), b: D.meda.sunset.slice(0, 5), sol: D.meda.sol });

    // Línea de tiempo dentro de la reserva del traje
    const total = Math.max(S.duracion_eva_min, P.minutos);
    const seg = P.segmentos.map(s => {
      const cls = s.tipo === 'camino' ? 'camino' : s.tipo;
      const ancho = Math.max(0.3, s.min / total * 100);
      const txt = s.parada && ancho > 3 ? (s.parada.tipo === 'tubo' ? s.parada.num : s.parada.etiqueta) : '';
      const tit = s.parada ? `${s.parada.nombre}: ${Math.round(s.min)} min` : t('lt.caminarMin', { m: Math.round(s.min) });
      return `<div class="seg seg--${cls}" style="width:${ancho}%" title="${tit}">${txt}</div>`;
    });
    const reserva = Math.max(0, S.duracion_eva_min - P.minutos);
    if (reserva > 0) seg.push(`<div class="seg seg--reserva" style="flex:1">${t('lt.reservaTxt', { d: Ruta.duracion(reserva) })}</div>`);
    $('ltBarra').innerHTML = seg.join('');
    $('ltBarra').classList.toggle('excede', P.minutos > S.duracion_eva_min);
    $('ltSalida').textContent = t('lt.salida', { h: S.hora_salida });
    $('ltRegreso').textContent = t('lt.regreso', { h: Ruta.horaMas(S.hora_salida, P.minutos) });
    $('ltLimite').textContent = t('lt.limite', { h: Ruta.horaMas(S.hora_salida, S.duracion_eva_min) });
  }

  /* ---------- supuestos ajustables ---------- */
  const formato = {
    velocidad_m_s: v => `${v.toFixed(1)} m/s`,
    min_por_tubo: v => `${v} min`,
    min_por_muestra: v => `${v} min`,
    duracion_eva_min: v => Ruta.duracion(v),
    margen_regreso: v => `${Math.round(v * 100)} %`,
  };
  const salida = { velocidad_m_s: 'outVel', min_por_tubo: 'outTubo', min_por_muestra: 'outMuestra', duracion_eva_min: 'outReserva', margen_regreso: 'outMargen' };

  function pintarSupuestos() {
    document.querySelectorAll('[data-sup]').forEach(inp => {
      const k = inp.dataset.sup;
      inp.value = S[k];
      $(salida[k]).textContent = formato[k](S[k]);
      inp.setAttribute('aria-valuetext', formato[k](S[k]));
    });
    $('btnRestablecer').hidden = CLAVES.every(k => S[k] === ORIGINAL[k]);
    $('optReservaPlan').textContent = t('demo.reservaPlan', { d: Ruta.duracion(S.duracion_eva_min) });
    const pct = Math.round(S.margen_regreso * 100);
    $('listaSupuestos').innerHTML = [
      t('fuentes.sup1'),
      t('fuentes.sup2', { v: S.velocidad_m_s.toFixed(1) }),
      t('fuentes.sup3', { a: S.min_por_tubo, b: S.min_por_muestra }),
      t('fuentes.sup4', { h: Ruta.duracion(S.duracion_eva_min), p: pct }),
      t('fuentes.sup5'),
    ].map(x => `<li>${x}</li>`).join('');
  }

  function pintarChips() {
    $('chipTemp').textContent = t('chip.meda', { sol: D.meda.sol, min: Math.round(D.meda.min_temp), max: Math.round(D.meda.max_temp) });
    $('chipPresion').textContent = `${Math.round(D.meda.pressure)} Pa`;
    $('chipSol').textContent = t('chip.puesta', { h: D.meda.sunset.slice(0, 5) });
  }

  function cambio(c) {
    if (c.habitat) estado.habitat = c.habitat;
    if (c.alternar) {
      if (estado.incluidas.has(c.alternar)) estado.incluidas.delete(c.alternar); else estado.incluidas.add(c.alternar);
    }
    recalcular();
  }

  function iniciar() {
    I18N.aplicar();
    pintarChips();
    pintarSupuestos();

    Planificar.iniciar(estado, cambio);
    recalcular();
    Navegar.conectar();
    $('btnPausa').textContent = t('nav.pausar');

    document.querySelectorAll('[data-sup]').forEach(inp => inp.addEventListener('input', () => {
      S[inp.dataset.sup] = Number(inp.value);
      pintarSupuestos();
      recalcular();
      Navegar.refrescar();
    }));
    $('btnRestablecer').addEventListener('click', () => {
      CLAVES.forEach(k => { S[k] = ORIGINAL[k]; });
      pintarSupuestos();
      recalcular();
      Navegar.refrescar();
    });

    document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => I18N.cambiar(b.dataset.lang)));
    I18N.alCambiar(() => {
      pintarChips();
      pintarSupuestos();
      recalcular();
      Navegar.refrescar();
    });

    $('listaParadas').addEventListener('click', e => {
      const b = e.target.closest('[data-ir]');
      if (b) Planificar.enfocar(b.dataset.ir);
      const a = e.target.closest('[data-alternar-lista]');
      if (a) cambio({ alternar: a.dataset.alternarLista });
    });
    $('btnFuentes').addEventListener('click', () => $('dlgFuentes').showModal());
    $('btnIniciar').addEventListener('click', () => {
      if (!estado.plan.orden.length) return;
      $('vistaPlan').hidden = true; $('vistaNav').hidden = false;
      Navegar.abrir(estado.plan);
    });
    $('btnVolver').addEventListener('click', () => {
      Navegar.cerrar();
      $('vistaNav').hidden = true; $('vistaPlan').hidden = false;
      Planificar.redimensionar();
    });

    // App instalable y sin internet cuando se sirve por https.
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  window.App = { estado, terreno };
  document.addEventListener('DOMContentLoaded', iniciar);
})();
