'use client';
import { useState, useRef, useEffect } from 'react';
import { EXAMPLES, exampleScene, replay } from '@/lib/examples';
import {
  validateScene,
  profileMemories,
  type ProfileId,
  type SceneResult,
  type Context,
} from '@/lib/scene';
import {
  readSaved,
  upsertSaved,
  STORAGE_KEY,
  type SavedScene,
} from '@/lib/storage';
import type { ModelOption, Timing, GenerationEvent } from '@/lib/generation';
import {
  PROFILE_STORAGE_KEY,
  readProfileSettings,
  emptyProfileSettings,
  type ProfileSettings,
} from '@/lib/profile-settings';

const initialContext: Context = { driving: false, profile: 'none' };
type Source = 'live' | 'example';
type Toast = { text: string; error?: boolean };

export function useSceneController(initialExample = true) {
  const profileSettings = useRef(emptyProfileSettings());
  const [ctx, setCtx] = useState<Context>(initialContext);
  const [result, setResult] = useState<SceneResult | null>(() =>
    initialExample
      ? validateScene(
          exampleScene('wait', initialContext),
          initialContext,
          EXAMPLES[1].input,
        )
      : null,
  );
  const [heard, setHeard] = useState(EXAMPLES[1].input),
    [input, setInput] = useState(''),
    [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Source>('example'),
    [source, setSource] = useState<Source>('example');
  const [models, setModels] = useState<ModelOption[]>([]),
    [model, setModel] = useState(''),
    [configured, setConfigured] = useState(false),
    [catalogError, setCatalogError] = useState(''),
    [catalogLoading, setCatalogLoading] = useState(true);
  const [busy, setBusy] = useState(false),
    [streamText, setStreamText] = useState(''),
    [elapsed, setElapsed] = useState(0),
    [status, setStatus] = useState(''),
    [error, setError] = useState('');
  const [timing, setTiming] = useState<Timing | null>(null),
    [modelUsed, setModelUsed] = useState('');
  const [review, setReview] = useState(false),
    [saved, setSaved] = useState<SavedScene[]>([]),
    [activeId, setActiveId] = useState<string | null>(null),
    [isSaved, setIsSaved] = useState(false),
    [why, setWhy] = useState(false),
    [notice, setNotice] = useState<Toast | null>(null);
  const inp = useRef<HTMLInputElement>(null),
    abort = useRef<AbortController | null>(null),
    requestId = useRef(0),
    started = useRef(0),
    mounted = useRef(true);
  const stateRef = useRef({ result, source, heard, busy, activeId, saved });
  stateRef.current = { result, source, heard, busy, activeId, saved };
  const showToast = (text: string, isError = false) =>
    setNotice({ text, error: isError });
  async function loadModels() {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        models: ModelOption[];
        defaultModel: string;
        configured: boolean;
        error?: string;
      };
      if (!mounted.current) return;
      setModels(data.models || []);
      setModel((m) =>
        data.models?.some((x: ModelOption) => x.id === m)
          ? m
          : data.defaultModel || '',
      );
      setConfigured(!!data.configured);
      setCatalogError(data.error || '');
    } catch {
      if (mounted.current) setCatalogError('模型目录暂时连接不上，可稍后重试');
    } finally {
      if (mounted.current) setCatalogLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    try {
      setSaved(readSaved(localStorage.getItem(STORAGE_KEY)));
      const settings = readProfileSettings(
        localStorage.getItem(PROFILE_STORAGE_KEY),
      );
      profileSettings.current = settings;
      const restored = {
        ...initialContext,
        profile: settings.profile,
        ignoredMemories: settings.removed[settings.profile],
      };
      setCtx(restored);
      setResult(
        initialExample
          ? validateScene(
              exampleScene('wait', restored),
              restored,
              EXAMPLES[1].input,
            )
          : null,
      );
    } catch {
      showToast('浏览器存储不可用，保存功能暂时不可用', true);
    }
    void loadModels();
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(
      () => setElapsed((performance.now() - started.current) / 1000),
      100,
    );
    return () => clearInterval(id);
  }, [busy]);
  function cancel() {
    requestId.current++;
    abort.current?.abort();
    setBusy(false);
    setStreamText('');
    setStatus('');
  }
  function changeContext(next: Context) {
    cancel();
    setCtx(next);
    setIsSaved(false);
    setTiming(null);
    if (result) {
      const validated = validateScene(result.scene, next, heard);
      setResult({
        ...validated,
        decisions: [
          ...validated.decisions,
          ...result.decisions.filter(
            (d) =>
              d.final === undefined &&
              !validated.decisions.some((x) => x.primary === d.primary),
          ),
        ],
      });
    }
  }
  function discard() {
    cancel();
    setResult(null);
    setHeard('');
    setInput('');
    setEditing(false);
    setActiveId(null);
    setIsSaved(false);
    setError('');
    setTiming(null);
    setWhy(false);
    inp.current?.focus();
  }
  async function run(
    text = input,
    forceNew = false,
    sourceOverride?: Source,
  ): Promise<SceneResult | null> {
    const runMode = sourceOverride || mode;
    const query = text.trim();
    if (!query) return null;
    cancel();
    const id = ++requestId.current;
    const controller = new AbortController();
    abort.current = controller;
    const previous = !forceNew ? result?.scene : undefined;
    setError('');
    setStatus('');
    setInput(query);
    setBusy(true);
    setElapsed(0);
    setStreamText('');
    started.current = performance.now();
    setTiming(null);
    setIsSaved(false);
    setWhy(false);
    let done = false;
    let output: SceneResult | null = null;
    const deadline = setTimeout(() => controller.abort(), 31000);
    try {
      if (runMode === 'example') {
        const next = replay(query, ctx, previous);
        // Example timing is solely an interface transition, never a measured model latency.
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, 650);
          controller.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(t);
              reject(new DOMException('Cancelled', 'AbortError'));
            },
            { once: true },
          );
        });
        if (id !== requestId.current) return null;
        output = next;
        setSource('example');
        setModelUsed('预设交互示例');
        done = true;
      } else {
        if (!configured)
          throw new Error(
            '真实 AI 尚未连接。请先配置服务端密钥，再在评审面板刷新连接。',
          );
        if (!model) throw new Error('没有可用的候选模型，请在评审面板刷新。');
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: query,
            model,
            context: ctx,
            currentScene: previous,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || '生成暂时不可用');
        }
        if (!response.body) throw new Error('生成服务没有返回内容');
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = '';
        function handle(line: string) {
          if (!line.startsWith('data:')) return;
          const event = JSON.parse(line.slice(5)) as GenerationEvent;
          if (id !== requestId.current) return;
          if (event.type === 'understanding') setStreamText(event.text);
          if (event.type === 'retry') {
            setStatus(event.text);
            setStreamText('');
          }
          if (event.type === 'error') throw new Error(event.message);
          if (event.type === 'result') {
            output = event.result;
            setTiming(event.timing);
            setModelUsed(event.model);
            setSource('live');
            done = true;
          }
        }
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) handle(line);
          }
          buffer += decoder.decode();
          if (buffer.trim()) handle(buffer);
        } finally {
          await reader.cancel().catch(() => {});
        }
        if (!done) throw new Error('连接已中断，输入已保留，请重试');
      }
      if (id !== requestId.current) return null;
      setResult(output);
      setHeard(previous ? heard : query);
      if (!previous) {
        setActiveId(null);
        setEditing(false);
      } else setEditing(false);
      setInput('');
      setStreamText('');
      return output;
    } catch (e) {
      if (id !== requestId.current) return null;
      const message = controller.signal.aborted
        ? '等待已结束，输入已保留。可以重试。'
        : e instanceof Error
          ? e.message
          : '生成失败，请重试';
      setError(message);
      return null;
    } finally {
      clearTimeout(deadline);
      if (id === requestId.current) {
        setBusy(false);
        setStatus('');
      }
    }
  }
  function saveCurrent() {
    const s = stateRef.current;
    if (
      !s.result?.savable ||
      !s.result.scene.name.trim() ||
      s.busy ||
      ctx.driving
    )
      throw new Error('请先完成一个可以保存的场景');
    const item: SavedScene = {
      id: s.activeId || crypto.randomUUID(),
      input: s.heard,
      source: s.source,
      profileId: ctx.profile,
      result: s.result,
      updatedAt: new Date().toISOString(),
    };
    const next = upsertSaved(s.saved, item);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(next);
      setActiveId(item.id);
      setIsSaved(true);
      showToast('已保存到我的场景');
      return { id: item.id, name: item.result.scene.name };
    } catch {
      showToast('浏览器无法保存，请检查存储空间', true);
      throw new Error('保存失败');
    }
  }
  function openSaved(item: SavedScene) {
    cancel();
    const checked = validateScene(item.result.scene, ctx, item.input);
    const changedByContext =
      JSON.stringify(checked.scene) !== JSON.stringify(item.result.scene);
    setResult({
      ...checked,
      decisions: [
        ...checked.decisions,
        ...item.result.decisions.filter((d) => d.final === undefined),
      ],
    });
    setModelUsed(
      item.source === 'example'
        ? '预设交互示例'
        : '已保存的 AI 场景（无本次时延）',
    );
    setHeard(item.input);
    setSource(item.source);
    setMode(item.source);
    setActiveId(item.id);
    setIsSaved(!changedByContext);
    if (changedByContext)
      showToast('已按当前车况和偏好调整预览，原场景保留；修改后请重新保存');
    setEditing(false);
    setError('');
    setInput('');
    setTiming(null);
  }
  function removeMemory(content: string) {
    if (!profileMemories[ctx.profile].some((m) => m.content === content))
      return;
    const removed = [...new Set([...(ctx.ignoredMemories || []), content])];
    if (
      persistProfile({
        ...profileSettings.current,
        removed: { ...profileSettings.current.removed, [ctx.profile]: removed },
      })
    ) {
      changeContext({ ...ctx, ignoredMemories: removed });
      showToast('已停用这条偏好，下次生成不再使用');
    }
  }
  function persistProfile(next: ProfileSettings) {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
      profileSettings.current = next;
      return true;
    } catch {
      showToast('偏好未能保存，请检查浏览器存储空间', true);
      return false;
    }
  }
  function selectProfile(profile: ProfileId) {
    if (profile === ctx.profile) return;
    if (persistProfile({ ...profileSettings.current, profile })) {
      changeContext({
        ...ctx,
        profile,
        ignoredMemories: profileSettings.current.removed[profile],
      });
      showToast('已切换档案，下次生成会参考当前偏好');
    }
  }
  function restoreMemory(content: string) {
    const removed = (ctx.ignoredMemories || []).filter((m) => m !== content);
    if (
      persistProfile({
        ...profileSettings.current,
        removed: { ...profileSettings.current.removed, [ctx.profile]: removed },
      })
    ) {
      changeContext({ ...ctx, ignoredMemories: removed });
      showToast('已恢复这条偏好，下次生成会参考');
    }
  }
  const actionsRef = useRef({ run, saveCurrent });
  actionsRef.current = { run, saveCurrent };
  useEffect(() => {
    type Mcp = {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Mcp })
      .modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    const tools = [
      {
        name: 'create_scene_proposal',
        title: '生成场景提案',
        description:
          '用当前模式生成场景提案并显示结果，不保存也不执行车辆动作。示例模式仅支持页面列出的示例。',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', minLength: 1, maxLength: 1200 },
          },
          required: ['input'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(value: unknown) {
          const v = value as { input?: unknown };
          if (
            typeof v?.input !== 'string' ||
            !v.input.trim() ||
            v.input.length > 1200
          )
            throw new Error('输入无效');
          const r = await actionsRef.current.run(v.input, true);
          if (!r) throw new Error('生成未完成');
          return {
            name: r.scene.name,
            savable: r.savable,
            clarify: r.scene.clarify,
          };
        },
      },
      {
        name: 'save_current_scene',
        title: '保存当前场景',
        description: '将当前已校验的提案保存到本浏览器，不执行车辆动作。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(value: unknown) {
          if (!value || typeof value !== 'object' || Object.keys(value).length)
            throw new Error('不接受参数');
          return actionsRef.current.saveCurrent();
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: life.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => life.abort();
  }, []);

  function updateScene(
    next: import('@/lib/scene').Scene,
    changed: string[] = [],
  ) {
    if (ctx.driving || busy) return;
    const checked = validateScene({ ...next, clarify: null }, ctx, heard);
    setResult({
      ...checked,
      changed,
      decisions: [
        ...checked.decisions,
        ...(result?.decisions || []).filter(
          (d) =>
            d.final === undefined &&
            !checked.decisions.some((c) => c.primary === d.primary),
        ),
      ],
    });
    setIsSaved(false);
  }
  function deleteSaved(id: string) {
    const next = saved.filter((s) => s.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(next);
      if (activeId === id) discard();
      showToast('场景已删除');
    } catch {
      showToast('删除失败，原场景已保留', true);
    }
  }
  return {
    ctx,
    result,
    heard,
    input,
    setInput,
    editing,
    setEditing,
    mode,
    setMode,
    source,
    models,
    model,
    setModel,
    configured,
    catalogError,
    catalogLoading,
    busy,
    streamText,
    elapsed,
    status,
    error,
    setError,
    timing,
    modelUsed,
    review,
    setReview,
    saved,
    activeId,
    isSaved,
    why,
    setWhy,
    notice,
    inp,
    loadModels,
    cancel,
    changeContext,
    discard,
    run,
    saveCurrent,
    openSaved,
    removeMemory,
    restoreMemory,
    selectProfile,
    showToast,
    updateScene,
    deleteSaved,
  };
}
