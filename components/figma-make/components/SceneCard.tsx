import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Lightbulb,
  Volume2,
  Wind,
  Thermometer,
  MessageSquare,
  Sparkles,
  Check,
  Pencil,
  X,
  Ban,
  Clock3,
  AlertTriangle,
  CornerDownLeft,
  Quote,
  ChevronDown,
  Brain,
} from 'lucide-react';
import type { ActionGroup, Scene, Action } from '../domain/types';
import { REGISTRY } from '../domain/capabilities';

const GROUP_META: Record<
  ActionGroup,
  { icon: typeof Lightbulb; label: string }
> = {
  光: { icon: Lightbulb, label: '光' },
  声: { icon: Volume2, label: '声' },
  气: { icon: Wind, label: '气' },
  温: { icon: Thermometer, label: '温' },
  话: { icon: MessageSquare, label: '话' },
  供: { icon: Sparkles, label: '供' },
  其他: { icon: Sparkles, label: '其他' },
};
const GROUP_ORDER: ActionGroup[] = ['光', '声', '气', '温', '话', '供', '其他'];

function num(text: string | null): number | null {
  if (!text) return null;
  const m = text.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function StatusTag({ status }: { status: Action['status'] }) {
  if (status === 'planned')
    return (
      <span className="rounded border border-border px-1.5 py-px text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        规划中
      </span>
    );
  if (status === 'proposed')
    return (
      <span className="rounded border border-primary/40 px-1.5 py-px text-[10px] font-mono uppercase tracking-wide text-primary/90">
        提议中
      </span>
    );
  if (status === 'adjusted')
    return (
      <span className="rounded bg-primary/15 px-1.5 py-px text-[10px] font-mono uppercase tracking-wide text-primary">
        已调整
      </span>
    );
  return null;
}

// 紧凑取值：数值/挡位显示细条 + 数字；枚举/布尔/播报显示文本
function Value({ action }: { action: Action }) {
  const spec = REGISTRY[action.capability];
  const val = action.finalValue ?? action.requested;
  if (action.group === '话') {
    return (
      <span className="max-w-[180px] truncate text-right text-[13px] text-foreground/85">
        “{val}”
      </span>
    );
  }
  if (spec && (spec.unit === '%' || spec.unit === '℃' || spec.unit === '挡')) {
    const n = num(val);
    if (n !== null && spec.min !== undefined && spec.max !== undefined) {
      const pct = Math.max(
        0.04,
        Math.min(1, (n - spec.min) / (spec.max - spec.min)),
      );
      return (
        <div className="flex items-center gap-2.5">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          <span className="w-12 text-right font-mono text-[14px] tabular-nums text-foreground">
            {val}
          </span>
        </div>
      );
    }
  }
  if (spec && spec.boolean) {
    const off = /关|off|停/i.test(val);
    return (
      <span className="flex items-center gap-1.5 font-mono text-[13px] text-foreground/90">
        <span
          className={`h-1.5 w-1.5 rounded-full ${off ? 'bg-muted-foreground/50' : 'bg-primary'}`}
        />{' '}
        {off ? '关' : '开'}
      </span>
    );
  }
  return (
    <span className="max-w-[160px] truncate text-right font-mono text-[13px] text-foreground/90">
      {val}
    </span>
  );
}

function Row({ action, changed }: { action: Action; changed: boolean }) {
  const Meta = GROUP_META[action.group];
  const Icon = Meta.icon;
  const soft = action.status === 'planned' || action.status === 'proposed';
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${changed ? 'bg-primary/[0.08]' : ''}`}
    >
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${changed ? 'bg-primary/20 text-primary' : 'bg-accent text-muted-foreground'}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[16px] ${soft ? 'text-muted-foreground' : 'text-foreground'}`}
          >
            {action.target}
          </span>
          {changed && (
            <span className="shrink-0 font-mono text-[9px] uppercase text-primary">
              刚改
            </span>
          )}
          <StatusTag status={action.status} />
        </div>
        {action.status === 'adjusted' &&
          action.requested !== action.finalValue && (
            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
              <span className="line-through">{action.requested}</span> →{' '}
              {action.finalValue} · {action.reason}
            </div>
          )}
        {action.status !== 'adjusted' && action.reason && (
          <div className="mt-0.5 text-[11px] text-muted-foreground/70">
            {action.reason}
          </div>
        )}
      </div>
      <div className="shrink-0">
        <Value action={action} />
      </div>
    </div>
  );
}

interface SceneCardProps {
  scene: Scene;
  understanding: string | null;
  heard: string;
  changedIds: Set<string>;
  sourceBadge: 'example' | 'ai';
  saved: boolean;
  editing: boolean;
  editText: string;
  onEditText: (v: string) => void;
  onSubmitEdit: (text?: string) => void;
  onSave: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  editor?: ReactNode;
}

export function SceneCard(props: SceneCardProps) {
  const { scene, understanding, heard, changedIds, sourceBadge, saved } = props;
  const groups = GROUP_ORDER.map((group) => ({
    group,
    actions: scene.actions.filter((a) => a.group === group),
  })).filter((g) => g.actions.length);
  const quickEdits = [
    { capability: '氛围灯亮度', label: '灯再暗一点' },
    { capability: '音量', label: '小声一点' },
    { capability: '主驾温度控制', label: '凉一点' },
  ].filter((e) => scene.actions.some((a) => a.capability === e.capability));

  return (
    <div
      className="flex min-h-0 flex-col"
      style={{ maxHeight: 'var(--scene-body-limit, 780px)' }}
      aria-label="场景生成卡片"
    >
      {/* 可滚动内容 */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 pt-6">
        {/* 标题 */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Scene
            </span>
            <span
              className={`rounded px-1.5 py-px text-[10px] font-mono ${sourceBadge === 'ai' ? 'bg-primary/15 text-primary' : 'border border-border text-muted-foreground'}`}
            >
              {sourceBadge === 'ai' ? 'AI' : '示例'}
            </span>
          </div>
          <motion.h2
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[26px] leading-tight tracking-tight text-foreground"
          >
            {scene.name}
          </motion.h2>
          {understanding && (
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              {understanding}
            </p>
          )}
        </div>

        {/* 听到了 + 条件 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px]">
          <span className="flex items-center gap-1 text-muted-foreground/70">
            <Quote className="h-3 w-3" />“{heard}”
          </span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground/60">
            何时生效
            {scene.conditions.length > 1
              ? scene.logic === 'AND'
                ? ' · 全部满足'
                : ' · 任一满足'
              : ''}
          </span>
          {scene.conditions.length === 0 ? (
            <span className="text-foreground/80">手动使用</span>
          ) : (
            scene.conditions.map((c) => (
              <span
                key={c.id}
                title={c.reason}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                  c.status === 'unsupported'
                    ? 'border-destructive/40 text-destructive/90'
                    : c.status === 'available'
                      ? 'border-border text-foreground/85'
                      : 'border-border/60 text-muted-foreground'
                }`}
              >
                {c.status === 'unsupported' && <Ban className="h-3 w-3" />}
                {(c.status === 'planned' || c.status === 'proposed') && (
                  <Clock3 className="h-3 w-3" />
                )}
                {c.label}
                {c.status === 'planned'
                  ? ' · 规划中'
                  : c.status === 'proposed'
                    ? ' · 提议中'
                    : ''}
              </span>
            ))
          )}
        </div>

        {props.editing && props.editor}
        {/* 动作列表（整段是一张卡里的紧凑行，不是每项一卡） */}
        {changedIds.size > 0 && (
          <div
            role="status"
            className="flex items-center gap-2 text-[12px] text-primary"
          >
            <Check className="h-3.5 w-3.5" />
            刚改了 {Array.from(changedIds).join('、')}，其余保留。
          </div>
        )}
        {groups.length > 0 && (
          <div
            className="divide-y divide-border/50 border-y border-border/60"
            aria-label="按元素分组的动作"
          >
            {groups.map(({ group, actions }, index) => (
              <motion.section
                key={group}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.24 }}
                className="py-2"
                aria-label={group + '的动作'}
              >
                <div className="px-2 pb-0.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground/70">
                  {group}
                </div>
                {actions.map((a) => (
                  <Row key={a.id} action={a} changed={changedIds.has(a.id)} />
                ))}
              </motion.section>
            ))}
          </div>
        )}

        {/* 偏好 + 做不了 */}
        {scene.memory.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-mono text-[10px] uppercase tracking-wide text-primary/70">
              <Brain className="mr-1 inline h-3 w-3" /> 与这些偏好一致
            </span>
            {scene.memory.map((m) => (
              <span
                key={m.id}
                className={`rounded-full px-2 py-0.5 ${m.negative ? 'bg-destructive/10 text-destructive/90' : 'bg-primary/10 text-primary'}`}
              >
                {m.label}
              </span>
            ))}
          </div>
        )}
        {scene.unsupported.length > 0 && (
          <div className="space-y-1 rounded-2xl border border-border/50 bg-secondary/20 px-4 py-3">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <Ban className="h-3 w-3" /> 做不了
            </div>
            {scene.unsupported.map((u) => (
              <div
                key={u.id}
                className="flex items-start justify-between gap-3 text-[12px]"
              >
                <span className="text-muted-foreground/70">
                  <span className="line-through">
                    {u.target} {u.requested}
                  </span>
                  <span
                    className={`ml-2 rounded px-1 py-px text-[10px] ${u.status === 'forbidden' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}
                  >
                    {u.status === 'forbidden' ? '禁止' : '不支持'}
                  </span>
                </span>
                <span className="text-right text-muted-foreground">
                  {u.reason}
                </span>
              </div>
            ))}
          </div>
        )}

        {scene.say && (
          <div className="flex items-start gap-2 text-[13px] text-foreground/75">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{' '}
            小塔会说：“{scene.say}”
          </div>
        )}
        <details className="group border-t border-border/50 pb-4 pt-3 text-[12px] text-muted-foreground">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1">
            为什么这样安排
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2 leading-relaxed">
            <p>
              依据你的原话生成 {scene.actions.length}{' '}
              项动作；没有安排的元素不会额外补齐。
            </p>
            {scene.memory.length > 0 ? (
              <p>
                上面的偏好与当前动作一致；拿走偏好后，下次生成会按新的档案建议。
              </p>
            ) : (
              <p>这张提案没有标注与动作一致的已知偏好。</p>
            )}
            <p>
              {scene.conditions.some((c) => c.status !== 'available') ||
              scene.actions.some(
                (a) => a.status === 'planned' || a.status === 'proposed',
              )
                ? '包含未落地能力，可以保存概念方案；带标记的条件或动作仍需后续接入。'
                : '动作已按当前模拟车况检查。保存后留在本浏览器，不会操控车辆。'}
            </p>
          </div>
        </details>
        {scene.offer.length > 0 &&
          scene.offer.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-2 text-[12px] text-muted-foreground"
            >
              <Sparkles className="h-3 w-3 text-primary/70" />
              {o.label}
              <span className="font-mono text-[10px]">
                {o.status === 'proposed' ? '提议中' : '规划中'}
              </span>
            </div>
          ))}

        {scene.warnings.length > 0 && (
          <div className="space-y-1">
            {scene.warnings.map((w) => (
              <p
                key={w.id}
                className="text-[12px] leading-relaxed text-muted-foreground"
              >
                {w.label}
              </p>
            ))}
          </div>
        )}
        {!scene.canSave && scene.blockReason && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {scene.blockReason}
          </div>
        )}
      </div>

      {/* 决定坞（贴卡片底部） */}
      <div className="shrink-0 space-y-2.5 border-t border-border/60 bg-card/80 px-7 py-4">
        {saved && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/15 px-3 py-1.5 text-[12px] text-primary">
            <Check className="h-3.5 w-3.5" /> 已存入「我的场景」—
            只是保存，车辆还没执行
          </div>
        )}
        {props.editing && (
          <div className="space-y-2">
            {quickEdits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickEdits.map((e) => (
                  <button
                    key={e.capability}
                    onClick={() => props.onSubmitEdit(e.label)}
                    className="rounded-full border border-border bg-secondary/50 px-3 py-2 text-[12px] text-foreground/80 hover:border-primary/40"
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-secondary/50 p-1.5">
              <input
                value={props.editText}
                onChange={(e) => props.onEditText(e.target.value)}
                aria-label="修改当前场景"
                maxLength={1200}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                    props.onSubmitEdit();
                }}
                autoFocus
                placeholder="说一句，只改你提到的这一项…"
                className="flex-1 bg-transparent px-2 py-1.5 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              <button
                disabled={!props.editText.trim()}
                aria-label="提交修改"
                onClick={() => props.onSubmitEdit()}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] text-primary-foreground"
              >
                <CornerDownLeft className="h-3.5 w-3.5" /> 改
              </button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/60">
          保存场景，不执行车辆动作
        </p>
        <div className="flex gap-2">
          <button
            onClick={props.onSave}
            disabled={!scene.canSave || saved}
            className="flex min-h-12 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> {saved ? '已保存' : '就这样保存'}
          </button>
          <button
            onClick={props.onEdit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-[14px] text-foreground transition-colors hover:border-primary/40"
          >
            <Pencil className="h-4 w-4" /> 改一下
          </button>
          <button
            onClick={props.onDiscard}
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" /> 不用
          </button>
        </div>
      </div>
    </div>
  );
}
