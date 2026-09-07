'use client';
import {
  Brain,
  Check,
  ArrowUpRight,
  RotateCcw,
  X,
  Sun,
  AudioLines,
  Wind,
  Thermometer,
  UserRound,
} from 'lucide-react';
import {
  profileMemories,
  memoriesFor,
  type Context,
  type ProfileId,
} from '@/lib/scene';

const profiles = [
  {
    id: 'none',
    name: '无档案',
    initial: '—',
    feeling: '从这一句话认识你',
    description: '不附加个人偏好，只参考你本次的表达。',
  },
  {
    id: 'quiet',
    name: '林',
    initial: '林',
    feeling: '安静，是我的舒适区',
    description: '光轻一点，声音低一点。休息时，刚刚好就好。',
  },
  {
    id: 'fresh',
    name: '周',
    initial: '周',
    feeling: '喜欢清爽，也喜欢明亮',
    description: '稍凉的温度、清新的空气，让车内更自在。',
  },
] as const;

export function ProfileSwitcher({
  ctx,
  onSelect,
  onOpen,
}: {
  ctx: Context;
  onSelect: (id: ProfileId) => void;
  onOpen: () => void;
}) {
  const profile = profiles.find((p) => p.id === ctx.profile)!;
  return (
    <div className="profile-switcher">
      <div className="profile-eyebrow">
        <span>当前档案</span>
        <span>演示</span>
      </div>
      <button
        className="profile-current"
        onClick={onOpen}
        aria-label="查看当前档案"
      >
        <span className={'profile-avatar profile-' + ctx.profile}>
          {ctx.profile === 'none' ? <UserRound size={23} /> : profile.initial}
        </span>
        <span>
          <strong>
            {profile.name}
            {ctx.profile !== 'none' && '的座舱'}
          </strong>
          <small>{memoriesFor(ctx).length} 条偏好生效</small>
        </span>
        <ArrowUpRight size={20} />
      </button>
      <div className="profile-segments" aria-label="选择演示档案">
        {profiles.map((p) => (
          <button
            key={p.id}
            aria-pressed={ctx.profile === p.id}
            onClick={() => onSelect(p.id)}
            aria-label={'切换档案 ' + p.name}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProfileLibrary({
  ctx,
  onSelect,
  onRemove,
  onRestore,
  onTry,
}: {
  ctx: Context;
  onSelect: (id: ProfileId) => void;
  onRemove: (content: string) => void;
  onRestore: (content: string) => void;
  onTry: () => void;
}) {
  const active = profiles.find((p) => p.id === ctx.profile)!;
  const items = profileMemories[ctx.profile],
    count = memoriesFor(ctx).length;
  return (
    <div className="memory-library">
      <p className="memory-intro">喜欢的，替你留意。不喜欢的，认真避开。</p>
      <div className="profile-gallery" aria-label="演示档案">
        {profiles.map((p) => (
          <button
            key={p.id}
            className={'profile-tile profile-' + p.id}
            aria-pressed={ctx.profile === p.id}
            onClick={() => onSelect(p.id)}
          >
            <div>
              <span className={'profile-avatar profile-' + p.id}>
                {p.id === 'none' ? <UserRound size={25} /> : p.initial}
              </span>
              <span className="profile-tile-check">
                {ctx.profile === p.id ? <Check size={20} /> : <PlusMark />}
              </span>
            </div>
            <h2>{p.name === '无档案' ? '先不使用档案' : p.name + '的座舱'}</h2>
            <p>{p.feeling}</p>
            <small>
              {p.id === 'none' ? '仅使用当次输入' : '预置演示档案 · 4 条偏好'}
            </small>
          </button>
        ))}
      </div>
      <div className="memory-section-heading">
        <div>
          <Brain size={24} />
          <h2>
            {ctx.profile === 'none'
              ? '先听听你怎么说'
              : '关于' + active.name + '，我记得'}
          </h2>
          <span>
            {count} / {items.length}
          </span>
        </div>
        <span>你始终可以改主意</span>
      </div>
      {items.length ? (
        <div className="memory-list">
          {items.map((m) => {
            const removed = !!ctx.ignoredMemories?.includes(m.content);
            const Icon =
              m.type === 'dislike'
                ? X
                : m.content.includes('亮度')
                  ? Sun
                  : m.content.includes('音量')
                    ? AudioLines
                    : m.content.includes('温度')
                      ? Thermometer
                      : Wind;
            return (
              <div
                key={m.content}
                className={
                  'memory-row' +
                  (removed ? ' removed' : '') +
                  (m.type === 'dislike' ? ' negative' : '')
                }
              >
                <span className="memory-icon">
                  <Icon size={23} />
                </span>
                <div className="memory-copy">
                  <p>{m.content}</p>
                  <small>
                    {removed
                      ? '已停用 · 后续生成不再参考'
                      : m.type === 'dislike'
                        ? '不喜欢 · 生成时优先遵循'
                        : '偏好 · 在相关场景中参考'}
                  </small>
                </div>
                <button
                  aria-label={(removed ? '恢复偏好 ' : '停用偏好 ') + m.content}
                  onClick={() =>
                    removed ? onRestore(m.content) : onRemove(m.content)
                  }
                >
                  {removed ? <RotateCcw size={18} /> : <X size={18} />}
                  <span>{removed ? '恢复' : '拿走'}</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="memory-empty">
          <Brain size={38} />
          <div>
            <h3>现在，没有关于你的预设。</h3>
            <p>选择一个演示档案，看看同一句话怎样变成不同的场景。</p>
          </div>
        </div>
      )}
      <div className="memory-library-footer">
        <p>
          这里展示预置演示偏好，尚未接入自动学习。调整保存在当前浏览器，对后续生成生效；已保存的场景由你决定是否修改。
        </p>
        <button onClick={onTry} disabled={ctx.driving}>
          用当前档案生成
          <ArrowUpRight size={21} />
        </button>
      </div>
    </div>
  );
}

function PlusMark() {
  return <span aria-hidden="true">+</span>;
}
