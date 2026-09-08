import { useEffect, useState, type ReactNode } from 'react';

// ── 车机外框 ─────────────────────────────────────────────────
// 固定 1920×1080 设计画布，等比缩放居中。外壳做出有厚度的实体感
// （挤出边 + 分层阴影 + 轻微透视），所有显示与交互都在这块玻璃里。
export function HmiFrame({
  children,
  chrome,
}: {
  children: ReactNode;
  chrome?: ReactNode;
}) {
  const [scale, setScale] = useState(0.6);
  const [front, setFront] = useState(false);

  useEffect(() => {
    const calc = () => {
      const s = Math.max(
        0.08,
        Math.min(
          (window.innerWidth - 44) / 1920,
          (window.innerHeight - 64) / 1080,
        ),
      );
      setScale(s);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-clip bg-[#050506]"
      style={{ perspective: 2600 }}
    >
      {/* 展厅光 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_55%_at_50%_-10%,rgba(205,236,82,0.07),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_130%,rgba(16,18,22,0.95),transparent_60%)]" />
      {/* 设备落影 */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[1400px] -translate-x-1/2 translate-y-[280px] rounded-[50%] bg-black/70 blur-[80px]" />

      {/* 中控外壳（有厚度 + 轻微透视）*/}
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale}) rotateX(${front ? 0 : 2.5}deg) rotateY(${front ? 0 : -5}deg)`,
          transition: 'transform 450ms ease',
          boxShadow:
            '0 2px 0 1px rgba(255,255,255,0.05), 26px 30px 0 -2px #060708, 34px 44px 60px -10px rgba(0,0,0,0.85), 0 60px 140px -30px rgba(0,0,0,0.9)',
        }}
        data-testid="hmi-frame"
        className="relative shrink-0 rounded-[46px] bg-gradient-to-b from-[#181a1e] to-[#0c0d10] p-[15px]"
      >
        {/* 边框顶光 */}
        <div className="pointer-events-none absolute inset-0 rounded-[46px] bg-[linear-gradient(155deg,rgba(255,255,255,0.09),transparent_26%)]" />
        <div className="pointer-events-none absolute inset-[3px] rounded-[42px] ring-1 ring-black/60" />
        {/* 屏幕玻璃 */}
        <div className="relative h-full w-full overflow-clip rounded-[32px] bg-background text-foreground">
          <div className="h-full pb-[80px]">{children}</div>
          {chrome && (
            <div className="absolute inset-x-0 bottom-0 z-30 flex h-[80px] items-center justify-center border-t border-white/[0.04] bg-[#0b0c0e]/95">
              {chrome}
              <button
                onClick={() => setFront((v) => !v)}
                aria-pressed={front}
                className="absolute right-7 min-h-12 rounded-full border border-border px-5 text-[18px] text-muted-foreground hover:text-foreground"
              >
                {front ? '驾驶员视角' : '正视阅读'}
              </button>
            </div>
          )}
          {/* 玻璃反光 */}
          <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[linear-gradient(120deg,rgba(255,255,255,0.04),transparent_18%,transparent_82%,rgba(255,255,255,0.02))]" />
        </div>
      </div>

      {/* 网页级底部控制（切换界面等）*/}
    </div>
  );
}
