/* Operación Three Forks — paradas, ruta óptima y presupuesto de tiempo. */
(function () {
  const D = window.DATOS;
  const S = D.supuestos;

  /* Todas las paradas posibles, con posición en metros. */
  function paradasBase() {
    const tubos = D.tubos.map(t => ({
      id: 'T' + t.num, tipo: 'tubo', num: t.num, etiqueta: String(t.num),
      nombre: t.nombre, ref: t, lon: t.lon, lat: t.lat, ...Geo.aMundo(t.lon, t.lat),
    }));
    const ciencia = D.objetivos.map(o => {
      const p = { id: 'C' + o.id, tipo: 'ciencia', etiqueta: o.id, ref: o, lon: o.lon, lat: o.lat, ...Geo.aMundo(o.lon, o.lat) };
      Object.defineProperty(p, 'nombre', { get: () => I18N.t('crater', { id: o.id }), enumerable: true });
      return p;
    });
    return tubos.concat(ciencia);
  }

  /* Longitud de un recorrido cerrado inicio → paradas → inicio. */
  function longitud(inicio, orden) {
    let tot = 0, prev = inicio;
    for (const p of orden) { tot += Geo.distancia(prev, p); prev = p; }
    return tot + Geo.distancia(prev, inicio);
  }

  /* Vecino más cercano + mejora 2-opt: óptimo o casi óptimo para ~12 paradas. */
  function optimizar(inicio, paradas) {
    if (paradas.length < 2) return paradas.slice();
    let mejor = null, mejorL = Infinity;
    const arranques = paradas.map((_, i) => i);
    for (const a of arranques) {
      const restantes = paradas.slice();
      const orden = [restantes.splice(a, 1)[0]];
      while (restantes.length) {
        const ult = orden[orden.length - 1];
        let k = 0, dk = Infinity;
        restantes.forEach((p, i) => { const d = Geo.distancia(ult, p); if (d < dk) { dk = d; k = i; } });
        orden.push(restantes.splice(k, 1)[0]);
      }
      let mejora = true, o = orden;
      while (mejora) {
        mejora = false;
        for (let i = 0; i < o.length - 1; i++) {
          for (let j = i + 1; j < o.length; j++) {
            const n = o.slice(0, i).concat(o.slice(i, j + 1).reverse(), o.slice(j + 1));
            if (longitud(inicio, n) < longitud(inicio, o) - 1e-6) { o = n; mejora = true; }
          }
        }
      }
      const l = longitud(inicio, o);
      if (l < mejorL) { mejorL = l; mejor = o; }
    }
    return mejor;
  }

  function minutosParada(p) { return p.tipo === 'tubo' ? S.min_por_tubo : S.min_por_muestra; }

  /* Plan completo: orden, tramos, tiempos y línea de tiempo. */
  function planificar(habitat, incluidas) {
    const inicio = { ...Geo.aMundo(habitat.lon, habitat.lat), lon: habitat.lon, lat: habitat.lat, tipo: 'habitat' };
    Object.defineProperty(inicio, 'nombre', { get: () => I18N.t('habitat') });
    const orden = optimizar(inicio, incluidas);
    const v = S.velocidad_m_s;
    const segmentos = [];
    let prev = inicio, total = 0, minutos = 0, maxCasa = 0;
    orden.forEach(p => {
      const d = Geo.distancia(prev, p);
      total += d; minutos += d / v / 60;
      segmentos.push({ tipo: 'camino', min: d / v / 60 });
      segmentos.push({ tipo: p.tipo, min: minutosParada(p), parada: p });
      minutos += minutosParada(p);
      maxCasa = Math.max(maxCasa, Geo.distancia(inicio, p));
      p.tramo = d;
      prev = p;
    });
    const regreso = Geo.distancia(prev, inicio);
    total += regreso; minutos += regreso / v / 60;
    segmentos.push({ tipo: 'camino', min: regreso / v / 60, regreso: true });
    return { inicio, orden, total, minutos, regreso, maxCasa, segmentos };
  }

  function horaMas(hhmm, minutos) {
    const [h, m] = hhmm.split(':').map(Number);
    const t = Math.round(h * 60 + m + minutos);
    const hh = Math.floor(t / 60) % 24, mm = ((t % 60) + 60) % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function duracion(min) {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
  }

  window.Ruta = { paradasBase, optimizar, planificar, horaMas, duracion, minutosParada };
})();
