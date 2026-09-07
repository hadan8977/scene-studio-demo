import { ArrowUpRight, Sparkles } from 'lucide-react';
import { exampleScene } from '@/lib/examples';
import { validateScene } from '@/lib/scene';
import type { Generation } from '../useGeneration';

export function PreferencePreview({
  gen,
  onTry,
}: {
  gen: Generation;
  onTry: () => void;
}) {
  const ctx = gen.controller.ctx;
  const baseline = exampleScene('wait', { driving: false, profile: 'none' });
  const preview = validateScene(exampleScene('wait', ctx), ctx);
  const rows = [
    { primary: '氛围灯亮度', label: '灯光' },
    { primary: '音量', label: '音量' },
    { primary: '主驾温度控制', label: '温度' },
    { primary: '自动空气净化', label: '净化' },
  ];
  return (
    <aside
      aria-label="偏好影响预览"
      className="self-start rounded-3xl border border-border bg-card/60 p-6"
    >
      <div className="flex items-center gap-2 text-[18px] text-primary">
        <Sparkles className="h-4 w-4" /> 等候场景
      </div>
      <p className="my-5 text-[28px] leading-relaxed tracking-tight">
        适合你的安排
      </p>
      <div className="mb-2 grid grid-cols-[1fr_95px_95px] text-right text-[17px] text-muted-foreground/70">
        <span />
        <span>默认</span>
        <span>{gen.profile.name}</span>
      </div>
      <div className="divide-y divide-border/60">
        {rows.map((r) => {
          const before =
            baseline.actions.find((a) => a.primary === r.primary)?.secondary ||
            '不添加';
          const after =
            preview.scene.actions.find((a) => a.primary === r.primary)
              ?.secondary || '不添加';
          return (
            <div
              key={r.primary}
              className="grid grid-cols-[1fr_95px_95px] items-center py-3 text-[22px]"
            >
              <span className="text-muted-foreground">{r.label}</span>
              <span className="text-right font-mono text-[20px] text-muted-foreground/60">
                {before}
              </span>
              <span
                className={`text-right font-mono text-[22px] ${before !== after ? 'text-primary' : 'text-foreground/80'}`}
              >
                {after}
              </span>
            </div>
          );
        })}
      </div>
      <button
        disabled={gen.driving === 'driving'}
        onClick={onTry}
        className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary/10 text-[20px] text-primary hover:bg-primary/15 disabled:opacity-40"
      >
        查看方案
        <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
}
