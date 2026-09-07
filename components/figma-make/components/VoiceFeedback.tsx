import { Sparkles, X } from 'lucide-react';
import type { Generation } from '../useGeneration';
export function VoiceFeedback({ gen }: { gen: Generation }) {
  const x = gen.experience,
    r = x.route;
  if (!r && !gen.heard) return null;
  const reply = gen.error
    ? gen.error.message
    : r?.kind === 'control'
      ? x.feedback.replace(/（演示）/g, '')
      : r?.kind === 'preset'
        ? '这项模式暂未开放。'
        : r?.kind === 'clarify'
          ? r.question
          : x.feedback === '已撤销'
            ? '已撤销'
            : x.application === 'done'
              ? gen.rawResult?.conceptual
                ? '已调好，可用功能已应用。'
                : '已调好。'
              : x.application === 'preview' || x.application === 'applying'
                ? ''
                : r?.kind === 'suggestion'
                  ? x.feedback === '这项功能暂未开放，方案已保留。'
                    ? x.feedback
                    : x.feedback.includes('停车后查看')
                      ? '方案已留好，停车后查看。'
                      : r.reply
                  : gen.understanding || r?.reply;
  const values =
    r?.kind === 'control'
      ? r.actions
          ?.map((a) => ({ name: a.primary, value: x.vehicle[a.primary] }))
          .filter((v) => v.value)
      : [];
  return (
    <div
      data-testid="voice-feedback"
      className="relative mb-4 w-[680px] px-4 text-center [text-shadow:0_2px_14px_#000]"
    >
      <p className="max-h-[60px] overflow-hidden text-[19px] leading-relaxed text-white/60">
        “{r?.input || gen.heard}”
      </p>
      {reply && (
        <p
          role={gen.error ? 'alert' : undefined}
          className="mt-2 text-[23px] leading-snug text-white/90"
        >
          <Sparkles className="mr-2 inline h-4 w-4 text-primary" />
          {reply}
        </p>
      )}
      {gen.phase === 'thinking' && (
        <output className="mt-2 block text-[19px] text-primary/90">
          {gen.slow ? '还需要一点时间…' : '正在准备…'}
        </output>
      )}
      {values && values.length > 0 && (
        <div
          data-testid="vehicle-state"
          className="mt-2 flex justify-center gap-5 text-[20px] text-primary"
        >
          {values.map((v) => (
            <span key={v.name}>
              {v.name.replace('控制', '')} {v.value}
            </span>
          ))}
        </div>
      )}
      {r?.kind === 'clarify' && (
        <div className="mt-3 flex justify-center gap-3">
          {['空调', '灯光', '车窗'].map((t) => (
            <button
              key={t}
              onClick={() => x.answerClarify(t)}
              className="rounded-full border border-white/15 bg-background/80 px-5 py-2 text-[21px] text-foreground"
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {gen.error && (
        <button
          onClick={gen.retry}
          className="mt-3 rounded-full bg-primary/15 px-5 py-2 text-[20px] text-primary"
        >
          重试
        </button>
      )}
      {!gen.controller.busy && (
        <button
          aria-label="清除对话"
          onClick={gen.reset}
          className="absolute -right-2 top-0 p-3 text-white/50"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
