import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEMO_CASES } from '@/lib/demo-cases';
export function CasePicker({ onTry }: { onTry: (text: string) => void }) {
  const [tab, setTab] = useState<'scene' | 'control' | 'chat'>('scene'),
    [page, setPage] = useState(0);
  const cases = DEMO_CASES.filter((c) =>
      tab === 'scene'
        ? c.entry === 'ambient'
        : c.entry === 'counter' &&
          (tab === 'chat' ? c.kind === 'chat' : c.kind !== 'chat'),
    ),
    pages = Math.ceil(cases.length / 4);
  return (
    <div aria-label="主动服务示例" className="mb-5 w-[680px] px-2">
      <div className="mb-3 flex items-center gap-4">
        {(['scene', 'control', 'chat'] as const).map((t) => (
          <button
            aria-pressed={tab === t}
            key={t}
            onClick={() => {
              setTab(t);
              setPage(0);
            }}
            className={`text-[18px] ${tab === t ? 'text-primary' : 'text-white/50'}`}
          >
            {t === 'scene'
              ? '场景建议'
              : t === 'control'
                ? '直接车控'
                : '普通对话'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[17px] text-white/50">
          <button
            aria-label="上一组示例"
            className="p-2"
            onClick={() => setPage((page + pages - 1) % pages)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {page + 1}/{pages}
          <button
            aria-label="下一组示例"
            className="p-2"
            onClick={() => setPage((page + 1) % pages)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="mb-3 text-[17px] text-white/45">
        {tab === 'scene'
          ? '先给方案，由你确认'
          : tab === 'control'
            ? '明确指令，直接处理'
            : '只回应，不调整车辆'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {cases.slice(page * 4, page * 4 + 4).map((c) => (
          <button
            key={c.id}
            aria-label={'体验 ' + c.title}
            onClick={() => onTry(c.input)}
            className="min-h-12 rounded-full border border-white/10 bg-card/80 px-4 py-2 text-left text-[20px] text-foreground/80 backdrop-blur-xl hover:border-primary/40"
          >
            {c.title}
          </button>
        ))}
      </div>
    </div>
  );
}
