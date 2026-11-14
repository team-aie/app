import type { StudioWorkflowPrefs } from '@shared/types';
import { useCallback, useEffect, useState } from 'react';
import { PromptStage } from './PromptStage';
import { StudioCanvas } from './StudioCanvas';
import { StudioSidebar } from './StudioSidebar';
import { StudioWorkflowBar, TakeHygieneBadges, TrashTakeDialog } from './StudioWorkflowBar';
import { useStudioT } from './studioStrings';
import type { RecordingStudioProps } from './types';
import { useStudioHotkeys } from './useStudioHotkeys';
import { useStudioSession } from './useStudioSession';

/** Screen 3: The Recording Studio. */
export function RecordingStudioScreen(props: RecordingStudioProps) {
  const t = useStudioT();
  const { manifest, activeSet, settings, onUpdateWorkflow } = props;

  // Local mirror so toggles react instantly even before the store round-trips.
  const [workflow, setWorkflow] = useState<StudioWorkflowPrefs>(settings.workflow);
  useEffect(() => setWorkflow(settings.workflow), [settings.workflow]);
  const updateWorkflow = useCallback(
    (patch: Partial<StudioWorkflowPrefs>) => {
      setWorkflow((w) => ({ ...w, ...patch }));
      onUpdateWorkflow(patch);
    },
    [onUpdateWorkflow]
  );

  const session = useStudioSession({
    manifest,
    activeSet,
    bundle: props.bundle,
    initialRecordedFiles: props.initialRecordedFiles,
    settings,
    workflow,
    audioAdapter: props.audioAdapter,
    onCursorChange: props.onCursorChange,
    t
  });

  useStudioHotkeys({
    mode: workflow.recordMode,
    enabled: session.pendingTrash === null,
    isRecording: session.isRecording,
    isTonePlaying: session.isTonePlaying,
    onRecordStart: session.startRecording,
    onRecordStop: () => void session.stopRecording(),
    onTogglePlayback: session.togglePlayback,
    onToneStart: session.startTone,
    onToneStop: session.stopTone,
    onPrevious: session.goPrevious,
    onNext: session.goNext,
    onNextUnrecorded: session.goNextUnrecorded,
    onTrash: session.requestTrash
  });

  const { entries, cursor, phase } = session;
  const navLocked = phase === 'recording' || phase === 'saving';
  const btn =
    'rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div data-testid="studio-screen" data-phase={phase} className="flex h-screen min-h-0 bg-zinc-950 text-zinc-100">
      <StudioSidebar
        entries={entries}
        cursor={cursor}
        recorded={session.recorded}
        durations={session.durations}
        onSelect={session.setCursor}
        onReveal={session.revealEntry}
        navigationLocked={navLocked}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" data-testid="studio-back-btn" onClick={props.onBackToProject} className={btn} disabled={navLocked}>
              ← {t('backToProject')}
            </button>
            <h1 className="text-lg font-semibold">{t('title')}</h1>
            <span className="text-sm text-zinc-400">
              {manifest.name} · {activeSet.name}
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            {workflow.recordMode === 'hold' ? t('transport.holdToRecord') : t('transport.pressToToggle')}
          </span>
        </header>

        <PromptStage
          previous={entries[cursor - 1] ?? null}
          current={session.currentEntry}
          next={entries[cursor + 1] ?? null}
          index={cursor}
          total={entries.length}
          isRecorded={session.currentIsRecorded}
        />

        <StudioCanvas
          isLive={session.isRecording}
          feed={session.feed}
          take={session.currentTake}
          targetNote={activeSet.scale}
          otoEntries={session.currentOto}
          showOtoGrid={workflow.showOtoGrid}
          autoZoomQuietTakes={workflow.autoZoomQuietTakes}
          playback={session.playback}
        />

        <div className="flex flex-wrap items-center gap-2" data-testid="studio-transport">
          <button
            type="button"
            data-testid="studio-prev-btn"
            onClick={session.goPrevious}
            disabled={navLocked || cursor <= 0}
            className={btn}
            aria-label={t('transport.previous')}
            title={t('transport.previous')}
          >
            ◀
          </button>
          <button
            type="button"
            data-testid="studio-record-btn"
            aria-pressed={session.isRecording}
            disabled={phase === 'saving' || entries.length === 0}
            onClick={() => (session.isRecording ? void session.stopRecording() : session.startRecording())}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
              session.isRecording ? 'animate-pulse bg-red-600' : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            ● {session.isRecording ? t('transport.stopRecording') : t('transport.record')}
          </button>
          <button
            type="button"
            data-testid="studio-play-btn"
            aria-pressed={session.isPlaying}
            disabled={navLocked || !session.currentIsRecorded}
            onClick={session.togglePlayback}
            className={btn}
          >
            {session.isPlaying ? `■ ${t('transport.stop')}` : `▶ ${t('transport.play')}`}
          </button>
          <button
            type="button"
            data-testid="studio-scale-btn"
            aria-pressed={session.isTonePlaying}
            onClick={() => (session.isTonePlaying ? session.stopTone() : session.startTone())}
            className={`${btn} ${session.isTonePlaying ? 'border-indigo-400 bg-indigo-500/20' : ''}`}
            title={t('transport.referenceToneHint', { note: activeSet.scale })}
          >
            ♪ {t('transport.referenceTone')} · {activeSet.scale}
          </button>
          <button
            type="button"
            data-testid="studio-next-btn"
            onClick={session.goNext}
            disabled={navLocked || cursor >= entries.length - 1}
            className={btn}
            aria-label={t('transport.next')}
            title={t('transport.next')}
          >
            ▶
          </button>
          <button
            type="button"
            data-testid="studio-next-unrecorded-btn"
            onClick={session.goNextUnrecorded}
            disabled={navLocked}
            className={btn}
          >
            {t('transport.nextUnrecorded')} (N)
          </button>
        </div>

        <StudioWorkflowBar
          workflow={workflow}
          onChange={updateWorkflow}
          canUndo={session.canUndo && !navLocked}
          canTrash={session.currentIsRecorded && !navLocked}
          onUndo={() => void session.undoRetake()}
          onTrash={session.requestTrash}
          onOpenTool={(tool) => void session.openTool(tool)}
          onOpenAudioSettings={props.onOpenAudioSettings}
        />

        <TakeHygieneBadges hygiene={session.hygiene} />

        {session.status ? (
          <div
            data-testid="studio-status"
            role={session.status.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-md px-3 py-2 text-sm ${
              session.status.tone === 'error'
                ? 'bg-red-500/15 text-red-200'
                : session.status.tone === 'success'
                  ? 'bg-emerald-500/10 text-emerald-200'
                  : 'bg-zinc-800 text-zinc-200'
            }`}
          >
            {session.status.text}
          </div>
        ) : null}

        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer select-none">{t('hotkeys.title')}</summary>
          <ul className="mt-2 grid grid-cols-2 gap-1">
            <li>{t('hotkeys.record')}</li>
            <li>{t('hotkeys.play')}</li>
            <li>{t('hotkeys.reference')}</li>
            <li>{t('hotkeys.navigate')}</li>
            <li>{t('hotkeys.nextUnrecorded')}</li>
            <li>{t('hotkeys.trash')}</li>
          </ul>
        </details>
      </main>

      <TrashTakeDialog
        fileName={session.pendingTrash}
        onCancel={session.cancelTrash}
        onConfirm={() => void session.confirmTrash()}
      />
    </div>
  );
}
