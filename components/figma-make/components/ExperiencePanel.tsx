import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Check,
  CornerDownLeft,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type { Generation } from '../useGeneration';
import { sceneDiff } from '@/lib/scene-similarity';

const LABELS = {
  control: '车控已接手',
  preset: '官方模式',
  chat: '小塔的回应',
  clarify: '先问清楚',
  blocked: '这项不能执行',
  suggestion: '关于眼前的这一刻',
  scene: '场景提案',
};
export function ExperiencePanel({ gen }: { gen: Generation }) {
  const x = gen.experience,
    r = x.route;
  if (!r) return null;
  return (
    <div
      data-testid="experience-panel"
      className="max-h-[620px] overflow-y-auto px-8 py-7"
    >
      <div className="flex items-center gap-2 text-[18px] text-primary">
        <Sparkles className="h-5 w-5" />
        {LABELS[r.kind]}
        <span className="ml-auto text-muted-foreground">
          {gen.source === 'ai' && ['scene', 'suggestion'].includes(r.kind)
            ? x.reused
              ? '已存 AI 提案'
              : 'AI 提案 · 车辆模拟'
            : '交互演示'}
        </span>
      </div>
      <p className="mt-4 text-[20px] text-muted-foreground">“{r.input}”</p>
      {r.reply && (
        <p className="mt-3 text-[30px] leading-relaxed tracking-tight">
          {r.reply}
        </p>
      )}
      {r.kind === 'clarify' && (
        <>
          <p className="mt-3 text-[30px] leading-relaxed">{r.question}</p>
          <div className="mt-6 flex gap-3">
            {['空调', '灯光', '车窗'].map((t) => (
              <button
                key={t}
                onClick={() => x.answerClarify(t)}
                className="min-h-14 flex-1 rounded-2xl bg-primary/10 text-[24px] text-primary"
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}
      {x.presentation === 'offer' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 border-t border-border pt-5"
        >
          <p className="text-[28px] leading-relaxed">
            {x.reused
              ? `要用你存过的「${x.reused.result.scene.name}」吗？`
              : r.question}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={x.applyOnce}
              className="min-h-14 flex-1 rounded-2xl bg-primary px-5 text-[24px] text-primary-foreground"
            >
              好，试一下
            </button>
            <button
              onClick={x.decline}
              className="min-h-14 rounded-2xl bg-secondary px-6 text-[24px] text-muted-foreground"
            >
              这次不用
            </button>
            <button
              onClick={x.showProposal}
              className="flex min-h-14 items-center gap-1 px-2 text-[20px] text-primary"
            >
              查看方案 <ArrowUpRight className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-[18px] text-muted-foreground">
            先试三秒光与声，随时还原。应用后不会自动保存。
          </p>
        </motion.div>
      )}
      {gen.phase === 'thinking' && r.kind === 'suggestion' && (
        <output className="mt-4 block text-[20px] text-muted-foreground">
          {gen.slow ? '还在想，先不打扰你…' : '正在想有没有合适的安排…'}
        </output>
      )}
      {x.feedback && (
        <output className="mt-5 block text-[23px] leading-relaxed text-primary/90">
          {x.feedback}
        </output>
      )}
      {(r.kind === 'control' || x.application !== 'idle') && (
        <div
          data-testid="vehicle-state"
          className="mt-5 border-y border-border py-4"
        >
          <div className="mb-3 flex items-center gap-2 text-[17px] text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            模拟车况 · 未连接实车
          </div>
          <div className="flex flex-wrap gap-x-7 gap-y-3">
            {Object.entries(x.vehicle)
              .filter(([k]) =>
                r.kind === 'control'
                  ? r.actions?.some((a) => a.primary === k)
                  : gen.rawResult?.scene.actions.some((a) => a.primary === k),
              )
              .map(([k, v]) => (
                <div key={k} aria-label={k + ' ' + v}>
                  <span className="text-[18px] text-muted-foreground">{k}</span>
                  <span className="ml-3 font-mono text-[23px]">{v}</span>
                </div>
              ))}
          </div>
        </div>
      )}
      {x.application !== 'idle' && (
        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={x.undo}
            className="flex min-h-14 items-center gap-2 rounded-2xl bg-secondary px-5 text-[22px]"
          >
            <RotateCcw className="h-5 w-5" />
            {x.application === 'preview'
              ? `还原 · ${x.countdown}`
              : '还原本次应用'}
          </button>
          {x.application === 'done' && gen.driving === 'parked' && (
            <button
              onClick={x.showProposal}
              className="flex items-center gap-2 text-[22px] text-primary"
            >
              <Check className="h-5 w-5" />
              查看并保存
            </button>
          )}
        </div>
      )}
      {x.presentation !== 'offer' &&
        x.application === 'idle' &&
        !gen.controller.busy && (
          <button
            onClick={gen.reset}
            className="mt-6 flex min-h-12 items-center gap-2 text-[20px] text-muted-foreground"
          >
            <CornerDownLeft className="h-5 w-5" />
            再聊一句
          </button>
        )}
      <details className="mt-5 text-[18px] text-muted-foreground">
        <summary className="cursor-pointer">为什么这样处理</summary>
        <p className="mt-2 leading-relaxed">{r.reason}</p>
        <p className="mt-2">
          输入分流、车况和主动询问规则为本地演示。自由场景生成需连接真实 AI。
        </p>
      </details>
    </div>
  );
}

export function DuplicatePanel({ gen }: { gen: Generation }) {
  const d = gen.duplicate;
  if (!d) return null;
  return (
    <div
      className="border-t border-primary/20 bg-primary/5 px-7 py-5"
      data-testid="duplicate-panel"
    >
      <p className="text-[25px]">已经有一个相近的「{d.result.scene.name}」</p>
      <p className="mt-2 text-[20px] text-muted-foreground">
        可以把这次涉及的设置更新进去，其余设置保留。
      </p>
      <div className="mt-3 max-h-32 space-y-1 overflow-y-auto text-[20px]">
        {gen.rawResult &&
          sceneDiff(d.result.scene, gen.rawResult.scene).map((v) => (
            <p key={v.primary}>
              <span className="text-muted-foreground">{v.primary}</span>{' '}
              <span className="text-muted-foreground line-through">
                {v.before || '未设置'}
              </span>{' '}
              → {v.after || '保留原值'}
            </p>
          ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => gen.handleSave('update')}
          className="min-h-14 rounded-xl bg-primary px-5 text-[22px] text-primary-foreground"
        >
          更新原场景
        </button>
        <button
          onClick={() => gen.handleSave('separate')}
          className="min-h-14 rounded-xl bg-secondary px-5 text-[22px]"
        >
          另存一个
        </button>
        <button
          onClick={gen.cancelDuplicate}
          className="px-4 text-[22px] text-muted-foreground"
        >
          先不保存
        </button>
      </div>
    </div>
  );
}
