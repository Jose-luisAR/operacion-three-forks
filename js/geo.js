/* Operación Three Forks — geometría local.
   Sistema "mundo": metros con E hacia el este y S hacia el sur, origen en la
   esquina noroeste de la imagen HiRISE. Así la imagen se dibuja tal cual. */
(function () {
  const D = window.DATOS;
  const L = D.limites;
  const M = D.m_por_grado;
  const latRef = (L.norte + L.sur) / 2;
  const cosRef = Math.cos(latRef * Math.PI / 180);

  const anchoM = (L.este - L.oeste) * M * cosRef;
  const altoM = (L.norte - L.sur) * M;
  const mPorPxX = anchoM / L.ancho_px;
  const mPorPxY = altoM / L.alto_px;

  function aMundo(lon, lat) {
    return { e: (lon - L.oeste) * M * cosRef, s: (L.norte - lat) * M };
  }
  function aLonLat(e, s) {
    return { lon: L.oeste + e / (M * cosRef), lat: L.norte - s / M };
  }
  function aPx(lon, lat) {
    return {
      x: (lon - L.oeste) / (L.este - L.oeste) * L.ancho_px,
      y: (L.norte - lat) / (L.norte - L.sur) * L.alto_px,
    };
  }
  function pxALonLat(x, y) {
    return {
      lon: L.oeste + x / L.ancho_px * (L.este - L.oeste),
      lat: L.norte - y / L.alto_px * (L.norte - L.sur),
    };
  }
  function distancia(a, b) { return Math.hypot(a.e - b.e, a.s - b.s); }
  /* Rumbo en grados desde el norte, en sentido horario. */
  function rumbo(a, b) {
    const r = Math.atan2(b.e - a.e, -(b.s - a.s)) * 180 / Math.PI;
    return (r + 360) % 360;
  }
  function difAngulo(a, b) { return ((b - a + 540) % 360) - 180; }
  function avanzar(p, rumboGrados, metros) {
    const r = rumboGrados * Math.PI / 180;
    return { e: p.e + Math.sin(r) * metros, s: p.s - Math.cos(r) * metros };
  }
  function puntoCardinal(g) {
    const n = I18N.t('cardinal');
    return n[Math.round(((g % 360) + 360) % 360 / 45) % 8];
  }

  window.Geo = { aMundo, aLonLat, aPx, pxALonLat, distancia, rumbo, difAngulo, avanzar, puntoCardinal,
    anchoM, altoM, mPorPxX, mPorPxY };
})();
