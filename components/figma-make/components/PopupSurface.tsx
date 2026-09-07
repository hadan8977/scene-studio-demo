import { useEffect, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  ArrowUp,
  Wifi,
  BatteryMedium,
  ParkingSquare,
  Gauge,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Composer } from './Composer';
import { NavigationMap } from './NavigationMap';
import { PROFILES } from '../domain/profiles';
import { CasePicker } from './CasePicker';
import type { Generation } from '../useGeneration';

function ControlCluster({
  gen,
  onReview,
}: {
  gen: Generation;
  onReview: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-full bg-black/40 p-0.5 backdrop-blur-md">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            aria-label={'切换档案 ' + p.name}
            aria-pressed={gen.profileId === p.id}
            onClick={() => gen.setProfileId(p.id)}
            className={`rounded-full px-2.5 py-1 text-[17px] transition-colors ${gen.profileId === p.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <button
        aria-label={gen.driving === 'parked' ? '切换到行驶态' : '切换到停车态'}
        onClick={() =>
          gen.setDriving(gen.driving === 'parked' ? 'driving' : 'parked')
        }
        className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 text-[17px] text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
      >
        {gen.driving === 'parked' ? (
          <ParkingSquare className="h-3 w-3" />
        ) : (
          <Gauge className="h-3 w-3 text-primary" />
        )}
        {gen.driving === 'parked' ? '停车' : '行驶中'}
      </button>
      <span
        className={`rounded-full px-2.5 py-1.5 text-[17px] backdrop-blur-md ${gen.mode === 'real' ? 'bg-primary/20 text-primary' : 'border border-white/10 bg-black/40 text-muted-foreground'}`}
      >
        {gen.mode === 'real'
          ? gen.configured
            ? 'AI 已连接'
            : 'AI 未连接'
          : '示例回放'}
      </span>
      <button
        aria-label="打开评审设置"
        onClick={onReview}
        className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 text-[17px] text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
      >
        <SlidersHorizontal className="h-3 w-3" /> 评审
      </button>
    </div>
  );
}

export function PopupSurface({
  gen,
  onReview,
}: {
  gen: Generation;
  onReview: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (gen.phase === 'thinking' || gen.experience.route) setCollapsed(false);
  }, [gen.phase, gen.experience.route]);
  const hasContent = gen.phase !== 'idle' || !!gen.experience.route;
  const active = hasContent && !collapsed;
  const [text, setText] = [gen.input, gen.setInput];

  return (
    <div data-testid="popup-surface" className="relative h-full w-full">
      <NavigationMap />

      {/* 系统状态栏（属于系统 / 另一个 app，我们不占用）*/}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2 font-mono text-[18px] uppercase tracking-[0.2em] text-muted-foreground/60">
          <span className="h-2 w-2 rounded-full bg-primary/70" /> 座舱 OS ·
          导航情境演示
        </div>
        <div className="flex items-center gap-4 font-mono text-[18px] text-muted-foreground/60">
          <span>车外 18℃</span>
          <span>22:14</span>
          <Wifi className="h-3.5 w-3.5" />
          <BatteryMedium className="h-4 w-4" />
        </div>
      </div>

      {/* 右上：演示控制 */}
      <div className="absolute right-8 top-16 z-10">
        <ControlCluster gen={gen} onReview={onReview} />
      </div>

      {/* 主动服务弹层：停在拇指区（底部）*/}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-8 pb-5">
        <AnimatePresence>
          {active && (
            <motion.div
              key="popup"
              data-testid="service-popup"
              style={{ '--scene-body-limit': '650px' } as CSSProperties}
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="mb-4 flex max-h-[730px] w-[700px] flex-col overflow-hidden rounded-[24px] border border-border bg-card/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-6 py-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-[20px] text-foreground">
                  小塔 · 随你所处
                </span>
                <span className="ml-auto font-mono text-[16px] uppercase tracking-widest text-muted-foreground">
                  建议 · 你说了算
                </span>
                <button
                  onClick={() => setCollapsed(true)}
                  aria-label="收起场景卡片"
                  className="ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <Composer
                  gen={gen}
                  onSwitchToReal={() => {
                    gen.setMode('real');
                    onReview();
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && hasContent && (
          <button
            onClick={() => setCollapsed(false)}
            className="mb-4 flex items-center gap-2 rounded-full border border-primary/25 bg-card/95 px-4 py-2.5 text-[20px] text-primary"
          >
            <Sparkles className="h-4 w-4" />
            继续查看小塔的回应
          </button>
        )}
        {/* 示例引导 */}
        {!hasContent && <CasePicker onTry={gen.playAmbient} />}

        {gen.experience.presentation === 'proposal' &&
          gen.scene &&
          !gen.scene.clarify &&
          !gen.editing &&
          gen.driving === 'parked' && (
            <div className="mb-3 flex items-center gap-3 text-[18px] text-muted-foreground">
              <span>用卡片内的「改一下」续改提案</span>
              <button
                onClick={gen.reset}
                className="rounded-full border border-white/10 bg-card/80 px-3 py-1.5 text-foreground/80 hover:border-primary/40"
              >
                新建另一个
              </button>
            </div>
          )}
        {/* 命令栏（唤起小塔）*/}
        <div className="flex w-[780px] items-center gap-2 rounded-full border border-border bg-card/90 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Mic className="h-5 w-5" />
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="描述你想要的场景"
            maxLength={1200}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                void gen.submitVoice();
            }}
            placeholder={
              gen.editing
                ? '继续改这张卡，例如：灯再暗一点…'
                : '对小塔说一句，例如：她说还要二十分钟…'
            }
            className="flex-1 bg-transparent px-1 text-[23px] text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          <button
            aria-label="发送给小塔"
            onClick={() => gen.submitVoice()}
            disabled={!text.trim()}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 text-[17px] text-muted-foreground/50">
          文字模拟语音 ·{' '}
          {gen.driving === 'driving'
            ? '行驶模拟 · 完整提案停车后查看'
            : gen.mode === 'example'
              ? '示例模式，预置回放'
              : gen.configured
                ? '真实 AI 已连接'
                : '真实 AI 未连接'}
        </div>
      </div>
    </div>
  );
}
