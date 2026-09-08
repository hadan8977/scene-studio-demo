'use client';
import { useEffect, useState } from 'react';
import { LayoutGrid, Radio } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { HmiFrame } from './components/HmiFrame';
import { PopupSurface } from './components/PopupSurface';
import { ManagerSurface } from './components/ManagerSurface';
import { ReviewPanel } from './components/ReviewPanel';
import { useGeneration } from './useGeneration';

type View = 'popup' | 'manager';

const VIEWS: { id: View; label: string; icon: typeof Radio }[] = [
  { id: 'popup', label: '主动服务弹窗', icon: Radio },
  { id: 'manager', label: '场景应用', icon: LayoutGrid },
];

export default function App() {
  const gen = useGeneration();
  const [view, setView] = useState<View>('popup');
  const [review, setReview] = useState(false);

  const openReview = () => setReview(true);
  useEffect(() => {
    if (gen.experience.viewRequest) setView('manager');
  }, [gen.experience.viewRequest]);

  const chrome = (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          onClick={() => setView(v.id)}
          aria-label={v.label}
          aria-pressed={view === v.id}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-[20px] transition-colors ${view === v.id ? 'bg-primary text-primary-foreground' : 'text-white/60 hover:text-white'}`}
        >
          <v.icon className="h-4 w-4" /> {v.label}
        </button>
      ))}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <HmiFrame chrome={chrome}>
        <div className="relative h-full" inert={review}>
          <div hidden={view !== 'popup'} className="h-full">
            <PopupSurface gen={gen} onReview={openReview} />
          </div>
          <div hidden={view !== 'manager'} className="h-full">
            <ManagerSurface
              active={view === 'manager'}
              gen={gen}
              onReview={openReview}
            />
          </div>
        </div>

        <ReviewPanel
          experience={gen.experience}
          open={review}
          onClose={() => setReview(false)}
          mode={gen.mode}
          onModeChange={gen.setMode}
          models={gen.models}
          onRefresh={gen.loadModels}
          loading={gen.catalogLoading}
          connectionNote={gen.connectionNote}
          rawResult={gen.rawResult}
          model={gen.model}
          modelUsed={gen.controller.modelUsed}
          provenance={gen.controller.provenance}
          onModelChange={gen.setModel}
          driving={gen.driving}
          onDrivingChange={gen.setDriving}
          profile={gen.profile}
          removedPrefs={gen.removedPrefs}
          onTogglePref={gen.togglePref}
          connection={gen.connection}
          latency={gen.latency}
          result={gen.result}
        />
        {gen.controller.notice && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-5 z-[80] flex justify-center"
          >
            <div
              className={`rounded-full border px-5 py-2.5 text-[22px] shadow-xl ${gen.controller.notice.error ? 'border-destructive/30 bg-popover text-destructive' : 'border-primary/20 bg-popover text-primary'}`}
            >
              {gen.controller.notice.text}
            </div>
          </div>
        )}
      </HmiFrame>
    </MotionConfig>
  );
}
