import {
  elementOf,
  type SceneResult,
  type Decision,
  type ProfileId,
} from '../../lib/scene.ts';
import type { SavedScene as StoredScene } from '../../lib/storage.ts';
import type {
  Action,
  Scene,
  GenerationResult,
  SavedScene,
} from './domain/types.ts';

export const CORE_PROFILE: Record<string, ProfileId> = {
  none: 'none',
  lin: 'quiet',
  zhou: 'fresh',
};
export const VIEW_PROFILE: Record<ProfileId, string> = {
  none: 'none',
  quiet: 'lin',
  fresh: 'zhou',
};
export const MEMORY_CONTENT: Record<string, string> = {
  lin_light: '等人或休息时氛围灯亮度20%',
  lin_vol: '等人或休息时媒体音量20%',
  lin_temp: '主驾温度24℃',
  lin_no_fragrance: '不喜欢香氛，不要开香氛',
  zhou_light: '等人时氛围灯亮度40%',
  zhou_temp: '主驾温度22℃',
  zhou_purify: '喜欢自动空气净化',
  zhou_no_window: '不喜欢开车窗',
};
const status = (d?: Decision): Action['status'] =>
  !d || d.status === 'accepted' ? 'available' : d.status;
const target = (p: string) =>
  ({ 主驾温度控制: '主驾温度', 音量: '媒体音量', 氛围灯亮度: '氛围灯亮度' })[
    p
  ] || p;

/** Presentation adapter only: the Appendix C result and 96-entry validator remain authoritative. */
export function toViewResult(result: SceneResult): GenerationResult {
  const raw = result.scene;
  const scene: Scene = {
    name: raw.name,
    understanding: raw.understanding,
    relevance: raw.relevance,
    intent: raw.clarify
      ? '追问'
      : raw.intent === 'none'
        ? '无关'
        : raw.intent === 'precise'
          ? '精准条件'
          : '模糊目标',
    logic: raw.logic,
    conditions: [
      ...raw.conditions.map((c, i) => {
        const d = result.decisions.find(
          (d) =>
            d.kind === 'condition' &&
            d.primary === c.primary &&
            d.final !== undefined,
        );
        return {
          id: `condition:${i}`,
          label: `${c.primary} ${c.op || '=='} ${c.secondary}`,
          status: status(d) as Scene['conditions'][number]['status'],
          reason: d?.reason,
        };
      }),
      ...result.decisions
        .filter((d) => d.kind === 'condition' && d.final === undefined)
        .map((d, i) => ({
          id: `condition:excluded:${i}`,
          label: `${d.primary} ${d.original}`,
          status: 'unsupported' as const,
          reason: d.reason,
        })),
    ],
    actions: raw.actions.map((a) => {
      const d = result.decisions.find(
        (d) =>
          d.kind === 'action' &&
          d.primary === a.primary &&
          d.final !== undefined,
      );
      return {
        id: a.primary,
        group: elementOf(a.primary),
        capability: a.primary,
        target: target(a.primary),
        requested: d?.original || a.secondary,
        finalValue: a.secondary,
        status: status(d),
        reason: d?.status !== 'accepted' ? d?.reason : undefined,
      };
    }),
    say: raw.say || undefined,
    offer:
      raw.offer.type === 'none'
        ? []
        : [{ id: 'offer', label: raw.offer.target, status: 'proposed' }],
    memory: result.memoryUsed.map((content) => ({
      id:
        Object.keys(MEMORY_CONTENT).find(
          (id) => MEMORY_CONTENT[id] === content,
        ) || content,
      label: content,
      negative: /不喜欢|不要/.test(content),
    })),
    unsupported: result.decisions
      .filter((d) => d.kind !== 'condition' && d.final === undefined)
      .map((d, i) => ({
        id: `excluded:${i}`,
        group: elementOf(d.primary),
        capability: d.primary,
        target: d.primary,
        requested: d.original,
        finalValue: null,
        status: status(d),
        reason: d.reason,
      })),
    warnings: raw.warnings.map((label, i) => ({
      id: `warning:${i}`,
      label,
      kind: 'info',
    })),
    clarify: raw.clarify ? { question: raw.clarify } : null,
    canSave: result.savable && !!raw.name.trim(),
    blockReason: result.savable
      ? undefined
      : raw.clarify || '请先补充有效动作或调整无法表达的触发条件。',
  };
  return {
    scene,
    raw: scene,
    verdicts: result.decisions.map((d) => ({
      capability: d.primary,
      requested: d.original,
      finalValue: d.final ?? null,
      outcome:
        d.final === undefined
          ? 'rejected'
          : d.status === 'adjusted'
            ? 'adjusted'
            : 'kept',
      reason: d.reason,
      status: d.status,
    })),
  };
}

export function toViewSaved(item: StoredScene): SavedScene {
  return {
    id: item.id,
    input: item.input,
    scene: toViewResult(item.result).scene,
    source: item.source === 'live' ? 'ai' : 'example',
    profileId: VIEW_PROFILE[item.profileId || 'none'] || 'none',
    savedAt: Date.parse(item.updatedAt),
  };
}
