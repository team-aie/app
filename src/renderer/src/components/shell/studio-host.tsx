import { ArrowLeft, Loader2, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScaleNote, StudioWorkflowPrefs } from '@shared/types';
import { createStudioEngineAdapter } from '@renderer/audio';
import { selectActiveSet, useAppStore } from '@renderer/store/use-app-store';
import type { StudioScreenComponent } from './studio-screen-slot';
import { Button, Card } from './ui';

/**
 * Screen 3 host: loads the recording list for the active set from the store
 * and renders whichever studio component is plugged in, wired to the real
 * `StudioAudioEngine` (`AudioWorklet` + `pitchy` f0 + 64-band FFT + sample-clock guide synth).
 */
export function StudioHost({ Screen }: { Screen: StudioScreenComponent }) {
  const { t } = useTranslation('studio');
  const { t: tc } = useTranslation('common');
  const manifest = useAppStore((state) => state.manifest);
  const activeSet = useAppStore(selectActiveSet);
  const studio = useAppStore((state) => state.studio);
  const settings = useAppStore((state) => state.settings);
  const bridge = useAppStore((state) => state.bridge);
  const bridgeAvailable = useAppStore((state) => state.bridgeAvailable);
  const updateWorkflow = useAppStore((state) => state.updateWorkflow);
  const updateCursor = useAppStore((state) => state.updateCursor);
  const changeActiveSetScale = useAppStore((state) => state.changeActiveSetScale);
  const goToProject = useAppStore((state) => state.goToProject);
  const openModal = useAppStore((state) => state.openModal);
  const enterStudio = useAppStore((state) => state.enterStudio);

  const audioAdapter = useMemo(() => createStudioEngineAdapter(), []);
  useEffect(() => () => audioAdapter.dispose(), [audioAdapter]);

  const onUpdateWorkflow = useCallback(
    (patch: Partial<StudioWorkflowPrefs>) => void updateWorkflow(patch),
    [updateWorkflow]
  );
  const onChangeScale = useCallback(
    (scale: ScaleNote) => void changeActiveSetScale(scale),
    [changeActiveSetScale]
  );
  const onRevealProjectFolder = useCallback(() => {
    if (!manifest) {
      return;
    }
    const targetBridge =
      bridgeAvailable || typeof window === 'undefined' || !window.aie ? bridge : window.aie;
    void targetBridge.shell.revealInFileManager(manifest.rootPath).catch(() => undefined);
  }, [bridge, bridgeAvailable, manifest]);
  const onOpenAudioSettings = useCallback(() => openModal('audioSettings'), [openModal]);

  if (!manifest || !activeSet || studio.status === 'idle' || studio.status === 'loading') {
    return (
      <div
        data-testid="studio-loading"
        role="status"
        className="flex flex-1 items-center justify-center gap-2 text-sm text-muted"
      >
        <Loader2 aria-hidden className="size-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  if (studio.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card data-testid="studio-error" className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
          <TriangleAlert aria-hidden className="size-6 text-warn" />
          <p className="text-sm text-fg">{t('loadFailed', { error: studio.error })}</p>
          <div className="flex gap-2">
            <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={goToProject}>
              {t('backToProject')}
            </Button>
            <Button variant="primary" onClick={() => void enterStudio(studio.setId)}>
              {tc('actions.retry')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <Screen
      key={`${manifest.rootPath}::${activeSet.id}`}
      manifest={manifest}
      activeSet={activeSet}
      bundle={studio.bundle}
      initialRecordedFiles={studio.recordedFileNames}
      settings={settings}
      onUpdateWorkflow={onUpdateWorkflow}
      onCursorChange={updateCursor}
      onChangeScale={onChangeScale}
      onRevealProjectFolder={onRevealProjectFolder}
      onBackToProject={goToProject}
      onOpenAudioSettings={onOpenAudioSettings}
      audioAdapter={audioAdapter}
    />
  );
}
