import { useRef, useState } from 'react';
import { Brain, Plus, Pencil, Trash2, X, RotateCcw } from 'lucide-react';
import {
  PREFERENCE_FIELDS,
  preferenceLabel,
  preferenceValues,
  type UserPreference,
} from '@/lib/user-preferences';
import { useOverlayFocus } from './useOverlayFocus';
import type { Generation } from '../useGeneration';

export function PreferenceManager({
  gen,
  surfaceActive = true,
}: {
  gen: Generation;
  surfaceActive?: boolean;
}) {
  const [draft, setDraft] = useState<UserPreference | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const active = gen.preferenceEntries.filter((p) => !p.deleted),
    deleted = gen.preferenceEntries.filter((p) => p.deleted);
  useOverlayFocus(surfaceActive && !!draft, dialog, () => setDraft(null));
  const add = () =>
    setDraft({
      id: crypto.randomUUID(),
      primary: '主驾温度控制',
      value: '24℃',
      negative: false,
    });
  const disabled = gen.driving === 'driving';
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
          className="ml-auto flex min-h-12 items-center gap-2 rounded-xl bg-primary px-4 text-[21px] text-primary-foreground disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
          添加偏好
        </button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        {active.length ? (
          active.map((p) => (
            <div
              data-testid="memory-row"
              data-preference={p.primary}
              key={p.id}
              className="flex min-h-[84px] items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${p.negative ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}
              >
                {p.negative ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Brain className="h-5 w-5" />
                )}
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
              {p.negative ? (
                <span className="text-[21px] text-muted-foreground">
                  不使用
                </span>
              ) : (
                p.primary !== '备注' && (
                  <select
                    aria-label={'偏好值 ' + preferenceLabel(p.primary)}
                    disabled={disabled}
                    value={p.value}
                    onChange={(e) =>
                      gen.savePreference({ ...p, value: e.target.value })
                    }
                    className="max-w-[180px] rounded-xl border border-primary/20 bg-background px-3 py-2 text-[24px] text-primary outline-none"
                  >
                    {preferenceValues(p.primary).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                )
              )}
              <button
                aria-label={'编辑偏好 ' + preferenceLabel(p.primary)}
                disabled={disabled}
                onClick={() => setDraft({ ...p })}
                className="rounded-lg p-3 text-muted-foreground hover:text-primary"
              >
                <Pencil className="h-5 w-5" />
              </button>
              <button
                aria-label={'删除偏好 ' + preferenceLabel(p.primary)}
                disabled={disabled}
                onClick={() => gen.deletePreference(p.id)}
                className="rounded-lg p-3 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))
        ) : (
          <div className="p-9">
            <p className="text-[25px]">还没有偏好</p>
            <button
              onClick={add}
              disabled={disabled}
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <dialog
            open
            aria-modal="true"
            aria-label="编辑偏好"
            ref={dialog}
            className="relative m-0 w-[520px] rounded-3xl border border-border bg-card p-7 text-foreground"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[28px]">
                {gen.preferenceEntries.some((p) => p.id === draft.id)
                  ? '编辑偏好'
                  : '添加偏好'}
              </h2>
              <button
                aria-label="关闭偏好编辑"
                onClick={() => setDraft(null)}
                className="p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-[19px] text-muted-foreground">
              项目
              <select
                aria-label="偏好项目"
                value={draft.primary}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    primary: e.target.value,
                    value: preferenceValues(e.target.value)[0] || '',
                    negative: false,
                  })
                }
                className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-[23px] text-foreground"
              >
                {PREFERENCE_FIELDS.map((f) => (
                  <option value={f.primary} key={f.primary}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-5 block text-[19px] text-muted-foreground">
              {draft.primary === '备注' ? '内容' : '偏好值'}
              {draft.primary === '备注' ? (
                <textarea
                  aria-label="偏好内容"
                  maxLength={120}
                  value={draft.value}
                  onChange={(e) =>
                    setDraft({ ...draft, value: e.target.value })
                  }
                  className="mt-2 h-28 w-full resize-none rounded-xl border border-border bg-background p-3 text-[22px] text-foreground"
                />
              ) : (
                <select
                  aria-label="编辑偏好值"
                  value={draft.value}
                  disabled={draft.negative}
                  onChange={(e) =>
                    setDraft({ ...draft, value: e.target.value })
                  }
                  className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-[23px] text-primary disabled:opacity-40"
                >
                  {preferenceValues(draft.primary).map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              )}
            </label>
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
              disabled={!draft.value.trim()}
              onClick={() => {
                if (gen.savePreference(draft)) setDraft(null);
              }}
              className="mt-7 min-h-14 w-full rounded-xl bg-primary text-[23px] text-primary-foreground disabled:opacity-40"
            >
              保存偏好
            </button>
          </dialog>
        </div>
      )}
    </section>
  );
}
