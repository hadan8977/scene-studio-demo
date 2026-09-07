import { useRef, useState } from 'react';
import {
  Brain,
  Plus,
  Minus,
  Pencil,
  Trash2,
  X,
  RotateCcw,
  ChevronDown,
  Check,
  Thermometer,
  Sun,
  Volume2,
  Wind,
  Armchair,
} from 'lucide-react';
import {
  PREFERENCE_FIELDS,
  preferenceLabel,
  preferenceValues,
  validPreference,
  type UserPreference,
} from '@/lib/user-preferences';
import { useOverlayFocus } from './useOverlayFocus';
import type { Generation } from '../useGeneration';

function PreferenceIcon({
  primary,
  className,
}: {
  primary: string;
  className: string;
}) {
  if (/温度|加热/.test(primary))
    return <Thermometer className={className} strokeWidth={1.4} />;
  if (/灯|屏幕/.test(primary))
    return <Sun className={className} strokeWidth={1.4} />;
  if (/音|声/.test(primary))
    return <Volume2 className={className} strokeWidth={1.4} />;
  if (/座椅/.test(primary))
    return <Armchair className={className} strokeWidth={1.4} />;
  if (/空气|循环|车窗|香氛/.test(primary))
    return <Wind className={className} strokeWidth={1.4} />;
  return <Brain className={className} strokeWidth={1.4} />;
}
function PreferenceValue({
  draft,
  onChange,
}: {
  draft: UserPreference;
  onChange: (value: string) => void;
}) {
  const values = preferenceValues(draft.primary),
    index = Math.max(0, values.indexOf(draft.value));
  const numeric =
    values.length > 3 && values.every((v) => /^\d+(?:\.\d+)?(?:℃|%)$/.test(v));
  return (
    <div className="mt-6 rounded-[28px] border border-primary/10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(205,236,82,.11),transparent_75%)] p-6">
      <div className="mb-4 flex items-center justify-center gap-2 text-[19px] text-primary/70">
        <PreferenceIcon primary={draft.primary} className="h-5 w-5" />
        {preferenceLabel(draft.primary)}
      </div>
      {numeric ? (
        <>
          <div className="flex items-center justify-between gap-5">
            <button
              aria-label="减小偏好值"
              disabled={index === 0 || draft.negative}
              onClick={() => onChange(values[index - 1])}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[.03] disabled:opacity-25"
            >
              <Minus className="h-6 w-6" />
            </button>
            <output
              aria-label="当前偏好值"
              className="text-[64px] font-medium leading-tight tracking-tight text-primary tabular-nums"
            >
              {draft.value}
            </output>
            <button
              aria-label="增大偏好值"
              disabled={index === values.length - 1 || draft.negative}
              onClick={() => onChange(values[index + 1])}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[.03] disabled:opacity-25"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <input
            type="range"
            aria-label="编辑偏好值"
            aria-valuetext={draft.value}
            min={0}
            max={values.length - 1}
            step={1}
            value={index}
            disabled={draft.negative}
            onChange={(e) => onChange(values[Number(e.target.value)])}
            className="preference-slider mt-7 w-full"
          />
          <div className="mt-3 flex justify-between text-[17px] text-muted-foreground">
            <span>{values[0]}</span>
            <span>{values.at(-1)}</span>
          </div>
        </>
      ) : (
        <div aria-label="编辑偏好值" className="grid grid-cols-2 gap-2">
          {values.map((v) => (
            <button
              key={v}
              aria-label={'偏好设为 ' + v}
              aria-pressed={draft.value === v}
              disabled={draft.negative}
              onClick={() => onChange(v)}
              className={`min-h-14 rounded-2xl border px-4 text-[23px] transition-colors ${draft.value === v ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/10 bg-white/[.025] text-muted-foreground'} disabled:opacity-40`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function PreferenceManager({
  gen,
  surfaceActive = true,
}: {
  gen: Generation;
  surfaceActive?: boolean;
}) {
  const [draft, setDraft] = useState<UserPreference | null>(null),
    [choosing, setChoosing] = useState(false),
    dialog = useRef<HTMLDialogElement>(null);
  const active = gen.preferenceEntries.filter((p) => !p.deleted),
    deleted = gen.preferenceEntries.filter((p) => p.deleted),
    disabled = gen.driving === 'driving';
  useOverlayFocus(surfaceActive && !!draft, dialog, () => setDraft(null));
  const edit = (p: UserPreference) => {
    setChoosing(false);
    setDraft({ ...p });
  };
  const add = () =>
    edit({
      id: crypto.randomUUID(),
      primary: '主驾温度控制',
      value: '24℃',
      negative: false,
    });
  return (
    <section aria-label="偏好管理">
      <div className="mb-7 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-[32px] text-primary">
          {gen.profileId === 'none' ? (
            <Brain className="h-8 w-8" />
          ) : (
            gen.profile.name
          )}
        </div>
        <div>
          <h2 className="text-[30px]">
            {gen.profileId === 'none'
              ? '我的偏好'
              : gen.profile.name + '的偏好'}
          </h2>
          <p className="mt-1 text-[19px] text-muted-foreground">
            {active.length} 条偏好
          </p>
        </div>
        <button
          disabled={disabled}
          onClick={add}
          className="ml-auto flex min-h-12 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-5 text-[21px] text-primary disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
          添加偏好
        </button>
      </div>
      <div className="space-y-3">
        {active.length ? (
          active.map((p) => {
            return (
              <div
                data-testid="memory-row"
                data-preference={p.primary}
                key={p.id}
                className="group flex min-h-[90px] items-center gap-4 rounded-[24px] border border-border bg-gradient-to-r from-card to-card/60 px-5 py-4 transition-colors hover:border-primary/20"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${p.negative ? 'bg-destructive/10 text-destructive' : 'bg-primary/8 text-primary/80'}`}
                >
                  <PreferenceIcon primary={p.primary} className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[23px]">
                    {preferenceLabel(p.primary)}
                  </span>
                  {p.primary === '备注' && (
                    <p className="mt-1 text-[20px] text-muted-foreground">
                      {p.value}
                    </p>
                  )}
                </div>
                {p.primary !== '备注' && (
                  <button
                    aria-label={'偏好值 ' + preferenceLabel(p.primary)}
                    disabled={disabled}
                    onClick={() => edit(p)}
                    className="min-h-12 rounded-full bg-primary/[.07] px-5 text-[26px] font-medium tracking-tight text-primary tabular-nums hover:bg-primary/15"
                  >
                    {p.negative ? '不使用' : p.value}
                  </button>
                )}
                <button
                  aria-label={'编辑偏好 ' + preferenceLabel(p.primary)}
                  disabled={disabled}
                  onClick={() => edit(p)}
                  className="rounded-xl p-3 text-muted-foreground hover:bg-secondary hover:text-primary"
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  aria-label={'删除偏好 ' + preferenceLabel(p.primary)}
                  disabled={disabled}
                  onClick={() => gen.deletePreference(p.id)}
                  className="rounded-xl p-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-border p-9">
            <p className="text-[25px]">还没有偏好</p>
            <button
              disabled={disabled}
              onClick={add}
              className="mt-4 text-[21px] text-primary"
            >
              添加第一条
            </button>
          </div>
        )}
      </div>
      {deleted.length > 0 && (
        <details className="mt-6 text-[19px] text-muted-foreground">
          <summary className="cursor-pointer py-3">
            最近删除 · {deleted.length}
          </summary>
          <div className="divide-y divide-border/50">
            {deleted.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-4">
                <span className="flex-1">
                  {preferenceLabel(p.primary)} ·{' '}
                  {p.negative ? '不使用' : p.value}
                </span>
                <button
                  aria-label={'恢复偏好 ' + preferenceLabel(p.primary)}
                  disabled={disabled}
                  onClick={() => gen.restorePreference(p.id)}
                  className="flex items-center gap-2 text-[20px] text-primary"
                >
                  <RotateCcw className="h-4 w-4" />
                  恢复
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
      {draft && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md">
          <dialog
            open
            aria-modal="true"
            aria-label="编辑偏好"
            data-preference-primary={draft.primary}
            ref={dialog}
            className="relative m-0 max-h-[850px] w-[570px] overflow-y-auto rounded-[36px] border border-white/10 bg-[linear-gradient(150deg,#232720,#151816_55%)] p-8 text-foreground shadow-[0_45px_100px_-20px_#000,inset_0_1px_0_#ffffff10]"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[17px] text-primary/70">
                  {gen.profileId === 'none'
                    ? '我的档案'
                    : gen.profile.name + '的档案'}
                </span>
                <h2 className="mt-1 text-[32px]">
                  {gen.preferenceEntries.some((p) => p.id === draft.id)
                    ? '编辑偏好'
                    : '添加偏好'}
                </h2>
              </div>
              <button
                aria-label="关闭偏好编辑"
                onClick={() => setDraft(null)}
                className="rounded-full bg-white/5 p-3 text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              aria-label="偏好项目"
              aria-expanded={choosing}
              onClick={() => setChoosing((v) => !v)}
              className="mt-6 flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-black/15 px-5 text-[23px]"
            >
              {preferenceLabel(draft.primary)}
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </button>
            {choosing && (
              <div
                aria-label="选择偏好项目"
                className="mt-3 grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto rounded-2xl bg-black/15 p-2"
              >
                {PREFERENCE_FIELDS.map((f) => (
                  <button
                    aria-label={'选择偏好 ' + f.label}
                    aria-pressed={draft.primary === f.primary}
                    key={f.primary}
                    onClick={() => {
                      setDraft({
                        ...draft,
                        primary: f.primary,
                        value: preferenceValues(f.primary)[0] || '',
                        negative: false,
                      });
                      setChoosing(false);
                    }}
                    className={`min-h-12 rounded-xl px-3 text-left text-[20px] ${draft.primary === f.primary ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {draft.primary === '备注' ? (
              <textarea
                aria-label="偏好内容"
                maxLength={120}
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                className="mt-6 h-36 w-full resize-none rounded-2xl border border-white/10 bg-black/15 p-5 text-[23px] outline-none focus:border-primary/30"
                placeholder="写下你的偏好"
              />
            ) : (
              <PreferenceValue
                draft={draft}
                onChange={(value) => setDraft({ ...draft, value })}
              />
            )}
            {['香氛开关', '主驾车窗', '备注'].includes(draft.primary) && (
              <label className="mt-5 flex items-center gap-3 text-[21px]">
                <input
                  type="checkbox"
                  checked={draft.negative}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      negative: e.target.checked,
                      ...(e.target.checked && draft.primary !== '备注'
                        ? { value: '关闭' }
                        : {}),
                    })
                  }
                  className="h-5 w-5 accent-[var(--primary)]"
                />
                不喜欢
                {draft.primary === '备注'
                  ? ''
                  : '使用' + preferenceLabel(draft.primary)}
              </label>
            )}
            <button
              disabled={!validPreference(draft) || disabled}
              onClick={() => {
                if (gen.savePreference(draft)) setDraft(null);
              }}
              className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-[23px] font-medium text-primary-foreground shadow-[0_8px_30px_-15px_var(--primary)] disabled:opacity-40"
            >
              <Check className="h-5 w-5" />
              保存偏好
            </button>
          </dialog>
        </div>
      )}
    </section>
  );
}
