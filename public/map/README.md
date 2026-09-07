# West Bund static map

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

`west-bund.geojson` contains the distributed geographic extract used to produce `west-bund.svg`. The extract and derivative geographic data remain under ODbL. The SVG is a produced work with custom Scene Studio styling. Attribution and the downloadable data remain visible in the application.

- Area: Shanghai Xuhui waterfront, bounds 31.162,121.438,31.202,121.492.
- Source: Overpass API (`https://overpass.kumi.systems/api/interpreter`).
- OSM base timestamp: 2026-06-01T08:52:28Z (reported by the source; this is a snapshot, not a current navigation service).
- Features rendered: highway ways, buildings, water ways, park ways and a museum landmark. Complex relation-only polygons are not reconstructed in this static extract.
- Highlight: actual OSM ways named 龙腾大道. Landmark: node 3126004579, 龙美术馆（西岸馆）.
- Projection: Web Mercator; no GPS lookup, commercial tiles, map API key or runtime network requests to a map provider.

Rebuild using `node scripts/build-map.mjs path/to/overpass.json` from the repository root. The source export query is:

```overpass
[out:json][timeout:30];
(
  way[highway](31.162,121.438,31.202,121.492);
  way[building](31.162,121.438,31.202,121.492);
  way[natural=water](31.162,121.438,31.202,121.492);
  relation[natural=water](31.162,121.438,31.202,121.492);
  way[leisure=park](31.162,121.438,31.202,121.492);
  nwr[tourism=museum](31.162,121.438,31.202,121.492);
);
out geom;
```
