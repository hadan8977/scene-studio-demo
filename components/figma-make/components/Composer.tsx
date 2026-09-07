import { motion } from 'motion/react';
import { ArrowUp, Gauge } from 'lucide-react';
import { SceneFields } from './SceneFields';
import { SceneCard } from './SceneCard';
import { ExperiencePanel, DuplicatePanel } from './ExperiencePanel';
import type { Generation } from '../useGeneration';
export function Orb({ active, size = 48 }: { active: boolean; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(205,236,82,0.95),rgba(205,236,82,0.08),rgba(205,236,82,0.95))] blur-[4px]"
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
      <div className="absolute inset-[7px] rounded-full bg-card" />
      <div className="absolute inset-[12px] rounded-full bg-primary/40" />
    </div>
  );
}
export function Composer({
  gen,
  onSwitchToReal,
  onDiscard = gen.reset,
}: {
  gen: Generation;
  onSwitchToReal?: () => void;
  onDiscard?: () => void;
}) {
  const { scene } = gen,
    x = gen.experience;
  if (gen.phase === 'error')
    return (
      <div className="px-6 pb-6">
        <p className="text-[22px]" role="alert">
          {gen.error?.message}
        </p>
        <button
          className="mt-4 text-[21px] text-primary"
          onClick={gen.mode === 'example' ? onSwitchToReal : gen.retry}
        >
          {gen.mode === 'example' ? '连接 AI' : '重试'}
        </button>
      </div>
    );
  if (
    x.application !== 'idle' ||
    (x.route?.kind === 'suggestion' && x.presentation !== 'proposal')
  )
    return (
      <>
        <ExperiencePanel gen={gen} />
        <DuplicatePanel gen={gen} />
      </>
    );
  if (gen.phase === 'thinking')
    return (
      <div className="flex items-center justify-center gap-4 px-6 py-10">
        <Orb active />
        <output className="text-[22px]">
          {gen.slow ? '还需要一点时间…' : '正在准备…'}
        </output>
      </div>
    );
  if (!scene)
    return (
      <p className="px-6 pb-6 text-[23px]">
        {x.route?.question ||
          x.feedback.replace(/（演示）/g, '') ||
          x.route?.reply}
      </p>
    );
  if (gen.driving === 'driving')
    return (
      <div data-testid="driving-summary" className="space-y-3 px-6 pb-6">
        <Gauge className="h-5 w-5 text-primary" />
        <p className="text-[28px]">{scene.name}</p>
        <p className="text-[21px] text-muted-foreground">
          {scene.actions.map((a) => `${a.target} ${a.finalValue}`).join(' · ')}
        </p>
        <p className="text-[20px] text-primary">停车后继续</p>
      </div>
    );
  if (scene.clarify)
    return (
      <div className="px-6 pb-6">
        <h2 className="text-[25px]">{scene.clarify.question}</h2>
        <div className="mt-5 flex rounded-xl bg-secondary p-2">
          <input
            aria-label="补充场景信息"
            value={gen.clarifyText}
            onChange={(e) => gen.setClarifyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                void gen.submitClarify();
            }}
            placeholder="补充一句"
            className="min-w-0 flex-1 bg-transparent px-2 text-[22px] outline-none"
          />
          <button
            aria-label="继续"
            disabled={!gen.clarifyText.trim()}
            onClick={() => gen.submitClarify()}
            className="rounded-xl bg-primary p-3 text-primary-foreground"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  return (
    <>
      <SceneCard
        scene={scene}
        understanding={gen.understanding}
        heard={gen.heard}
        changedIds={gen.changedIds}
        sourceBadge={gen.source}
        saved={gen.saved}
        editing={gen.editing}
        editText={gen.editText}
        onEditText={gen.setEditText}
        onSubmitEdit={(text) => gen.submitEdit(text)}
        onSave={() => gen.handleSave()}
        onEdit={() => gen.setEditing(true)}
        onDiscard={onDiscard}
        editor={<SceneFields gen={gen} />}
        onApply={x.applyOnce}
        confirmApplication={
          gen.saved ||
          (x.route?.kind === 'suggestion' && gen.changedIds.size === 0)
        }
      />
      <DuplicatePanel gen={gen} />
    </>
  );
}
