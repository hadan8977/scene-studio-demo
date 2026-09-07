import { useRef, type ReactNode } from 'react';
import { useOverlayFocus } from './useOverlayFocus';
import type { ModelOption } from '@/lib/generation';
import type { SceneResult } from '@/lib/scene';
import { capabilities, registryVersion } from '@/lib/scene';
import { motion, AnimatePresence } from 'motion/react';
import { X, Circle, ArrowRight, Check, Pencil, Ban } from 'lucide-react';
import type { GenerationResult, DrivingState, Profile } from '../domain/types';
import type { Generation } from '../useGeneration';

export interface LatencyMarks {
  t0?: number;
  understandingStart?: number;
  understandingDone?: number;
  complete?: number;
}

interface ReviewPanelProps {
  experience: Generation['experience'];
  open: boolean;
  onClose: () => void;
  mode: 'example' | 'real';
  onModeChange: (m: 'example' | 'real') => void;
  models: ModelOption[];
  onRefresh: () => void;
  loading: boolean;
  rawResult: SceneResult | null;
  model: string;
  modelUsed: string;
  onModelChange: (m: string) => void;
  driving: DrivingState;
  onDrivingChange: (d: DrivingState) => void;
  profile: Profile;
  removedPrefs: string[];
  onTogglePref: (id: string) => void;
  connection: 'example' | 'connected' | 'not-connected' | 'error';
  connectionNote?: string;
  latency: LatencyMarks;
  result: GenerationResult | null;
}

function seg(a?: number, b?: number) {
  if (a === undefined || b === undefined) return null;
  return Math.max(0, Math.round(b - a));
}

function LatencyBar({
  label,
  ms,
  max,
}: {
  label: string;
  ms: number | null;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[17px] text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        {ms !== null && (
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (ms / max) * 100)}%` }}
          />
        )}
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-[17px] text-foreground">
        {ms === null ? '—' : `${ms}ms`}
      </span>
    </div>
  );
}

export function ReviewPanel(props: ReviewPanelProps) {
  const { latency, result } = props;
  const panel = useRef<HTMLElement>(null);
  useOverlayFocus(props.open, panel, props.onClose);
  const s1 = seg(latency.t0, latency.understandingStart);
  const s2 = seg(latency.understandingStart, latency.understandingDone);
  const s3 = seg(latency.understandingDone, latency.complete);
  const total = seg(latency.t0, latency.complete);

  return (
    <AnimatePresence>
      {props.open && (
        <>
          <motion.div
            className="absolute inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
          />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="评审设置"
            className="absolute right-0 top-0 z-50 flex h-full w-full max-w-[620px] flex-col border-l border-border bg-popover"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-[17px] font-mono uppercase tracking-wider text-muted-foreground">
                  Review
                </div>
                <div className="text-[23px] text-foreground">评审信息</div>
              </div>
              <button
                aria-label="关闭评审设置"
                onClick={props.onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section className="space-y-3">
                <SectionTitle>主动建议 · 本地规则演示</SectionTitle>
                <p className="text-[19px] leading-relaxed text-muted-foreground">
                  先回应，再检查能否改善、是否合适、是否值得。示例按钮会重置为独立情境；连续输入共享本次额度。
                </p>
                <div className="flex gap-2">
                  <Toggle
                    active={props.experience.attention.quiet}
                    onClick={() =>
                      props.experience.setQuiet(
                        !props.experience.attention.quiet,
                      )
                    }
                  >
                    安静模式
                  </Toggle>
                  <Toggle
                    active={props.experience.attention.highLoad}
                    onClick={() =>
                      props.experience.setHighLoad(
                        !props.experience.attention.highLoad,
                      )
                    }
                  >
                    高驾驶负荷
                  </Toggle>
                </div>
                <div className="flex items-center justify-between text-[19px] text-muted-foreground">
                  <span>
                    本次已询问 {props.experience.attention.questions} / 1
                  </span>
                  <button
                    onClick={props.experience.resetAttention}
                    className="min-h-12 text-primary"
                  >
                    重置额度与冷却
                  </button>
                </div>
                {props.experience.route && (
                  <div className="border-l-2 border-primary/40 pl-4 text-[20px] leading-relaxed">
                    <p>{props.experience.route.reason}</p>
                    {props.experience.feedback && (
                      <p className="mt-2 text-muted-foreground">
                        {props.experience.feedback}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[17px] text-muted-foreground">
                  同类拒绝冷却 7
                  天（当前会话模拟）。未接入观测学习、跨日额度和真实车辆。
                </p>
              </section>
              {/* 模式与连接 */}
              <section className="space-y-3">
                <SectionTitle>模式与连接</SectionTitle>
                <div className="flex gap-2">
                  <Toggle
                    active={props.mode === 'example'}
                    onClick={() => props.onModeChange('example')}
                  >
                    示例模式
                  </Toggle>
                  <Toggle
                    active={props.mode === 'real'}
                    onClick={() => props.onModeChange('real')}
                  >
                    真实 AI
                  </Toggle>
                </div>
                <div className="flex items-center gap-2 text-[18px]">
                  <Circle
                    className={`h-2.5 w-2.5 ${
                      props.connection === 'connected'
                        ? 'fill-primary text-primary'
                        : props.connection === 'example'
                          ? 'fill-muted-foreground text-muted-foreground'
                          : 'fill-destructive text-destructive'
                    }`}
                  />
                  <span className="text-foreground">
                    {props.connection === 'example' &&
                      '示例模式（预设结果，非实时 AI）'}
                    {props.connection === 'connected' && '真实接口已连接'}
                    {props.connection === 'not-connected' && '真实接口未连接'}
                    {props.connection === 'error' && '接口错误'}
                  </span>
                </div>
                {props.connectionNote && (
                  <div className="text-[17px] text-muted-foreground">
                    {props.connectionNote}
                  </div>
                )}
                {props.mode === 'real' && (
                  <label className="block">
                    <span className="text-[17px] text-muted-foreground">
                      服务端接口（密钥仅在服务端）
                    </span>
                    <input
                      value="/api/generate"
                      readOnly

                      placeholder="/api/generate-scene"
                      className="mt-1 w-full rounded-lg border border-border bg-input-background px-3 py-2 font-mono text-[18px] text-foreground outline-none focus:border-primary/50"
                    />
                  </label>
                )}
              </section>

              {/* 模型 */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <SectionTitle>模型</SectionTitle>
                  <button
                    disabled={props.loading}
                    onClick={props.onRefresh}
                    className="text-[18px] text-primary"
                  >
                    {props.loading ? '读取中…' : '刷新连接'}
                  </button>
                </div>
                {!props.models.length && (
                  <p className="text-[18px] text-muted-foreground">
                    暂时没有可用候选，刷新后再试。
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {props.models.map((m) => (
                    <Toggle
                      key={m.id}
                      active={props.model === m.id}
                      onClick={() => props.onModelChange(m.id)}
                    >
                      <span className="font-mono text-[17px]">{m.id}</span>
                    </Toggle>
                  ))}
                </div>
              </section>

              {/* 车辆状态 */}
              <section className="space-y-2">
                <SectionTitle>车辆状态</SectionTitle>
                <div className="flex gap-2">
                  <Toggle
                    active={props.driving === 'parked'}
                    onClick={() => props.onDrivingChange('parked')}
                  >
                    停车
                  </Toggle>
                  <Toggle
                    active={props.driving === 'driving'}
                    onClick={() => props.onDrivingChange('driving')}
                  >
                    行驶中
                  </Toggle>
                </div>
              </section>

              {/* 档案与偏好 */}
              <section className="space-y-2">
                <SectionTitle>演示档案</SectionTitle>
                <div className="text-[18px] text-muted-foreground">
                  当前：{props.profile.name} · {props.profile.blurb}
                </div>
                <p className="text-[18px] text-muted-foreground">
                  在场景应用的「它学会了什么」中编辑偏好。
                </p>
              </section>

              {/* 真实耗时 */}
              <section className="space-y-2">
                <SectionTitle>真实耗时</SectionTitle>
                <p className="text-[17px] text-muted-foreground">
                  本次结果：{props.modelUsed || '尚未生成'} · 示例不记录模型时延
                </p>
                <div className="space-y-2">
                  <LatencyBar label="服务端→理解句出现" ms={s1} max={3000} />
                  <LatencyBar label="理解句出现→完成" ms={s2} max={3000} />
                  <LatencyBar label="理解句完成→整体" ms={s3} max={3000} />
                  <div className="flex justify-between border-t border-border pt-2 text-[18px]">
                    <span className="text-muted-foreground">整体完成</span>
                    <span className="font-mono text-foreground">
                      {total === null ? '—' : `${total}ms`}
                    </span>
                  </div>
                </div>
              </section>

              {/* 验证器裁决 */}
              <section className="space-y-2">
                <SectionTitle>提议与能力裁决</SectionTitle>
                <p className="text-[17px] text-muted-foreground">
                  {capabilities.length} 条能力 · {registryVersion}
                </p>
                {result ? (
                  <div className="space-y-1">
                    {result.verdicts.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-1.5 text-[18px]"
                      >
                        {v.outcome === 'kept' && (
                          <Check className="h-3 w-3 shrink-0 text-primary" />
                        )}
                        {v.outcome === 'adjusted' && (
                          <Pencil className="h-3 w-3 shrink-0 text-primary" />
                        )}
                        {v.outcome === 'rejected' && (
                          <Ban className="h-3 w-3 shrink-0 text-destructive" />
                        )}
                        <span className="font-mono text-muted-foreground">
                          {v.capability}
                        </span>
                        <span className="text-[16px] text-primary/70">
                          {
                            (
                              {
                                accepted: '可用',
                                adjusted: '已调整',
                                forbidden: '禁止',
                                unsupported: '不支持',
                                planned: '规划中',
                                proposed: '提议中',
                              } as Record<string, string>
                            )[v.status || '']
                          }
                        </span>
                        <span className="truncate text-muted-foreground/70">
                          {v.requested}
                        </span>
                        {v.finalValue && (
                          <>
                            <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-foreground">
                              {v.finalValue}
                            </span>
                          </>
                        )}
                        {v.reason && (
                          <span className="ml-auto text-[17px] text-muted-foreground/70">
                            {v.reason}
                          </span>
                        )}
                      </div>
                    ))}
                    {result.verdicts.length === 0 && (
                      <div className="text-[18px] text-muted-foreground/70">
                        无
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[18px] text-muted-foreground/70">
                    尚无生成结果
                  </div>
                )}
              </section>

              {/* 结构化数据 */}
              <section className="space-y-2">
                <SectionTitle>最终结构化 scene</SectionTitle>
                <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[17px] leading-relaxed text-muted-foreground">
                  {result
                    ? JSON.stringify(props.rawResult?.scene, null, 2)
                    : '—'}
                </pre>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[17px] font-mono uppercase tracking-wider text-primary/70">
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[20px] transition-colors ${
        active
          ? 'border-primary/50 bg-primary/15 text-primary'
          : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
