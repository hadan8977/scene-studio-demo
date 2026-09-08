import type { Context, SceneResult } from './scene.ts';
import { apiUrl } from './base-path.ts';

export type RuntimeState = {
  vehicle: Record<string, string>;
  timeline: { due: number; status: string; execution_id: string }[];
  virtual_seconds: number;
  proposal_id?: string;
  registry_revision?: string;
  scene_id?: string;
};

/** Product controls call only their own server. The service token stays private. */
export async function runtimeOperation(
  result: SceneResult,
  operation:
    | 'save'
    | 'apply_once'
    | 'restore'
    | 'advance'
    | 'cancel'
    | 'trigger'
    | 'manual',
  context: Context,
  extra: Record<string, unknown> = {},
): Promise<RuntimeState> {
  if (!result.runtime && !['save', 'apply_once', 'trigger'].includes(operation))
    throw new Error('该提案不属于技术服务');
  const response = await fetch(apiUrl('/api/runtime'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operation,
      runtime: result.runtime,
      scene: result.scene,
      context,
      ...extra,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '技术服务未能完成操作');
  return body;
}
