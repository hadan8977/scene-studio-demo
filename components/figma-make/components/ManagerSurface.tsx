import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutGrid,
  Brain,
  SlidersHorizontal,
  Plus,
  X,
  Trash2,
  Sparkles,
  Mic,
  ArrowUp,
  ChevronRight,
  Lightbulb,
  Wifi,
  BatteryMedium,
} from 'lucide-react';
import { useOverlayFocus } from './useOverlayFocus';
import { EXAMPLES } from '@/lib/examples';
import { toViewSaved } from '../bridge';
import { Composer } from './Composer';
import { SceneInspiration } from './SceneInspiration';
import { PreferencePreview } from './PreferencePreview';
import { PreferenceManager } from './PreferenceManager';
import { DEMO_CASES } from '@/lib/demo-cases';
import { PROFILES } from '../domain/profiles';
import type { Generation } from '../useGeneration';
import type { SavedScene } from '../domain/types';

const NAV = [
  { id: 'scenes', label: '我的场景', icon: LayoutGrid },
  { id: 'ideas', label: '场景建议', icon: Lightbulb },
  { id: 'learned', label: '它学会了什么', icon: Brain },
] as const;

const CHIPS = EXAMPLES.slice(0, 3).map((x) => x.input);

function SceneTile({
  s,
  onOpen,
  onRemove,
}: {
  s: SavedScene;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const cond = s.scene.conditions.length
    ? s.scene.conditions
        .map((c) => c.label)
        .join(s.scene.logic === 'AND' ? ' · ' : ' / ')
    : '手动使用';
  const concept =
    s.scene.conditions.some(
      (c) => c.status === 'planned' || c.status === 'proposed',
    ) ||
    s.scene.actions.some(
      (a) => a.status === 'planned' || a.status === 'proposed',
    );
  const profileName =
    PROFILES.find((p) => p.id === s.profileId)?.name ?? '无档案';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
    >
      <button
        aria-label={'删除场景 ' + s.scene.name}
        onClick={onRemove}
        className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <button
        aria-label={'打开场景 ' + s.scene.name}
        onClick={onOpen}
        className="flex flex-1 flex-col items-start text-left"
      >
        <div className="flex items-center gap-2">
          {concept && (
            <span className="text-[16px] text-muted-foreground">
              含规划功能
            </span>
          )}
        </div>
        <div className="mt-3 text-[28px] tracking-tight text-foreground">
          {s.scene.name}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {s.scene.actions.slice(0, 4).map((a) => (
            <span
              key={a.id}
              className="rounded-lg bg-secondary/70 px-2 py-1 font-mono text-[17px] text-foreground/80"
            >
              {a.target} {a.finalValue}
            </span>
          ))}
          {s.scene.actions.length > 4 && (
            <span className="rounded-lg bg-secondary/70 px-2 py-1 font-mono text-[17px] text-muted-foreground">
              +{s.scene.actions.length - 4}
            </span>
          )}
        </div>
        <div className="mt-4 flex w-full items-center justify-between border-t border-border/60 pt-3 text-[18px] text-muted-foreground">
          <span className="line-clamp-2" title={cond}>
            {cond} · {profileName}
          </span>
          <span className="flex items-center gap-1 shrink-0 text-primary">
            打开 <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>
    </motion.div>
  );
}

export function ManagerSurface({
  gen,
  onReview,
  active,
}: {
  gen: Generation;
  onReview: () => void;
  active: boolean;
}) {
  const [tab, setTab] = useState<'scenes' | 'learned' | 'ideas'>('scenes');
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const deleteDialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gen.saveVersion) {
      setModal(false);
      setTab('scenes');
    }
  }, [gen.saveVersion]);
  useEffect(() => {
    if (
      active &&
      gen.phase !== 'idle' &&
      !gen.saved &&
      gen.experience.presentation === 'proposal'
    )
      setModal(true);
  }, [active]);
  useEffect(() => {
    if (gen.experience.viewRequest) setModal(true);
  }, [gen.experience.viewRequest]);

  const openCreate = () => {
    if (gen.driving === 'driving') {
      gen.controller.showToast('停车后再创建场景');
      return;
    }
    gen.reset();
    setModal(true);
  };
  const openExisting = (s: SavedScene) => {
    gen.openSaved(s);
    setModal(true);
  };
  const tryExample = (text: string) => {
    if (gen.driving === 'driving') return;
    setModal(true);
    void gen.playExample(text);
  };
  const discard = () => {
    gen.reset();
    setModal(false);
  };
  useOverlayFocus(active && modal, dialog, discard);
  useOverlayFocus(active && !!deleteId, deleteDialog, () => setDeleteId(null));

  return (
    <div
      data-testid="manager-surface"
      className="relative flex h-full w-full bg-background"
    >
      {/* 侧边栏 */}
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-border bg-card/40 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[24px] leading-tight tracking-tight text-foreground">
              小塔场景
            </div>
            <div className="font-mono text-[17px] uppercase tracking-wider text-muted-foreground">
              Scene Studio
            </div>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[23px] text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-5 w-5" /> 新建场景
        </button>

        <nav aria-label="场景应用导航" className="mt-8 space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              aria-current={tab === n.id ? 'page' : undefined}
              onClick={() => setTab(n.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-[23px] transition-colors ${tab === n.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
            >
              <n.icon className="h-[18px] w-[18px]" /> {n.label}
              {n.id === 'scenes' && gen.scenes.length > 0 && (
                <span className="ml-auto font-mono text-[18px] text-muted-foreground">
                  {gen.scenes.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-border bg-background/60 p-3.5">
            <div className="font-mono text-[16px] uppercase tracking-wider text-muted-foreground">
              当前档案
            </div>
            <div className="mt-2 flex gap-1">
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  aria-label={'切换档案 ' + p.name}
                  aria-pressed={gen.profileId === p.id}
                  onClick={() => gen.setProfileId(p.id)}
                  className={`flex-1 rounded-lg py-1.5 text-[18px] transition-colors ${gen.profileId === p.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <button
            aria-label="打开评审设置"
            onClick={onReview}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-[22px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" /> 设置
          </button>
        </div>
      </aside>

      {/* 主区 */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-10 py-6">
          <div>
            <h1 className="text-[36px] tracking-tight text-foreground">
              {tab === 'scenes'
                ? '我的场景'
                : tab === 'ideas'
                  ? '场景建议'
                  : '它学会了什么'}
            </h1>
          </div>
          <div className="flex items-center gap-4 font-mono text-[18px] text-muted-foreground/60">
            <span className="rounded-full border border-border px-3 py-1.5 text-[17px] text-muted-foreground">
              {gen.mode === 'example'
                ? '示例模式'
                : gen.configured
                  ? 'AI 已连接'
                  : 'AI 未连接'}
            </span>
            <span>22:14</span>
            <Wifi className="h-3.5 w-3.5" />
            <BatteryMedium className="h-4 w-4" />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-10 pb-10">
          {tab === 'ideas' && (
            <div data-testid="ideas-inbox">
              {gen.experience.inbox.length ? (
                <div className="grid grid-cols-2 gap-4">
                  {gen.experience.inbox.map((s) => (
                    <SceneTile
                      key={s.id}
                      s={toViewSaved(s)}
                      onOpen={() => gen.experience.openIdea(s)}
                      onRemove={() => gen.experience.removeIdea(s.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-border bg-card p-10">
                  <Lightbulb className="h-10 w-10 text-primary/70" />
                  <h2 className="mt-5 text-[30px]">没有待处理的建议</h2>
                  <p className="mt-3 max-w-3xl text-[24px] leading-relaxed text-muted-foreground">
                    有合适的安排时，会为你保留。
                  </p>
                  <p className="mt-5 text-[19px] text-muted-foreground"></p>
                </div>
              )}
            </div>
          )}
          {tab === 'scenes' &&
            (gen.scenes.length > 0 ||
              (gen.phase !== 'idle' && !gen.saved && !modal)) && (
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  {gen.phase !== 'idle' && !gen.saved && !modal && (
                    <button
                      onClick={() => setModal(true)}
                      className="rounded-xl border border-primary/20 px-3 py-2 text-[20px] text-primary"
                    >
                      继续编辑
                    </button>
                  )}
                </div>
                {gen.scenes.length > 0 && (
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="搜索我的场景"
                    placeholder="搜索场景"
                    className="w-[230px] rounded-xl border border-border bg-card px-3 py-2 text-[20px] outline-none focus:border-primary/40"
                  />
                )}
              </div>
            )}
          {tab === 'scenes' &&
            search &&
            !gen.scenes.some((s) =>
              (s.scene.name + s.input)
                .toLowerCase()
                .includes(search.toLowerCase()),
            ) && (
              <p className="mb-5 text-[22px] text-muted-foreground">
                没有找到这个场景。
              </p>
            )}
          {tab === 'scenes' &&
            (gen.scenes.length === 0 ? (
              <div className="flex flex-col items-start rounded-3xl border border-border/60 bg-[radial-gradient(ellipse_at_100%_0%,rgba(205,236,82,0.065),transparent_65%)] p-8 text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="mt-5 text-[26px] text-foreground">
                  还没有保存的场景
                </div>
                <button
                  onClick={openCreate}
                  className="mt-6 flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[23px] text-primary-foreground"
                >
                  <Plus className="h-5 w-5" /> 新建场景
                </button>
              </div>
            ) : (
              <div
                className="grid grid-cols-2 gap-4"
                data-testid="saved-scenes"
              >
                <button
                  onClick={openCreate}
                  className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="text-[22px]">新建场景</span>
                </button>
                <AnimatePresence>
                  {gen.scenes
                    .filter(
                      (s) =>
                        s.scene.name
                          .toLowerCase()
                          .includes(search.toLowerCase()) ||
                        s.input.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((s) => (
                      <SceneTile
                        key={s.id}
                        s={s}
                        onOpen={() => openExisting(s)}
                        onRemove={() => setDeleteId(s.id)}
                      />
                    ))}
                </AnimatePresence>
              </div>
            ))}

          {tab === 'ideas' && (
            <div className="mt-8">
              <h2 className="mb-4 text-[26px]">可用模板</h2>
              <div className="grid grid-cols-3 gap-4">
                {['wait', 'reading', 'dust'].map((id) => {
                  const c = DEMO_CASES.find((c) => c.id === id)!;
                  return (
                    <button
                      key={id}
                      aria-label={'查看模板 ' + c.title}
                      onClick={() => tryExample(c.input)}
                      className="rounded-3xl border border-border bg-card p-6 text-left hover:border-primary/40"
                    >
                      <Lightbulb className="h-6 w-6 text-primary" />
                      <h3 className="mt-4 text-[26px]">{c.title}</h3>
                      <p className="mt-2 text-[19px] text-muted-foreground">
                        {c.actions
                          ?.slice(0, 3)
                          .map(([p]) => p.replace('控制', ''))
                          .join(' · ') || '灯光 · 声音 · 温度'}
                      </p>
                      <span className="mt-5 block text-[20px] text-primary">
                        查看方案 →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {tab === 'scenes' && !search && (
            <SceneInspiration
              onTry={tryExample}
              disabled={gen.driving === 'driving'}
            />
          )}
          {tab === 'learned' && (
            <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-7">
              <PreferenceManager
                key={gen.profileId}
                gen={gen}
                surfaceActive={active}
              />
              <PreferencePreview
                gen={gen}
                onTry={() => tryExample(EXAMPLES[1].input)}
              />
            </div>
          )}
        </div>

        {/* 新建 / 编辑 弹层 */}
        <AnimatePresence>
          {modal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm"
              onClick={discard}
            >
              <motion.div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-label="场景编辑"
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-full w-[680px] flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_50px_140px_-30px_rgba(0,0,0,0.9)]"
              >
                <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-6 py-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[22px] text-foreground">
                    {gen.phase === 'idle' ? '新建场景' : '场景提案'}
                  </span>
                  <button
                    aria-label="关闭编辑窗口"
                    onClick={discard}
                    className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {gen.phase === 'idle' && !gen.experience.route ? (
                  <div className="px-7 py-8">
                    <p className="text-[23px] leading-relaxed text-muted-foreground">
                      想要什么样的车内时刻？
                    </p>

                    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-input-background p-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Mic className="h-5 w-5" />
                      </div>
                      <input
                        autoFocus
                        value={gen.input}
                        onChange={(e) => gen.setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                            void gen.submitInput();
                        }}
                        aria-label="描述你想要的场景"
                        maxLength={1200}
                        disabled={gen.driving === 'driving'}
                        placeholder="例如：做一个雨夜回家的场景"
                        className="flex-1 bg-transparent px-1 text-[23px] text-foreground outline-none placeholder:text-muted-foreground/50"
                      />
                      <button
                        aria-label="生成场景"
                        onClick={() => gen.submitInput()}
                        disabled={!gen.input.trim()}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-5 w-5" />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        gen.controller.startManual();
                        gen.experience.showProposal();
                      }}
                      className="mt-5 text-[21px] text-primary"
                    >
                      手动创建
                    </button>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {CHIPS.map((c) => (
                        <button
                          key={c}
                          onClick={() => gen.submitInput(c)}
                          className="rounded-full border border-border px-3 py-1.5 text-[20px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <Composer
                      onDiscard={discard}
                      gen={gen}
                      onSwitchToReal={() => {
                        gen.setMode('real');
                        onReview();
                      }}
                    />
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {deleteId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
              ref={deleteDialog}
              role="dialog"
              aria-modal="true"
              aria-label="删除场景确认"
              className="w-[520px] rounded-3xl border border-border bg-card p-7"
            >
              <h2 className="text-[28px]">删除这个场景？</h2>
              <p className="mt-2 text-[22px] text-muted-foreground">
                {gen.scenes.find((s) => s.id === deleteId)?.scene.name}
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-[22px]"
                >
                  保留
                </button>
                <button
                  onClick={() => {
                    gen.remove(deleteId);
                    setDeleteId(null);
                  }}
                  className="flex-1 rounded-xl bg-destructive/15 px-4 py-2.5 text-[22px] text-destructive"
                >
                  删除场景
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
