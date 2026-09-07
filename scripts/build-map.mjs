// Rebuild the static map from an Overpass JSON export. No network during builds.
// Usage: node scripts/build-map.mjs path/to/overpass.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const source = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (source.remark || !source.elements?.length)
  throw new Error('Incomplete OSM export');
const out = new URL('../public/map/', import.meta.url);
mkdirSync(out, { recursive: true });
const merc = (lat) =>
  (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const scale = 1920 / (121.492 - 121.438);
const point = ({ lon, lat }) => [
  (lon - 121.438) * scale,
  (merc(31.192) - merc(lat)) * scale,
];
const escape = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
const paths = {
  water: [],
  park: [],
  building: [],
  minor: [],
  road: [],
  major: [],
  tunnel: [],
  highlight: [],
};
const features = [];
const labels = [];
const names = new Set();
const line = (geom) =>
  geom
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'}${point(p)
          .map((n) => n.toFixed(1))
          .join(',')}`,
    )
    .join('');
for (const e of source.elements) {
  if (e.type !== 'way' || !e.geometry?.length) continue;
  const t = e.tags || {},
    geo = e.geometry;
  let layer =
    t.natural === 'water'
      ? 'water'
      : t.leisure === 'park'
        ? 'park'
        : t.building
          ? 'building'
          : null;
  if (t.highway)
    layer = /footway|path|cycleway|steps|service|pedestrian/.test(t.highway)
      ? 'minor'
      : /motorway|trunk|primary/.test(t.highway)
        ? 'major'
        : 'road';
  if (!layer) continue;
  const closed = ['water', 'park', 'building'].includes(layer);
  const path = line(geo) + (closed ? 'Z' : '');
  paths[t.tunnel ? 'tunnel' : layer].push(path);
  if (t.name === '龙腾大道') paths.highlight.push(path);
  features.push({
    type: 'Feature',
    id: `way/${e.id}`,
    properties: { name: t.name, layer, highway: t.highway },
    geometry: {
      type: closed ? 'Polygon' : 'LineString',
      coordinates: closed
        ? [geo.map((p) => [p.lon, p.lat])]
        : geo.map((p) => [p.lon, p.lat]),
    },
  });
  if (
    t.name &&
    t.highway &&
    !names.has(t.name) &&
    !/minor|tunnel/.test(layer)
  ) {
    const mid = geo[Math.floor(geo.length / 2)],
      [x, y] = point(mid);
    const first = point(geo[0]),
      last = point(geo.at(-1));
    const length = Math.hypot(last[0] - first[0], last[1] - first[1]);
    if (
      length < 110 ||
      x < 120 ||
      x > 1770 ||
      y < 100 ||
      y > 890 ||
      labels.some((l) => Math.hypot(l.x - x, l.y - y) < 145)
    )
      continue;
    let angle =
      (Math.atan2(last[1] - first[1], last[0] - first[0]) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    labels.push({ x, y, angle, name: t.name });
    names.add(t.name);
  }
}
const museum = source.elements.find(
  (e) => e.id === 3126004579 && e.type === 'node',
);
if (!museum || paths.highlight.length === 0 || paths.water.length === 0)
  throw new Error('Map landmarks missing');
const [mx, my] = point(museum);
features.push({
  type: 'Feature',
  id: `node/${museum.id}`,
  properties: { name: museum.tags.name, layer: 'landmark' },
  geometry: { type: 'Point', coordinates: [museum.lon, museum.lat] },
});
const metadata = {
  source: 'OpenStreetMap contributors',
  license: 'https://opendatacommons.org/licenses/odbl/1-0/',
  copyright: 'https://www.openstreetmap.org/copyright',
  timestamp: source.osm3s.timestamp_osm_base,
  queryBounds: [121.438, 31.162, 121.492, 31.202],
  projectedLandmark: [mx, my],
};
writeFileSync(
  new URL('west-bund.geojson', out),
  JSON.stringify({ type: 'FeatureCollection', ...metadata, features }),
);
const group = (key, attrs) =>
  `<g ${attrs}><path d="${paths[key].join('')}"/></g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1000">
<title>上海徐汇滨江真实街区地图</title><desc>OpenStreetMap contributors, ODbL. Data ${escape(metadata.timestamp)}. Custom Scene Studio styling. Highlighted road: 龙腾大道. This is a static map, not live navigation.</desc>
<rect width="1920" height="1000" fill="#101317"/>
${group('park', 'fill="#1b2421" stroke="#26322a" stroke-width="1"')}
${group('water', 'fill="#080e13" stroke="#2b363b" stroke-width="1.5"')}
${group('building', 'fill="#1c2025" stroke="#292e34" stroke-width="0.6"')}
${group('minor', 'fill="none" stroke="#282e32" stroke-width="1.5"')}
${group('road', 'fill="none" stroke="#0c0f13" stroke-width="9" stroke-linecap="round"')}
${group('road', 'fill="none" stroke="#343a3f" stroke-width="5" stroke-linecap="round"')}
${group('major', 'fill="none" stroke="#101317" stroke-width="13" stroke-linecap="round"')}
${group('major', 'fill="none" stroke="#444a4e" stroke-width="7" stroke-linecap="round"')}
${group('tunnel', 'fill="none" stroke="#444a4e" stroke-opacity="0.7" stroke-width="3" stroke-dasharray="7 7"')}
${group('highlight', 'fill="none" stroke="#cdec52" stroke-opacity="0.1" stroke-width="22" stroke-linecap="round"')}
${group('highlight', 'fill="none" stroke="#cdec52" stroke-opacity="0.8" stroke-width="5" stroke-linecap="round"')}
<g fill="#90999d" font-family="sans-serif" font-size="15" text-anchor="middle" stroke="#101317" stroke-width="5" paint-order="stroke" stroke-linejoin="round">${labels.map((l) => `<text transform="translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.angle.toFixed(1)})" dy="-10">${escape(l.name)}</text>`).join('')}</g>
<text x="930" y="365" fill="#52646c" font-family="sans-serif" font-size="23" letter-spacing="12" transform="rotate(-60 930 365)">黄浦江</text>
<circle cx="${mx}" cy="${my}" r="19" fill="#cdec52" fill-opacity="0.1"/><circle cx="${mx}" cy="${my}" r="6" fill="#cdec52" stroke="#15171a" stroke-width="3"/>
<text x="${mx - 24}" y="${my - 22}" text-anchor="end" fill="#e5e8dc" font-family="sans-serif" font-size="19" stroke="#101317" stroke-width="5" paint-order="stroke">龙美术馆 · 西岸</text>
</svg>`;
writeFileSync(new URL('west-bund.svg', out), svg);
writeFileSync(new URL('source.json', out), JSON.stringify(metadata, null, 2));
console.log(
  JSON.stringify({
    features: features.length,
    svgBytes: Buffer.byteLength(svg),
    landmark: [mx, my],
    labels: labels.length,
    sourceTimestamp: metadata.timestamp,
  }),
);
