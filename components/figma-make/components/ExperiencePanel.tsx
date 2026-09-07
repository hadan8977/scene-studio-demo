import { ArrowUpRight, Check, RotateCcw, Sparkles } from 'lucide-react';
import type { Generation } from '../useGeneration';
import { sceneDiff } from '@/lib/scene-similarity';
import { ActionRows } from './SceneCard';
export function ExperiencePanel({ gen }: { gen: Generation }) {
  const x = gen.experience;
  if (!gen.scene) return null;
  if (x.application === 'idle')
    return (
      <button
        data-testid="proposal-invitation"
        aria-label="查看方案"
        onClick={x.showProposal}
        className="flex w-full items-center gap-4 px-6 pb-5 pt-1 text-left"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <span className="min-w-0 flex-1">
          <span className="block text-[26px]">{gen.scene.name}</span>
          <span className="mt-1 block text-[19px] text-muted-foreground">
            {x.reused ? '使用已存场景' : '查看方案'}
          </span>
        </span>
        <ArrowUpRight className="h-6 w-6 text-primary" />
      </button>
    );
  return (
    <div data-testid="application-state" className="px-6 pb-5 pt-1">
      <div className="flex items-center justify-between">
        <h2 className="text-[28px]">{gen.scene.name}</h2>
        <output className="text-[18px] text-primary">
          {x.application === 'done'
            ? '已应用'
            : x.application === 'preview'
              ? `正在调整 · ${x.countdown}`
              : '正在调整'}
        </output>
      </div>
      <div className="mt-4" data-testid="vehicle-state">
        <ActionRows
          actions={gen.scene.actions
            .filter(
              (a) =>
                !['planned', 'proposed'].includes(a.status) &&
                a.capability !== '延时',
            )
            .map((a) => ({
              ...a,
              finalValue: x.vehicle[a.capability] || '待调整',
            }))}
        />
      </div>
      <div className="mt-5 flex gap-3">
        <button
          onClick={x.undo}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-secondary text-[22px]"
        >
          <RotateCcw className="h-5 w-5" />
          撤销
        </button>
        {x.application === 'done' && gen.driving === 'parked' && !gen.saved && (
          <button
            onClick={() => gen.handleSave()}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-primary text-[22px] text-primary-foreground"
          >
            <Check className="h-5 w-5" />
            保存
          </button>
        )}
      </div>
    </div>
  );
}
export function DuplicatePanel({ gen }: { gen: Generation }) {
  const d = gen.duplicate;
  if (!d) return null;
  return (
    <div
      data-testid="duplicate-panel"
      className="border-t border-border bg-secondary/40 px-6 py-5"
    >
      <p className="text-[23px]">更新「{d.result.scene.name}」？</p>
      <div className="my-3 max-h-28 overflow-y-auto text-[18px] text-muted-foreground">
        {gen.rawResult &&
          sceneDiff(d.result.scene, gen.rawResult.scene).map((v) => (
            <p key={v.primary}>
              {v.primary}{' '}
              <span className="line-through">{v.before || '未设置'}</span> →{' '}
              {v.after || '保留'}
            </p>
          ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => gen.handleSave('update')}
          className="rounded-xl bg-primary px-4 py-3 text-[20px] text-primary-foreground"
        >
          更新
        </button>
        <button
          onClick={() => gen.handleSave('separate')}
          className="rounded-xl bg-secondary px-4 py-3 text-[20px]"
        >
          另存
        </button>
        <button
          onClick={gen.cancelDuplicate}
          className="px-4 text-[20px] text-muted-foreground"
        >
          取消
        </button>
      </div>
    </div>
  );
}
