import { motion } from 'motion/react';
import {
  Loader2,
  AlertCircle,
  RotateCcw,
  HelpCircle,
  CornerDownLeft,
  Gauge,
} from 'lucide-react';
import { SceneFields } from './SceneFields';
import { SceneCard } from './SceneCard';
import type { Generation } from '../useGeneration';

export function Orb({ active, size = 72 }: { active: boolean; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(205,236,82,0.95),rgba(205,236,82,0.08),rgba(205,236,82,0.95))] blur-[5px]"
        animate={
          active
            ? { rotate: 360, scale: [1, 1.07, 1] }
            : { rotate: 0, scale: 1 }
        }
        transition={{
          rotate: { duration: 5.5, repeat: Infinity, ease: 'linear' },
          scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
      <div className="absolute inset-[8px] rounded-full bg-card" />
      <motion.div
        className="absolute inset-[13px] rounded-full bg-primary/40"
        animate={active ? { opacity: [0.3, 0.7, 0.3] } : { opacity: 0.45 }}
        transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// 生成过程的正文（想想 / 追问 / 出错 / 行驶摘要 / 结果卡）。
// 由父级窗口（弹窗或应用弹层）提供卡片外壳。
export function Composer({
  gen,
  onSwitchToReal,
  onDiscard = gen.reset,
}: {
  gen: Generation;
  onSwitchToReal?: () => void;
  onDiscard?: () => void;
}) {
  const { phase, scene, understanding, slow, error } = gen;
  const showClarify =
    gen.driving !== 'driving' && phase === 'result' && !!scene?.clarify;
  const drivingCompact =
    gen.driving === 'driving' && phase === 'result' && !!scene;
  const showResult =
    phase === 'result' && !!scene && !showClarify && !drivingCompact;

  if (showResult && scene) {
    return (
      <SceneCard
        scene={scene}
        understanding={understanding}
        heard={gen.heard}
        changedIds={gen.changedIds}
        sourceBadge={gen.source}
        saved={gen.saved}
        editing={gen.editing}
        editText={gen.editText}
        onEditText={gen.setEditText}
        onSubmitEdit={(text) => gen.submitEdit(text)}
        onSave={gen.handleSave}
        onEdit={() => gen.setEditing(true)}
        onDiscard={onDiscard}
        editor={<SceneFields gen={gen} />}
      />
    );
  }

  return (
    <div className="max-h-full overflow-y-auto px-7 py-7">
      {phase === 'thinking' && (
        <div
          role="status"
          className="flex flex-col items-center py-2 text-center"
        >
          <p className="mb-5 line-clamp-2 text-[12px] text-muted-foreground/70">
            “{gen.input}” · {gen.mode === 'example' ? '示例回放' : '真实 AI'}
          </p>
          <Orb active size={72} />
          {understanding ? (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-[17px] leading-relaxed tracking-tight text-foreground"
            >
              {understanding}
            </motion.p>
          ) : (
            <div className="mt-6 flex items-center gap-2 text-[14px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />{' '}
              正在听你说…
            </div>
          )}
          {understanding && (
            <div className="mt-6 w-full space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-xl bg-secondary/50"
                  style={{ animationDelay: `${i * 130}ms` }}
                />
              ))}
            </div>
          )}
          {slow && (
            <div className="mt-5 text-[13px] text-muted-foreground">
              {gen.status || '我再想想，稍等一下…'}
            </div>
          )}
          <button
            onClick={gen.cancel}
            className="mt-4 rounded-lg px-3 py-2 text-[12px] text-muted-foreground"
          >
            取消生成
          </button>
        </div>
      )}

      {showClarify && scene?.clarify && (
        <div className="flex flex-col items-center py-1 text-center">
          <Orb active={false} size={60} />
          <div className="mt-5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <HelpCircle className="h-4 w-4 text-primary" /> 需要你确认一下
          </div>
          <p className="mt-2 text-[20px] leading-tight tracking-tight text-foreground">
            {scene.clarify.question}
          </p>
          {scene.conditions
            .filter((c) => c.status === 'unsupported')
            .map((c) => (
              <p key={c.id} className="mt-3 text-[13px] text-destructive/90">
                {c.label} · {c.reason}
              </p>
            ))}
          {gen.mode === 'example' &&
            scene.clarify.question === '你想打开空调、灯光，还是车窗？' && (
              <div className="mt-5 flex gap-2">
                {['空调', '灯光', '车窗'].map((label) => (
                  <button
                    key={label}
                    onClick={() => gen.submitClarify(label)}
                    className="min-h-11 rounded-xl border border-primary/25 bg-primary/10 px-5 text-[14px] text-primary"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          <div className="mt-6 flex w-full items-center gap-2 rounded-2xl border border-border bg-input-background p-1.5">
            <input
              value={gen.clarifyText}
              onChange={(e) => gen.setClarifyText(e.target.value)}
              aria-label="补充场景信息"
              maxLength={1200}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                  void gen.submitClarify();
              }}
              autoFocus
              placeholder="回答一句，继续刚才的场景…"
              className="flex-1 bg-transparent px-3 py-2 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/50"
            />
            <button
              disabled={!gen.clarifyText.trim()}
              onClick={() => gen.submitClarify()}
              className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-[13px] text-primary-foreground"
            >
              <CornerDownLeft className="h-3.5 w-3.5" /> 继续
            </button>
          </div>
          <button
            onClick={onDiscard}
            className="mt-4 px-4 py-2 text-[13px] text-muted-foreground"
          >
            不用
          </button>
        </div>
      )}

      {drivingCompact && scene && (
        <div data-testid="driving-summary">
          <div className="mb-3 flex items-center gap-1.5 font-mono text-[11px] text-primary/70">
            <Gauge className="h-3.5 w-3.5" />
            行驶中 · 提案已保留
          </div>
          <div className="space-y-2">
            <p className="truncate text-[22px] text-foreground">
              「{scene.name}」
            </p>
            <p className="truncate text-[14px] text-muted-foreground">
              {scene.clarify?.question ||
                scene.actions
                  .map((a) => a.target + ' ' + a.finalValue)
                  .join(' · ') ||
                understanding}
            </p>
            <p className="text-[13px] text-muted-foreground">
              停车后查看、修改与保存
            </p>
          </div>
        </div>
      )}

      {phase === 'error' && error && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3.5"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <div className="text-[14px] text-foreground">{error.message}</div>
              {error.hint && (
                <div className="mt-1 text-[13px] text-muted-foreground">
                  {error.hint}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                {gen.scene && (
                  <button
                    onClick={() => gen.controller.setError('')}
                    className="rounded-lg border border-border px-3 py-2 text-[13px] text-foreground"
                  >
                    返回当前提案
                  </button>
                )}
                {error.canRetry && (
                  <button
                    onClick={gen.retry}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] text-primary-foreground hover:opacity-90"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> 重试
                  </button>
                )}
                {gen.mode === 'example' &&
                  !error.canRetry &&
                  onSwitchToReal && (
                    <button
                      onClick={onSwitchToReal}
                      className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-foreground hover:border-primary/40"
                    >
                      切换到真实 AI
                    </button>
                  )}
              </div>
            </div>
          </div>
          <button
            onClick={onDiscard}
            className="mt-3 text-[13px] text-muted-foreground"
          >
            不用
          </button>
        </div>
      )}
    </div>
  );
}
