import { Navigation, MapPin } from 'lucide-react';

export function AssistantMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={'assistant-mark' + (small ? ' small' : '')}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" fill="none">
        <path
          d="M30 9h4c0 13 8 21 21 21v4c-13 0-21 8-21 21h-4c0-13-8-21-21-21v-4c13 0 21-8 21-21Z"
          fill="currentColor"
        />
        <circle cx="48" cy="16" r="4" fill="currentColor" />
      </svg>
    </span>
  );
}

export function SoundArtwork({ large = false }: { large?: boolean }) {
  return (
    <div className={'sound-art' + (large ? ' large' : '')} aria-hidden="true">
      <div className="sound-sun" />
      <i />
      <i />
      <i />
      <span>
        AFTER
        <br />
        HOURS
      </span>
    </div>
  );
}

export function NavigationCanvas({
  driving,
  zoom,
}: {
  driving: boolean;
  zoom: number;
}) {
  const blocks = Array.from({ length: 132 }, (_, i) => ({
    x: (i % 12) * 155 - 110,
    y: Math.floor(i / 12) * 104 - 100,
    w: 100 + (i % 3) * 11,
    h: 54 + (i % 4) * 5,
  }));
  return (
    <div className="navigation-canvas" aria-label="演示导航地图">
      <svg
        className="city-map"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label="西岸区域示意地图，不提供真实导航"
      >
        <defs>
          <linearGradient id="mapGround" x2="1" y2="1">
            <stop stopColor="#181c1c" />
            <stop offset="1" stopColor="#111415" />
          </linearGradient>
          <linearGradient id="river" x2="1" y2="1">
            <stop stopColor="#111b1b" />
            <stop offset="1" stopColor="#1a2a2b" />
          </linearGradient>
          <linearGradient id="building" x2="0.2" y2="1">
            <stop stopColor="#2b3030" />
            <stop offset="1" stopColor="#212625" />
          </linearGradient>
          <linearGradient id="route" x2="1" y2="0">
            <stop stopColor="#b0c44e" />
            <stop offset="1" stopColor="#e0f497" />
          </linearGradient>
          <filter id="routeGlow">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>
        <rect width="1920" height="1080" fill="url(#mapGround)" />
        <g transform={`translate(800 500) scale(${zoom}) translate(-800 -500)`}>
          <g transform="translate(70 155) skewY(-13) rotate(-17 750 500)">
            <g
              fill="url(#building)"
              stroke="#515950"
              strokeWidth="1"
              opacity=".68"
            >
              {blocks.map((b, i) => (
                <g key={i}>
                  <rect
                    x={b.x + 5}
                    y={b.y + 7}
                    width={b.w}
                    height={b.h}
                    rx="7"
                    fill="#0e162a"
                  />
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" />
                  <path
                    d={`M${b.x + 9} ${b.y + 8}h${b.w - 18}`}
                    stroke="#748199"
                    opacity=".35"
                  />
                </g>
              ))}
            </g>
            <path
              d="M-100 532H1780M450-200V1400M1080-100V1300"
              fill="none"
              stroke="#111715"
              strokeWidth="45"
            />
            <path
              d="M-100 532H1780M450-200V1400M1080-100V1300"
              fill="none"
              stroke="#687269"
              strokeOpacity=".22"
              strokeWidth="2"
            />
            <rect
              x="478"
              y="275"
              width="234"
              height="183"
              rx="35"
              fill="#273d30"
              stroke="#435b42"
            />
            <path
              d="M508 420Q550 285 680 310M505 340L680 400"
              stroke="#627b54"
              fill="none"
              opacity=".5"
              strokeWidth="3"
            />
          </g>
          <path
            d="M1350 -150C970 130 1340 400 1100 550S1230 870 1820 1270"
            fill="none"
            stroke="#0c1716"
            strokeWidth="210"
          />
          <path
            d="M1350 -150C970 130 1340 400 1100 550S1230 870 1820 1270"
            fill="none"
            stroke="url(#river)"
            strokeWidth="178"
          />
          <path
            d="M1350 -150C970 130 1340 400 1100 550S1230 870 1820 1270"
            fill="none"
            stroke="#8da99d"
            strokeOpacity=".15"
            strokeWidth="2"
          />
          <path
            d="M384 890L512 655Q522 633 550 623L837 535Q867 526 852 490L767 310"
            stroke="#b7d653"
            filter="url(#routeGlow)"
            strokeWidth="20"
            fill="none"
          />
          <path
            d="M384 890L512 655Q522 633 550 623L837 535Q867 526 852 490L767 310"
            stroke="#53662d"
            strokeWidth="18"
            fill="none"
          />
          <path
            d="M384 890L512 655Q522 633 550 623L837 535Q867 526 852 490L767 310"
            stroke="url(#route)"
            strokeWidth="7"
            fill="none"
          />
          <g
            fontFamily="Arial, Microsoft YaHei, sans-serif"
            fill="#929e94"
            fontSize="21"
            letterSpacing="3"
          >
            <text x="485" y="278" transform="rotate(-28 485 278)">
              龙腾大道
            </text>
            <text x="189" y="633" transform="rotate(-28 189 633)">
              瑞宁路
            </text>
            <text x="518" y="785" transform="rotate(-28 518 785)">
              龙华中路
            </text>
            <text x="595" y="438" fill="#92aa89">
              西岸滨江绿地
            </text>
            <text
              x="1210"
              y="320"
              fill="#658d84"
              transform="rotate(25 1210 320)"
            >
              黄 浦 江
            </text>
            <text x="760" y="215" fill="#d1dcbb">
              西岸美术馆
            </text>
          </g>
          <circle
            cx="767"
            cy="310"
            r="16"
            fill="#cdec52"
            stroke="#202b1a"
            strokeWidth="6"
          />
          <g
            transform={
              driving
                ? 'translate(550 625) rotate(65)'
                : 'translate(767 347) rotate(-25)'
            }
          >
            <circle r="48" fill="#cdec52" opacity=".12" />
            <circle r="31" fill="#cdec52" opacity=".12" />
            <path
              d="M0-24L18 19 0 10-18 19Z"
              fill="#edf8d6"
              stroke="#a4c658"
              strokeWidth="3"
            />
          </g>
        </g>
      </svg>
      <div className="map-vignette" />
      <div className="navigation-instruction">
        <div className="direction-icon">
          {driving ? <Navigation size={50} /> : <MapPin size={45} />}
        </div>
        <div>
          <span>{driving ? '前方路口右转' : '已抵达目的地'}</span>
          <h2>{driving ? '龙腾大道' : '西岸美术馆'}</h2>
          <p>{driving ? '沿当前道路行驶' : '滨江 · 临时停车区'}</p>
        </div>
      </div>
      <span className="map-caption">导航情境演示 · 非真实路线</span>
    </div>
  );
}
