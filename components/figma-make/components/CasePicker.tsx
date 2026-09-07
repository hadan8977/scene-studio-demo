import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEMO_CASES } from '@/lib/demo-cases';
export function CasePicker({ onTry }: { onTry: (text: string) => void }) {
  const [tab, setTab] = useState<'ambient' | 'counter'>('ambient'),
    [page, setPage] = useState(0);
  const cases = DEMO_CASES.filter((c) => c.entry === tab),
    pages = Math.ceil(cases.length / 4);
  return (
    <section
      aria-label="主动服务示例"
      className="mb-5 w-[880px] rounded-[26px] border border-white/10 bg-card/90 p-5 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-4 flex items-center gap-4">
        {(['ambient', 'counter'] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setPage(0);
            }}
            className={`min-h-12 rounded-full px-5 text-[22px] ${tab === t ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}
          >
            {t === 'ambient' ? '一句处境，轻轻问你' : '这些不该生成场景'}
          </button>
        ))}
        <span className="ml-auto text-[17px] text-muted-foreground">
          独立情境回放
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-2">
        {cases.slice(page * 4, page * 4 + 4).map((c) => (
          <button
            key={c.id}
            aria-label={'体验 ' + c.title}
            onClick={() => onTry(c.input)}
            className="group min-h-[88px] border-b border-border/70 py-3 text-left"
          >
            <span className="flex items-center justify-between text-[24px]">
              {c.title}
              <ChevronRight className="h-5 w-5 text-primary/70" />
            </span>
            <span className="mt-1 block text-[19px] text-muted-foreground">
              “{c.input}”
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[17px] text-muted-foreground">
          {tab === 'ambient'
            ? '先回应，再判断是否值得建议。'
            : '具体车控、官方模式、闲聊和不支持的请求各有归处。'}
        </p>
        <div className="flex items-center gap-3 text-[18px]">
          <button
            aria-label="上一组示例"
            onClick={() => setPage((page + pages - 1) % pages)}
            className="p-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {page + 1} / {pages}
          <button
            aria-label="下一组示例"
            onClick={() => setPage((page + 1) % pages)}
            className="p-2"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
