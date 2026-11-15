/* Operation Three Forks — local geometry.
   "World" frame: meters, with E pointing east and S pointing south, origin at
   the north-west corner of the HiRISE image, so the image can be drawn as is. */
(function () {
  const D = window.DATA;
  const B = D.bounds;
  const M = D.m_per_degree;
  const refLat = (B.north + B.south) / 2;
  const cosRef = Math.cos(refLat * Math.PI / 180);

  const widthM = (B.east - B.west) * M * cosRef;
  const heightM = (B.north - B.south) * M;
  const mPerPxX = widthM / B.width_px;
  const mPerPxY = heightM / B.height_px;

  function toWorld(lon, lat) {
    return { e: (lon - B.west) * M * cosRef, s: (B.north - lat) * M };
  }
  function toPx(lon, lat) {
    return {
      x: (lon - B.west) / (B.east - B.west) * B.width_px,
      y: (B.north - lat) / (B.north - B.south) * B.height_px,
    };
  }
  function pxToLonLat(x, y) {
    return {
      lon: B.west + x / B.width_px * (B.east - B.west),
      lat: B.north - y / B.height_px * (B.north - B.south),
    };
  }
  function distance(a, b) { return Math.hypot(a.e - b.e, a.s - b.s); }
  /* Bearing in degrees from north, clockwise. */
  function bearing(a, b) {
    const r = Math.atan2(b.e - a.e, -(b.s - a.s)) * 180 / Math.PI;
    return (r + 360) % 360;
  }
  function angleDiff(a, b) { return ((b - a + 540) % 360) - 180; }
  function advance(p, bearingDeg, meters) {
    const r = bearingDeg * Math.PI / 180;
    return { e: p.e + Math.sin(r) * meters, s: p.s - Math.cos(r) * meters };
  }
  function compassPoint(deg) {
    const names = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    return names[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  }

  window.Geo = { toWorld, toPx, pxToLonLat, distance, bearing, angleDiff, advance, compassPoint,
    widthM, heightM, mPerPxX, mPerPxY };
})();
