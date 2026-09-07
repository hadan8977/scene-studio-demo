import { ChevronDown, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { capabilities } from '@/lib/scene';
import {
  structuredFields,
  validStructuredValue,
} from '@/lib/structured-values';
import type { Generation } from '../useGeneration';

function values(primary: string, condition: boolean) {
  if (structuredFields[primary])
    return structuredFields[primary].example
      ? [structuredFields[primary].example!]
      : [];
  const cap = capabilities.find((c) => c.zh === primary);
  const spec = condition ? cap?.cond_values : cap?.act_values;
  if (!spec) return [];
  return (
    Array.isArray(spec)
      ? spec
      : Array.from(
          {
            length: Math.min(
              110,
              Math.floor(
                (Number(spec.range[1]) - Number(spec.range[0])) /
                  Number(spec.range[2]),
              ) + 1,
            ),
          },
          (_, i) =>
            `${Number(spec.range[0]) + i * Number(spec.range[2])}${spec.range[3]}`,
        )
  ).filter(
    (v) =>
      (condition || !cap?.deny_act_values.includes(v)) &&
      ![
        '自定义',
        '自定义动效',
        '地点搜索',
        '收藏地点',
        '常用地点',
        '指定歌曲',
      ].includes(v),
  );
}

function CustomValue({
  primary,
  value,
  onApply,
}: {
  primary: string;
  value: string;
  onApply: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const valid = validStructuredValue(primary, draft.trim()) === true;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input
        aria-label={'设置' + primary}
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={structuredFields[primary].hint}
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-[18px] text-foreground"
      />
      <button
        disabled={!valid || draft === value}
        onClick={() => onApply(draft.trim())}
        className="rounded-lg px-2 py-2 text-[18px] text-primary disabled:opacity-30"
      >
        应用
      </button>
    </div>
  );
}

export function SceneFields({ gen }: { gen: Generation }) {
  const [pending, setPending] = useState<{
    primary: string;
    kind: 'actions' | 'conditions';
  } | null>(null);
  const scene = gen.rawResult?.scene;
  if (!scene) return null;
  const update = gen.controller.updateScene;
  return (
    <details
      open
      className="rounded-xl border border-primary/20 bg-secondary/30 p-3 text-[20px]"
      data-testid="scene-fields"
    >
      <summary className="flex cursor-pointer items-center justify-between text-primary">
        名称、条件与动作
        <ChevronDown className="h-4 w-4" />
      </summary>
      <label className="mt-4 block text-[18px] text-muted-foreground">
        场景名称
        <input
          aria-label="场景名称"
          maxLength={20}
          value={scene.name}
          onChange={(e) =>
            update({ ...scene, name: e.target.value }, ['场景名称'])
          }
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[22px] text-foreground"
        />
      </label>
      {(['conditions', 'actions'] as const).map((kind) => (
        <div key={kind} className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[18px] text-muted-foreground">
            <span>{kind === 'conditions' ? '触发条件' : '场景动作'}</span>
            {kind === 'conditions' && scene.conditions.length > 1 && (
              <button
                onClick={() =>
                  update(
                    { ...scene, logic: scene.logic === 'AND' ? 'OR' : 'AND' },
                    ['触发关系'],
                  )
                }
                className="text-primary"
              >
                {scene.logic === 'AND' ? '全部满足' : '任一满足'}
              </button>
            )}
          </div>
          {scene[kind].map((entry, i) => (
            <div
              key={`${entry.primary}:${i}`}
              className="flex items-center gap-2"
            >
              <span className="min-w-0 flex-1 text-[18px] text-foreground/80">
                {entry.primary}
              </span>
              {kind === 'conditions' && (
                <select
                  aria-label={'比较方式 ' + entry.primary}
                  value={entry.op || '=='}
                  onChange={(e) =>
                    update(
                      {
                        ...scene,
                        conditions: scene.conditions.map((a, j) =>
                          j === i ? { ...a, op: e.target.value } : a,
                        ),
                      },
                      [entry.primary],
                    )
                  }
                  className="max-w-20 rounded border border-border bg-background px-1 py-2 text-[18px]"
                >
                  {(Array.isArray(
                    capabilities.find((c) => c.zh === entry.primary)
                      ?.cond_values,
                  )
                    ? ['==']
                    : ['==', '<', '<=', '>', '>=']
                  ).map((op) => (
                    <option key={op}>{op}</option>
                  ))}
                </select>
              )}
              {structuredFields[entry.primary] ? (
                <CustomValue
                  key={entry.primary + entry.secondary}
                  primary={entry.primary}
                  value={entry.secondary}
                  onApply={(value) =>
                    update(
                      {
                        ...scene,
                        [kind]: scene[kind].map((a, j) =>
                          j === i ? { ...a, secondary: value } : a,
                        ),
                      },
                      [entry.primary],
                    )
                  }
                />
              ) : (
                <select
                  aria-label={'设置' + entry.primary}
                  value={entry.secondary}
                  onChange={(e) =>
                    update(
                      {
                        ...scene,
                        [kind]: scene[kind].map((a, j) =>
                          j === i ? { ...a, secondary: e.target.value } : a,
                        ),
                      },
                      [entry.primary],
                    )
                  }
                  className="max-w-[240px] rounded-lg border border-border bg-background px-2 py-2 text-[18px] text-primary"
                >
                  {values(entry.primary, kind === 'conditions').map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              )}
              <button
                aria-label={'移除' + entry.primary}
                onClick={() =>
                  update(
                    { ...scene, [kind]: scene[kind].filter((_, j) => j !== i) },
                    [entry.primary],
                  )
                }
                className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 text-primary/70">
            <Plus className="h-4 w-4" />
            <select
              aria-label={kind === 'conditions' ? '添加触发条件' : '添加动作'}
              value=""
              onChange={(e) => {
                const primary = e.target.value;
                if (
                  structuredFields[primary] &&
                  !structuredFields[primary].example
                ) {
                  setPending({ primary, kind });
                  return;
                }
                const secondary = values(primary, kind === 'conditions')[0];
                if (secondary !== undefined)
                  update(
                    {
                      ...scene,
                      [kind]: [
                        ...scene[kind],
                        {
                          primary,
                          secondary,
                          ...(kind === 'conditions' ? { op: '==' } : {}),
                        },
                      ],
                    },
                    [primary],
                  );
              }}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-[18px] text-muted-foreground"
            >
              <option value="">
                {kind === 'conditions' ? '添加触发条件' : '添加动作'}
              </option>
              {capabilities
                .filter(
                  (c) =>
                    c.status === 'enabled' &&
                    (kind === 'conditions' ? c.cond_values : c.act_values) &&
                    !scene[kind].some((a) => a.primary === c.zh),
                )
                .map((c) => (
                  <option key={c.id} value={c.zh}>
                    {c.zh}
                    {c.maturity === 'proposed'
                      ? ' · 提议中'
                      : ['planned', 'sprint'].includes(c.maturity)
                        ? ' · 规划中'
                        : ''}
                  </option>
                ))}
            </select>
          </div>
          {pending?.kind === kind && (
            <div className="rounded-lg border border-primary/20 p-3">
              <div className="mb-2 flex items-center justify-between text-[18px] text-muted-foreground">
                {pending.primary}
                <button aria-label="取消添加" onClick={() => setPending(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <CustomValue
                primary={pending.primary}
                value=""
                onApply={(value) => {
                  update(
                    {
                      ...scene,
                      [kind]: [
                        ...scene[kind],
                        {
                          primary: pending.primary,
                          secondary: value,
                          ...(kind === 'conditions' ? { op: '==' } : {}),
                        },
                      ],
                    },
                    [pending.primary],
                  );
                  setPending(null);
                }}
              />
            </div>
          )}
        </div>
      ))}
    </details>
  );
}
