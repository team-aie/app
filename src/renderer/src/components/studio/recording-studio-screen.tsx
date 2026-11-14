import { ALL_SCALE_NOTES, scaleNoteToFrequencyHz } from '@shared/music/chromatic';
import type { ScaleNote, StudioWorkflowPrefs } from '@shared/types';
import { useCallback, useEffect, useState } from 'react';
import { PromptStage } from './prompt-stage';
import { StudioCanvas } from './studio-canvas';
import { StudioSidebar } from './studio-sidebar';
import {
  BoothOptionsPopover,
  OpenInPopover,
  ShortcutsPopover,
  TakeHygieneBadges,
  TrashTakeDialog
} from './studio-workflow-bar';
import { useStudioT } from './studio-strings';
import type { RecordingStudioProps } from './types';
import { blurOnPointerClick, useStudioHotkeys } from './use-studio-hotkeys';
import { useStudioSession } from './use-studio-session';

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
  const targetHz = Math.round(scaleNoteToFrequencyHz(activeSet.scale));
  const hasHygieneWarning = Boolean(
    session.hygiene &&
      (session.hygiene.clipped ||
        session.hygiene.earlyCutoffWarning ||
        (session.hygiene.quiet && !session.hygiene.clipped))
  );

  const headerBtn =
    'rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';
  const transportBtn =
    'shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';

  const handleRevealFolder = useCallback(() => {
    if (props.onRevealProjectFolder) {
      props.onRevealProjectFolder();
    } else if (session.currentEntry) {
      session.revealEntry(session.currentEntry);
    }
  }, [props.onRevealProjectFolder, session]);

  return (
    <div
      data-testid="studio-screen"
      data-phase={phase}
      className="flex h-full min-h-0 flex-1 overflow-hidden bg-zinc-950 text-zinc-100"
    >
      <StudioSidebar
        entries={entries}
        cursor={cursor}
        recorded={session.recorded}
        durations={session.durations}
        onSelect={session.setCursor}
        onReveal={session.revealEntry}
        navigationLocked={navLocked}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 overflow-hidden px-5 py-3">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              data-testid="studio-back-btn"
              onClick={props.onBackToProject}
              className={headerBtn}
              disabled={navLocked}
            >
              ← {t('backToProject')}
            </button>
            <div className="flex min-w-0 items-baseline gap-2">
              <h1 className="shrink-0 text-base font-semibold">{t('title')}</h1>
              <span className="truncate text-sm text-zinc-400">
                {manifest.name} · {activeSet.name}
              </span>
            </div>
            <select
              data-testid="studio-target-pitch-select"
              aria-label={t('header.targetPitch')}
              title={t('header.targetPitchHint')}
              value={activeSet.scale}
              disabled={navLocked || !props.onChangeScale}
              onChange={(e) => {
                props.onChangeScale?.(e.target.value as ScaleNote);
                e.currentTarget.blur();
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-indigo-200 hover:bg-zinc-800 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ALL_SCALE_NOTES.map((note) => (
                <option key={note} value={note}>
                  {note} · {Math.round(scaleNoteToFrequencyHz(note))} Hz
                </option>
              ))}
            </select>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              data-testid="studio-mode-badge"
              title={
                workflow.recordMode === 'hold'
                  ? t('transport.holdToRecord')
                  : t('transport.pressToToggle')
              }
              className="hidden rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs text-zinc-400 sm:inline-flex"
            >
              {workflow.recordMode === 'hold' ? t('mode.hold') : t('mode.toggle')}
            </span>
            <BoothOptionsPopover
              workflow={workflow}
              onChange={updateWorkflow}
              onOpenAudioSettings={props.onOpenAudioSettings}
            />
            <OpenInPopover
              onRevealFolder={handleRevealFolder}
              onOpenTool={(tool) => void session.openTool(tool)}
            />
            <ShortcutsPopover />
          </div>
        </header>

        <PromptStage
          previous={entries[cursor - 1] ?? null}
          current={session.currentEntry}
          next={entries[cursor + 1] ?? null}
          index={cursor}
          total={entries.length}
          isRecorded={session.currentIsRecorded}
        />

        {hasHygieneWarning || session.status ? (
          <div
            data-testid="studio-feedback-strip"
            className="flex shrink-0 flex-wrap items-center gap-2"
          >
            <TakeHygieneBadges hygiene={session.hygiene} />
            {session.status ? (
              <div
                data-testid="studio-status"
                role={session.status.tone === 'error' ? 'alert' : 'status'}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
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
          </div>
        ) : null}

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

        <div
          className="flex shrink-0 items-center gap-2 overflow-x-auto"
          data-testid="studio-transport"
        >
          <button
            type="button"
            data-testid="studio-prev-btn"
            onClick={(e) => {
              blurOnPointerClick(e);
              session.goPrevious();
            }}
            disabled={navLocked || cursor <= 0}
            className={transportBtn}
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
            onClick={(e) => {
              blurOnPointerClick(e);
              if (session.isRecording) {
                void session.stopRecording();
              } else {
                session.startRecording();
              }
            }}
            className={`shrink-0 rounded-full px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-40 ${
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
            onClick={(e) => {
              blurOnPointerClick(e);
              session.togglePlayback();
            }}
            className={transportBtn}
          >
            {session.isPlaying ? `■ ${t('transport.stop')}` : `▶ ${t('transport.play')}`}
          </button>
          <button
            type="button"
            data-testid="studio-scale-btn"
            aria-pressed={session.isTonePlaying}
            onClick={(e) => {
              blurOnPointerClick(e);
              if (session.isTonePlaying) {
                session.stopTone();
              } else {
                session.startTone();
              }
            }}
            className={`${transportBtn} ${session.isTonePlaying ? 'border-indigo-400 bg-indigo-500/20' : ''}`}
            title={t('transport.referenceToneHint', { note: `${activeSet.scale} (${targetHz} Hz)` })}
          >
            ♪ {t('transport.referenceTone')} · {activeSet.scale} ({targetHz} Hz)
          </button>
          <button
            type="button"
            data-testid="studio-next-btn"
            onClick={(e) => {
              blurOnPointerClick(e);
              session.goNext();
            }}
            disabled={navLocked || cursor >= entries.length - 1}
            className={transportBtn}
            aria-label={t('transport.next')}
            title={t('transport.next')}
          >
            ▶
          </button>
          <button
            type="button"
            data-testid="studio-next-unrecorded-btn"
            onClick={(e) => {
              blurOnPointerClick(e);
              session.goNextUnrecorded();
            }}
            disabled={navLocked}
            className={transportBtn}
          >
            {t('transport.nextUnrecorded')} (N)
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-testid="studio-undo-btn"
              disabled={!(session.canUndo && !navLocked)}
              onClick={(e) => {
                blurOnPointerClick(e);
                void session.undoRetake();
              }}
              className={transportBtn}
              title={
                session.canUndo && !navLocked
                  ? t('workflow.undoRetake')
                  : t('workflow.undoRetakeUnavailable')
              }
            >
              ↶ {t('workflow.undoRetake')}
            </button>
            <button
              type="button"
              data-testid="studio-trash-btn"
              disabled={!(session.currentIsRecorded && !navLocked)}
              onClick={(e) => {
                blurOnPointerClick(e);
                session.requestTrash();
              }}
              className={transportBtn}
            >
              🗑 {t('workflow.trashTake')}
            </button>
          </div>
        </div>
      </main>

      <TrashTakeDialog
        fileName={session.pendingTrash}
        onCancel={session.cancelTrash}
        onConfirm={() => void session.confirmTrash()}
      />
    </div>
  );
}
