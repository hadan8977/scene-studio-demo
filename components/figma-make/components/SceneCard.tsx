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
  ArrowUp,
  Clock3,
  Brain,
} from 'lucide-react';
import type { Scene, Action } from '../domain/types';

const ICONS = {
  光: Lightbulb,
  声: Volume2,
  气: Wind,
  温: Thermometer,
  话: MessageSquare,
  供: Sparkles,
  其他: Sparkles,
};
const shortName = (a: Action) =>
  ({
    氛围灯亮度: '氛围灯',
    主驾温度: '温度',
    前排风量调节: '风量',
    自动空气净化: '空气净化',
    主驾座椅通风: '座椅通风',
    主驾座椅加热: '座椅加热',
    主驾座椅按摩模式: '座椅按摩',
    进入情景模式: '基础模式',
  })[a.target] || a.target;
const shortMemory = (label: string) =>
  label
    .replace(/等人或休息时|等人时|主驾|控制/g, '')
    .replace('不喜欢香氛，不要开香氛', '不使用香氛');
export function ActionRows({
  actions,
  changedIds = new Set<string>(),
}: {
  actions: Action[];
  changedIds?: Set<string>;
}) {
  return (
    <div aria-label="场景动作" className="divide-y divide-border/50">
      {actions.map((a, i) => {
        const Icon = a.capability === '延时' ? Clock3 : ICONS[a.group];
        return (
          <div
            key={a.id + ':' + i}
            className={`flex min-h-[43px] items-center gap-3 py-1.5 ${changedIds.has(a.id) ? 'text-primary' : 'text-foreground'}`}
          >
            <Icon
              className="h-5 w-5 shrink-0 text-primary/75"
              strokeWidth={1.5}
            />
            <span className="min-w-0 flex-1 text-[22px]">{shortName(a)}</span>
            {(a.status === 'planned' || a.status === 'proposed') && (
              <span className="shrink-0 text-[16px] text-muted-foreground">
                {a.status === 'planned' ? '规划中' : '提议中'}
              </span>
            )}
            {a.status === 'adjusted' && a.requested !== a.finalValue && (
              <span className="text-[17px] text-muted-foreground line-through">
                {a.requested}
              </span>
            )}
            <span className="max-w-[220px] break-words text-right text-[22px] font-medium tabular-nums">
              {a.finalValue || a.requested}
            </span>
          </div>
        );
      })}
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
  onApply?: () => void;
  confirmApplication?: boolean;
}
export function SceneCard(p: SceneCardProps) {
  const { scene } = p;
  const affected = scene.actions.filter(
    (a) => a.status === 'adjusted' && a.reason,
  );
  const quick = [
    ['氛围灯亮度', '灯再暗一点'],
    ['音量', '小声一点'],
    ['主驾温度控制', '凉一点'],
  ].filter(([cap]) => scene.actions.some((a) => a.capability === cap));
  return (
    <div
      aria-label="场景生成卡片"
      data-layout="compact"
      className="px-6 pb-5 pt-2"
    >
      <motion.h2
        key={scene.name}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[30px] font-medium leading-tight tracking-tight"
      >
        {scene.name}
      </motion.h2>
      <div className="mb-3 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[18px] text-muted-foreground">
        {scene.conditions.length ? (
          <>
            <Clock3 className="h-4 w-4" />
            {scene.conditions.map((c, i) => (
              <span key={c.id}>
                {i > 0 ? (scene.logic === 'AND' ? ' · ' : ' / ') : ''}
                {c.label}
                {c.status === 'planned'
                  ? ' · 规划中'
                  : c.status === 'proposed'
                    ? ' · 提议中'
                    : ''}
              </span>
            ))}
          </>
        ) : (
          <span>随时使用</span>
        )}
      </div>
      {p.editing ? (
        <div data-editor-body className="max-h-[380px] overflow-y-auto pb-2">
          {p.editor}
        </div>
      ) : (
        <ActionRows actions={scene.actions} changedIds={p.changedIds} />
      )}
      {p.changedIds.size > 0 && !p.editing && (
        <output className="mt-2 block text-[17px] text-primary">
          已更新{' '}
          {scene.actions
            .filter((a) => p.changedIds.has(a.id))
            .map(shortName)
            .join('、') || '场景'}
        </output>
      )}
      {scene.memory.length > 0 && !p.editing && (
        <div className="mt-3 flex items-start gap-2 text-[17px] leading-relaxed text-muted-foreground">
          <Brain className="mt-1 h-4 w-4 shrink-0 text-primary/60" />
          <span>
            {scene.memory
              .slice(0, 3)
              .map((m) => shortMemory(m.label))
              .join(' · ')}
          </span>
        </div>
      )}
      {affected.map((a) => (
        <p key={a.id} className="mt-2 text-[17px] text-primary/80">
          {a.reason}
        </p>
      ))}
      {scene.unsupported.map((u) => (
        <p
          key={u.id}
          className="mt-2 text-[17px] leading-snug text-muted-foreground"
        >
          <span
            className={
              u.status === 'forbidden'
                ? 'text-destructive/90'
                : 'text-foreground/70'
            }
          >
            {u.target}
          </span>{' '}
          · {u.status === 'forbidden' ? '不允许' : '不支持'}
          {u.reason?.includes('偏好') ? ' · 已遵循偏好' : ''}
        </p>
      ))}
      {!scene.canSave && scene.blockReason && (
        <p className="mt-3 text-[18px] text-destructive">{scene.blockReason}</p>
      )}
      {p.editing && (
        <div className="mt-4">
          <div className="mb-3 flex gap-2">
            {quick.map(([cap, label]) => (
              <button
                key={cap}
                onClick={() => p.onSubmitEdit(label)}
                className="rounded-full bg-secondary px-3 py-2 text-[18px]"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-border bg-secondary/50 p-1.5">
            <input
              aria-label="修改当前场景"
              value={p.editText}
              maxLength={1200}
              onChange={(e) => p.onEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                  p.onSubmitEdit();
              }}
              placeholder="说说想改哪里"
              className="min-w-0 flex-1 bg-transparent px-2 text-[21px] outline-none"
            />
            <button
              aria-label="提交修改"
              disabled={!p.editText.trim()}
              onClick={() => p.onSubmitEdit()}
              className="rounded-lg bg-primary p-3 text-primary-foreground disabled:opacity-30"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      <div className="mt-4 flex gap-3 border-t border-border/60 pt-4">
        <button
          disabled={!scene.canSave || (!p.confirmApplication && p.saved)}
          onClick={p.confirmApplication && !p.editing ? p.onApply : p.onSave}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-primary text-[22px] font-medium text-primary-foreground disabled:opacity-40"
        >
          <Check className="h-5 w-5" />
          {p.confirmApplication && !p.editing
            ? '好'
            : p.saved
              ? '已保存'
              : '保存'}
        </button>
        {!p.editing && (
          <button
            onClick={p.onEdit}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-secondary px-6 text-[21px]"
          >
            <Pencil className="h-4 w-4" />
            编辑
          </button>
        )}
      </div>
    </div>
  );
}
