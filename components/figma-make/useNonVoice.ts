'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { useSceneController } from '@/lib/use-scene-controller';
import type { useExperience } from './useExperience';
import {
  emptyScene,
  validateScene,
  type Scene,
  type SceneResult,
} from '@/lib/scene';
import {
  STORIES,
  VEHICLE_DEFAULTS,
  captureChoices,
  sceneFrom,
  freshLearning,
  observationReason,
  executable,
  TriggerLatch,
  ScenePlayback,
  type ManualEvent,
  type LearningState,
  type SceneOrigin,
} from '@/lib/nonvoice';
import type { SavedScene } from '@/lib/storage';
import { similarScene } from '@/lib/scene-similarity';
import { runtimeOperation, type RuntimeState } from '@/lib/runtime-browser';
import { apiUrl } from '@/lib/base-path';

type Draft = {
  scene: Scene;
  origin: SceneOrigin;
  source: 'live' | 'example';
  id?: string;
  inboxId?: string;
  runtime?: SceneResult['runtime'];
};
const KEY = 'scene-studio.nonvoice.v1';
export function useNonVoice(
  c: ReturnType<typeof useSceneController>,
  x: ReturnType<typeof useExperience>,
) {
  const [panel, setPanel] = useState<
    'closed' | 'stories' | 'controls' | 'capture' | 'proposal' | 'saved'
  >('closed');
  const [storyId, setStoryId] = useState<string | null>(null),
    [tab, setTab] = useState('空调');
  const [events, setEvents] = useState<ManualEvent[]>([]),
    [learning, setLearningState] = useState<Record<string, LearningState>>({});
  const [draft, setDraftState] = useState<Draft | null>(null),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState(''),
    [why, setWhy] = useState(false),
    [busy, setBusy] = useState(false),
    [duplicate, setDuplicate] = useState<SavedScene | null>(null);
  const [aiInfo, setAiInfo] = useState<{
    total: number;
    understanding: number | null;
    trace: unknown[];
  } | null>(null);
  const [applied, setApplied] = useState(false),
    [pending, setPending] = useState(false),
    [clock, setClock] = useState(Date.now());
  const [evidenceDeleted, setEvidenceDeleted] = useState(false),
    [simEvidence, setSimEvidence] = useState<'normal' | 'insufficient'>(
      'normal',
    );
  const life = useRef(0),
    lock = useRef(false),
    controller = useRef<AbortController | null>(null),
    play = useRef<ScenePlayback | null>(null),
    runtimePlay = useRef<{ result: SceneResult; state: RuntimeState } | null>(
      null,
    ),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    latches = useRef(new TriggerLatch()),
    clockAnchor = useRef(Date.now());
  const latest = useRef({ c, x, draft, events, learning, clock });
  useLayoutEffect(() => {
    latest.current = { c, x, draft, events, learning, clock };
  });
  function virtualNow() {
    return latest.current.clock + Date.now() - clockAnchor.current;
  }
  function moveClock(at: number) {
    clockAnchor.current = Date.now();
    latest.current.clock = at;
    setClock(at);
  }
  const story = STORIES.find((s) => s.id === storyId);
  const state = learning[c.ctx.profile] || freshLearning();
  const choices = captureChoices(events, x.vehicle, c.ctx.profile, clock);
  const checked = draft ? validateScene(draft.scene, c.ctx) : null;
  const reason =
    story?.entry === 'observation'
      ? observationReason(
          simEvidence === 'insufficient'
            ? { ...story, evidence: { ...story.evidence!, occurrences: 1 } }
            : story,
          c.ctx,
          state,
          clock,
          x.attention.highLoad,
          x.attention.quiet,
        )
      : null;

  function updateLearning(change: Partial<LearningState>) {
    const profile = latest.current.c.ctx.profile;
    const next = {
      ...latest.current.learning,
      [profile]: {
        ...(latest.current.learning[profile] || freshLearning()),
        ...change,
      },
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      latest.current.learning = next;
      setLearningState(next);
    } catch {
      c.showToast('学习设置未能保存', true);
    }
  }
  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
        const next: Record<string, LearningState> = {};
        for (const p of ['none', 'quiet', 'fresh'])
          if (raw[p])
            next[p] = { ...freshLearning(), ...raw[p], paused: false };
        setLearningState(next);
      } catch {}
    });
    const dispose = () => {
      life.current++;
      controller.current?.abort();
      timers.current.forEach(clearTimeout);
    };
    return () => {
      mounted = false;
      dispose();
    };
  }, []);
  function invalidate() {
    life.current++;
    controller.current?.abort();
    setBusy(false);
    lock.current = false;
  }
  function stop() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    play.current = null;
    setPending(false);
    if (runtimePlay.current) {
      void runtimeOperation(
        runtimePlay.current.result,
        'cancel',
        latest.current.c.ctx,
      ).catch(() => {});
      runtimePlay.current = null;
    }
    setApplied(false);
  }
  useEffect(() => {
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      invalidate();
      stop();
      setPanel('closed');
      setStoryId(null);
      setDraftState(null);
      setEvents([]);
      setNote('');
    });
    return () => {
      current = false;
    };
  }, [c.ctx.profile]);
  useEffect(() => {
    if (c.ctx.driving && (panel === 'capture' || panel === 'proposal')) {
      queueMicrotask(() => {
        setNote('停车后继续整理');
        setEditing(false);
      });
    }
  }, [c.ctx.driving, panel]);
  function setDraft(next: Draft | null) {
    invalidate();
    latest.current.draft = next;
    setDraftState(next);
    setDuplicate(null);
  }
  function changeScene(scene: Scene) {
    if (c.ctx.driving) return;
    const d = latest.current.draft;
    if (d) setDraft({ ...d, scene, runtime: undefined });
  }
  function openControls() {
    c.cancel();
    setPanel('controls');
    setNote('');
  }
  function loadStory(id: string) {
    invalidate();
    stop();
    x.reset();
    const s = STORIES.find((s) => s.id === id)!;
    setStoryId(id);
    setAiInfo(null);
    setTab(s.tab);
    setPanel('controls');
    setDraft(null);
    setNote('');
    setWhy(false);
    setEvidenceDeleted(false);
    setSimEvidence('normal');
    setEditing(false);
    // Story timestamps are fixture time; never claim these were personal trips.
    const at =
      Math.max(Date.now(), virtualNow(), state.lastOffered || 0) +
      (id !== storyId ? 40 * 86400000 : 0);
    moveClock(at);
    const vehicle: Record<string, string> = {
      ...VEHICLE_DEFAULTS,
      ...s.context,
      挡位: c.ctx.driving ? '挡位D' : '挡位P',
    };
    const delayAt = s.actions.findIndex((a) => a.primary === '延时');
    const initial = delayAt < 0 ? s.actions : s.actions.slice(0, delayAt);
    const sample: ManualEvent[] = [];
    for (const a of initial) {
      if (a.primary === '延时') continue;
      vehicle[a.primary] = a.secondary;
      sample.push({
        primary: a.primary,
        value: a.secondary,
        at: at - 60000,
        profile: c.ctx.profile,
      });
    }
    // Older setting is optional; it must never become checked by default.
    if (s.id === 'waiting') {
      vehicle['主驾座椅加热'] = '1挡';
      sample.push({
        primary: '主驾座椅加热',
        value: '1挡',
        at: at - 900000,
        profile: c.ctx.profile,
      });
    }
    x.replaceVehicle(vehicle);
    setEvents(sample);
  }
  async function manual(primary: string, value: string) {
    if (lock.current) return;
    if (x.application !== 'idle') x.cancel();
    const checked = validateScene(
      {
        ...emptyScene(),
        name: '手动调整',
        intent: 'action',
        actions: [{ primary, secondary: value }],
      },
      { ...c.ctx, profile: 'none', preferences: [] },
    );
    if (!executable(checked)) {
      setNote('当前状态不允许这项调整');
      return;
    }
    value = checked.scene.actions[0].secondary;
    invalidate();
    play.current?.takeover(primary);
    const d = latest.current;
    const vehicle = { ...d.x.vehicle, [primary]: value };
    const version = life.current;
    lock.current = true;
    try {
      if (runtimePlay.current) {
        const p = runtimePlay.current;
        const next = await runtimeOperation(p.result, 'manual', d.c.ctx, {
          values: { [primary]: value },
        });
        if (version !== life.current || runtimePlay.current !== p) return;
        d.x.replaceVehicle(next.vehicle);
        p.state = next;
      } else d.x.replaceVehicle(vehicle);
      const at = virtualNow();
      moveClock(at);
      const learning = d.learning[d.c.ctx.profile] || freshLearning();
      if (learning.enabled && !learning.paused)
        setEvents((es) =>
          [
            ...es.filter(
              (e) => !(e.primary === primary && e.profile === d.c.ctx.profile),
            ),
            { primary, value, at, profile: d.c.ctx.profile },
          ].slice(-80),
        );
      else setEvents((es) => es.filter((e) => e.primary !== primary));
      setPending(
        !!play.current?.pending.length ||
          !!runtimePlay.current?.state.timeline.some(
            (j) => j.status === 'pending',
          ),
      );
      setNote(
        checked.decisions.find((d) => d.status === 'adjusted')?.reason || '',
      );
    } catch (e) {
      if (version === life.current)
        setNote(e instanceof Error ? e.message : '调整失败');
    } finally {
      if (version === life.current) lock.current = false;
    }
  }
  function capture() {
    invalidate();
    const d = latest.current;
    const now = virtualNow();
    moveClock(now);
    const list = captureChoices(d.events, d.x.vehicle, d.c.ctx.profile, now);
    if (!list.length) {
      setNote('先调好再长按');
      return;
    }
    const recent = list.filter((a) => a.recent);
    const scene = {
      ...emptyScene(),
      name:
        story?.entry === 'capture'
          ? story.name
          : '场景·' +
            new Date(d.clock).toLocaleString('zh-CN', {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
      intent: 'action',
      relevance: 1,
      understanding: '记住现在这样',
      actions: recent.map((e) => ({ primary: e.primary, secondary: e.value })),
    };
    const origin: SceneOrigin = {
      entry: 'capture',
      storyId: storyId || undefined,
      automatic: false,
    };
    if (c.ctx.driving) {
      const item: SavedScene = {
        id: crypto.randomUUID(),
        input: story?.title || '记住现在这样',
        source: 'example',
        profileId: c.ctx.profile,
        updatedAt: new Date().toISOString(),
        origin,
        result: validateScene(scene, { ...c.ctx, driving: false }),
      };
      x.putIdea(item);
      setNote('已记下，停车后整理');
      return;
    }
    setDraft({ scene, origin, source: 'example' });
    setSelected(recent.map((e) => e.primary));
    setEditing(true);
    setPanel('capture');
    setNote('');
  }
  function toggleCapture(primary: string) {
    const d = latest.current.draft;
    if (!d) return;
    const next = selected.includes(primary)
      ? selected.filter((p) => p !== primary)
      : [...selected, primary];
    setSelected(next);
    changeScene({
      ...d.scene,
      actions: choices
        .filter((e) => next.includes(e.primary))
        .map((e) => ({
          primary: e.primary,
          secondary:
            d.scene.actions.find((a) => a.primary === e.primary)?.secondary ||
            e.value,
        })),
    });
  }
  function openObservation() {
    if (!story || reason) {
      setNote(reason || '没有待保存的习惯');
      return;
    }
    setDraft({
      scene: sceneFrom(story),
      origin: {
        entry: 'observation',
        storyId: story.id,
        automatic: false,
        evidence: story.evidence,
      },
      source: 'example',
    });
    setPanel('proposal');
    setEditing(false);
    setNote('');
    setWhy(false);
    updateLearning({
      lastOffered: clock,
      offers: { ...state.offers, [story.id]: clock },
    });
    if (c.mode === 'live') void nameWithAI();
  }
  function close(decline = false) {
    invalidate();
    if (draft?.origin.entry === 'observation' && !draft.id && storyId) {
      const ignores = (state.ignored[storyId] || 0) + 1;
      updateLearning({
        ignored: { ...state.ignored, [storyId]: ignores },
        refused: {
          ...state.refused,
          [storyId]: clock + (decline ? 7 : ignores >= 2 ? 30 : 2) * 86400000,
        },
      });
    }
    setPanel('closed');
    setDraft(null);
    setDuplicate(null);
    setWhy(false);
  }
  async function save(choice?: 'update' | 'separate') {
    if (lock.current || c.ctx.driving) return false;
    const d = latest.current.draft;
    if (!d) return false;
    let result = validateScene(d.scene, c.ctx);
    if (
      !result.savable ||
      result.decisions.some((d) =>
        ['forbidden', 'unsupported'].includes(d.status),
      ) ||
      !d.scene.name.trim() ||
      !d.scene.actions.length
    ) {
      setNote('请保留有效设置并填写名称');
      return false;
    }
    const current = latest.current.c.saved.filter(
      (s) => !s.profileId || s.profileId === c.ctx.profile,
    );
    const same =
      similarScene(d.scene, current, d.id) ||
      current.find(
        (s) => s.id !== d.id && s.result.scene.name === d.scene.name,
      );
    if (same && !choice) {
      setDuplicate(same);
      return false;
    }
    lock.current = true;
    const version = ++life.current;
    setBusy(true);
    try {
      if (d.source === 'live' && c.runtimeEnabled) {
        result = { ...result, runtime: d.runtime };
        const response = await runtimeOperation(result, 'save', {
          ...c.ctx,
          vehicle: x.vehicle,
        });
        if (version !== life.current) return false;
        result.runtime = {
          proposalId: response.proposal_id!,
          registryRevision: response.registry_revision!,
          valid: true,
          executable: true,
          trace: d.runtime?.trace || [],
          proposedScene: result.scene,
        };
      }
      const origin = {
        ...d.origin,
        automatic:
          !!d.origin.automatic &&
          d.scene.conditions.length > 0 &&
          executable(result),
      };
      const item: SavedScene = {
        id: choice === 'update' && same ? same.id : d.id || crypto.randomUUID(),
        input: story?.title || d.scene.understanding || '记住现在这样',
        source: d.source,
        result,
        profileId: c.ctx.profile,
        updatedAt: new Date().toISOString(),
        origin,
      };
      c.storeScene(item);
      if (d.inboxId) x.removeIdea(d.inboxId);
      setDraftState({
        ...d,
        scene: result.scene,
        id: item.id,
        origin,
        inboxId: undefined,
      });
      setPanel('saved');
      setEditing(false);
      setDuplicate(null);
      setNote('已保存');
      if (d.origin.storyId)
        updateLearning({
          offers: { ...state.offers, [d.origin.storyId]: clock },
        });
      return true;
    } catch (e) {
      setNote(e instanceof Error ? e.message : '保存失败');
      return false;
    } finally {
      if (version === life.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  function openSaved(item: SavedScene, inbox = false) {
    invalidate();
    stop();
    x.reset();
    setStoryId(item.origin?.storyId || null);
    setDraft({
      scene: structuredClone(item.result.scene),
      origin: item.origin || { entry: 'capture', automatic: false },
      source: item.source,
      id: inbox ? undefined : item.id,
      inboxId: inbox ? item.id : undefined,
      runtime: item.result.runtime
        ? { ...item.result.runtime, proposalId: '' }
        : undefined,
    });
    setPanel('proposal');
    setEditing(false);
    setWhy(false);
    setNote('');
  }
  function setAutomatic(on: boolean) {
    const d = latest.current.draft;
    if (d) {
      setDraft({
        ...d,
        origin: { ...d.origin, automatic: on && d.scene.conditions.length > 0 },
      });
      if (d.id) {
        setEditing(true);
        setPanel('proposal');
      }
    }
  }
  function toggleSavedAuto(item: SavedScene) {
    if (c.ctx.driving) return;
    const r = validateScene(item.result.scene, c.ctx);
    if (!item.result.scene.conditions.length || !executable(r)) {
      c.showToast('需要已上线的触发条件与动作', true);
      return;
    }
    c.storeScene({
      ...item,
      origin: {
        entry: item.origin?.entry || 'voice',
        ...item.origin,
        automatic: !item.origin?.automatic,
      },
      updatedAt: new Date().toISOString(),
    });
  }
  function syncPlayback(next: Record<string, string>) {
    latest.current.x.replaceVehicle(next);
    setApplied(true);
    setPending(!!play.current?.pending.length);
  }
  function scheduleLocal() {
    timers.current.forEach(clearTimeout);
    const p = play.current;
    if (!p) return;
    for (const at of new Set(p.pending.map((j) => j.at)))
      timers.current.push(
        setTimeout(
          () => {
            if (play.current !== p) return;
            try {
              syncPlayback(
                p.advance(
                  at - p.elapsed,
                  latest.current.x.vehicle,
                  latest.current.c.ctx,
                ),
              );
            } catch (e) {
              setNote(String(e));
              setPending(false);
            }
          },
          Math.max(0, at - p.elapsed) * 1000,
        ),
      );
  }
  function scheduleRuntime() {
    timers.current.forEach(clearTimeout);
    const p = runtimePlay.current;
    if (!p) return;
    const at = Math.min(
      ...p.state.timeline
        .filter((j) => j.status === 'pending')
        .map((j) => j.due),
    );
    if (Number.isFinite(at))
      timers.current.push(
        setTimeout(
          () => void advance(),
          Math.max(0, at - p.state.virtual_seconds) * 1000,
        ),
      );
    setPending(Number.isFinite(at));
  }
  async function apply(item?: SavedScene) {
    const d = item
      ? {
          scene: item.result.scene,
          source: item.source,
          runtime: item.result.runtime,
        }
      : latest.current.draft;
    if (!d || lock.current) return;
    const result = validateScene(d.scene, c.ctx);
    if (!executable(result)) {
      setNote('当前条件或能力不允许应用');
      return;
    }
    // Manual use is explicitly immediate; conditional trigger has its own path.
    stop();
    const version = ++life.current;
    lock.current = true;
    setBusy(true);
    try {
      if (d.source === 'live' && c.runtimeEnabled) {
        const immediate = {
          ...result,
          scene: { ...result.scene, conditions: [] },
          runtime: d.runtime,
        };
        const state = await runtimeOperation(immediate, 'apply_once', {
          ...c.ctx,
          vehicle: x.vehicle,
        });
        if (version !== life.current) return;
        const ref = {
          ...immediate,
          runtime: {
            proposalId: state.proposal_id!,
            registryRevision: state.registry_revision!,
            valid: true,
            executable: true,
            trace: [],
            proposedScene: immediate.scene,
          },
        };
        runtimePlay.current = { result: ref, state };
        x.replaceVehicle(state.vehicle);
        setApplied(true);
        scheduleRuntime();
      } else {
        const p = new ScenePlayback(d.scene, latest.current.x.vehicle);
        play.current = p;
        syncPlayback(p.advance(0, latest.current.x.vehicle, c.ctx));
        scheduleLocal();
      }
      setNote('已应用');
      const savedId = item?.id || latest.current.draft?.id;
      const used = latest.current.c.saved.find((s) => s.id === savedId);
      if (used?.origin)
        c.storeScene({
          ...used,
          origin: { ...used.origin, lastUsedAt: new Date().toISOString() },
        });
    } catch (e) {
      setNote(e instanceof Error ? e.message : '应用失败');
    } finally {
      if (version === life.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  async function advance() {
    try {
      if (runtimePlay.current) {
        const p = runtimePlay.current;
        const at = Math.min(
          ...p.state.timeline
            .filter((j) => j.status === 'pending')
            .map((j) => j.due),
        );
        if (!Number.isFinite(at)) return;
        const version = life.current;
        const state = await runtimeOperation(
          p.result,
          'advance',
          latest.current.c.ctx,
          { seconds: at - p.state.virtual_seconds },
        );
        if (version !== life.current || runtimePlay.current !== p) return;
        p.state = state;
        latest.current.x.replaceVehicle(state.vehicle);
        scheduleRuntime();
        setNote('已切换到柔和阶段');
      } else if (play.current?.pending.length) {
        const p = play.current;
        const at = Math.min(...p.pending.map((j) => j.at));
        syncPlayback(
          p.advance(
            at - p.elapsed,
            latest.current.x.vehicle,
            latest.current.c.ctx,
          ),
        );
        scheduleLocal();
        setNote('已切换到柔和阶段');
      }
    } catch (e) {
      stop();
      setNote(e instanceof Error ? e.message : '后续动作已停止');
    }
  }
  async function undo() {
    invalidate();
    timers.current.forEach(clearTimeout);
    try {
      if (runtimePlay.current) {
        const p = runtimePlay.current;
        const state = await runtimeOperation(
          p.result,
          'restore',
          latest.current.c.ctx,
        );
        latest.current.x.replaceVehicle(state.vehicle);
        runtimePlay.current = null;
      } else if (play.current) {
        latest.current.x.replaceVehicle(
          play.current.undo(latest.current.x.vehicle),
        );
        play.current = null;
      }
      setApplied(false);
      setPending(false);
      setNote('已撤销');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '撤销失败');
    }
  }
  async function checkConditions(
    context = latest.current.x.vehicle,
    newTrip = false,
  ) {
    if (lock.current) return;
    const items = latest.current.c.saved.filter(
      (s) => !s.profileId || s.profileId === c.ctx.profile,
    );
    const eligible = items.filter((s) =>
      latches.current.check(
        s.id,
        !!s.origin?.automatic &&
          executable(validateScene(s.result.scene, c.ctx)),
        s.result.scene,
        context,
      ),
    );
    const item = eligible.sort(
      (a, b) =>
        b.result.scene.conditions.length - a.result.scene.conditions.length,
    )[0];
    if (!item) {
      setNote('没有新满足条件的已启用场景');
      return;
    }
    stop();
    setDraft({
      scene: structuredClone(item.result.scene),
      origin: item.origin!,
      source: item.source,
      id: item.id,
      runtime: item.result.runtime,
    });
    setPanel('saved');
    if (item.source === 'live' && c.runtimeEnabled) {
      const version = ++life.current;
      lock.current = true;
      setBusy(true);
      try {
        const state = await runtimeOperation(
          item.result,
          'trigger',
          { ...c.ctx, vehicle: context },
          {
            newTrip,
            savedScenes: items
              .filter((s) => s.origin?.automatic)
              .map((s) => ({ id: s.id, scene: s.result.scene })),
          },
        );
        if (version !== life.current) return;
        if (!state.proposal_id) {
          setNote('场景未触发，请检查条件');
          return;
        }
        const result = {
          ...item.result,
          runtime: {
            proposalId: state.proposal_id,
            registryRevision: state.registry_revision || '',
            valid: true,
            executable: true,
            trace: [],
            proposedScene: item.result.scene,
          },
        };
        runtimePlay.current = { result, state };
        x.replaceVehicle(state.vehicle);
        setApplied(true);
        scheduleRuntime();
      } catch (e) {
        setNote(e instanceof Error ? e.message : '触发失败');
        return;
      } finally {
        if (version === life.current) {
          lock.current = false;
          setBusy(false);
        }
      }
    } else {
      const p = new ScenePlayback(item.result.scene, context);
      play.current = p;
      syncPlayback(p.advance(0, context, c.ctx));
      scheduleLocal();
    }
    c.storeScene({
      ...item,
      origin: { ...item.origin!, lastTriggeredAt: new Date().toISOString() },
    });
    setNote(item.result.scene.name + '已应用');
  }
  async function nextTrip() {
    if (lock.current) return;
    invalidate();
    stop();
    const context = {
      ...VEHICLE_DEFAULTS,
      星期类型: '工作日',
      时段: '清晨',
      挡位: c.ctx.driving ? '挡位D' : '挡位P',
    };
    x.replaceVehicle(context);
    moveClock(virtualNow() + 86400000);
    updateLearning({ paused: false });
    latches.current.reset();
    await checkConditions(context, true);
  }
  async function nameWithAI() {
    const d = latest.current.draft;
    if (!d || busy || c.ctx.driving) return;
    const version = ++life.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setNote('');
    const timeout = setTimeout(() => abort.abort(), 30000);
    try {
      const r = await fetch(apiUrl('/api/nonvoice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          kind: d.origin.entry === 'observation' ? 'observation' : 'capture',
          scene: d.scene,
          evidence: d.origin.evidence,
          context: { ...c.ctx, vehicle: x.vehicle },
          model: c.model,
          existingScenes: c.saved.map((s) => ({
            id: s.id,
            scene: s.result.scene,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || 'AI 未连接');
      if (version !== life.current) return;
      setAiInfo({
        total: data.timing?.total ?? 0,
        understanding: data.timing?.understanding ?? null,
        trace: data.runtime?.trace || [],
      });
      setDraftState({
        ...d,
        scene: {
          ...d.scene,
          name: data.name,
          understanding: data.understanding || d.scene.understanding,
        },
        source: 'live',
        runtime: data.runtime,
      });
      setNote('AI 命名已更新');
    } catch (e) {
      if (version === life.current)
        setNote(
          abort.signal.aborted
            ? '等待已结束，设置已保留'
            : e instanceof Error
              ? e.message
              : 'AI 连接失败',
        );
    } finally {
      clearTimeout(timeout);
      if (version === life.current) setBusy(false);
    }
  }
  function deleteEvidence(id = storyId) {
    if (!id) return;
    updateLearning({ deleted: [...new Set([...state.deleted, id])] });
    setEvidenceDeleted(true);
    if (panel === 'proposal' && !draft?.id) {
      setDraft(null);
      setPanel('controls');
    }
    setNote('相关观察记录已删除');
  }
  return {
    panel,
    setPanel,
    story,
    storyId,
    clock,
    tab,
    setTab,
    events,
    choices,
    learning: state,
    reason,
    draft,
    checked,
    editing,
    setEditing,
    selected,
    note,
    setNote,
    why,
    setWhy,
    busy,
    aiInfo,
    duplicate,
    setDuplicate,
    applied,
    pending,
    evidenceDeleted,
    simEvidence,
    setSimEvidence,
    openControls,
    loadStory,
    manual,
    capture,
    toggleCapture,
    openObservation,
    close,
    save,
    openSaved,
    changeScene,
    setAutomatic,
    toggleSavedAuto,
    apply,
    advance,
    undo,
    nextTrip,
    checkConditions,
    nameWithAI,
    deleteEvidence,
    toggleHabit: (id: string) =>
      updateLearning({
        deleted: state.deleted.includes(id)
          ? state.deleted.filter((s) => s !== id)
          : [...state.deleted, id],
      }),
    pause: (paused: boolean) => {
      updateLearning({ paused });
      if (paused) {
        invalidate();
        if (!draft?.id) {
          setDraft(null);
          setPanel('controls');
        }
        setNote('这趟不记录，也不出观察建议');
      }
    },
    setLearning: (enabled: boolean) => {
      updateLearning({
        enabled,
        ...(!enabled
          ? {
              deleted: [
                ...new Set([
                  ...state.deleted,
                  ...STORIES.filter((s) => s.entry === 'observation').map(
                    (s) => s.id,
                  ),
                ]),
              ],
            }
          : {}),
      });
      if (!enabled) {
        invalidate();
        if (!draft?.id) {
          setDraft(null);
          setPanel('controls');
        }
      }
    },
    resetEvidence: () => {
      updateLearning({
        ...freshLearning(),
        paused: state.paused,
        enabled: state.enabled,
      });
      setSimEvidence('normal');
      setEvidenceDeleted(false);
      setNote('示例记录已重新载入');
    },
  };
}
export type NonVoice = ReturnType<typeof useNonVoice>;
