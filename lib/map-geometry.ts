export type Point = [number, number];
const merc = (lat: number) =>
  (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
export function project([lon, lat]: Point): Point {
  return [
    ((lon - 121.438) * 1920) / 0.054,
    ((merc(31.192) - merc(lat)) * 1920) / 0.054,
  ];
}
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function pointOnRoute(points: Point[], fraction: number) {
  const lengths = points.slice(1).map((p, i) => distance(points[i], p));
  let left =
    lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, fraction));
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i];
    if (left <= length || i === lengths.length - 1) {
      const t = length ? left / length : 0,
        a = points[i],
        b = points[i + 1];
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as Point,
        angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 90,
      };
    }
    left -= length;
  }
  throw new Error('A route needs at least two points');
}
export function routeDistance(point: Point, route: Point[]) {
  return Math.min(
    ...route.slice(1).map((b, i) => {
      const a = route[i],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(
            1,
            ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) /
              (dx * dx + dy * dy || 1),
          ),
        );
      return distance(point, [a[0] + t * dx, a[1] + t * dy]);
    }),
  );
}
export function connectedRoute(segments: Point[][]): Point[] {
  const pending = segments.map((s) => [...s]),
    chains: Point[][] = [];
  while (pending.length) {
    let chain = pending.shift()!;
    let joined = true;
    while (joined) {
      joined = false;
      for (let i = 0; i < pending.length; i++) {
        const segment = pending[i];
        if (distance(chain.at(-1)!, segment[0]) < 0.1)
          chain.push(...segment.slice(1));
        else if (distance(chain.at(-1)!, segment.at(-1)!) < 0.1)
          chain.push(...segment.reverse().slice(1));
        else if (distance(chain[0], segment.at(-1)!) < 0.1)
          chain = [...segment.slice(0, -1), ...chain];
        else if (distance(chain[0], segment[0]) < 0.1)
          chain = [...segment.reverse().slice(0, -1), ...chain];
        else continue;
        pending.splice(i, 1);
        joined = true;
        break;
      }
    }
    chains.push(chain);
  }
  const visible: Point[][] = [];
  for (const chain of chains) {
    let part: Point[] = [];
    for (const p of chain) {
      if (p[0] >= 30 && p[0] <= 1890 && p[1] >= 160 && p[1] <= 880)
        part.push(p);
      else {
        if (part.length > 1) visible.push(part);
        part = [];
      }
    }
    if (part.length > 1) visible.push(part);
  }
  const length = (p: Point[]) =>
    p.slice(1).reduce((total, v, i) => total + distance(p[i], v), 0);
  const route = visible.sort((a, b) => length(b) - length(a))[0];
  if (!route) throw new Error('No continuous visible road');
  return route[0][1] < route.at(-1)![1] ? route : route.reverse();
}
