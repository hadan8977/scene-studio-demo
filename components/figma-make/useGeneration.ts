'use client';
import { useMemo, useRef, useState } from 'react';
import { useSceneController } from '@/lib/use-scene-controller';
import {
  toViewResult,
  toViewSaved,
  CORE_PROFILE,
  VIEW_PROFILE,
} from './bridge';
import { PROFILES } from './domain/profiles';
import type { DrivingState, SavedScene } from './domain/types';
import { useExperience } from './useExperience';
import { similarScene, mergeScene } from '@/lib/scene-similarity';
import type { SavedScene as StoredScene } from '@/lib/storage';
import {
  preferenceLabel,
  defaultPreferences,
  type UserPreference,
} from '@/lib/user-preferences';

/** Figma Make's component API, connected to the existing real generation service. */
export function useGeneration() {
  const c = useSceneController(false);
  const experience = useExperience(c);
  const [duplicate, setDuplicate] = useState<StoredScene | null>(null);
  const [saveVersion, setSaveVersion] = useState(0);
  const lastRequest = useRef<{
    text: string;
    fresh: boolean;
    source?: 'example' | 'live';
  } | null>(null);
  const result = useMemo(
    () => (c.result ? toViewResult(c.result) : null),
    [c.result],
  );
  const profileId = VIEW_PROFILE[c.ctx.profile];
  const preferenceEntries =
    c.ctx.preferences || defaultPreferences(c.ctx.profile);
  const removedPrefs = preferenceEntries
    .filter((p) => p.deleted)
    .map((p) => p.id);
  const profile = {
    ...PROFILES.find((p) => p.id === profileId)!,
    preferences: preferenceEntries
      .filter((p) => !p.deleted)
      .map((p) => ({
        id: p.id,
        label: preferenceLabel(p.primary) + (p.negative ? '' : ` ${p.value}`),
        negative: p.negative,
      })),
  };
  const mode: 'real' | 'example' = c.mode === 'live' ? 'real' : 'example';
  const phase = c.busy
    ? 'thinking'
    : c.error
      ? 'error'
      : result
        ? 'result'
        : 'idle';
  async function request(
    text: string,
    fresh: boolean,
    source?: 'example' | 'live',
  ) {
    if (!text.trim()) return;
    if (c.ctx.driving) {
      c.showToast('提案已保留，停车后继续创建与编辑');
      return;
    }
    lastRequest.current = { text, fresh, source };
    return fresh ? experience.submit(text, source) : c.run(text, false, source);
  }
  function handleSave(choice?: 'separate' | 'update') {
    try {
      if (!c.result) return false;
      const same = similarScene(
        c.result.scene,
        c.saved,
        c.activeId || undefined,
      );
      if (!choice && same) {
        setDuplicate(same);
        return false;
      }
      const merged =
        choice === 'update' && duplicate
          ? mergeScene(duplicate.result.scene, c.result.scene, c.ctx)
          : null;
      if (merged && !merged.savable) {
        c.showToast('合并后仍需补充信息，请分别保存', true);
        return false;
      }
      c.saveCurrent(
        merged && duplicate ? { id: duplicate.id, result: merged } : undefined,
      );
      experience.clearSavedIdea(c.heard);
      setDuplicate(null);
      c.setEditing(false);
      setSaveVersion((v) => v + 1);
      return true;
    } catch {
      return false;
    }
  }
  const error = c.error
    ? {
        message: c.error,
        hint:
          mode === 'example'
            ? '示例只回放预设案例；自由表达需要连接真实 AI。'
            : '输入已保留，可重试或在设置中检查连接。',
        canRetry: mode === 'real',
      }
    : null;
  return {
    phase,
    scene: result?.scene || null,
    result,
    rawResult: c.result,
    source: (c.source === 'live' ? 'ai' : 'example') as 'ai' | 'example',
    input: c.input,
    setInput: c.setInput,
    heard: c.heard,
    understanding: c.busy ? c.streamText : result?.scene.understanding || null,
    slow: c.busy && c.elapsed >= 2.5,
    status: c.status,
    error,
    mode,
    setMode: (m: 'real' | 'example') => {
      experience.cancel();
      c.setError('');
      c.setMode(m === 'real' ? 'live' : 'example');
    },
    model: c.model,
    setModel: c.setModel,
    models: c.models,
    loadModels: c.loadModels,
    configured: c.configured,
    catalogLoading: c.catalogLoading,
    connectionNote: c.catalogError,
    connection:
      mode === 'example'
        ? ('example' as const)
        : c.catalogError
          ? ('error' as const)
          : c.configured
            ? ('connected' as const)
            : ('not-connected' as const),
    driving: (c.ctx.driving ? 'driving' : 'parked') as DrivingState,
    setDriving: (v: DrivingState) =>
      c.changeContext({ ...c.ctx, driving: v === 'driving' }),
    profileId,
    profile,
    preferenceEntries,
    savePreference: (entry: UserPreference) => c.savePreference(entry),
    deletePreference: (id: string) => c.deletePreference(id),
    restorePreference: (id: string) => c.deletePreference(id, true),
    removedPrefs,
    setProfileId: (id: string) => c.selectProfile(CORE_PROFILE[id] || 'none'),
    togglePref: (id: string) => {
      c.deletePreference(id, removedPrefs.includes(id));
    },
    latency:
      c.source === 'live' && c.timing
        ? {
            t0: 0,
            understandingStart:
              c.timing.understandingStart == null
                ? undefined
                : c.timing.understandingStart * 1000,
            understandingDone:
              c.timing.understanding == null
                ? undefined
                : c.timing.understanding * 1000,
            complete: c.timing.total * 1000,
          }
        : {},
    changedIds: new Set(c.result?.changed || []),
    saved: c.isSaved,
    saveVersion,
    editing: c.editing,
    setEditing: c.setEditing,
    editText: c.input,
    setEditText: c.setInput,
    clarifyText: c.input,
    setClarifyText: c.setInput,
    submitInput: (text = c.input) => request(text, !c.result),
    submitVoice: (text = c.input) => {
      if (c.editing) return request(text, false);
      lastRequest.current = { text, fresh: true };
      return experience.submit(text, undefined, false, 'voice');
    },
    submitEdit: (text = c.input) => request(text, false),
    submitClarify: (text = c.input) => request(text, false),
    playExample: (text: string) => {
      return experience.submit(text, 'example', true, 'create');
    },
    playAmbient: (text: string) =>
      experience.submit(text, 'example', true, 'voice'),
    retry: () =>
      lastRequest.current
        ? request(
            lastRequest.current.text,
            lastRequest.current.fresh,
            lastRequest.current.source,
          )
        : undefined,
    reset: () => {
      setDuplicate(null);
      experience.reset();
    },
    cancel: experience.cancel,
    handleSave,
    duplicate,
    cancelDuplicate: () => setDuplicate(null),
    experience,
    scenes: c.saved.map(toViewSaved),
    remove: c.deleteSaved,
    openSaved: (s: SavedScene) => {
      const stored = c.saved.find((x) => x.id === s.id);
      if (stored) {
        experience.reset();
        c.openSaved(stored);
        experience.showProposal();
      }
    },
    controller: c,
  };
}
export type Generation = ReturnType<typeof useGeneration>;
