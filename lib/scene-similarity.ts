import type { Scene, SceneResult } from './scene.ts';
import { validateScene, type Context } from './scene.ts';
import type { SavedScene } from './storage.ts';
const conditionKeys = (s: Scene) =>
  s.conditions.map((c) => `${c.primary}|${c.op}|${c.secondary}`).sort();
export function similarScene(
  scene: Scene,
  items: SavedScene[],
  excludeId?: string,
): SavedScene | undefined {
  const conditions = conditionKeys(scene);
  return items
    .filter((s) => s.id !== excludeId)
    .map((item) => {
      const other = conditionKeys(item.result.scene);
      const conditionMatch =
        scene.logic === item.result.scene.logic &&
        (conditions.every((c) => other.includes(c)) ||
          other.every((c) => conditions.includes(c))) &&
        !!conditions.length === !!other.length;
      const a = new Set(scene.actions.map((a) => a.primary)),
        b = new Set(item.result.scene.actions.map((a) => a.primary));
      const union = new Set([...a, ...b]).size,
        intersection = [...a].filter((v) => b.has(v)).length;
      return {
        item,
        score: conditionMatch && union ? intersection / union : 0,
      };
    })
    .filter((s) => s.score >= 0.5)
    .sort((a, b) => b.score - a.score)[0]?.item;
}
export function sceneDiff(before: Scene, after: Scene) {
  const keys = new Set(
    [...before.actions, ...after.actions].map((a) => a.primary),
  );
  return [...keys]
    .map((primary) => ({
      primary,
      before: before.actions.find((a) => a.primary === primary)?.secondary,
      after: after.actions.find((a) => a.primary === primary)?.secondary,
    }))
    .filter((d) => d.before !== d.after);
}
export function mergeScene(
  existing: Scene,
  proposal: Scene,
  ctx: Context,
): SceneResult {
  const actions = new Map(existing.actions.map((a) => [a.primary, a]));
  for (const a of proposal.actions) actions.set(a.primary, a);
  return validateScene(
    {
      ...proposal,
      name: existing.name,
      conditions:
        proposal.conditions.length >= existing.conditions.length
          ? proposal.conditions
          : existing.conditions,
      actions: [...actions.values()],
    },
    ctx,
  );
}
