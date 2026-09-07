import { useState } from 'react';
import { ArrowUpRight, Sparkles, Clock3 } from 'lucide-react';
import { DEMO_CASES } from '@/lib/demo-cases';
import { capabilities } from '@/lib/scene';

const cases = DEMO_CASES.filter(
  (c) => c.entry === 'create' && c.category !== '不支持的请求',
);
const categories = ['全部', ...new Set(cases.map((c) => c.category))];
export function SceneInspiration({
  onTry,
  disabled,
}: {
  onTry: (text: string) => void;
  disabled: boolean;
}) {
  const [category, setCategory] = useState('全部');
  const selected = cases.filter(
    (c) => category === '全部' || c.category === category,
  );
  return (
    <section aria-label="场景灵感" className="mt-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="mt-2 text-[32px]">场景模板</h2>
        </div>
        <span className="text-[19px] text-muted-foreground">
          {cases.length} 个模板
        </span>
      </div>
      <div className="my-5 flex flex-wrap gap-2" aria-label="场景灵感分类">
        {categories.map((cat) => (
          <button
            key={cat}
            aria-pressed={category === cat}
            onClick={() => setCategory(cat)}
            className={`min-h-12 rounded-full border px-4 text-[20px] ${category === cat ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {selected.map((c, i) => {
          const conceptual = c.actions?.some(([p]) => {
            const cap = capabilities.find((x) => x.zh === p);
            return cap && !['released', 'no_ux'].includes(cap.maturity);
          });
          return (
            <button
              key={c.id}
              disabled={disabled}
              aria-label={'试用示例 ' + c.title}
              onClick={() => onTry(c.input)}
              className="group relative rounded-[26px] border border-border bg-card p-6 text-left transition-colors hover:border-primary/40 disabled:opacity-40"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[17px] text-primary/70">
                  <Sparkles className="h-5 w-5" />
                  {c.category}
                </span>
                <span className="font-mono text-[17px] text-muted-foreground/60">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className="mt-5 text-[30px]">{c.title}</h3>
              <p className="mt-2 text-[22px] text-foreground/80">“{c.input}”</p>
              <p className="mt-3 text-[20px] leading-relaxed text-muted-foreground">
                {c.actions
                  ?.slice(0, 4)
                  .map(([p]) => p.replace('控制', ''))
                  .join(' · ') || '灯光 · 音量 · 温度'}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-[18px] text-primary">
                <span>
                  创建场景{' '}
                  <ArrowUpRight className="inline h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
                {conceptual && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    含规划功能
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
