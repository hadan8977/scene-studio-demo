import { MapPin, Navigation2 } from 'lucide-react';

/** Real OSM geometry, locally styled and hosted: no tile provider or key at runtime. */
export function NavigationMap() {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#101317]"
      data-testid="real-map"
    >
      {/* A factual map is a data visualization; the SVG is generated from OSM coordinates. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/map/west-bund.svg"
        alt="上海徐汇滨江地图，标出龙腾大道、黄浦江和龙美术馆西岸馆，车辆箭头位于龙腾大道路线上"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_42%_38%,transparent_25%,rgba(6,8,10,0.45)_100%)]" />
      <div className="absolute left-10 top-24 w-[340px] rounded-2xl border border-white/[0.07] bg-card/90 p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[17px] tracking-[0.18em] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" /> SHANGHAI · WEST BUND
        </div>
        <div className="mt-3 text-[36px] tracking-tight text-foreground">
          徐汇滨江
        </div>
        <div className="mt-1 flex items-center gap-2 text-[22px] text-muted-foreground">
          <span className="h-0.5 w-5 rounded bg-primary" /> 龙腾大道
        </div>
      </div>
      <div
        aria-label="地图朝北"
        className="absolute right-10 top-36 flex h-14 w-14 flex-col items-center justify-center rounded-full border border-white/10 bg-card/80 text-muted-foreground shadow-lg backdrop-blur-md"
      >
        <span className="font-mono text-[16px]">N</span>
        <Navigation2 className="h-5 w-5 text-foreground/80" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[350px] bg-gradient-to-t from-background/95 to-transparent" />
      <div className="absolute bottom-5 left-8 z-10 flex items-center gap-2 text-[17px] text-muted-foreground/80">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="rounded bg-background/70 px-2 py-1 hover:text-foreground"
        >
          © OpenStreetMap contributors
        </a>
        <a
          href="/map/west-bund.geojson"
          download
          className="rounded bg-background/70 px-2 py-1 hover:text-foreground"
        >
          ODbL · 地图数据
        </a>
      </div>
    </div>
  );
}
