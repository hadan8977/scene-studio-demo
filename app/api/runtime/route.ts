export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { Part1Client, runtimeConfigured } from '@/lib/runtime-client';
import { inputFrom } from '@/lib/generation';
import { parseScene, sameSettings } from '@/lib/scene';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: '请求来源无效' }, { status: 403 });
  if (!runtimeConfigured())
    return Response.json({ error: '技术结构未连接' }, { status: 503 });
  try {
    const text = await request.text();
    if (text.length > 60000) throw new Error('请求过大');
    const body = JSON.parse(text);
    if (
      ![
        'save',
        'apply_once',
        'restore',
        'advance',
        'cancel',
        'trigger',
        'manual',
      ].includes(body.operation)
    )
      throw new Error('未知操作');
    const input = inputFrom({
      input: 'Runtime operation',
      model: 'deepseek-v4-flash',
      context: body.context,
    });
    const scene = parseScene(body.scene),
      client = new Part1Client();
    if (body.operation === 'trigger') {
      const valid = inputFrom({
        input: '条件触发',
        model: 'deepseek-v4-flash',
        context: body.context,
        existingScenes: body.savedScenes,
      });
      await client.syncContext(valid.context, valid.existingScenes);
      const triggered = await client.json('/simulation/trigger', {
        trial: false,
        new_trip: body.newTrip === true,
      });
      const event = triggered.events.find(
        (e: {
          kind?: string;
          event?: string;
          type?: string;
          execution_id?: string;
        }) => e.execution_id,
      );
      const state = await client.json('/state');
      return Response.json({
        vehicle: state.vehicle,
        timeline: state.timeline.filter(
          (j: { execution_id: string }) =>
            j.execution_id === event?.execution_id,
        ),
        virtual_seconds: state.virtual_seconds,
        proposal_id: event?.execution_id,
        registry_revision: state.registry_revision,
        scene_id: event?.scene_id,
      });
    }
    if (
      body.runtime &&
      (typeof body.runtime.proposalId !== 'string' ||
        typeof body.runtime.registryRevision !== 'string')
    )
      throw new Error('提案引用无效');
    let proposalId = body.runtime?.proposalId,
      revision = body.runtime?.registryRevision;
    // Sync current simulated context before applying, not stale generation-time state.
    if (['save', 'apply_once'].includes(body.operation))
      await client.syncContext(input.context);
    else if (body.operation === 'advance')
      await client.syncContext({ ...input.context, vehicle: {} });
    if (
      ['save', 'apply_once'].includes(body.operation) &&
      (!proposalId ||
        !body.runtime?.proposedScene ||
        !sameSettings(scene, parseScene(body.runtime.proposedScene)))
    ) {
      const proposal = await client.json('/demo/prepare', { scene });
      if (!proposal.valid) throw new Error('编辑后的场景未通过完整校验');
      proposalId = proposal.proposal_id;
      revision = proposal.registry_revision;
    }
    if (!proposalId) throw new Error('缺少有效的执行引用');
    let event;
    if (body.operation === 'manual')
      event = await client.json('/simulation/manual', {
        values: body.values,
        driving: input.context.driving,
      });
    else if (body.operation === 'restore')
      event = await client.json('/restore', { proposal_id: proposalId });
    else if (body.operation === 'cancel')
      event = await client.json('/execution/cancel', {
        proposal_id: proposalId,
      });
    else if (body.operation === 'advance')
      event = await client.json('/simulation/advance', {
        seconds: body.seconds,
      });
    else
      event = await client.json('/confirm', {
        proposal_id: proposalId,
        operation: body.operation,
        registry_revision: revision,
        trial: false,
      });
    const state = await client.json('/state');
    return Response.json({
      vehicle: state.vehicle,
      timeline: state.timeline.filter(
        (job: { execution_id: string }) => job.execution_id === proposalId,
      ),
      virtual_seconds: state.virtual_seconds,
      proposal_id: proposalId,
      registry_revision: revision,
      scene_id: event.scene_id || proposalId,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '技术服务操作失败' },
      { status: 400 },
    );
  }
}
