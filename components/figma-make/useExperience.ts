'use client';
import { useEffect, useRef, useState } from 'react';
import type { useSceneController } from '@/lib/use-scene-controller';
import {
  routeInput,
  controlResult,
  evaluateSuggestion,
  isImmediateControl,
  emptyAttention,
  type IntentRoute,
} from '@/lib/intent-routing';
import { vehicleShortcut } from '@/lib/vehicle-shortcuts';
import { demoCase, sceneForCase } from '@/lib/demo-cases';
import { capabilities, validateScene, type SceneResult } from '@/lib/scene';
import { readSaved, type SavedScene } from '@/lib/storage';
import { similarScene } from '@/lib/scene-similarity';
import { runtimeOperation } from '@/lib/runtime-browser';

const INBOX_KEY = 'scene-studio.ideas.v1';
export const INITIAL_VEHICLE: Record<string, string> = {
  氛围灯亮度: '50%',
  音量: '30%',
  主驾温度控制: '24℃',
  主驾车窗: '关闭',
  副驾车窗: '关闭',
  屏幕亮度: '70%',
  屏幕模式: '白天模式',
  声场: '全车模式',
  内外循环设置: '外循环',
  自动空气净化: '关闭',
  主驾座椅通风: '关闭',
  电动遮阳帘: '100%',
};
type Controller = ReturnType<typeof useSceneController>;
type Applied = {
  before: Record<string, string>;
  values: Record<string, string>;
};
function restore(current: Record<string, string>, applied: Applied) {
  const next = { ...current };
  for (const [key, value] of Object.entries(applied.values)) {
    if (next[key] !== value) continue;
    if (key in applied.before) next[key] = applied.before[key];
    else delete next[key];
  }
  return next;
}
export function useExperience(c: Controller) {
  const [route, setRoute] = useState<IntentRoute | null>(null);
  const [presentation, setPresentation] = useState<
    'idle' | 'response' | 'offer' | 'proposal'
  >('idle');
  const [feedback, setFeedback] = useState('');
  const [attention, setAttention] = useState(emptyAttention);
  const [vehicle, setVehicle] = useState({ ...INITIAL_VEHICLE });
  const [application, setApplicationState] = useState<
    'idle' | 'applying' | 'done'
  >('idle');
  const [inbox, setInbox] = useState<SavedScene[]>([]);
  const inboxRef = useRef(inbox);
  const [reused, setReused] = useState<SavedScene | null>(null);
  const [viewRequest, setViewRequest] = useState(0);
  const job = useRef(0),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    snapshot = useRef<Applied | null>(null);
  const live = useRef(vehicle);
  const runtimeApplied = useRef<SceneResult | null>(null);
  const applicationRef = useRef(application);
  function setApplication(value: typeof application) {
    applicationRef.current = value;
    setApplicationState(value);
  }
  function cancelPending() {
    job.current++;
    timers.current.forEach(clearTimeout);
  }
  useEffect(() => {
    let mounted = true;
    const sync = () => {
      if (!mounted) return;
      try {
        const next = readSaved(localStorage.getItem(INBOX_KEY));
        inboxRef.current = next;
        setInbox(next);
      } catch {}
    };
    // Read browser-owned state after hydration, and follow changes from other tabs.
    queueMicrotask(sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === INBOX_KEY || e.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      mounted = false;
      window.removeEventListener('storage', onStorage);
      cancelPending();
    };
  }, []);
  function stopPreview(undo = false) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (runtimeApplied.current && applicationRef.current === 'applying') {
      void runtimeOperation(runtimeApplied.current, 'cancel', c.ctx).catch(error => c.showToast(error instanceof Error ? error.message : '停止执行未确认', true));
    }
    if (snapshot.current && (undo || applicationRef.current === 'applying')) {
      const next = restore(live.current, snapshot.current);
      live.current = next;
      setVehicle(next);
    }
    setApplication('idle');
  }
  useEffect(() => {
    const id = ++job.current;
    queueMicrotask(() => {
      if (id !== job.current) return;
      stopPreview();
      setPresentation((p) => (p === 'offer' ? 'response' : p));
    });
  }, [c.ctx]);
  function updateInbox(next: SavedScene[]) {
    try {
      localStorage.setItem(INBOX_KEY, JSON.stringify(next));
      inboxRef.current = next;
      setInbox(next);
    } catch {
      c.showToast('建议未能保存，请检查浏览器存储空间', true);
    }
  }
  function keepIdea(
    result: SceneResult,
    input: string,
    source: 'live' | 'example' = c.source,
  ) {
    const exists = inboxRef.current.find((s) => s.input === input);
    if (exists) return;
    updateInbox(
      [
        {
          id: crypto.randomUUID(),
          input,
          source,
          profileId: c.ctx.profile,
          result,
          updatedAt: new Date().toISOString(),
        },
        ...inboxRef.current,
      ].slice(0, 30),
    );
  }
  function openIdea(item: SavedScene) {
    job.current++;
    stopPreview();
    c.openProposal(item);
    setRoute({
      kind: 'scene',
      input: item.input,
      reason: '从场景建议打开提案',
      reply: '',
    });
    setPresentation('proposal');
    setViewRequest((v) => v + 1);
  }
  function reset() {
    job.current++;
    stopPreview();
    c.discard();
    setRoute(null);
    setReused(null);
    setFeedback('');
    setPresentation('idle');
  }
  async function submit(
    text: string,
    source?: 'live' | 'example',
    independent = false,
    origin: 'voice' | 'create' = 'create',
  ) {
    const input = text.trim();
    if (!input) return;
    const r = routeInput(input, c.ctx);
    if (
      origin === 'create' &&
      r.kind === 'chat' &&
      r.reason.startsWith('当前演示规则')
    ) {
      r.kind = 'scene';
      r.reason = '用户在场景应用内明确创建';
    }
    const id = ++job.current;
    stopPreview();
    c.discard();
    c.setInput(input);
    setRoute(r);
    setReused(null);
    setFeedback('');
    setPresentation(r.kind === 'scene' ? 'proposal' : 'response');
    const contextVehicle = independent
      ? { ...INITIAL_VEHICLE, ...demoCase(r.caseId || '')?.initial }
      : live.current;
    const ledger = independent ? emptyAttention() : attention;
    if (independent) {
      setAttention(ledger);
      live.current = contextVehicle;
      setVehicle(contextVehicle);
    }
    if (source) c.setMode(source);
    const shortcut = vehicleShortcut(input, c.ctx.driving);
    if (shortcut) {
      setRoute({
        ...r,
        kind: 'preset',
        reply: shortcut.reply,
        reason: '车机已有功能直达，不属于场景编排',
      });
      if (shortcut.applied) {
        live.current = { ...live.current, ...shortcut.values };
        setVehicle(live.current);
      }
      setFeedback(shortcut.reply);
      c.setInput('');
      return;
    }
    if ((source || c.mode) === 'live') {
      const result = await c.run(input, true, source, contextVehicle);
      if (id !== job.current || !result) return;
      const scene = result.scene;
      if (scene.clarify || scene.intent === 'clarify') {
        setRoute({
          ...r,
          kind: 'clarify',
          question: scene.clarify || '需要补充什么条件？',
          reply: scene.understanding,
        });
        setPresentation('response');
        return;
      }
      const chatOnly =
        r.kind === 'blocked' ||
        (r.kind === 'chat' &&
          !r.reason.startsWith('当前演示规则') &&
          !isImmediateControl(r, scene));
      if (
        scene.intent === 'none' ||
        chatOnly ||
        (!scene.actions.length && !scene.say)
      ) {
        const reply =
          scene.understanding || scene.say || r.reply || '这次没有生成方案。';
        setRoute({ ...r, kind: 'chat', reply });
        setFeedback(reply);
        setPresentation('response');
        return;
      }
      if (isImmediateControl(r, scene)) {
        if (result.runtime) {
          try {
            const state = await runtimeOperation(result, 'apply_once', { ...c.ctx, vehicle: live.current });
            if (id !== job.current) return;
            live.current = state.vehicle; setVehicle(state.vehicle);
            runtimeApplied.current = { ...result, runtime: { ...result.runtime, proposalId: state.proposal_id || result.runtime.proposalId } };
            setRoute({ ...r, kind: 'control', actions: scene.actions, reply: scene.understanding });
            setFeedback('已调好。'); setPresentation('response');
          } catch (error) {
            setFeedback(error instanceof Error ? error.message : '执行校验未通过');
            setPresentation('response');
          }
          return;
        }
        const available = scene.actions.filter((a) =>
          capabilities.some(
            (c) =>
              c.zh === a.primary &&
              c.status === 'enabled' &&
              ['released', 'no_ux'].includes(c.maturity),
          ),
        );
        const actions =
          r.kind === 'control' && /生理状态/.test(r.reason)
            ? available.slice(0, 1)
            : available;
        live.current = {
          ...live.current,
          ...Object.fromEntries(
            actions
              .filter((a) => a.primary !== '延时')
              .map((a) => [a.primary, a.secondary]),
          ),
        };
        setVehicle(live.current);
        setRoute({
          ...r,
          kind: 'control',
          actions,
          reply: scene.understanding,
        });
        setFeedback(actions.length ? '已调好。' : '这项暂时无法调整。');
        setPresentation('response');
        return;
      }
      setRoute({
        ...r,
        kind: r.kind === 'scene' ? 'scene' : 'suggestion',
        reply: scene.understanding,
        reason: result.runtime ? '模型提议，经过技术服务完整校验' : 'p13 模型提议，经过现有能力校验',
      });
      if (c.ctx.driving) {
        keepIdea(result, input, 'live');
        setPresentation('response');
        setFeedback('完整方案已留在「场景建议」，停车后查看。');
        return;
      }
      if (r.kind !== 'scene') {
        const denied = evaluateSuggestion(
          r,
          result,
          c.ctx,
          ledger,
          contextVehicle,
        );
        if (denied) {
          setFeedback(denied);
          setPresentation('response');
          return;
        }
        setAttention((prev) => ({ ...prev, questions: prev.questions + 1 }));
      }
      setPresentation('proposal');
      return;
    }
    if (r.kind === 'control' || r.kind === 'preset') {
      const checked = controlResult(r, c.ctx);
      const available = checked.scene.actions.filter((a) => {
        const cap = capabilities.find((c) => c.zh === a.primary);
        return cap && ['released', 'no_ux'].includes(cap.maturity);
      });
      const values = Object.fromEntries(
        available.map((a) => [a.primary, a.secondary]),
      );
      live.current = { ...live.current, ...values };
      setVehicle(live.current);
      c.setInput('');
      setFeedback(
        available.length
          ? '已调好。'
          : checked.conceptual
            ? '这项功能暂未开放。'
            : '这项无法调整。',
      );
      return;
    }
    if (r.kind !== 'scene' && r.kind !== 'suggestion') {
      c.setInput('');
      return;
    }
    if (r.kind === 'suggestion' && (ledger.quiet || ledger.highLoad)) {
      setFeedback(
        ledger.quiet ? '安静模式，不主动建议。' : '当前负荷较高，不主动建议。',
      );
      return;
    }
    const prior =
      r.kind === 'suggestion' && r.caseId
        ? similarScene(
            sceneForCase(r.caseId, c.ctx, input),
            c.saved.filter(
              (s) => !s.profileId || s.profileId === c.ctx.profile,
            ),
          )
        : undefined;
    const result = prior
      ? validateScene(prior.result.scene, c.ctx, input)
      : await c.run(input, true, source);
    if (id !== job.current || !result) return;
    if (r.kind === 'scene') return;
    const same =
      prior ||
      similarScene(
        result.scene,
        c.saved.filter((s) => !s.profileId || s.profileId === c.ctx.profile),
      );
    const checked = same
      ? validateScene(same.result.scene, c.ctx, input)
      : result;
    if (same) {
      setReused(same);
      c.openProposal({ ...same, input: same.input, result: checked });
    }
    const denied = evaluateSuggestion(
      r,
      checked,
      c.ctx,
      ledger,
      contextVehicle,
    );
    if (denied) {
      setFeedback(denied);
      return;
    }
    if (c.ctx.driving) {
      keepIdea(checked, input, same?.source || source || c.mode);
      setFeedback('完整方案已留在「场景建议」，停车后查看。');
      return;
    }
    setPresentation('proposal');
    setAttention((prev) => ({ ...prev, questions: prev.questions + 1 }));
  }

  function decline() {
    if (route)
      setAttention((a) => ({
        ...a,
        refused: {
          ...a.refused,
          [route.family || route.caseId || 'unknown']:
            Date.now() + 7 * 86400000,
        },
      }));
    setPresentation('response');
    setFeedback('好，不安排了。');
  }
  async function applyOnce() {
    if (!c.result) return;
    if (c.result.runtime || c.runtimeEnabled) {
      const proposal = c.result;
      if (!proposal.savable) { setFeedback('提案需要先补充完整。'); return; }
      stopPreview(); snapshot.current = null; const id = ++job.current;
      setApplication('applying'); setPresentation('response');
      try {
        const state = await runtimeOperation(proposal, 'apply_once', { ...c.ctx, vehicle: live.current });
        if (id !== job.current) return;
        live.current = state.vehicle; setVehicle(state.vehicle);
        const applied: SceneResult = { ...proposal, runtime: { ...proposal.runtime, proposalId: state.proposal_id || proposal.runtime?.proposalId || '', registryRevision: state.registry_revision || proposal.runtime?.registryRevision || '', valid: true, executable: true, trace: proposal.runtime?.trace || [], proposedScene: proposal.scene } };
        runtimeApplied.current = applied;
        const due = [...new Set(state.timeline.filter(j => j.status === 'pending').map(j => j.due))].sort((a, b) => a - b);
        let prior = state.virtual_seconds;
        let segments = Promise.resolve();
        for (const at of due) {
          const seconds = at - prior; prior = at;
          timers.current.push(setTimeout(() => { segments = segments.then(async () => {
            if (id !== job.current) return;
            try {
              const next = await runtimeOperation(applied, 'advance', c.ctx, { seconds });
              if (id !== job.current) return;
              live.current = next.vehicle; setVehicle(next.vehicle);
              if (next.timeline.some(j => j.status !== 'pending' && j.status !== 'executed')) {
                cancelPending(); setApplication('idle'); setFeedback('车况或能力已变化，后续动作已停止。');
              } else if (!next.timeline.some(j => j.status === 'pending')) { setApplication('done'); setFeedback('已应用'); }
            } catch (error) {
              cancelPending(); setApplication('idle'); setFeedback(error instanceof Error ? error.message : '延时动作已停止');
            }
          }); }, Math.max(0, at - state.virtual_seconds) * 1000));
        }
        if (!due.length) { setApplication('done'); setFeedback('已应用'); }
        else setFeedback('正在应用，可以随时撤销');
      } catch (error) {
        setApplication('idle'); setFeedback(error instanceof Error ? error.message : '执行校验未通过');
      }
      return;
    }
    if (!route)
      setRoute({
        kind: 'scene',
        input: c.heard,
        reason: '手动应用已保存场景，不产生新的主动建议',
        reply: '',
      });
    stopPreview();
    const id = ++job.current;
    const checked = validateScene(c.result.scene, c.ctx, c.heard);
    if (!checked.savable) {
      setFeedback('提案需要先补充完整。');
      return;
    }
    const actions = checked.scene.actions.filter((a) => {
      const cap = capabilities.find((c) => c.zh === a.primary);
      return cap && ['released', 'no_ux'].includes(cap.maturity);
    });
    if (!actions.length) {
      keepIdea(c.result, c.heard);
      setFeedback('这项功能暂未开放，方案已保留。');
      c.showToast('这项功能暂未开放，方案已保留。');
      setPresentation('response');
      return;
    }
    runtimeApplied.current = null;
    snapshot.current = { before: { ...live.current }, values: {} };
    const apply = (primary: string, secondary: string) => {
      if (id !== job.current) return;
      live.current = { ...live.current, [primary]: secondary };
      snapshot.current!.values[primary] = secondary;
      setVehicle(live.current);
    };
    let delay = 0;
    setPresentation('response');
    for (const a of actions) {
      if (a.primary === '延时') {
        delay += parseFloat(a.secondary) * 1000;
        continue;
      }
      if (!delay) apply(a.primary, a.secondary);
      else
        timers.current.push(
          setTimeout(() => apply(a.primary, a.secondary), delay),
        );
    }
    const finish = () => {
      if (id !== job.current) return;
      setApplication('done');
      setFeedback('已应用');
      if (!c.isSaved) keepIdea(c.result!, c.heard);
    };
    if (delay) {
      setApplication('applying');
      timers.current.push(setTimeout(finish, delay));
    } else finish();
  }

  return {
    route,
    presentation,
    feedback,
    vehicle,
    application,
    inbox,
    reused,
    viewRequest,
    attention,
    showProposal: () => {
      setPresentation('proposal');
    },
    reset,
    submit,
    decline,
    applyOnce,
    cancel: () => {
      job.current++;
      stopPreview();
      c.cancel();
      setFeedback('已取消本次安排。');
      setPresentation((p) => (p === 'proposal' ? p : 'response'));
    },
    undo: async () => {
      if (runtimeApplied.current) {
        const applied = runtimeApplied.current;
        cancelPending();
        try {
          const state = await runtimeOperation(applied, 'restore', c.ctx);
          live.current = state.vehicle; setVehicle(state.vehicle); runtimeApplied.current = null;
          setApplication('idle'); setFeedback('已撤销'); setPresentation('proposal');
        } catch (error) { setFeedback(error instanceof Error ? error.message : '还原未完成'); }
        return;
      }
      job.current++;
      stopPreview(true);
      setFeedback('已撤销');
      setPresentation('proposal');
    },
    openIdea,
    removeIdea: (id: string) => updateInbox(inbox.filter((s) => s.id !== id)),
    clearSavedIdea: (input: string) =>
      updateInbox(inbox.filter((s) => s.input !== input)),
    setQuiet: (quiet: boolean) => {
      setAttention((a) => ({ ...a, quiet }));
      if (quiet) {
        job.current++;
        stopPreview();
        c.cancel();
        setPresentation((p) => (p === 'offer' ? 'response' : p));
        setFeedback('安静模式，不主动建议。');
      }
    },
    setHighLoad: (highLoad: boolean) => {
      setAttention((a) => ({ ...a, highLoad }));
      if (highLoad) {
        job.current++;
        stopPreview();
        c.cancel();
        setPresentation((p) => (p === 'offer' ? 'response' : p));
        setFeedback('当前负荷较高，不主动建议。');
      }
    },
    resetAttention: () => {
      setAttention(emptyAttention());
      c.showToast('已重置本次演示的额度和冷却');
    },
    answerClarify: (target: string) =>
      submit('打开' + target, undefined, false, 'voice'),
  };
}
