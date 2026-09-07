import { VoiceFeedback } from './VoiceFeedback';
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
          : '示例模式'}
      </span>
      <button
        aria-label="打开评审设置"
        onClick={onReview}
        className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 text-[17px] text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
      >
        <SlidersHorizontal className="h-3 w-3" /> 设置
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
  const x = gen.experience;
  const hasContent = !!x.route || gen.phase !== 'idle';
  const active =
    gen.phase !== 'error' &&
    (((x.route?.kind === 'scene' || !x.route) && gen.phase !== 'idle') ||
      (x.route?.kind === 'suggestion' &&
        (x.presentation === 'offer' ||
          x.presentation === 'proposal' ||
          x.application !== 'idle')));
  const [text, setText] = [gen.input, gen.setInput];

  return (
    <div data-testid="popup-surface" className="relative h-full w-full">
      <NavigationMap />

      {/* 系统状态栏（属于系统 / 另一个 app，我们不占用）*/}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2 font-mono text-[18px] uppercase tracking-[0.2em] text-muted-foreground/60">
          <span className="h-2 w-2 rounded-full bg-primary/70" /> 导航
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
              layout
              data-testid="service-popup"
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="mb-5 flex max-h-[710px] w-[580px] flex-col overflow-hidden rounded-[24px] border border-border bg-card/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl [&_[data-editor-body]]:max-h-[300px]"
            >
              <div className="flex shrink-0 items-center gap-2 px-6 pb-3 pt-5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-[20px] text-foreground">小塔</span>
                <button
                  onClick={() => {
                    if (x.route?.kind === 'suggestion') x.decline();
                    gen.reset();
                  }}
                  aria-label="关闭场景卡片"
                  className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
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

        {!hasContent && <CasePicker onTry={gen.playAmbient} />}
        {hasContent && <VoiceFeedback gen={gen} />}
        {/* 命令栏（唤起小塔）*/}
        <div className="flex w-[680px] items-center gap-2 rounded-full border border-border bg-card/90 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Mic className="h-5 w-5" />
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="描述你想要的场景"
            disabled={gen.driving === 'driving'}
            maxLength={1200}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                void gen.submitVoice();
            }}
            placeholder={gen.editing ? '说说想改哪里' : '你好，小塔'}
            className="flex-1 bg-transparent px-1 text-[23px] text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          <button
            aria-label="发送给小塔"
            onClick={() => gen.submitVoice()}
            disabled={!text.trim() || gen.driving === 'driving'}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
