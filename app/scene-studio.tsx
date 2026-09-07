'use client';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  Check,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  Minus,
  Navigation,
  Music2,
  LayoutGrid,
  SlidersHorizontal,
  Sun,
  AudioLines,
  Wind,
  Thermometer,
  MessageCircle,
  Layers,
  Bookmark,
  Play,
  Pause,
  SkipForward,
  Bluetooth,
  Signal,
  BatteryMedium,
  CloudMoon,
  MapPin,
  Maximize2,
  CircleAlert,
  RotateCcw,
  Trash2,
  Pencil,
  Search,
  Brain,
} from 'lucide-react';
import { ProfileLibrary, ProfileSwitcher } from '@/components/profile-library';
import { ProposalPresence } from '@/components/proposal-presence';
import { useSceneController } from '@/lib/use-scene-controller';
import {
  AssistantMark,
  NavigationCanvas,
  SoundArtwork,
} from '@/components/cockpit-art';
import { Switch } from '@/components/ui/switch';
import { EXAMPLES } from '@/lib/examples';
import {
  capabilities,
  elementOf,
  memoriesFor,
  PROFILE_LABELS,
  registryVersion,
  type ProfileId,
} from '@/lib/scene';

const icons = {
  光: Sun,
  声: AudioLines,
  气: Wind,
  温: Thermometer,
  话: MessageCircle,
  供: Navigation,
  其他: Layers,
};
const order = ['光', '声', '气', '温', '话', '供', '其他'] as const;
const labels: Record<string, string> = {
  主驾温度控制: '主驾温度',
  音量: '媒体音量',
  氛围灯亮度: '氛围灯',
};
const tags: Record<string, string> = {
  accepted: '可用',
  adjusted: '已调整',
  forbidden: '禁止',
  unsupported: '不支持',
  planned: '规划中',
  proposed: '提议中',
};
const fmt = (n: number | null | undefined) =>
  n == null ? '—' : n.toFixed(2) + ' s';
type Surface = 'navigation' | 'music' | 'scenes';
type Page = 'saved' | 'discover' | 'create' | 'detail' | 'learned';

function ContainedPanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current;
    el?.querySelector<HTMLButtonElement>('button')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      }
      if (e.key === 'Tab' && el) {
        const items = [
          ...el.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]',
          ),
        ].filter((x) => x.getClientRects().length);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      previous?.focus();
    };
  }, []);
  return (
    <div className="panel-layer">
      <button
        className="panel-scrim"
        onClick={onClose}
        aria-label="关闭面板"
        tabIndex={-1}
      />
      <section
        ref={ref}
        className="in-display-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span className="overline">SCENE / SETTINGS</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="round-button"
            aria-label="关闭面板"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <div className="panel-scroll">{children}</div>
      </section>
    </div>
  );
}

export default function SceneStudio() {
  const c = useSceneController();
  const [surface, setSurface] = useState<Surface>('navigation'),
    [page, setPage] = useState<Page>('saved'),
    [popup, setPopup] = useState(true);
  const [scale, setScale] = useState(0.7),
    [detail, setDetail] = useState(false),
    [editTarget, setEditTarget] = useState(''),
    [search, setSearch] = useState(''),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false),
    [track, setTrack] = useState(0),
    [zoom, setZoom] = useState(1),
    [climate, setClimate] = useState(24),
    [climateOpen, setClimateOpen] = useState(false);
  const scene = c.result?.scene,
    screen = useRef<HTMLDivElement>(null),
    previousEditing = useRef(false);
  useEffect(() => {
    const resize = () =>
      setScale(
        Math.max(
          0.2,
          Math.min(
            (window.innerWidth - 100) / 2020,
            (window.innerHeight - 90) / 1200,
          ),
        ),
      );
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (c.editing && !previousEditing.current)
      requestAnimationFrame(() => c.inp.current?.focus());
    previousEditing.current = c.editing;
  }, [c.editing, c.inp]);
  useEffect(() => {
    if (c.ctx.driving) {
      setEditTarget('');
      setDetail(false);
      setClimateOpen(false);
      c.setEditing(false);
    }
  }, [c.ctx.driving]);
  const groups = order.flatMap((group) => {
    const actions = (scene?.actions || []).filter(
      (a) => elementOf(a.primary) === group,
    );
    if (group === '话' && scene?.say)
      actions.push({ primary: '小塔播报', secondary: scene.say });
    return actions.length ? [{ group, actions }] : [];
  });
  const exceptions =
      c.result?.decisions.filter((d) => d.status !== 'accepted') || [],
    omitted = exceptions.filter((d) => d.final === undefined);
  const showCard =
    surface === 'scenes' ? page === 'create' || page === 'detail' : popup;
  const overlay = c.review || !!deleteId,
    modeLabel =
      c.mode === 'example'
        ? '示例体验'
        : c.configured
          ? 'AI 已连接'
          : 'AI 未连接',
    heardLabel = c.busy ? c.input : c.heard;
  function showApp(next: Page = 'saved') {
    setSurface('scenes');
    setPage(next);
    setPopup(false);
    setDetail(false);
    setEditTarget('');
  }
  function create() {
    if (c.ctx.driving) {
      c.showToast('停车后再创建场景');
      return;
    }
    c.discard();
    setEditTarget('');
    setDetail(false);
    showApp('create');
  }
  function dismiss() {
    c.discard();
    setPopup(false);
    setDetail(false);
    setEditTarget('');
    if (surface === 'scenes') setPage('saved');
  }
  function beginEdit() {
    if (c.ctx.driving) return;
    c.setEditing(true);
    c.setInput('');
    setEditTarget('');
    setDetail(false);
  }
  async function submit(
    text = c.input,
    fresh = false,
    sourceOverride?: 'live' | 'example',
  ) {
    if (c.ctx.driving) {
      c.showToast('提案已保留，停车后继续');
      return;
    }
    setPopup(true);
    setEditTarget('');
    setDetail(false);
    if (surface === 'scenes') setPage('detail');
    await c.run(text, fresh, sourceOverride);
  }
  function save() {
    try {
      c.saveCurrent();
      c.setEditing(false);
      setEditTarget('');
      showApp('saved');
    } catch {}
  }
  function openSuggestion() {
    if (!c.result) void submit(EXAMPLES[1].input, true);
    setPopup(true);
  }
  function updateValue(
    primary: string,
    value: string,
    condition = false,
    index = -1,
  ) {
    if (!scene) return;
    const next = structuredClone(scene);
    if (condition) {
      if (index >= 0)
        next.conditions[index] = {
          ...next.conditions[index],
          secondary: value,
        };
      else next.conditions.push({ primary, op: '==', secondary: value });
    } else {
      const found = next.actions.find((a) => a.primary === primary);
      if (found) found.secondary = value;
      else next.actions.push({ primary, secondary: value });
    }
    c.updateScene(next, [primary]);
    setEditTarget('');
  }
  function removeEntry(primary: string, condition = false, index = -1) {
    if (!scene) return;
    const next = structuredClone(scene);
    if (condition) next.conditions.splice(index, 1);
    else next.actions = next.actions.filter((a) => a.primary !== primary);
    c.updateScene(next, [primary]);
    setEditTarget('');
  }
  function valuesFor(primary: string, condition = false) {
    const cap = capabilities.find((a) => a.zh === primary),
      values = condition ? cap?.cond_values : cap?.act_values;
    if (!values) return [];
    return (
      Array.isArray(values)
        ? values
        : Array.from(
            {
              length: Math.min(
                110,
                Math.floor(
                  (Number(values.range[1]) - Number(values.range[0])) /
                    Number(values.range[2]),
                ) + 1,
              ),
            },
            (_, i) =>
              `${Number(values.range[0]) + i * Number(values.range[2])}${values.range[3]}`,
          )
    ).filter((v) => !cap?.deny_act_values.includes(v));
  }
  const conditionEdit = editTarget.startsWith('condition:'),
    conditionIndex = conditionEdit ? Number(editTarget.split(':')[1]) : -1;
  const chosenPrimary = conditionEdit
    ? scene?.conditions[conditionIndex]?.primary || ''
    : editTarget.replace(/^add:/, '').replace(/^condadd:/, '');
  const addCondition =
    editTarget === '__condition' || editTarget.startsWith('condadd:');
  const picker = editTarget && scene && (
    <div className="value-editor">
      <div className="value-editor-heading">
        <strong>
          {editTarget === '__action'
            ? '添加动作'
            : editTarget === '__condition'
              ? '添加触发条件'
              : chosenPrimary}
        </strong>
        <button
          className="bare"
          aria-label="关闭参数编辑"
          onClick={() => setEditTarget('')}
        >
          <X size={22} />
        </button>
      </div>
      {editTarget === '__action' || editTarget === '__condition' ? (
        <div className="capability-list">
          {capabilities
            .filter(
              (a) =>
                a.status === 'enabled' &&
                (addCondition ? a.cond_values : a.act_values),
            )
            .map((a) => (
              <button
                key={a.id}
                onClick={() =>
                  setEditTarget((addCondition ? 'condadd:' : 'add:') + a.zh)
                }
              >
                {a.zh}
                <ChevronRight size={18} />
              </button>
            ))}
        </div>
      ) : (
        <>
          <div className="value-options">
            {valuesFor(chosenPrimary, conditionEdit || addCondition).map(
              (value) => (
                <button
                  key={value}
                  onClick={() =>
                    updateValue(
                      chosenPrimary,
                      value,
                      conditionEdit || addCondition,
                      conditionIndex,
                    )
                  }
                >
                  {value}
                </button>
              ),
            )}
          </div>
          {!valuesFor(chosenPrimary, conditionEdit || addCondition).length && (
            <p>请通过下方输入框描述这项内容。</p>
          )}
          {!editTarget.includes('add:') && (
            <button
              className="remove-entry"
              onClick={() =>
                removeEntry(chosenPrimary, conditionEdit, conditionIndex)
              }
            >
              <Minus size={18} />
              移除此{conditionEdit ? '条件' : '动作'}
            </button>
          )}
        </>
      )}
    </div>
  );
  const composer = (
    <div className="card-composer">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <AssistantMark small />
        <input
          ref={c.inp}
          value={c.input}
          onChange={(e) => c.setInput(e.target.value)}
          maxLength={1200}
          disabled={c.ctx.driving}
          aria-label={c.editing ? '修改当前场景' : '描述你想要的场景'}
          placeholder={
            scene?.clarify
              ? '补充你想打开的对象'
              : c.editing
                ? '再说一句，只改你提到的地方'
                : '说说你想要的车内场景'
          }
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing && e.key === 'Enter')
              e.preventDefault();
          }}
        />
        <button
          aria-label={c.busy ? '重新生成' : '生成场景'}
          disabled={!c.input.trim() || c.ctx.driving}
          type="submit"
        >
          <ArrowUp size={28} />
        </button>
      </form>
      <div className="quick-replies">
        {(scene?.clarify
          ? ['灯光', '空调', '车窗']
          : c.editing
            ? ['灯再暗一点', '小声一点', '再凉一点']
            : EXAMPLES.slice(0, 3).map((x) => x.label)
        ).map((text) => (
          <button
            key={text}
            disabled={c.ctx.driving}
            onClick={() =>
              void submit(
                c.editing || scene?.clarify
                  ? text
                  : EXAMPLES.find((x) => x.label === text)!.input,
                !c.editing && !scene?.clarify,
              )
            }
          >
            {text}
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      <span className="input-caption">文字模拟语音输入 · {modeLabel}</span>
    </div>
  );
  const proposal = (
    <section
      className={
        'proposal' +
        (c.busy ? ' is-generating' : '') +
        (c.editing ? ' is-editing' : '') +
        (c.ctx.driving ? ' is-driving' : '')
      }
      aria-label="场景生成卡片"
      aria-busy={c.busy}
    >
      <div className="proposal-top">
        <span>
          <AssistantMark small />
          {c.busy
            ? '正在为你生成'
            : scene?.clarify
              ? '再告诉我一点'
              : c.editing
                ? '编辑场景'
                : c.isSaved
                  ? '已保存的场景'
                  : '为这一刻'}
        </span>
        <div>
          <span className="source-stamp">
            {c.busy
              ? modeLabel
              : c.source === 'example'
                ? '示例提案'
                : 'AI 生成'}
          </span>
          {surface !== 'scenes' && (
            <button
              className="bare"
              aria-label="收起场景卡片"
              onClick={() => setPopup(false)}
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>
      <div className="proposal-scroll">
        {c.busy ? (
          <div className="generating-body" role="status">
            <span className="heard-line">“{heardLabel}”</span>
            <div className="thinking-orbit">
              <AssistantMark />
            </div>
            <h2>{c.streamText || '让这一刻，更合适。'}</h2>
            <p>
              {c.status ||
                (c.elapsed >= 2.5
                  ? '我再想想，正在整理你的方案。'
                  : '先理解你的需要，再安排车内设置。')}
            </p>
            <button className="bare" onClick={c.cancel}>
              取消生成
            </button>
          </div>
        ) : scene ? (
          <>
            <div className="proposal-intro">
              <span className="heard-line">“{heardLabel}”</span>
              {c.editing ? (
                <input
                  className="scene-name-editor"
                  aria-label="场景名称"
                  placeholder="给场景起个名字"
                  required
                  maxLength={20}
                  value={scene.name}
                  onChange={(e) =>
                    c.updateScene({ ...scene, name: e.target.value }, [
                      '场景名称',
                    ])
                  }
                />
              ) : (
                <h1>{scene.name || '这一刻'}</h1>
              )}
              <p className="understanding" aria-live="polite">
                {scene.understanding}
              </p>
            </div>
            {c.ctx.driving ? (
              <div className="drive-three-lines">
                <p>场景 · {scene.name}</p>
                <p>
                  {groups
                    .flatMap((g) => g.actions)
                    .map(
                      (a) => `${labels[a.primary] || a.primary} ${a.secondary}`,
                    )
                    .join(' · ') || '等待补充信息'}
                </p>
                <p>提案已保留，停车后查看与编辑</p>
              </div>
            ) : (
              <>
                <div className="condition-line">
                  <span>当</span>
                  {scene.conditions.length ? (
                    <div>
                      {scene.conditions.map((a, i) => {
                        const decision = c.result?.decisions.find(
                          (d) =>
                            d.primary === a.primary && d.kind === 'condition',
                        );
                        return (
                          <button
                            disabled={!c.editing}
                            key={a.primary + i}
                            onClick={() => setEditTarget('condition:' + i)}
                          >
                            {i > 0 && (scene.logic === 'AND' ? '且 ' : '或 ')}
                            {a.primary} {a.op === '==' ? '' : a.op}{' '}
                            {a.secondary}
                            {decision && decision.status !== 'accepted' && (
                              <em>{tags[decision.status]}</em>
                            )}
                            {c.editing && <Pencil size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="manual-condition">你手动选择时</span>
                  )}
                  {c.editing && scene.conditions.length > 1 && (
                    <button
                      className="condition-logic"
                      onClick={() =>
                        c.updateScene(
                          {
                            ...scene,
                            logic: scene.logic === 'AND' ? 'OR' : 'AND',
                          },
                          ['触发关系'],
                        )
                      }
                    >
                      {scene.logic === 'AND' ? '全部满足' : '任一满足'}
                    </button>
                  )}
                  {c.editing && (
                    <button
                      className="bare"
                      aria-label="添加触发条件"
                      onClick={() => setEditTarget('__condition')}
                    >
                      <Plus size={22} />
                    </button>
                  )}
                </div>
                {scene.clarify ? (
                  <div className="clarify-line">
                    <MessageCircle size={30} />
                    <p>{scene.clarify}</p>
                  </div>
                ) : (
                  <div
                    className={
                      'action-composition' +
                      (groups.length > 4 ? ' many-elements' : '')
                    }
                  >
                    {groups.map(({ group, actions }, i) => {
                      const Icon = icons[group];
                      return (
                        <div
                          className="element-column"
                          key={group}
                          style={
                            { animationDelay: `${i * 85}ms` } as CSSProperties
                          }
                        >
                          <div className="element-label">
                            <Icon size={25} />
                            <span>{group}</span>
                          </div>
                          {actions.map((a, j) => {
                            const d = c.result?.decisions.find(
                                (d) =>
                                  d.primary === a.primary &&
                                  d.kind === 'action' &&
                                  d.final !== undefined,
                              ),
                              val = /^(\d+(?:\.\d+)?)(%|℃|挡)$/.exec(
                                a.secondary,
                              );
                            return (
                              <div
                                className={
                                  'setting-line' +
                                  (c.result?.changed.includes(a.primary)
                                    ? ' just-changed'
                                    : '')
                                }
                                key={a.primary + j}
                              >
                                <button
                                  className="setting-value"
                                  disabled={
                                    !c.editing || a.primary === '小塔播报'
                                  }
                                  onClick={() => setEditTarget(a.primary)}
                                  aria-label={'编辑' + a.primary}
                                >
                                  <span className={!val ? 'word-value' : ''}>
                                    {val ? val[1] : a.secondary}
                                  </span>
                                  {val && (
                                    <small>
                                      {val[2] === '℃' ? '°' : val[2]}
                                    </small>
                                  )}
                                  {c.editing && <Pencil size={17} />}
                                </button>
                                <span
                                  className="setting-meter"
                                  aria-hidden="true"
                                >
                                  <i
                                    style={{
                                      width: val
                                        ? (val[2] === '℃'
                                            ? Math.max(
                                                0,
                                                Math.min(
                                                  100,
                                                  ((Number(val[1]) - 18) / 14) *
                                                    100,
                                                ),
                                              )
                                            : Math.max(
                                                0,
                                                Math.min(100, Number(val[1])),
                                              )) + '%'
                                        : '100%',
                                    }}
                                  />
                                </span>
                                <span className="setting-label">
                                  {labels[a.primary] || a.primary}
                                </span>
                                {d && d.status !== 'accepted' && (
                                  <span
                                    className={'capability-note ' + d.status}
                                  >
                                    {d.status === 'adjusted'
                                      ? `${d.original} → ${d.final}`
                                      : tags[d.status]}
                                  </span>
                                )}
                                {c.result?.changed.includes(a.primary) && (
                                  <span className="changed-label">已修改</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    {!groups.length && (
                      <p className="empty-actions">
                        这句话暂时不需要安排车内动作。
                      </p>
                    )}
                  </div>
                )}
                {c.editing && !scene.clarify && (
                  <button
                    className="add-action"
                    onClick={() => setEditTarget('__action')}
                  >
                    <Plus size={20} />
                    添加动作
                  </button>
                )}
                {picker}
                {omitted.length > 0 && (
                  <div className="omitted-lines">
                    {omitted.map((d, i) => (
                      <p key={i}>
                        <CircleAlert size={18} />
                        <span>
                          <s>
                            {d.primary}
                            {d.original && d.original !== c.heard
                              ? ' ' + d.original
                              : ''}
                          </s>
                          <small>
                            {tags[d.status]} · {d.reason}
                          </small>
                        </span>
                      </p>
                    ))}
                  </div>
                )}
                {exceptions
                  .filter((d) => d.status === 'adjusted')
                  .map((d, i) => (
                    <p className="adjustment-line" key={i}>
                      {d.primary}：{d.original} → {d.final}，{d.reason}
                    </p>
                  ))}
                {!!c.result?.memoryUsed.length && (
                  <div className="used-memory">
                    <Bookmark size={18} />
                    <div>
                      <span>记得你的偏好</span>
                      {c.result.memoryUsed.map((m) => (
                        <button
                          key={m}
                          onClick={() => c.removeMemory(m)}
                          title="移除此偏好"
                        >
                          {m}
                          <X size={15} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {detail && (
                  <div className="reason-detail">
                    <strong>为什么这样安排</strong>
                    <p>{scene.understanding}</p>
                    <p>
                      {c.result?.memoryUsed.length
                        ? '参考了上方列出的演示偏好。'
                        : '本次未使用记忆档案。'}
                    </p>
                    {scene.warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                    {scene.memory.map((m, i) => (
                      <p key={i}>建议记住（尚未保存）：{m.content}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="new-proposal">
            <AssistantMark />
            <span className="overline">YOUR WORDS. YOUR SPACE.</span>
            <h1>
              你说一句，
              <br />
              车里刚刚好。
            </h1>
            <p>
              告诉我什么时候，想要什么感觉。
              <br />
              我会把条件和动作整理成一个场景。
            </p>
          </div>
        )}
      </div>
      {c.error && (
        <div className="generation-error" role="alert">
          <CircleAlert size={20} />
          <p>{c.error}</p>
          <button onClick={() => void submit()}>重试</button>
        </div>
      )}
      {!c.busy &&
        !c.ctx.driving &&
        (c.editing || !scene || !!scene.clarify) &&
        composer}
      {!c.busy && scene && (
        <footer className="proposal-footer">
          <div className="proposal-note">
            <span>
              {c.result?.conceptual
                ? '含未落地能力 · 仅概念展示'
                : '保存场景，不立即执行'}
            </span>
            {!c.ctx.driving && (
              <button
                className="bare"
                onClick={() => setDetail(!detail)}
                aria-expanded={detail}
              >
                为什么
                <ChevronDown size={16} />
              </button>
            )}
          </div>
          {c.ctx.driving ? (
            <button
              className="driving-dismiss"
              onClick={() => {
                setPopup(false);
                if (surface === 'scenes') showApp('saved');
              }}
            >
              收起，停车后继续
            </button>
          ) : (
            <div className="proposal-actions">
              <button
                className="confirm-button"
                onClick={save}
                disabled={!c.result?.savable || c.isSaved || !scene.name.trim()}
              >
                <Check size={25} />
                {c.isSaved ? '已保存' : '就这样保存'}
              </button>
              <button
                className="edit-button"
                onClick={() => {
                  if (c.editing) {
                    c.setEditing(false);
                    setEditTarget('');
                  } else beginEdit();
                }}
              >
                {c.editing ? '完成编辑' : scene.clarify ? '补充一句' : '改一下'}
                <Pencil size={20} />
              </button>
              <button className="dismiss-button" onClick={dismiss}>
                不用
              </button>
            </div>
          )}
        </footer>
      )}
    </section>
  );
  return (
    <main className="presentation-stage">
      <div
        className="device-position"
        style={{ width: 1968 * scale, height: 1128 * scale }}
      >
        <div
          className="device-hardware"
          style={{
            transform: `scale(${scale}) translate(984px, 564px) perspective(2800px) rotateX(2deg) rotateY(-5deg) translate(-984px, -564px)`,
          }}
        >
          <div className="hardware-highlight" />
          <div className="cockpit-screen" ref={screen}>
            <div className="cockpit-content" inert={overlay}>
              <header className="status-rail">
                <div className="vehicle-status">
                  <span className="gear">{c.ctx.driving ? 'D' : 'P'}</span>
                  <span className="speed">
                    {c.ctx.driving ? '38' : '0'}
                    <small>km/h</small>
                  </span>
                  <span className="status-separator" />
                  <span className="status-location">
                    <MapPin size={22} />
                    上海 · 西岸
                  </span>
                </div>
                <span className="system-brand">
                  L U M A<span>与你，共处此刻</span>
                </span>
                <div className="status-right">
                  <CloudMoon size={24} />
                  <span>21°</span>
                  <span className="status-separator" />
                  <Bluetooth size={20} />
                  <Signal size={24} />
                  <BatteryMedium size={29} />
                  <span>82%</span>
                  <b>18:42</b>
                </div>
              </header>
              <div className={'os-workspace ' + surface}>
                {surface === 'navigation' && (
                  <>
                    <NavigationCanvas driving={c.ctx.driving} zoom={zoom} />
                    <div className="map-zoom">
                      <button
                        aria-label="放大地图"
                        onClick={() => setZoom(Math.min(1.4, zoom + 0.1))}
                      >
                        <Plus />
                      </button>
                      <button
                        aria-label="缩小地图"
                        onClick={() => setZoom(Math.max(0.8, zoom - 0.1))}
                      >
                        <Minus />
                      </button>
                    </div>
                    <div className="map-media">
                      <SoundArtwork />
                      <div>
                        <span>车内音乐 · 演示</span>
                        <h3>
                          {
                            ['After hours', 'Coastal air', 'Slow morning'][
                              track
                            ]
                          }
                        </h3>
                        <p>
                          {playing
                            ? '播放界面预览 · 无音频'
                            : '停一会儿，也很好'}
                        </p>
                      </div>
                      <button
                        aria-label={playing ? '暂停演示播放' : '演示播放'}
                        onClick={() => setPlaying(!playing)}
                      >
                        {playing ? <Pause /> : <Play />}
                      </button>
                    </div>
                    <ProposalPresence open={showCard}>
                      {proposal}
                    </ProposalPresence>
                    {!popup && (
                      <button
                        className="restore-proposal"
                        onClick={openSuggestion}
                      >
                        <AssistantMark small />
                        {c.result ? '继续查看场景提案' : '生成一个场景'}
                        <ArrowUpRight size={22} />
                      </button>
                    )}
                  </>
                )}
                {surface === 'music' && (
                  <div className="music-application">
                    <div>
                      <span className="overline">YOUR LISTENING SPACE</span>
                      <h1>把世界，调小一点。</h1>
                      <p>车内音乐 · 情境演示</p>
                      <SoundArtwork large />
                    </div>
                    <div className="music-now">
                      <span>AFTER HOURS / 0{track + 1}</span>
                      <h2>
                        {['After hours', 'Coastal air', 'Slow morning'][track]}
                      </h2>
                      <p>Ambient collection · 交互预览，无音频</p>
                      <div className="music-progress">
                        <i />
                      </div>
                      <div className="music-controls">
                        <button
                          aria-label="上一首演示曲目"
                          onClick={() => setTrack((track + 2) % 3)}
                        >
                          <SkipForward className="reverse" />
                        </button>
                        <button
                          className="big-play"
                          aria-label={playing ? '暂停演示播放' : '演示播放'}
                          onClick={() => setPlaying(!playing)}
                        >
                          {playing ? <Pause /> : <Play />}
                        </button>
                        <button
                          aria-label="下一首演示曲目"
                          onClick={() => setTrack((track + 1) % 3)}
                        >
                          <SkipForward />
                        </button>
                      </div>
                      <button className="music-scene" onClick={openSuggestion}>
                        <AssistantMark small />
                        为听歌留一个场景
                        <ArrowUpRight />
                      </button>
                    </div>
                    <ProposalPresence open={showCard}>
                      {proposal}
                    </ProposalPresence>
                  </div>
                )}
                {surface === 'scenes' && (
                  <div className="scene-application">
                    <aside className="app-sidebar">
                      <div className="app-brand">
                        <AssistantMark />
                        <div>
                          <h2>小塔场景</h2>
                          <span>SCENE STUDIO</span>
                        </div>
                      </div>
                      <button className="sidebar-create" onClick={create}>
                        <Plus size={23} />
                        一句话新建
                        <ArrowUpRight size={18} />
                      </button>
                      <nav aria-label="场景应用导航">
                        <button
                          aria-current={page === 'saved' ? 'page' : undefined}
                          onClick={() => setPage('saved')}
                        >
                          <Bookmark />
                          我的场景<span>{c.saved.length}</span>
                        </button>
                        <button
                          aria-current={
                            page === 'discover' ? 'page' : undefined
                          }
                          onClick={() => setPage('discover')}
                        >
                          <Layers />
                          灵感场景
                        </button>
                        <button
                          aria-current={page === 'learned' ? 'page' : undefined}
                          onClick={() => setPage('learned')}
                        >
                          <Brain />
                          它学会了什么
                        </button>
                      </nav>
                      <div className="sidebar-bottom">
                        <ProfileSwitcher
                          ctx={c.ctx}
                          onSelect={c.selectProfile}
                          onOpen={() => setPage('learned')}
                        />
                        <span className="local-storage-note">
                          只属于你的这台浏览器
                        </span>
                      </div>
                    </aside>
                    <section className="application-body">
                      <header className="application-heading">
                        <div>
                          <span className="overline">
                            {page === 'learned'
                              ? 'A LITTLE MORE YOU'
                              : page === 'saved'
                                ? 'YOUR SCENES'
                                : page === 'discover'
                                  ? 'A LITTLE INSPIRATION'
                                  : page === 'create'
                                    ? 'CREATE A SCENE'
                                    : 'SCENE DETAILS'}
                          </span>
                          <h1>
                            {page === 'learned'
                              ? '它学会了什么'
                              : page === 'saved'
                                ? '我的场景'
                                : page === 'discover'
                                  ? '从一种感觉开始'
                                  : page === 'create'
                                    ? '创建场景'
                                    : c.editing
                                      ? '编辑场景'
                                      : '场景详情'}
                          </h1>
                        </div>
                        {page === 'saved' ? (
                          <button className="new-scene-button" onClick={create}>
                            <Plus size={24} />
                            创建场景
                          </button>
                        ) : (
                          <button
                            className="app-back"
                            onClick={() => setPage('saved')}
                          >
                            <ArrowLeft size={22} />
                            我的场景
                          </button>
                        )}
                      </header>
                      {page === 'learned' ? (
                        <ProfileLibrary
                          ctx={c.ctx}
                          onSelect={c.selectProfile}
                          onRemove={c.removeMemory}
                          onRestore={c.restoreMemory}
                          onTry={() => {
                            c.discard();
                            c.setMode('example');
                            setPage('detail');
                            void submit(EXAMPLES[1].input, true, 'example');
                          }}
                        />
                      ) : page === 'saved' || page === 'discover' ? (
                        <>
                          <div className="library-subtitle">
                            <p>
                              {page === 'saved'
                                ? '把喜欢的车内设置，留给下一次。'
                                : '选一个示例，再改成适合自己的样子。'}
                            </p>
                            {page === 'saved' && c.saved.length > 0 && (
                              <label className="scene-search">
                                <Search size={21} />
                                <input
                                  aria-label="搜索我的场景"
                                  value={search}
                                  onChange={(e) => setSearch(e.target.value)}
                                  placeholder="搜索场景"
                                />
                              </label>
                            )}
                          </div>
                          <div className="library-content">
                            {page === 'saved' ? (
                              c.saved.length ? (
                                <div className="saved-scene-list">
                                  {c.saved
                                    .filter(
                                      (s) =>
                                        s.result.scene.name.includes(search) ||
                                        s.input.includes(search),
                                    )
                                    .map((s, i) => (
                                      <div
                                        className={
                                          'saved-scene-row' +
                                          (s.id === c.activeId
                                            ? ' selected'
                                            : '')
                                        }
                                        key={s.id}
                                      >
                                        <button
                                          onClick={() => {
                                            c.openSaved(s);
                                            setPage('detail');
                                            setDetail(false);
                                            setEditTarget('');
                                          }}
                                        >
                                          <span
                                            className={
                                              'scene-thumbnail tone-' + (i % 3)
                                            }
                                          >
                                            <AssistantMark small />
                                          </span>
                                          <div>
                                            <span className="saved-origin">
                                              {s.source === 'example'
                                                ? '示例场景'
                                                : 'AI 场景'}
                                              {s.result.conceptual
                                                ? ' · 含概念能力'
                                                : ''}
                                            </span>
                                            <h2>{s.result.scene.name}</h2>
                                            <p className="saved-understanding">
                                              {s.result.scene.understanding}
                                            </p>
                                            <div className="saved-settings">
                                              {s.result.scene.actions
                                                .slice(0, 3)
                                                .map((a) => (
                                                  <span key={a.primary}>
                                                    {labels[a.primary] ||
                                                      a.primary}{' '}
                                                    <b>{a.secondary}</b>
                                                  </span>
                                                ))}
                                              {s.result.scene.actions.length >
                                                3 && (
                                                <span>
                                                  +
                                                  {s.result.scene.actions
                                                    .length - 3}
                                                </span>
                                              )}
                                            </div>
                                            <p className="saved-metadata">
                                              {PROFILE_LABELS[
                                                s.profileId || 'none'
                                              ] || '无记忆档案'}
                                              <span> / </span>
                                              {s.result.scene.conditions.length
                                                ? s.result.scene.conditions
                                                    .map(
                                                      (a) =>
                                                        a.primary +
                                                        ' ' +
                                                        a.secondary,
                                                    )
                                                    .join(' · ')
                                                : '手动选择时'}
                                            </p>
                                          </div>
                                          <ChevronRight size={26} />
                                        </button>
                                        <button
                                          className="delete-scene"
                                          aria-label={
                                            '删除场景 ' + s.result.scene.name
                                          }
                                          onClick={() => setDeleteId(s.id)}
                                        >
                                          <Trash2 size={23} />
                                        </button>
                                      </div>
                                    ))}
                                  {c.saved.filter(
                                    (s) =>
                                      s.result.scene.name.includes(search) ||
                                      s.input.includes(search),
                                  ).length === 0 && (
                                    <p className="no-search-results">
                                      没有找到这个场景。
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="empty-library">
                                  <div className="empty-sculpture">
                                    <AssistantMark />
                                  </div>
                                  <div>
                                    <span className="overline">
                                      MAKE ROOM FOR YOUR MOMENTS
                                    </span>
                                    <h2>
                                      第一个场景，
                                      <br />
                                      从你的一句话开始。
                                    </h2>
                                    <p>
                                      喜欢的温度、恰好的声音，
                                      <br />
                                      都可以一起记下来。
                                    </p>
                                    <button
                                      className="new-scene-button"
                                      onClick={create}
                                    >
                                      <Plus size={24} />
                                      创建我的第一个场景
                                    </button>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="inspiration-list">
                                {EXAMPLES.slice(0, 3).map((x, i) => (
                                  <button
                                    className={
                                      'inspiration-scene inspiration-' + i
                                    }
                                    key={x.id}
                                    onClick={() => {
                                      c.discard();
                                      c.setMode('example');
                                      setPage('detail');
                                      void submit(x.input, true, 'example');
                                    }}
                                  >
                                    <span className="scene-number">
                                      0{i + 1} / 示例
                                    </span>
                                    <div className="inspiration-orbit">
                                      <AssistantMark />
                                    </div>
                                    <div>
                                      <h2>{x.label}</h2>
                                      <p>{x.input}</p>
                                    </div>
                                    <ArrowUpRight size={29} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="library-footer">
                            <span>
                              <i />
                              {modeLabel}
                            </span>
                            <span>场景由你确认 · 保存不会执行车辆动作</span>
                          </div>
                        </>
                      ) : (
                        <div className="application-editor">
                          <div className="editor-context">
                            <span className="editor-step">
                              {scene ? '02' : '01'}
                              <i>/ 03</i>
                            </span>
                            <h2>
                              {scene
                                ? c.editing
                                  ? '只改你想改的。'
                                  : '让它更像你。'
                                : '说一个时刻。'}
                            </h2>
                            <p>
                              {scene
                                ? '查看条件与动作，确认后保存。\n下次回来，还可以继续修改。'
                                : '比如等人的片刻、雨夜回家，\n或者想让后排安静一点。'}
                            </p>
                            <div className="editor-steps">
                              <span className="complete">
                                <Check size={17} />
                                表达需要
                              </span>
                              <span className={scene ? 'current' : ''}>
                                <i />
                                确认场景
                              </span>
                              <span>
                                <i />
                                留在我的场景
                              </span>
                            </div>
                            {scene && (
                              <div className="editor-source">
                                <span>你说</span>
                                <p>“{c.heard}”</p>
                              </div>
                            )}
                            <button
                              className="preview-window"
                              onClick={() => {
                                setSurface('navigation');
                                setPopup(true);
                              }}
                            >
                              <Maximize2 size={22} />
                              在导航上查看卡片
                              <ArrowUpRight size={20} />
                            </button>
                          </div>
                          <div className="in-app-proposal">{proposal}</div>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>
              <footer className="system-dock">
                <div className="climate-control">
                  <button
                    onClick={() => setClimateOpen(!climateOpen)}
                    aria-label="打开空调演示"
                  >
                    <Wind size={29} />
                    <span>
                      {climate}
                      <sup>°</sup>
                    </span>
                    <small>AUTO</small>
                  </button>
                  {climateOpen && (
                    <div className="climate-popover">
                      <span>主驾温度 · 界面演示</span>
                      <div>
                        <button
                          aria-label="降低演示温度"
                          onClick={() => setClimate(Math.max(18, climate - 1))}
                        >
                          <Minus />
                        </button>
                        <strong>{climate}°</strong>
                        <button
                          aria-label="提高演示温度"
                          onClick={() => setClimate(Math.min(32, climate + 1))}
                        >
                          <Plus />
                        </button>
                      </div>
                      <small>与提案独立，未控制真实车辆</small>
                    </div>
                  )}
                </div>
                <nav aria-label="车机应用">
                  <button
                    className={surface === 'navigation' ? 'active' : ''}
                    onClick={() => setSurface('navigation')}
                    aria-label="导航应用"
                  >
                    <Navigation />
                    <span>导航</span>
                  </button>
                  <button
                    className={surface === 'music' ? 'active' : ''}
                    onClick={() => setSurface('music')}
                    aria-label="音乐应用"
                  >
                    <Music2 />
                    <span>音乐</span>
                  </button>
                  <button
                    className={surface === 'scenes' ? 'active' : ''}
                    onClick={() => showApp()}
                    aria-label="场景应用"
                  >
                    <LayoutGrid />
                    <span>场景</span>
                  </button>
                </nav>
                <button
                  className={'assistant-dock' + (showCard ? ' selected' : '')}
                  onClick={() => {
                    if (surface === 'scenes') create();
                    else if (popup) setPopup(false);
                    else openSuggestion();
                  }}
                >
                  <AssistantMark small />
                  <span>
                    {surface === 'scenes'
                      ? '说一句，创建场景'
                      : showCard
                        ? '场景提案'
                        : '唤起场景'}
                  </span>
                </button>
                <div className="dock-right">
                  <span className="demo-state">
                    <i />
                    {modeLabel}
                  </span>
                  <button
                    className="dock-settings"
                    onClick={() => c.setReview(true)}
                    aria-label="打开演示设置"
                  >
                    <SlidersHorizontal size={25} />
                  </button>
                  <button
                    className="fullscreen-button"
                    aria-label="全屏展示车机"
                    onClick={() => {
                      if (document.fullscreenElement)
                        void document.exitFullscreen();
                      else
                        void screen.current
                          ?.closest('.device-position')
                          ?.requestFullscreen()
                          .catch(() => c.showToast('浏览器暂不支持全屏', true));
                    }}
                  >
                    <Maximize2 size={24} />
                  </button>
                </div>
              </footer>
              {c.notice && (
                <div
                  className={'cockpit-toast' + (c.notice.error ? ' error' : '')}
                  role="status"
                >
                  {c.notice.error ? (
                    <CircleAlert size={24} />
                  ) : (
                    <Check size={24} />
                  )}
                  <span>{c.notice.text}</span>
                </div>
              )}
            </div>
            {c.review && (
              <ContainedPanel
                title="演示设置"
                subtitle="车况与记忆为模拟数据；评审信息收在这里。"
                onClose={() => c.setReview(false)}
              >
                <section className="settings-section">
                  <h3>当前车况</h3>
                  <div className="drive-switch">
                    <span>
                      行驶状态<small>行驶时仅保留三行摘要</small>
                    </span>
                    <Switch
                      checked={c.ctx.driving}
                      onCheckedChange={(driving) =>
                        c.changeContext({ ...c.ctx, driving })
                      }
                      aria-label="行驶中"
                    />
                  </div>
                  <label>
                    记忆档案
                    <select
                      value={c.ctx.profile}
                      onChange={(e) =>
                        c.selectProfile(e.target.value as ProfileId)
                      }
                    >
                      {Object.entries(PROFILE_LABELS).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {memoriesFor(c.ctx).map((m) => (
                    <div className="settings-memory" key={m.content}>
                      <p>
                        <small>
                          {m.type === 'dislike' ? '负面偏好' : '记忆偏好'}
                        </small>
                        {m.content}
                      </p>
                      <button
                        aria-label={'删除偏好 ' + m.content}
                        onClick={() => c.removeMemory(m.content)}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </section>
                <section className="settings-section">
                  <h3>生成来源</h3>
                  <div className="mode-switch">
                    {(['example', 'live'] as const).map((m) => (
                      <button
                        className={c.mode === m ? 'active' : ''}
                        key={m}
                        onClick={() => {
                          c.cancel();
                          c.setMode(m);
                          c.setError('');
                        }}
                      >
                        {m === 'example' ? '示例体验' : '真实 AI'}
                      </button>
                    ))}
                  </div>
                  <div className="connection-state">
                    <span>
                      {c.catalogLoading
                        ? '正在检查连接'
                        : c.configured
                          ? '服务端密钥已配置'
                          : 'OpenRouter 尚未连接'}
                    </span>
                    <button
                      onClick={() => void c.loadModels()}
                      disabled={c.catalogLoading}
                    >
                      <RotateCcw size={19} />
                      刷新
                    </button>
                  </div>
                  <p className="settings-hint">
                    {c.configured
                      ? '模型目录可见不代表账号有可用额度。'
                      : '真实生成需要在 Vercel 服务端配置 OPENROUTER_API_KEY。'}
                  </p>
                  {c.catalogError && (
                    <p className="settings-error">{c.catalogError}</p>
                  )}
                  <label>
                    模型
                    <select
                      aria-label="模型"
                      value={c.model}
                      onChange={(e) => c.setModel(e.target.value)}
                      disabled={!c.models.length}
                    >
                      {c.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
                <section className="settings-section">
                  <h3>本次生成</h3>
                  <p className="settings-hint">
                    {c.source === 'example'
                      ? '预设交互示例 · 没有调用模型'
                      : c.modelUsed}
                  </p>
                  <div className="timings">
                    <div>
                      首字
                      <b>{c.source === 'live' ? fmt(c.timing?.ttft) : '—'}</b>
                    </div>
                    <div>
                      理解句
                      <b>
                        {c.source === 'live'
                          ? fmt(c.timing?.understanding)
                          : '—'}
                      </b>
                    </div>
                    <div>
                      完整结果
                      <b>{c.source === 'live' ? fmt(c.timing?.total) : '—'}</b>
                    </div>
                  </div>
                  <p className="settings-hint">
                    {registryVersion} · 96 条能力。仅真实请求记录模型时延。
                  </p>
                  <details>
                    <summary>
                      查看逐项裁决 <ChevronDown size={18} />
                    </summary>
                    {c.result?.decisions.map((d, i) => (
                      <div className="decision-row" key={i}>
                        <strong>
                          {d.primary}
                          <span>{tags[d.status]}</span>
                        </strong>
                        <p>
                          {d.original}
                          {d.final && d.final !== d.original
                            ? ' → ' + d.final
                            : ''}
                        </p>
                        <small>{d.reason}</small>
                      </div>
                    ))}
                  </details>
                  <details>
                    <summary>
                      结构化结果 <ChevronDown size={18} />
                    </summary>
                    <pre>{JSON.stringify(c.result, null, 2)}</pre>
                  </details>
                </section>
                <section className="settings-section">
                  <h3>边界与状态演示</h3>
                  <div className="review-cases">
                    {EXAMPLES.slice(3).map((x) => (
                      <button
                        disabled={c.ctx.driving}
                        key={x.id}
                        onClick={() => {
                          c.discard();
                          c.setMode('example');
                          c.setReview(false);
                          setSurface('navigation');
                          setPopup(true);
                          void submit(x.input, true, 'example');
                        }}
                      >
                        {x.label}
                        <ArrowUpRight size={19} />
                      </button>
                    ))}
                  </div>
                  <p className="settings-hint">
                    本 demo
                    覆盖第一部分的场景生成。导航浮窗为呈现演示，未接主动门控、观察学习、真实车辆或自动执行。
                  </p>
                </section>
              </ContainedPanel>
            )}
            {deleteId && (
              <ContainedPanel
                title="删除这个场景？"
                subtitle="只删除当前浏览器里的场景，无法撤销。"
                onClose={() => setDeleteId(null)}
              >
                <div className="delete-confirm">
                  <h3>
                    {c.saved.find((s) => s.id === deleteId)?.result.scene.name}
                  </h3>
                  <button
                    className="confirm-delete"
                    onClick={() => {
                      c.deleteSaved(deleteId);
                      setDeleteId(null);
                    }}
                  >
                    删除场景
                  </button>
                  <button onClick={() => setDeleteId(null)}>保留</button>
                </div>
              </ContainedPanel>
            )}
          </div>
          <span className="hardware-inscription">
            LUMA EXPERIENCE / 1920 × 1080
          </span>
        </div>
      </div>
    </main>
  );
}
