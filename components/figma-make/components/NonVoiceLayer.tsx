import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Wind,
  Music2,
  Armchair,
  Sun,
  SlidersHorizontal,
  Sparkles,
  ArrowUpRight,
  ChevronRight,
  Minus,
  Plus,
  Fingerprint,
  EyeOff,
  BookOpen,
  BriefcaseBusiness,
  Users,
  Sunrise,
} from 'lucide-react';
import {
  STORIES,
  CONTROL_GROUPS,
  VEHICLE_DEFAULTS,
  valuesFor,
  stages,
  stageLabel,
} from '@/lib/nonvoice';
import type { Generation } from '../useGeneration';
import { useOverlayFocus } from './useOverlayFocus';

const button =
  'min-h-14 rounded-2xl border border-white/10 px-5 text-[22px] transition-colors hover:bg-white/[0.06] disabled:opacity-30';
const icons: Record<string, typeof Wind> = {
  空调: Wind,
  座椅: Armchair,
  灯光: Sun,
  声音: Music2,
  车窗: SlidersHorizontal,
};
const storyIcons = [Music2, Wind, Wind, BriefcaseBusiness, Users, Sunrise, Sun];
export function ValuePicker({
  primary,
  value,
  onChange,
  onClose,
}: {
  primary: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const values = valuesFor(primary),
    index = Math.max(0, values.indexOf(value));
  const [preview, setPreview] = useState(index);
  const numerical = values.length > 8 || values.every((v) => /^\d/.test(v));
  const commit = (i: number) => {
    const safe = Math.min(values.length - 1, Math.max(0, i));
    setPreview(safe);
    onChange(values[safe]);
  };
  return (
    <div
      data-testid="value-picker"
      className="absolute inset-x-4 bottom-4 z-30 rounded-[26px] border border-white/15 bg-[#202521] p-6 shadow-[0_-20px_80px_#0008]"
    >
      <div className="flex items-center justify-between">
        <span className="text-[24px]">{primary}</span>
        <button aria-label="关闭数值调整" className="p-3" onClick={onClose}>
          <X className="h-6 w-6" />
        </button>
      </div>
      {numerical ? (
        <>
          <div className="my-6 flex items-center justify-between">
            <button
              className={button}
              aria-label={'降低' + primary}
              disabled={preview === 0}
              onClick={() => commit(preview - 1)}
            >
              <Minus />
            </button>
            <output className="font-mono text-[52px] tracking-tight text-primary">
              {values[preview]}
            </output>
            <button
              className={button}
              aria-label={'增加' + primary}
              disabled={preview === values.length - 1}
              onClick={() => commit(preview + 1)}
            >
              <Plus />
            </button>
          </div>
          <input
            className="nv-range my-5 w-full"
            aria-label={'调节' + primary}
            type="range"
            min={0}
            max={values.length - 1}
            step={1}
            value={preview}
            onChange={(e) => setPreview(Number(e.target.value))}
            onPointerUp={() => commit(preview)}
            onPointerCancel={() => setPreview(index)}
            onKeyUp={(e) => {
              if (
                [
                  'ArrowLeft',
                  'ArrowRight',
                  'Home',
                  'End',
                  'ArrowUp',
                  'ArrowDown',
                ].includes(e.key)
              )
                commit(preview);
            }}
          />
          <div className="flex justify-between text-[20px] text-muted-foreground">
            <span>{values[0]}</span>
            <span>{values.at(-1)}</span>
          </div>
        </>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {values.map((v) => (
            <button
              key={v}
              aria-pressed={v === value}
              className={`${button} ${v === value ? 'border-primary/40 bg-primary/15 text-primary' : ''}`}
              onClick={() => onChange(v)}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function HoldRow({
  name,
  value,
  onOpen,
  onHold,
}: {
  name: string;
  value: string;
  onOpen: () => void;
  onHold: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    held = useRef(false),
    start = useRef({ x: 0, y: 0 });
  const [press, setPress] = useState(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPress(false);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      aria-label={name + ' ' + value}
      className="group relative flex min-h-[72px] w-full items-center justify-between gap-4 overflow-hidden border-b border-white/[0.07] px-2 text-left text-[24px] hover:bg-white/[0.025]"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        held.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        setPress(true);
        timer.current = setTimeout(() => {
          held.current = true;
          setPress(false);
          onHold();
        }, 1000);
      }}
      onPointerMove={(e) => {
        if (
          Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) >
          12
        )
          clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => {
        e.preventDefault();
        clear();
        held.current = true;
        onHold();
      }}
      onClick={() => {
        if (!held.current) onOpen();
        held.current = false;
      }}
    >
      <span>{name.replace('控制', '').replace('调节', '')}</span>
      <span className="flex items-center gap-3 font-mono text-[26px] text-primary">
        {value}
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </span>
      {press && (
        <motion.span
          className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      )}
    </button>
  );
}
function StoryArt({ index }: { index: number }) {
  const Icon = storyIcons[index];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
      <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(205,236,82,.12),transparent_68%)]" />
      <svg
        viewBox="0 0 260 140"
        className="absolute -right-4 top-4 h-36 w-64 text-primary/10"
        fill="none"
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M 0 ${100 + i * 12} Q 100 ${-10 + i * 16} 260 ${50 + i * 12}`}
            stroke="currentColor"
            strokeWidth="1.3"
          />
        ))}
      </svg>
      <Icon className="absolute right-6 top-6 h-9 w-9 text-primary/70" />
    </div>
  );
}
export function NonVoiceLayer({ gen }: { gen: Generation }) {
  const n = gen.nonVoice;
  const [picker, setPicker] = useState<{
      primary: string;
      index?: number;
    } | null>(null),
    [captureMenu, setCaptureMenu] = useState(false),
    [showOlder, setShowOlder] = useState(false),
    [add, setAdd] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = n.panel !== 'closed';
  useOverlayFocus(active, dialog, () => n.close());
  useEffect(() => {
    queueMicrotask(() => {
      setPicker(null);
      setCaptureMenu(false);
      setAdd(false);
      setShowOlder(false);
    });
  }, [n.panel, n.storyId]);
  if (!active)
    return n.applied ? (
      <aside className="absolute bottom-28 right-12 z-20 flex items-center gap-6 rounded-2xl border border-white/15 bg-card/95 px-6 py-4 shadow-2xl">
        <span className="text-[23px]">{n.story?.name || '场景'}已应用</span>
        <button
          className={button + ' text-primary'}
          onClick={() => void n.undo()}
        >
          撤销
        </button>
      </aside>
    ) : null;
  const drafting =
    !!n.draft && ['proposal', 'capture', 'saved'].includes(n.panel);
  const body = n.draft?.scene;
  const updateEntry = (index: number, value: string) => {
    if (!body) return;
    n.changeScene({
      ...body,
      actions: body.actions.map((a, i) =>
        i === index ? { ...a, secondary: value } : a,
      ),
    });
  };
  return (
    <dialog
      open
      ref={dialog}
      aria-modal="true"
      aria-label={n.panel === 'stories' ? '体验故事' : '车控与场景'}
      className="absolute inset-0 z-30 m-0 h-full w-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 text-foreground outline-none"
      data-testid="nonvoice-layer"
    >
      <button
        aria-label="关闭场景浮层"
        tabIndex={-1}
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={() => n.close()}
      />
      {n.panel === 'stories' ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-x-[220px] top-12 bottom-12 flex flex-col rounded-[32px] border border-white/10 bg-[#111613]/98 p-8 shadow-2xl"
        >
          <div className="mb-7 flex items-center justify-between">
            <div>
              <div className="mb-2 font-mono text-[18px] tracking-[.22em] text-primary/70">
                MOMENTS, TOGETHER
              </div>
              <h2 className="text-[36px] tracking-tight">生活里的小片刻</h2>
              <p className="mt-2 text-[21px] text-muted-foreground">
                预设故事 · 操作车控，体验发现与保存
              </p>
            </div>
            <button
              className={button}
              aria-label="关闭体验故事"
              onClick={() => n.close()}
            >
              <X />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
            {STORIES.filter((s) => !s.basic).map((s, i) => (
              <button
                key={s.id}
                onClick={() => n.loadStory(s.id)}
                data-testid={'story-' + s.id}
                className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.025] p-6 text-left transition hover:border-primary/35 hover:bg-white/[0.045]"
              >
                <StoryArt index={i} />
                <span className="relative font-mono text-[18px] text-primary/60">
                  0{i + 1} / {s.entry === 'observation' ? '观察' : '顺手存'}
                </span>
                <h3 className="relative mt-10 text-[28px] leading-tight">
                  {s.title}
                </h3>
                <p className="relative mt-3 text-[20px] text-muted-foreground">
                  {s.category}
                </p>
                <ArrowUpRight className="absolute bottom-6 right-6 h-6 w-6 text-primary/60" />
              </button>
            ))}
            <div className="flex flex-col justify-center gap-4 rounded-[24px] border border-dashed border-white/10 p-6">
              <p className="text-[20px] text-muted-foreground">基础示例</p>
              {STORIES.filter((s) => s.basic).map((s) => (
                <button
                  key={s.id}
                  className="flex min-h-14 items-center justify-between text-[24px] hover:text-primary"
                  onClick={() => n.loadStory(s.id)}
                >
                  {s.title}
                  <ChevronRight className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="absolute left-[56px] top-9 flex items-center gap-4">
            <button
              className={button + ' bg-card/90'}
              onClick={() => n.setPanel('stories')}
            >
              <BookOpen className="mr-2 inline h-5 w-5" />
              体验故事
            </button>
            {n.story && (
              <span className="text-[21px] text-white/70">
                {n.story.title}{' '}
                <span className="ml-3 text-[18px] text-primary/60">
                  示例记录
                </span>
              </span>
            )}
          </div>
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-[114px] left-[56px] top-[118px] flex w-[720px] flex-col rounded-[30px] border border-white/10 bg-[#131815]/97 p-7 shadow-[0_30px_100px_#0008]"
            aria-label="车控面板"
          >
            <header className="flex items-center justify-between">
              <div>
                <p className="text-[20px] text-muted-foreground">CABIN</p>
                <h2 className="mt-1 text-[32px]">车内，刚刚好</h2>
              </div>
              <div className="flex gap-2">
                <button
                  aria-label={n.learning.paused ? '恢复本趟记录' : '这趟别记'}
                  aria-pressed={n.learning.paused}
                  onClick={() => n.pause(!n.learning.paused)}
                  className={`${button} px-3 ${n.learning.paused ? 'text-primary' : ''}`}
                >
                  <EyeOff className="h-6 w-6" />
                </button>
                <button
                  aria-label="车控菜单"
                  className={button + ' px-3'}
                  onClick={() => setCaptureMenu(!captureMenu)}
                >
                  <Fingerprint className="h-6 w-6" />
                </button>
                <button
                  aria-label="关闭车控"
                  className={button + ' px-3'}
                  onClick={() => n.close()}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </header>
            {captureMenu && (
              <div className="absolute right-6 top-24 z-20 rounded-2xl border border-white/15 bg-[#262d27] p-2 shadow-2xl">
                <button
                  className={button}
                  onClick={() => {
                    setCaptureMenu(false);
                    n.capture();
                  }}
                >
                  记住现在这样
                </button>
              </div>
            )}
            <nav
              className="mt-6 flex gap-1 border-b border-white/10 pb-4"
              aria-label="车控分类"
            >
              {Object.keys(CONTROL_GROUPS).map((t) => {
                const Icon = icons[t];
                return (
                  <button
                    key={t}
                    aria-pressed={n.tab === t}
                    onClick={() => {
                      n.setTab(t);
                      setPicker(null);
                    }}
                    className={`flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl text-[21px] ${n.tab === t ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                  >
                    <Icon className="h-5 w-5" />
                    {t}
                  </button>
                );
              })}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto pt-2">
              {CONTROL_GROUPS[n.tab].map((p) => (
                <HoldRow
                  key={p}
                  name={p}
                  value={gen.experience.vehicle[p] || VEHICLE_DEFAULTS[p]}
                  onOpen={() => setPicker({ primary: p })}
                  onHold={() => setCaptureMenu(true)}
                />
              ))}
            </div>
            {n.story?.entry === 'observation' && !n.reason && !drafting && (
              <button
                data-testid="observation-invitation"
                className="mt-5 flex min-h-[68px] items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[.08] px-4 text-left text-[24px] text-primary"
                onClick={n.openObservation}
              >
                <Sparkles className="h-6 w-6 shrink-0" />
                <span className="flex-1">{n.story.invitation}</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
            <div className="mt-4 flex items-center justify-between gap-3 text-[20px] text-muted-foreground">
              <span>
                {n.learning.paused ? (
                  <>
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary" />
                    这趟不记录
                  </>
                ) : (
                  '长按设置，记住现在这样'
                )}
              </span>
              <button className="min-h-12 text-primary" onClick={n.capture}>
                记住现在这样
              </button>
            </div>
            {picker && picker.index === undefined && (
              <ValuePicker
                key={picker.primary}
                primary={picker.primary}
                value={
                  gen.experience.vehicle[picker.primary] ||
                  VEHICLE_DEFAULTS[picker.primary]
                }
                onChange={(v) => void n.manual(picker.primary, v)}
                onClose={() => setPicker(null)}
              />
            )}
          </motion.section>
          {!drafting && (
            <aside className="absolute right-[74px] top-[170px] w-[560px]">
              {n.story ? (
                <>
                  <span className="text-[20px] text-primary/70">
                    {n.story.category}
                  </span>
                  <h2 className="mt-5 text-[44px] leading-tight tracking-tight">
                    {n.story.title}
                  </h2>
                  <p className="mt-6 text-[25px] leading-[1.7] text-white/70">
                    {n.story.body}
                  </p>
                  <div className="mt-8 h-px bg-gradient-to-r from-primary/30 to-transparent" />
                  <p className="mt-6 text-[22px] text-muted-foreground">
                    {n.story.entry === 'capture'
                      ? n.story.invitation
                      : '打开相关面板，看看小塔发现了什么。'}
                  </p>
                </>
              ) : (
                <>
                  <span className="text-primary/60">
                    MAKE ROOM FOR YOURSELF
                  </span>
                  <h2 className="mt-5 text-[44px]">舒服，不必从头再来。</h2>
                  <p className="mt-6 text-[25px] leading-relaxed text-muted-foreground">
                    调好温度、声音与光。喜欢现在这样，就顺手留下来。
                  </p>
                </>
              )}
              {n.story?.entry === 'observation' && (
                <details className="mt-7 text-[20px] text-muted-foreground">
                  <summary className="cursor-pointer">示例记录与判断</summary>
                  <div className="mt-4 space-y-4">
                    <p>{n.reason || '重复 4 / 5 次 · 验证 3 天 · 可建议'}</p>
                    <button
                      className={button}
                      onClick={() =>
                        n.setSimEvidence(
                          n.simEvidence === 'normal'
                            ? 'insufficient'
                            : 'normal',
                        )
                      }
                    >
                      {n.simEvidence === 'normal'
                        ? '查看记录不足的情况'
                        : '恢复完整记录'}
                    </button>
                    <button className={button} onClick={n.resetEvidence}>
                      重置示例额度与记录
                    </button>
                  </div>
                </details>
              )}
            </aside>
          )}
          {drafting && body && (
            <section
              className="absolute bottom-[114px] right-[56px] top-[118px] flex w-[630px] flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#1b211c]/98 shadow-[0_35px_110px_#000a]"
              data-testid="nonvoice-proposal"
            >
              <header className="flex shrink-0 items-center gap-3 px-7 pb-4 pt-6">
                <Sparkles className="h-6 w-6 text-primary" />
                <span className="text-[22px]">小塔</span>
                <button
                  className="ml-auto p-2"
                  aria-label="关闭保存卡片"
                  onClick={() => n.close()}
                >
                  <X className="h-6 w-6" />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-4">
                <p className="text-[20px] text-primary/70">
                  {n.applied
                    ? '已应用'
                    : n.panel === 'saved'
                      ? '已保存'
                      : n.panel === 'capture'
                        ? '记住现在这样'
                        : n.draft?.id
                          ? '已保存的场景'
                          : '记为一个场景'}
                </p>
                {n.editing ? (
                  <input
                    aria-label="新场景名称"
                    className="mt-3 w-full rounded-xl border border-white/15 bg-black/15 px-3 py-3 text-[30px] outline-none focus:border-primary/50"
                    maxLength={20}
                    value={body.name}
                    onChange={(e) =>
                      n.changeScene({ ...body, name: e.target.value })
                    }
                  />
                ) : (
                  <h2 className="mt-3 text-[34px] tracking-tight">
                    {body.name}
                  </h2>
                )}
                <div className="mt-4 flex flex-wrap gap-2 text-[20px] text-muted-foreground">
                  {body.conditions.length ? (
                    body.conditions.map((a, i) => (
                      <span key={i} className="rounded-lg bg-white/5 px-3 py-1">
                        {a.secondary.replace('挡位', '')}
                        {n.editing && (
                          <button
                            aria-label={'删除条件' + a.primary}
                            className="ml-2 text-primary"
                            onClick={() =>
                              n.changeScene({
                                ...body,
                                conditions: body.conditions.filter(
                                  (_, j) => i !== j,
                                ),
                              })
                            }
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  ) : (
                    <span>手动使用</span>
                  )}
                </div>
                <div className="mt-5">
                  {n.panel === 'capture' ? (
                    <>
                      {[
                        ...n.choices.filter((e) => e.recent),
                        ...(showOlder
                          ? n.choices.filter((e) => !e.recent)
                          : []),
                      ].map((e) => (
                        <div
                          key={e.primary}
                          className="flex min-h-[64px] items-center gap-3 border-b border-white/10 text-[22px]"
                        >
                          <input
                            className="h-6 w-6 accent-[#cdec52]"
                            type="checkbox"
                            aria-label={'保存' + e.primary}
                            checked={n.selected.includes(e.primary)}
                            onChange={() => n.toggleCapture(e.primary)}
                          />
                          <span className="flex-1">
                            {e.primary.replace('控制', '')}
                          </span>
                          <button
                            disabled={!n.selected.includes(e.primary)}
                            className="min-h-14 text-[24px] text-primary disabled:text-muted-foreground"
                            onClick={() =>
                              setPicker({
                                primary: e.primary,
                                index: body.actions.findIndex(
                                  (a) => a.primary === e.primary,
                                ),
                              })
                            }
                          >
                            {body.actions.find((a) => a.primary === e.primary)
                              ?.secondary || e.value}
                          </button>
                        </div>
                      ))}
                      {n.choices.some((e) => !e.recent) && (
                        <button
                          className="mt-4 text-[20px] text-muted-foreground"
                          onClick={() => setShowOlder(!showOlder)}
                        >
                          {showOlder ? '收起' : '更早调整的设置'} · 默认不选
                        </button>
                      )}
                    </>
                  ) : (
                    stages(body.actions).map((group, g) => (
                      <div key={g} className={g ? 'mt-5' : ''}>
                        {body.actions.some((a) => a.primary === '延时') && (
                          <p className="mb-2 text-[20px] text-primary/60">
                            {stageLabel(group.at)}
                          </p>
                        )}
                        {group.items.map(({ entry: a, index }) => (
                          <div
                            key={index}
                            className="flex min-h-[58px] items-center gap-2 border-b border-white/[.07] text-[22px]"
                          >
                            <span className="flex-1">
                              {a.primary
                                .replace('控制', '')
                                .replace('调节', '')}
                            </span>
                            <button
                              disabled={!n.editing}
                              aria-label={
                                stageLabel(group.at) + ' ' + a.primary
                              }
                              className="min-h-14 font-mono text-[24px] text-primary"
                              onClick={() =>
                                setPicker({ primary: a.primary, index })
                              }
                            >
                              {a.secondary}
                            </button>
                            {n.editing && (
                              <button
                                aria-label={'移除动作' + index}
                                className="p-2 text-muted-foreground"
                                onClick={() =>
                                  n.changeScene({
                                    ...body,
                                    actions: body.actions.filter(
                                      (_, i) => i !== index,
                                    ),
                                  })
                                }
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
                {n.editing && (
                  <div className="mt-5 space-y-4 text-[20px]">
                    {body.actions.map(
                      (a, i) =>
                        a.primary === '延时' && (
                          <label
                            key={i}
                            className="flex items-center justify-between text-muted-foreground"
                          >
                            阶段间隔（秒）
                            <input
                              aria-label="阶段间隔秒数"
                              type="number"
                              min="1"
                              max="600"
                              step="1"
                              value={parseFloat(a.secondary)}
                              className="w-28 rounded-xl bg-black/20 p-3 text-primary"
                              onChange={(e) =>
                                updateEntry(i, e.target.value + '秒')
                              }
                            />
                          </label>
                        ),
                    )}
                    {n.panel !== 'capture' && (
                      <>
                        <button
                          className="text-primary"
                          onClick={() => setAdd(!add)}
                        >
                          ＋ 添加设置
                        </button>
                        {add && (
                          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                            {Object.values(CONTROL_GROUPS)
                              .flat()
                              .filter(
                                (p) =>
                                  !body.actions.some((a) => a.primary === p),
                              )
                              .map((p) => (
                                <button
                                  key={p}
                                  className="rounded-xl bg-white/5 px-3 py-2"
                                  onClick={() => {
                                    n.changeScene({
                                      ...body,
                                      actions: [
                                        ...body.actions,
                                        {
                                          primary: p,
                                          secondary: VEHICLE_DEFAULTS[p],
                                        },
                                      ],
                                    });
                                    setAdd(false);
                                  }}
                                >
                                  {p}
                                </button>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">
                        触发条件与命名
                      </summary>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {['时段', '星期类型', '挡位']
                          .filter(
                            (p) =>
                              !body.conditions.some((a) => a.primary === p),
                          )
                          .map((p) => (
                            <button
                              className="rounded-xl border border-white/10 px-3 py-2"
                              key={p}
                              onClick={() =>
                                n.changeScene({
                                  ...body,
                                  conditions: [
                                    ...body.conditions,
                                    {
                                      primary: p,
                                      secondary:
                                        p === '挡位'
                                          ? '挡位P'
                                          : gen.experience.vehicle[p] ||
                                            VEHICLE_DEFAULTS[p],
                                      op: '==',
                                    },
                                  ],
                                })
                              }
                            >
                              {p} ·{' '}
                              {p === '挡位'
                                ? '停车'
                                : gen.experience.vehicle[p] ||
                                  VEHICLE_DEFAULTS[p]}
                            </button>
                          ))}
                      </div>
                      <button
                        className="mt-4 text-[20px] text-primary disabled:opacity-40"
                        disabled={n.busy}
                        onClick={() => void n.nameWithAI()}
                      >
                        请 AI 起个名字
                      </button>
                    </details>
                  </div>
                )}
                {!!body.conditions.length && (
                  <label className="mt-5 flex items-center gap-3 text-[21px]">
                    <input
                      type="checkbox"
                      className="h-6 w-6 accent-[#cdec52]"
                      checked={!!n.draft?.origin.automatic}
                      disabled={gen.driving === 'driving'}
                      onChange={(e) => n.setAutomatic(e.target.checked)}
                    />
                    下次满足条件时自动使用
                  </label>
                )}
                {n.draft?.origin.evidence && (
                  <details
                    className="mt-5 text-[20px] text-muted-foreground"
                    open={n.why}
                    onToggle={(e) => n.setWhy(e.currentTarget.open)}
                  >
                    <summary className="cursor-pointer">为什么</summary>
                    <p className="mt-3">
                      示例历史：{n.draft.origin.evidence.occurrences} /{' '}
                      {n.draft.origin.evidence.opportunities} 次相似操作，验证{' '}
                      {n.draft.origin.evidence.validationDays}{' '}
                      天。预设记录用于体验观察入口。
                    </p>
                    <button
                      className="mt-3 text-primary"
                      onClick={() => n.deleteEvidence()}
                    >
                      删除相关记录
                    </button>
                  </details>
                )}
                {n.checked?.decisions
                  .filter((d) => d.status !== 'accepted')
                  .map((d, i) => (
                    <p key={i} className="mt-3 text-[20px] text-amber-200/80">
                      {d.primary}：{d.reason}
                    </p>
                  ))}
              </div>
              <footer className="shrink-0 border-t border-white/10 px-7 py-5">
                {n.note && (
                  <output className="mb-4 block text-[21px] text-primary">
                    {n.note}
                  </output>
                )}
                {gen.driving === 'driving' ? (
                  <p className="text-[23px] text-muted-foreground">
                    停车后继续
                  </p>
                ) : n.duplicate ? (
                  <div className="space-y-3">
                    <p className="text-[21px]">
                      已有「{n.duplicate.result.scene.name}」，更新或另存？
                    </p>
                    <div className="flex gap-2">
                      <button
                        className={button}
                        onClick={() => void n.save('update')}
                      >
                        更新
                      </button>
                      <button
                        className={button}
                        onClick={() => void n.save('separate')}
                      >
                        另存
                      </button>
                      <button
                        className={button}
                        onClick={() => n.setDuplicate(null)}
                      >
                        返回
                      </button>
                    </div>
                  </div>
                ) : n.applied ? (
                  <div className="flex gap-3">
                    <button
                      className={button + ' flex-1'}
                      onClick={() => void n.undo()}
                    >
                      撤销
                    </button>
                    {n.pending && (
                      <button
                        className={button + ' flex-1 text-primary'}
                        onClick={() => void n.advance()}
                      >
                        5 分钟后
                      </button>
                    )}
                  </div>
                ) : n.panel === 'saved' || (n.draft?.id && !n.editing) ? (
                  <div className="flex gap-3">
                    <button
                      className={
                        button +
                        ' flex-1 bg-primary text-primary-foreground hover:bg-primary/90'
                      }
                      disabled={n.busy}
                      onClick={() => void n.apply()}
                    >
                      现在使用
                    </button>
                    <button
                      className={button}
                      onClick={() => {
                        n.setEditing(true);
                        n.setPanel('proposal');
                      }}
                    >
                      编辑
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      className={
                        button +
                        ' flex-1 bg-primary text-primary-foreground hover:bg-primary/90'
                      }
                      disabled={
                        n.busy || !body.actions.length || !n.checked?.savable
                      }
                      onClick={() => void n.save()}
                    >
                      {n.busy
                        ? '处理中…'
                        : n.panel === 'capture' || n.editing
                          ? '保存'
                          : '好'}
                    </button>
                    <button
                      className={button + ' flex-1'}
                      onClick={() => n.close(true)}
                    >
                      不要
                    </button>
                    {!n.editing && (
                      <button
                        className={button + ' flex-1'}
                        onClick={() => n.setEditing(true)}
                      >
                        编辑
                      </button>
                    )}
                  </div>
                )}
              </footer>
              {picker && picker.index !== undefined && (
                <ValuePicker
                  key={picker.primary + picker.index}
                  primary={picker.primary}
                  value={body.actions[picker.index]?.secondary || ''}
                  onChange={(v) => updateEntry(picker.index!, v)}
                  onClose={() => setPicker(null)}
                />
              )}
            </section>
          )}
          <div className="absolute bottom-7 left-[56px] right-[56px] flex items-center justify-between gap-6">
            <details className="relative text-[20px] text-muted-foreground">
              <summary className="cursor-pointer rounded-xl border border-white/10 bg-card/90 px-5 py-3">
                连接与校验
              </summary>
              <div className="absolute bottom-16 left-0 max-h-[470px] w-[720px] overflow-auto rounded-2xl border border-white/15 bg-[#202521] p-6 shadow-2xl">
                <p>
                  {n.draft?.source === 'live'
                    ? 'AI 补充命名与理解'
                    : '预设故事 / 本地快存'}{' '}
                  · 车辆状态为模拟数据
                </p>
                <p className="mt-3">
                  观察运行时：
                  {gen.controller.runtimeEnabled && gen.configured
                    ? '已连接'
                    : '未连接'}{' '}
                  · 示例日期 {new Date(n.clock).toLocaleDateString('zh-CN')}
                </p>
                {n.story?.evidence && (
                  <p className="mt-3">
                    重复 {n.story.evidence.occurrences} /{' '}
                    {n.story.evidence.opportunities} 次 · 验证{' '}
                    {n.story.evidence.validationDays} 天
                  </p>
                )}
                {n.aiInfo && (
                  <p className="mt-3">
                    AI 完成 {n.aiInfo.total.toFixed(2)} s · 理解句{' '}
                    {n.aiInfo.understanding === null
                      ? '未记录'
                      : n.aiInfo.understanding.toFixed(2) + ' s'}
                  </p>
                )}
                {n.checked?.decisions.map((d, i) => (
                  <p className="mt-2" key={i}>
                    {d.primary} · {d.final || d.original} · {d.reason}
                  </p>
                ))}
                {n.story?.id === 'morning' && (
                  <button
                    className={button + ' mt-4'}
                    onClick={() => void n.checkConditions()}
                  >
                    检查当前条件
                  </button>
                )}
                {!!n.aiInfo?.trace.length && (
                  <pre className="mt-4 whitespace-pre-wrap text-[18px]">
                    {JSON.stringify(n.aiInfo.trace, null, 2)}
                  </pre>
                )}
              </div>
            </details>
            <output className="text-[21px] text-white/80">
              {!drafting
                ? n.note
                : n.draft?.source === 'live'
                  ? 'AI 命名 · 车辆状态为模拟数据'
                  : ''}
            </output>
            <div className="flex gap-3">
              {n.story?.id === 'morning' && (
                <button
                  className={button + ' bg-card/90'}
                  onClick={() => void n.nextTrip()}
                >
                  <Sunrise className="mr-2 inline h-5 w-5" />
                  下一次出行
                </button>
              )}
              <button
                className={button + ' bg-card/90'}
                onClick={() => n.close()}
              >
                返回地图
              </button>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}

export function LearnedHabits({ gen }: { gen: Generation }) {
  const n = gen.nonVoice;
  const items = gen.controller.saved.filter(
    (s) =>
      s.origin?.entry === 'observation' &&
      (!s.profileId || s.profileId === gen.controller.ctx.profile),
  );
  return (
    <section
      className="mb-7 rounded-[26px] border border-white/10 bg-card p-6"
      aria-label="学习的习惯"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[27px]">相处中留下的习惯</h2>
          <p className="mt-2 text-[20px] text-muted-foreground">
            {items.length
              ? `${items.length} 个已确认的习惯`
              : '喜欢的安排，确认后留在这里'}
          </p>
        </div>
        <button
          aria-pressed={n.learning.enabled}
          className={
            button +
            ' ' +
            (n.learning.enabled ? 'text-primary' : 'text-muted-foreground')
          }
          onClick={() => n.setLearning(!n.learning.enabled)}
        >
          {n.learning.enabled ? '学习已开启' : '学习已关闭'}
        </button>
      </div>
      {items.map((s) => (
        <div
          key={s.id}
          className="mt-5 flex items-center gap-3 border-t border-white/10 pt-5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[24px]">{s.result.scene.name}</p>
            <p className="mt-1 text-[20px] text-muted-foreground">
              {STORIES.find((st) => st.id === s.origin?.storyId)?.title ||
                '观察发现'}
            </p>
            <p className="mt-1 text-[20px] text-muted-foreground">
              {s.origin?.lastUsedAt || s.origin?.lastTriggeredAt
                ? '最近使用 ' +
                  new Date(
                    s.origin.lastUsedAt || s.origin.lastTriggeredAt!,
                  ).toLocaleDateString('zh-CN')
                : '尚未使用'}
            </p>
          </div>
          {s.origin?.storyId && (
            <button
              className={button + ' text-[20px]'}
              onClick={() => n.toggleHabit(s.origin!.storyId!)}
            >
              {n.learning.deleted.includes(s.origin.storyId)
                ? '恢复建议'
                : '停止建议'}
            </button>
          )}
          <button className={button} onClick={() => n.openSaved(s)}>
            编辑
          </button>
          <button
            className={button}
            onClick={() => {
              if (s.origin?.storyId) n.deleteEvidence(s.origin.storyId);
              gen.remove(s.id);
            }}
          >
            删除
          </button>
        </div>
      ))}
    </section>
  );
}
