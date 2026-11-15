/* Operación Three Forks — navegación tipo GPS durante la caminata. */
(function () {
  const D = window.DATOS;
  const S = D.supuestos;
  const $ = id => document.getElementById(id);
  const t = (k, v) => I18N.t(k, v);
  const reservaDemo = () => Number($('selReserva').value) || S.duracion_eva_min;

  const img = new Image();
  img.src = D.imagenes.hirise;
  img.onload = () => dibujar();
  const ctxImg = new Image();
  ctxImg.src = D.imagenes.contexto;
  ctxImg.onload = () => dibujar();
  const CL = D.imagenes.contexto_limites;
  const ctxNO = Geo.aMundo(CL.oeste, CL.norte), ctxSE = Geo.aMundo(CL.este, CL.sur);
  /* Dibuja el contexto (1.3 m/px) y encima el detalle (25 cm) en metros. */
  function dibujarSuelo(x) {
    if (ctxImg.complete && ctxImg.naturalWidth) x.drawImage(ctxImg, ctxNO.e, ctxNO.s, ctxSE.e - ctxNO.e, ctxSE.s - ctxNO.s);
    if (img.complete && img.naturalWidth) x.drawImage(img, 0, 0, Geo.anchoM, Geo.altoM);
  }

  const recorridoM = D.recorrido.map(r => Geo.aMundo(r.lon, r.lat));

  let n = null;           // estado de la caminata
  let ultimo = 0, raf = 0, geoId = null;

  /* ---------- estado ---------- */
  function nueva(plan) {
    const casa = { e: plan.inicio.e, s: plan.inicio.s };
    n = {
      plan, casa,
      pos: { ...casa },
      rumbo: plan.orden.length ? Geo.rumbo(casa, plan.orden[0]) : 0,
      rumboVisto: null,
      idx: 0,
      hechos: new Set(),
      reloj: 0,                    // minutos de EVA transcurridos
      caminado: 0,
      reserva: reservaDemo(),
      factor: Number($('selVel').value),
      modo: document.querySelector('input[name=modo]:checked').value,
      pausado: false,
      zoom: 9,                     // px de pantalla por metro
      regresando: false,
      soloSiguiente: false,
      alertaVista: false,
      tarjeta: null,               // 'llegada' | 'alerta' | 'foto' | 'fin'
      patio: null,
    };
    n.rumboVisto = n.rumbo;
    ocultarTodo();
    $('btnPausa').textContent = t('nav.pausar');
    if (n.modo === 'patio') iniciarPatio(); else detenerPatio();
    actualizarPaneles();
  }

  function destino() {
    if (n.regresando || n.idx >= n.plan.orden.length) return { ...n.casa, tipo: 'habitat', nombre: t('habitat'), etiqueta: 'H' };
    return n.plan.orden[n.idx];
  }
  function despues() {
    if (n.regresando) return null;
    if (n.soloSiguiente) return { ...n.casa, tipo: 'habitat', nombre: t('habitat') };
    if (n.idx + 1 < n.plan.orden.length) return n.plan.orden[n.idx + 1];
    if (n.idx < n.plan.orden.length) return { ...n.casa, tipo: 'habitat', nombre: t('habitat') };
    return null;
  }
  const v = () => S.velocidad_m_s;
  const minutosCaminar = m => m / v() / 60;

  function restanteRuta() {
    let d = 0, min = 0, prev = n.pos;
    if (!n.regresando) {
      const fin = n.soloSiguiente ? n.idx + 1 : n.plan.orden.length;
      for (let i = n.idx; i < fin; i++) {
        const p = n.plan.orden[i];
        d += Geo.distancia(prev, p); min += Ruta.minutosParada(p); prev = p;
      }
    }
    d += Geo.distancia(prev, n.casa);
    return { d, min: min + minutosCaminar(d) };
  }

  /* Regla de regreso: ¿cuántos minutos quedan antes de tener que volver? */
  function margenRegreso() {
    const restante = n.reserva - n.reloj;
    const necesario = minutosCaminar(Geo.distancia(n.pos, n.casa)) * (1 + S.margen_regreso);
    return restante - necesario;
  }

  /* ---------- ciclo ---------- */
  function ciclo(t) {
    const dt = ultimo ? Math.min((t - ultimo) / 1000, 0.25) : 0;
    ultimo = t;
    if (n && !n.pausado && !n.tarjeta) avanzar(dt);
    if (n) {
      const objetivo = n.rumbo;
      const dif = Geo.difAngulo(n.rumboVisto, objetivo);
      n.rumboVisto = (n.rumboVisto + dif * Math.min(1, dt * 5) + 360) % 360;
    }
    dibujar();
    raf = requestAnimationFrame(ciclo);
  }

  function avanzar(dt) {
    const dest = destino();
    if (n.modo === 'sim') {
      n.reloj += dt * n.factor / 60;
      const paso = v() * n.factor * dt;
      const d = Geo.distancia(n.pos, dest);
      if (d > 0.05) n.rumbo = Geo.rumbo(n.pos, dest);
      if (paso >= d) { n.caminado += d; n.pos = { e: dest.e, s: dest.s }; llegar(dest); }
      else { n.caminado += paso; n.pos = Geo.avanzar(n.pos, n.rumbo, paso); }
    } else {
      n.reloj += dt / 60;
      if (Geo.distancia(n.pos, dest) < 4) llegar(dest);
    }
    revisarRegreso();
    actualizarPaneles();
  }

  function revisarRegreso() {
    if (n.regresando || n.alertaVista || n.tarjeta) return;
    if (margenRegreso() <= 15) { n.alertaVista = true; mostrarAlerta(); }
  }

  /* ---------- llegada ---------- */
  function llegar(dest) {
    if (dest.tipo === 'habitat') return mostrarFin();
    mostrarParada(dest, 'llegada');
  }

  function mostrarParada(p, modo) {
    n.tarjeta = modo; n.tarjetaParada = p;
    prepararMedia(p, 'sat');
    $('llegMarca').textContent = t(modo === 'llegada' ? 'card.llegaste' : 'card.proximo');
    $('llegMarca').hidden = false;
    const datos = $('llegDatos'), pasos = $('llegPasos'), ciencia = $('llegCiencia');
    if (p.tipo === 'tubo') {
      const tb = p.ref;
      $('llegTitulo').textContent = t('parada.tubo', { n: tb.num, nombre: tb.nombre });
      $('llegPista').textContent = t('card.pista', { az: tb.azimut, card: Geo.puntoCardinal(tb.azimut) });
      datos.innerHTML = celda(t('card.designacion'), tb.designacion) + celda(t('card.contenido'), t('tipo.' + tb.tipo)) +
        celda(t('card.soles'), `sol ${tb.sol_toma} / sol ${tb.sol_deposito}`) +
        celda(t('card.roverSoltar'), `${tb.lat.toFixed(5)}, ${tb.lon.toFixed(5)}`);
      pasos.innerHTML = paso(t('card.paso1')) + paso(t('card.paso2')) + paso(t('card.paso3', { n: tb.num }));
      ciencia.innerHTML = `<b>${t('card.cienciaAqui')}</b><span>${t('card.cienciaAquiTxt')}</span>`;
      $('llegListo').textContent = t('card.listoTubo', { n: tb.num });
    } else {
      $('llegTitulo').textContent = t('parada.ciencia', { n: p.nombre });
      $('llegPista').textContent = t('card.cPista');
      datos.innerHTML = celda(t('card.posicion'), `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`) + celda(t('card.estado'), t('card.sinVisitar'));
      pasos.innerHTML = paso(t('card.cPaso1')) + paso(t('card.cPaso2')) + paso(t('card.cPaso3'));
      ciencia.innerHTML = `<b>${t('card.porQue')}</b><span>${t('card.porQueTxt', { t: t('crater.tarea') })}</span>`;
      $('llegListo').textContent = t('card.listoCiencia', { n: p.nombre });
    }
    $('llegListo').hidden = modo !== 'llegada';
    $('llegCerrar').textContent = t(modo === 'llegada' ? 'card.verMapa' : 'card.seguir');
    $('llegada').hidden = false;
    $('llegListo').focus({ preventScroll: true });
  }
  /* ---------- imágenes de cada parada ---------- */
  let mediaParada = null;
  function panoramaPara(p) {
    const P = D.imagenes.panoramas;
    if (p.tipo === 'habitat') return P[P.length - 1];
    if (p.tipo !== 'tubo') return null;
    return P.find(x => p.ref.sol_deposito <= x.hasta_sol) || P[P.length - 1];
  }
  function prepararMedia(p, vista) {
    mediaParada = p;
    const pano = panoramaPara(p);
    const tabR = $('tabRover');
    tabR.disabled = !pano;
    tabR.textContent = t(pano ? 'card.rover' : 'card.sinRover');
    tabR.title = pano ? '' : t('card.sinRoverTit');
    mostrarMedia(pano ? vista : 'sat');
  }
  let vistaMedia = 'sat';
  function mostrarMedia(vista) {
    vistaMedia = vista;
    const p = mediaParada, pano = panoramaPara(p);
    const sat = vista === 'sat' || !pano;
    $('tabSat').setAttribute('aria-pressed', String(sat));
    $('tabRover').setAttribute('aria-pressed', String(!sat));
    $('llegSat').hidden = !sat; $('llegFoto').hidden = sat;
    if (sat) {
      dibujarSatelite(p);
      $('llegCredito').textContent = t('card.satCredito');
    } else {
      const txt = t('pano.' + pano.sol.slice(0, 3));
      if (!$('llegFoto').src.endsWith(pano.src)) $('llegFoto').src = pano.src;
      $('llegFoto').alt = t('card.fotoAlt', { t: txt });
      $('llegCredito').textContent = `${txt} · Mastcam-Z`;
    }
  }
  function dibujarSatelite(p) {
    const c = $('llegSat'), x = c.getContext('2d');
    const k = c.width / 40;                      // 40 m de ancho
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#0B0908'; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, c.width / 2 - p.e * k, c.height / 2 - p.s * k);
    dibujarSuelo(x);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2 / k; x.setLineDash([2 / k, 7 / k]); linea(x, recorridoM); x.setLineDash([]);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const cx = c.width / 2, cy = c.height / 2;
    // otros tubos cercanos
    D.tubos.forEach(t => {
      const m = Geo.aMundo(t.lon, t.lat); const sx = cx + (m.e - p.e) * k, sy = cy + (m.s - p.s) * k;
      if (p.tipo === 'tubo' && t.num === p.num) return;
      if (sx < 0 || sy < 0 || sx > c.width || sy > c.height) return;
      x.fillStyle = 'rgba(242,169,59,.8)'; x.strokeStyle = '#2A1A05'; x.lineWidth = 2;
      x.beginPath(); x.arc(sx, sy, 11, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#2A1A05'; x.font = '700 12px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.num, sx, sy + 0.5);
    });
    if (p.tipo === 'tubo') {
      // orientación del tubo (azimut del PDS), exagerada para que se vea
      const r = p.ref.azimut * Math.PI / 180, L2 = 26;
      x.strokeStyle = '#FFFFFF'; x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - Math.sin(r) * L2, cy + Math.cos(r) * L2); x.lineTo(cx + Math.sin(r) * L2, cy - Math.cos(r) * L2); x.stroke();
      x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(cx + Math.sin(r) * L2, cy - Math.cos(r) * L2, 5, 0, 7); x.fill();
    }
    x.strokeStyle = p.tipo === 'ciencia' ? '#B9E58A' : p.tipo === 'habitat' ? '#F2E6D8' : '#F2A93B';
    x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, 44, 0, 7); x.stroke();
    // escala de 5 m (abajo a la derecha)
    const by = c.height - 30, bx1 = c.width - 24, bx0 = bx1 - 5 * k;
    x.fillStyle = 'rgba(21,17,14,.85)'; x.beginPath(); x.roundRect(bx0 - 14, by - 34, 5 * k + 28, 48, 8); x.fill();
    x.strokeStyle = '#F2E6D8'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(bx0, by - 8); x.lineTo(bx0, by); x.lineTo(bx1, by); x.lineTo(bx1, by - 8); x.stroke();
    x.fillStyle = '#F2E6D8'; x.font = '600 16px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillText('5 m', (bx0 + bx1) / 2, by - 12);
  }

  const celda = (k, val) => `<div><dt>${k}</dt><dd>${val}</dd></div>`;
  const paso = t => `<li><label><input type="checkbox"><span>${t}</span></label></li>`;

  function completarParada() {
    const p = destino();
    n.hechos.add(p.id);
    n.reloj += Ruta.minutosParada(p);
    n.idx++;
    if (n.soloSiguiente) { n.regresando = true; n.soloSiguiente = false; }
    cerrarTarjeta();
    revisarRegreso();
  }

  function mostrarFin() {
    const tubos = [...n.hechos].filter(id => id[0] === 'T').length;
    const muestras = [...n.hechos].filter(id => id[0] === 'C').length;
    if (!n.tarjeta || n.tarjeta !== 'fin') prepararMedia({ ...n.casa, tipo: 'habitat', nombre: t('habitat') }, 'rover');
    else mostrarMedia(vistaMedia);
    n.tarjeta = 'fin';
    $('llegMarca').textContent = t('fin.marca');
    $('llegTitulo').textContent = t('fin.titulo');
    $('llegPista').textContent = t(tubos === D.tubos.length ? 'fin.todos' : 'fin.parcial');
    $('llegDatos').innerHTML = celda(t('fin.tubos'), t('fin.tubosVal', { a: tubos, b: D.tubos.length })) + celda(t('fin.muestras'), muestras) +
      celda(t('fin.caminaste'), Math.round(n.caminado) + ' m') + celda(t('fin.duracion'), Ruta.duracion(n.reloj));
    $('llegPasos').innerHTML = '';
    $('llegCiencia').innerHTML = `<b>${t('fin.siguiente')}</b><span>${t('fin.siguienteTxt')}</span>`;
    $('llegListo').hidden = true;
    $('llegCerrar').textContent = t('card.cerrar');
    $('llegada').hidden = false;
    n.pausado = true;
  }

  function cerrarTarjeta() {
    $('llegada').hidden = true; $('alerta').hidden = true;
    n.tarjeta = null;
    actualizarPaneles();
  }
  function ocultarTodo() { $('llegada').hidden = true; $('alerta').hidden = true; }

  /* ---------- alerta de regreso ---------- */
  function mostrarAlerta() {
    n.tarjeta = 'alerta';
    const m = Math.max(0, Math.floor(margenRegreso()));
    const casa = Geo.distancia(n.pos, n.casa);
    const pct = Math.round(S.margen_regreso * 100);
    $('alertaTitulo').textContent = m > 0 ? t('alerta.en', { m }) : t('alerta.ahora');
    $('alertaTexto').textContent = t('alerta.txt', { m, d: Math.round(casa), t: Math.ceil(minutosCaminar(casa)), p: pct });
    $('alertaNota').textContent = t('alerta.nota', { p: pct });
    const sig = n.idx < n.plan.orden.length ? n.plan.orden[n.idx] : null;
    const b = $('alertaSeguir');
    if (sig) {
      const extraM = Geo.distancia(n.pos, sig) + Geo.distancia(sig, n.casa) - casa;
      const extraMin = minutosCaminar(extraM) + Ruta.minutosParada(sig);
      const alcanza = m - extraMin * (1 + S.margen_regreso) > 0;
      const nombre = sig.tipo === 'tubo' ? t('parada.tuboCorto', { n: sig.num }) : sig.nombre;
      b.textContent = alcanza ? t('alerta.ir', { dest: nombre, m: Math.round(extraM), t: Math.round(extraMin) }) : t('alerta.noAlcanza', { dest: nombre });
      b.disabled = !alcanza; b.hidden = false;
    } else b.hidden = true;
    $('alerta').hidden = false;
    dibujarMiniMapa();
  }

  function dibujarMiniMapa() {
    const c = $('alertaMapa'), x = c.getContext('2d');
    const a = n.pos, b = n.casa;
    const k = Math.max(c.width / (ctxSE.e - ctxNO.e), Math.min(c.width / (Math.abs(a.e - b.e) + 30), c.height / (Math.abs(a.s - b.s) + 30)));
    const medio = (v, lado, min, max) => Math.min(Math.max(v, min + lado / 2 / k), max - lado / 2 / k);
    const ce = medio((a.e + b.e) / 2, c.width, ctxNO.e, ctxSE.e), cs = medio((a.s + b.s) / 2, c.height, ctxNO.s, ctxSE.s);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, c.width / 2 - ce * k, c.height / 2 - cs * k);
    dibujarSuelo(x);
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(14,52,64,.75)'; x.lineWidth = 14 / k; linea(x, [a, b]);
    x.strokeStyle = '#7FD3EE'; x.lineWidth = 6 / k; x.setLineDash([14 / k, 10 / k]); linea(x, [a, b]); x.setLineDash([]);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const pa = { x: c.width / 2 + (a.e - ce) * k, y: c.height / 2 + (a.s - cs) * k };
    const pb = { x: c.width / 2 + (b.e - ce) * k, y: c.height / 2 + (b.s - cs) * k };
    casita(x, pb.x, pb.y, 26);
    x.fillStyle = '#7FD3EE'; x.strokeStyle = '#fff'; x.lineWidth = 5;
    x.beginPath(); x.arc(pa.x, pa.y, 13, 0, 7); x.fill(); x.stroke();
  }

  /* ---------- modo patio (GPS real) ---------- */
  function iniciarPatio() {
    const est = $('estadoPatio');
    if (!('geolocation' in navigator)) { est.textContent = t('gps.no'); return; }
    if (!window.isSecureContext) { est.textContent = t('gps.https'); return; }
    est.textContent = t('gps.buscando');
    n.patio = { origenTierra: null, origenMarte: { ...n.pos }, ultimoRumbo: null };
    geoId = navigator.geolocation.watchPosition(p => {
      const { latitude: la, longitude: lo, accuracy } = p.coords;
      if (!n.patio.origenTierra) n.patio.origenTierra = { la, lo };
      const o = n.patio.origenTierra;
      const dE = (lo - o.lo) * 111320 * Math.cos(o.la * Math.PI / 180);
      const dN = (la - o.la) * 110540;
      const nueva = { e: n.patio.origenMarte.e + dE, s: n.patio.origenMarte.s - dN };
      n.caminado += Geo.distancia(n.pos, nueva);
      n.pos = nueva;
      const ur = n.patio.ultimoRumbo;
      if (!ur) n.patio.ultimoRumbo = { ...nueva };
      else if (Geo.distancia(ur, nueva) >= 1.5) { n.rumbo = Geo.rumbo(ur, nueva); n.patio.ultimoRumbo = { ...nueva }; }
      est.textContent = t('gps.activo', { m: Math.round(accuracy) });
    }, err => { est.textContent = t('gps.error', { e: err.message }); }, { enableHighAccuracy: true, maximumAge: 1000 });
  }
  function detenerPatio() {
    if (geoId !== null) navigator.geolocation.clearWatch(geoId);
    geoId = null;
    $('estadoPatio').textContent = '';
  }

  /* ---------- paneles ---------- */
  function lado(rel) {
    const a = Math.abs(rel);
    if (a < 30) return t('lado.frente');
    if (a > 150) return t('lado.atras');
    return t(rel > 0 ? 'lado.der' : 'lado.izq');
  }
  function giro(dif) {
    if (Math.abs(dif) < 25) return { txt: t('giro.recto'), ico: 'recto' };
    if (Math.abs(dif) > 140) return { txt: t('giro.vuelta'), ico: 'vuelta' };
    return dif > 0 ? { txt: t('giro.der'), ico: 'der' } : { txt: t('giro.izq'), ico: 'izq' };
  }
  function nombreParada(p) {
    if (p.tipo === 'tubo') return t('parada.tubo', { n: p.num, nombre: p.nombre });
    if (p.tipo === 'ciencia') return t('parada.ciencia', { n: p.nombre });
    return t('habitat');
  }

  const ICONOS = {
    recto: '<path d="M26 44 V10 M14 22 L26 10 L38 22"/>',
    der: '<path d="M18 44 V24 Q18 16 26 16 H40 M32 8 L40 16 L32 24"/>',
    izq: '<path d="M34 44 V24 Q34 16 26 16 H12 M20 8 L12 16 L20 24"/>',
    vuelta: '<path d="M18 44 V20 Q18 10 27 10 Q36 10 36 20 V30 M28 24 L36 32 L44 24"/>',
    casa: '<path d="M10 26 L26 10 L42 26 M15 22 V42 H37 V22"/>',
  };

  function actualizarPaneles() {
    if (!n) return;
    const dest = destino();
    const d = Geo.distancia(n.pos, dest);
    const rumboDest = Geo.rumbo(n.pos, dest);
    const g = n.modo === 'sim' || d < 3 ? { ico: 'recto' } : giro(Geo.difAngulo(n.rumbo, rumboDest));
    $('icoManiobra').innerHTML = ICONOS[dest.tipo === 'habitat' ? 'casa' : g.ico];
    $('indDist').textContent = d < 10 ? d.toFixed(1) + ' m' : Math.round(d) + ' m';
    $('indDest').textContent = n.regresando ? t('nav.regresoDirecto') : nombreParada(dest);
    const luego = despues();
    if (luego && dest.tipo !== 'habitat') {
      const dif = Geo.difAngulo(Geo.rumbo(n.pos, dest), Geo.rumbo(dest, luego));
      $('indLuego').textContent = t('nav.luego', { giro: giro(dif).txt, dest: luego.tipo === 'habitat' ? t('habitat').toLowerCase() : luego.nombre, m: Math.round(Geo.distancia(dest, luego)) });
      $('indLuego').hidden = false;
    } else $('indLuego').hidden = true;
    $('indicacion').classList.toggle('indicacion--regreso', n.regresando);

    // Entorno: lo que hay cerca, relativo a hacia dónde caminas
    const cosas = [];
    n.plan.orden.forEach(p => { if (p !== dest) cosas.push({ p, nom: p.tipo === 'tubo' ? t('parada.tuboCorto', { n: p.num }) : p.nombre, hecho: n.hechos.has(p.id) }); });
    if (dest.tipo !== 'habitat') cosas.push({ p: n.casa, nom: t('habitat') });
    const cerca = cosas.map(c => ({ ...c, d: Geo.distancia(n.pos, c.p) })).filter(c => c.d < 35 && c.d > 1).sort((a, b) => a.d - b.d).slice(0, 2);
    const chips = cerca.map(c => `<span class="chip chip--flota">${t('nav.cerca', { nom: c.nom + (c.hecho ? ' ✓' : ''), m: Math.round(c.d), lado: lado(Geo.difAngulo(n.rumbo, Geo.rumbo(n.pos, c.p))) })}</span>`);
    let huella = Infinity;
    recorridoM.forEach((r, i) => { if (i) huella = Math.min(huella, distSegmento(n.pos, recorridoM[i - 1], r)); });
    if (huella < 6) chips.push(`<span class="chip chip--flota">${t('nav.huellas')}</span>`);
    chips.unshift(`<span class="chip chip--flota">${window.App.terreno()}</span>`);
    $('entorno').innerHTML = chips.join('');

    const resta = restanteRuta();
    $('hojaHora').textContent = Ruta.horaMas(S.hora_salida, n.reloj + resta.min);
    $('hojaCasa').textContent = t('nav.deCasa', { m: Math.round(Geo.distancia(n.pos, n.casa)) });
    const totTubos = n.plan.orden.filter(p => p.tipo === 'tubo').length;
    const totC = n.plan.orden.filter(p => p.tipo === 'ciencia').length;
    $('hojaTubos').textContent = `${[...n.hechos].filter(i => i[0] === 'T').length}/${totTubos}`;
    $('hojaMuestras').textContent = `${[...n.hechos].filter(i => i[0] === 'C').length}/${totC}`;
    const o2 = Math.max(0, 1 - n.reloj / n.reserva);
    $('hojaO2').textContent = Math.round(o2 * 100) + ' %';
    $('hojaO2').classList.toggle('bajo', margenRegreso() <= 15);
    $('hojaReloj').textContent = Ruta.horaMas(S.hora_salida, n.reloj);
  }

  function distSegmento(p, a, b) {
    const dx = b.e - a.e, dy = b.s - a.s, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.e - a.e) * dx + (p.s - a.s) * dy) / l2)) : 0;
    return Math.hypot(p.e - (a.e + t * dx), p.s - (a.s + t * dy));
  }

  /* ---------- dibujo del mapa orientado ---------- */
  function linea(x, pts) { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p.e, p.s) : x.moveTo(p.e, p.s)); x.stroke(); }
  function casita(x, cx, cy, t) {
    x.fillStyle = '#F2E6D8'; x.strokeStyle = '#15110E'; x.lineWidth = 3;
    x.beginPath(); x.roundRect(cx - t / 2, cy - t / 2, t, t, 6); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(cx - t * 0.3, cy); x.lineTo(cx, cy - t * 0.28); x.lineTo(cx + t * 0.3, cy);
    x.moveTo(cx - t * 0.2, cy - 0.05 * t); x.lineTo(cx - t * 0.2, cy + t * 0.28); x.lineTo(cx + t * 0.2, cy + t * 0.28); x.lineTo(cx + t * 0.2, cy - 0.05 * t);
    x.lineWidth = 2.2; x.stroke();
  }

  function dibujar() {
    const c = $('lienzo');
    if (!n || !c || $('vistaNav').hidden) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext('2d');
    const cx = w / 2, cy = h * 0.6, k = n.zoom;
    const th = -n.rumboVisto * Math.PI / 180;
    const cos = Math.cos(th), sin = Math.sin(th);
    const aPantalla = p => {
      const dx = (p.e - n.pos.e) * k, dy = (p.s - n.pos.s) * k;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    };

    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#0B0908'; x.fillRect(0, 0, w, h);
    x.save();
    x.translate(cx, cy); x.rotate(th); x.scale(k, k); x.translate(-n.pos.e, -n.pos.s);
    dibujarSuelo(x);
    x.lineCap = 'round'; x.lineJoin = 'round';
    // recorrido del rover
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2 / k; x.setLineDash([2 / k, 7 / k]); linea(x, recorridoM); x.setLineDash([]);
    // ruta completa tenue
    const todo = [n.casa].concat(n.plan.orden, [n.casa]);
    x.strokeStyle = 'rgba(127,211,238,.28)'; x.lineWidth = 3 / k; linea(x, todo);
    // lo que falta
    const falta = [n.pos];
    if (!n.regresando) { const fin = n.soloSiguiente ? n.idx + 1 : n.plan.orden.length; for (let i = n.idx; i < fin; i++) falta.push(n.plan.orden[i]); }
    falta.push(n.casa);
    x.strokeStyle = 'rgba(14,52,64,.8)'; x.lineWidth = 9 / k; linea(x, falta);
    x.strokeStyle = '#7FD3EE'; x.lineWidth = 4.5 / k; linea(x, falta);
    x.restore();

    // marcadores en pantalla (siempre derechos)
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dest = destino();
    n.plan.orden.forEach(p => {
      const s = aPantalla(p), hecho = n.hechos.has(p.id), esDest = p === dest;
      if (s.x < -40 || s.y < -40 || s.x > w + 40 || s.y > h + 40) return;
      if (p.tipo === 'tubo') {
        x.fillStyle = hecho ? '#6B625B' : '#F2A93B';
        x.strokeStyle = esDest ? '#FFFFFF' : '#2A1A05'; x.lineWidth = esDest ? 3 : 2;
        x.beginPath(); x.arc(s.x, s.y, esDest ? 13 : 10, 0, 7); x.fill(); x.stroke();
        x.fillStyle = hecho ? '#F2E6D8' : '#2A1A05'; x.font = '700 11px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(hecho ? '✓' : String(p.num), s.x, s.y + 0.5);
      } else {
        x.strokeStyle = hecho ? '#6B625B' : '#B9E58A'; x.lineWidth = 3;
        x.beginPath(); x.arc(s.x, s.y, 18, 0, 7); x.stroke();
        x.fillStyle = hecho ? '#9A8F86' : '#B9E58A'; x.font = '700 13px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(p.etiqueta, s.x, s.y);
      }
      if (esDest || (!hecho && p.tipo === 'ciencia')) etiqueta(x, s.x + 16, s.y - 16, p.tipo === 'tubo' ? `${p.num} · ${p.nombre}` : p.nombre, esDest);
    });
    const sc = aPantalla(n.casa);
    casita(x, sc.x, sc.y, 30);
    // astronauta
    x.save(); x.translate(cx, cy);
    x.fillStyle = 'rgba(127,211,238,.18)'; x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill();
    x.fillStyle = '#7FD3EE'; x.strokeStyle = '#FFFFFF'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, -18); x.lineTo(14, 16); x.lineTo(0, 9); x.lineTo(-14, 16); x.closePath(); x.fill(); x.stroke();
    x.restore();
    // brújula
    x.save(); x.translate(w - 34, 250); x.rotate(th);
    x.fillStyle = 'rgba(21,17,14,.85)'; x.beginPath(); x.arc(0, 0, 20, 0, 7); x.fill();
    x.fillStyle = '#FF8A65'; x.beginPath(); x.moveTo(0, -15); x.lineTo(5, -3); x.lineTo(-5, -3); x.fill();
    x.fillStyle = '#F2E6D8'; x.font = '700 11px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', 0, 6);
    x.restore();
  }

  function etiqueta(x, px, py, txt, fuerte) {
    x.font = (fuerte ? '600 13px' : '500 12px') + ' Barlow, sans-serif';
    const ancho = x.measureText(txt).width + 14;
    x.fillStyle = 'rgba(21,17,14,.88)';
    x.beginPath(); x.roundRect(px, py - 11, ancho, 22, 6); x.fill();
    x.fillStyle = '#F2E6D8'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(txt, px + 7, py);
  }

  /* ---------- controles ---------- */
  function conectar() {
    $('btnPausa').addEventListener('click', () => {
      n.pausado = !n.pausado;
      $('btnPausa').textContent = t(n.pausado ? 'nav.reanudar' : 'nav.pausar');
    });
    $('btnFoto').addEventListener('click', () => { const d = destino(); if (d.tipo !== 'habitat') mostrarParada(d, 'foto'); });
    $('llegListo').addEventListener('click', completarParada);
    $('tabSat').addEventListener('click', () => mostrarMedia('sat'));
    $('tabRover').addEventListener('click', () => mostrarMedia('rover'));
    $('llegCerrar').addEventListener('click', () => {
      if (n.tarjeta === 'llegada') { $('llegada').hidden = true; n.pausado = true; n.tarjeta = null; $('btnPausa').textContent = t('nav.reanudar'); }
      else cerrarTarjeta();
    });
    $('alertaRegresar').addEventListener('click', () => { n.regresando = true; n.soloSiguiente = false; cerrarTarjeta(); });
    $('alertaSeguir').addEventListener('click', () => { n.soloSiguiente = true; cerrarTarjeta(); });
    $('zoomMas').addEventListener('click', () => { n.zoom = Math.min(30, n.zoom * 1.4); });
    $('zoomMenos').addEventListener('click', () => { n.zoom = Math.max(1.5, n.zoom / 1.4); });
    $('selVel').addEventListener('change', e => { n.factor = Number(e.target.value); });
    $('selReserva').addEventListener('change', () => { n.reserva = reservaDemo(); n.alertaVista = false; actualizarPaneles(); });
    document.querySelectorAll('input[name=modo]').forEach(r => r.addEventListener('change', e => {
      n.modo = e.target.value;
      if (n.modo === 'patio') iniciarPatio(); else detenerPatio();
    }));
    $('btnReiniciar').addEventListener('click', () => nueva(n.plan));
    window.addEventListener('resize', dibujar);
  }
  function abrir(plan) {
    nueva(plan);
    if (!raf) { ultimo = 0; raf = requestAnimationFrame(ciclo); }
  }
  function cerrar() {
    detenerPatio();
    cancelAnimationFrame(raf); raf = 0;
  }

  /* Al cambiar idioma o supuestos: volver a escribir lo que está en pantalla. */
  function refrescar() {
    if (!n) return;
    n.reserva = reservaDemo();
    $('btnPausa').textContent = t(n.pausado ? 'nav.reanudar' : 'nav.pausar');
    if (n.tarjeta === 'llegada' || n.tarjeta === 'foto') { const v = vistaMedia; mostrarParada(n.tarjetaParada, n.tarjeta); mostrarMedia(v); }
    else if (n.tarjeta === 'fin') mostrarFin();
    else if (n.tarjeta === 'alerta') mostrarAlerta();
    actualizarPaneles();
  }

  window.Navegar = { abrir, cerrar, conectar, refrescar, estado: () => n };
})();
