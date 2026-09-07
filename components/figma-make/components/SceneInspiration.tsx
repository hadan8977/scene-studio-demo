import {
  ArrowUpRight,
  MoonStar,
  CloudRain,
  Coffee,
  Languages,
  ShieldCheck,
  CircleHelp,
  Clock3,
} from 'lucide-react';
import { EXAMPLES } from '@/lib/examples';

const MOMENTS = [
  {
    id: 'wait',
    icon: Coffee,
    eyebrow: 'TAKE A MOMENT',
    title: '把等待，留给自己',
    description: '灯光收一点，让车里舒服一点。',
  },
  {
    id: 'rain',
    icon: CloudRain,
    eyebrow: 'ON THE WAY HOME',
    title: '雨夜里的归途',
    description: '从一句话，安排光、声与温度。',
  },
  {
    id: 'quiet',
    icon: MoonStar,
    eyebrow: 'A LITTLE QUIETER',
    title: '轻一点，别吵醒后排',
    description: '声音留在前排，安静留给后排。',
  },
];

export function SceneInspiration({
  onTry,
  disabled,
}: {
  onTry: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <section aria-label="场景灵感" className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[18px] text-foreground">从一个时刻开始</h2>
        <span className="text-[12px] text-muted-foreground">
          示例提案 · 你决定是否保存
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {MOMENTS.map((m, i) => (
          <button
            key={m.id}
            disabled={disabled}
            aria-label={
              '试用示例 ' + EXAMPLES.find((e) => e.id === m.id)!.label
            }
            onClick={() => onTry(EXAMPLES.find((e) => e.id === m.id)!.input)}
            className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/40 disabled:opacity-40"
          >
            <div className="mb-8 flex items-start justify-between">
              <m.icon className="h-8 w-8 text-primary/80" strokeWidth={1.2} />
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground/40">
                0{i + 1}
              </span>
            </div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground/60">
              {m.eyebrow}
            </div>
            <h3 className="mt-2 text-[21px] tracking-tight">{m.title}</h3>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {m.description}
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-[12px] text-primary">
              看看提案
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
        <span>也可以试试</span>
        {[
          { id: 'english', icon: Languages },
          { id: 'clarify', icon: CircleHelp },
          { id: 'boundary', icon: ShieldCheck },
          { id: 'planned', icon: Clock3 },
        ].map((m) => (
          <button
            key={m.id}
            disabled={disabled}
            onClick={() => onTry(EXAMPLES.find((e) => e.id === m.id)!.input)}
            className="flex min-h-10 items-center gap-2 rounded-full border border-border px-3.5 hover:border-primary/30 hover:text-foreground"
          >
            <m.icon className="h-3.5 w-3.5" />
            {EXAMPLES.find((e) => e.id === m.id)!.label}
          </button>
        ))}
      </div>
    </section>
  );
}
