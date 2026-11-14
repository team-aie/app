import type {
  AieProjectManifest,
  AppSettings,
  ParsedRecordingListBundle,
  RecordingSetConfig,
  ReclistEntry,
  StudioWorkflowPrefs
} from '@shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultStudioAudioAdapter } from './defaultAudioAdapter';
import { LiveVisualFeed } from './liveVisualFeed';
import { analyzeTake, clampIndex, findNextUnrecordedIndex, joinPath, otoEntriesForFile } from './studioMath';
import type { StudioTranslate } from './studioStrings';
import type {
  PlaybackClock,
  StudioAudioAdapter,
  StudioTakeBuffer,
  StudioTransportPhase,
  TakeHygiene
} from './types';

export interface StudioStatus {
  tone: 'info' | 'success' | 'error';
  text: string;
}

export interface UseStudioSessionArgs {
  manifest: AieProjectManifest;
  activeSet: RecordingSetConfig;
  bundle: ParsedRecordingListBundle;
  initialRecordedFiles: string[];
  settings: AppSettings;
  workflow: StudioWorkflowPrefs;
  audioAdapter?: StudioAudioAdapter;
  onCursorChange?: (index: number) => void;
  t: StudioTranslate;
}

const STATUS_CLEAR_MS = 4000;

function bridge() {
  return typeof window !== 'undefined' ? window.aie : undefined;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Recording Studio controller: transport phases, in-memory takes, save / listen-back /
 * auto-advance pipeline, undo retake, trash, directory watching and navigation.
 */
export function useStudioSession(args: UseStudioSessionArgs) {
  const { manifest, activeSet, bundle, settings, t } = args;
  const entries = bundle.entries;

  const ownsAdapter = !args.audioAdapter;
  const adapter = useMemo(
    () => args.audioAdapter ?? createDefaultStudioAudioAdapter(),
    [args.audioAdapter]
  );
  const feed = useMemo(() => new LiveVisualFeed(), []);

  const relativeDirectory = activeSet.targetLocation === 'root' ? '' : activeSet.subfolderName;
  const directoryPath = joinPath(manifest.rootPath, relativeDirectory);

  const [cursor, setCursorState] = useState(() => clampIndex(activeSet.lastCursorIndex, entries.length));
  const [phase, setPhaseState] = useState<StudioTransportPhase>('idle');
  const [isTonePlaying, setTonePlaying] = useState(false);
  const [recorded, setRecorded] = useState<Set<string>>(() => new Set(args.initialRecordedFiles));
  const [takes, setTakes] = useState<Map<string, StudioTakeBuffer>>(() => new Map());
  const [durations, setDurations] = useState<Map<string, number>>(() => new Map());
  const [playback, setPlayback] = useState<PlaybackClock | null>(null);
  const [hygiene, setHygiene] = useState<TakeHygiene | null>(null);
  const [undoTarget, setUndoTarget] = useState<string | null>(null);
  const [pendingTrash, setPendingTrash] = useState<string | null>(null);
  const [status, setStatusState] = useState<StudioStatus | null>(null);

  // Synchronous mirrors for event-driven callbacks.
  const phaseRef = useRef<StudioTransportPhase>('idle');
  const cursorRef = useRef(cursor);
  const takesRef = useRef(takes);
  const recordedRef = useRef(recorded);
  const workflowRef = useRef(args.workflow);
  workflowRef.current = args.workflow;
  const onCursorChangeRef = useRef(args.onCursorChange);
  onCursorChangeRef.current = args.onCursorChange;
  const startPromiseRef = useRef<Promise<boolean> | null>(null);
  const recordingFileRef = useRef<string | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  const setPhase = useCallback((next: StudioTransportPhase) => {
    phaseRef.current = next;
    if (mountedRef.current) setPhaseState(next);
  }, []);

  const updateTakes = useCallback((mutate: (m: Map<string, StudioTakeBuffer>) => void) => {
    const next = new Map(takesRef.current);
    mutate(next);
    takesRef.current = next;
    setTakes(next);
  }, []);

  const updateRecorded = useCallback((mutate: (s: Set<string>) => void) => {
    const next = new Set(recordedRef.current);
    mutate(next);
    recordedRef.current = next;
    setRecorded(next);
  }, []);

  const showStatus = useCallback((next: StudioStatus | null) => {
    if (!mountedRef.current) return;
    setStatusState(next);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = null;
    if (next && next.tone !== 'error') {
      statusTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setStatusState(null);
      }, STATUS_CLEAR_MS);
    }
  }, []);

  const cancelAdvance = useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = null;
  }, []);

  const fileParams = useCallback(
    (fileName: string) => ({ projectRootPath: manifest.rootPath, relativeDirectory, fileName }),
    [manifest.rootPath, relativeDirectory]
  );

  // ---------------------------------------------------------------- navigation
  const setCursor = useCallback(
    (index: number) => {
      if (phaseRef.current === 'recording' || phaseRef.current === 'saving') return;
      if (entries.length === 0) return;
      const next = clampIndex(index, entries.length);
      cancelAdvance();
      if (phaseRef.current === 'playing') {
        adapter.stopPlayback();
        setPlayback(null);
        setPhase('idle');
      }
      if (next === cursorRef.current) return;
      cursorRef.current = next;
      setCursorState(next);
      setHygiene(null);
      onCursorChangeRef.current?.(next);
    },
    [adapter, cancelAdvance, entries.length, setPhase]
  );

  const goPrevious = useCallback(() => setCursor(cursorRef.current - 1), [setCursor]);
  const goNext = useCallback(() => setCursor(cursorRef.current + 1), [setCursor]);
  const goNextUnrecorded = useCallback(() => {
    const idx = findNextUnrecordedIndex(entries, cursorRef.current, recordedRef.current);
    if (idx === null) {
      showStatus({ tone: 'success', text: t('status.allRecorded') });
      return;
    }
    setCursor(idx);
  }, [entries, setCursor, showStatus, t]);

  // ---------------------------------------------------------------- playback
  const loadTake = useCallback(
    async (fileName: string): Promise<StudioTakeBuffer | null> => {
      const cached = takesRef.current.get(fileName);
      if (cached) return cached;
      const api = bridge();
      if (!api || !recordedRef.current.has(fileName)) return null;
      try {
        const loaded = await api.audioFile.readTakeSamples(fileParams(fileName));
        if (!loaded || !mountedRef.current) return null;
        updateTakes((m) => m.set(fileName, loaded));
        setDurations((d) => new Map(d).set(fileName, (loaded.samples.length / loaded.sampleRate) * 1000));
        return loaded;
      } catch {
        return null;
      }
    },
    [fileParams, updateTakes]
  );

  const playFile = useCallback(
    async (fileName: string, onEnded?: () => void) => {
      const take = await loadTake(fileName);
      if (!take || take.samples.length === 0) return false;
      if (phaseRef.current === 'recording' || phaseRef.current === 'saving') return false;
      adapter.stopPlayback();
      setPhase('playing');
      setPlayback({
        startedAtMs: performance.now(),
        durationMs: (take.samples.length / take.sampleRate) * 1000
      });
      try {
        await adapter.playSamples(take.samples, take.sampleRate, {
          outputDeviceId: settings.outputDeviceId || undefined,
          onEnded: () => {
            if (phaseRef.current !== 'playing') return;
            setPlayback(null);
            setPhase('idle');
            onEnded?.();
          }
        });
        return true;
      } catch (err) {
        setPlayback(null);
        setPhase('idle');
        showStatus({ tone: 'error', text: t('status.playbackFailed', { error: errorMessage(err) }) });
        return false;
      }
    },
    [adapter, loadTake, setPhase, settings.outputDeviceId, showStatus, t]
  );

  const stopPlayback = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    adapter.stopPlayback();
    setPlayback(null);
    setPhase('idle');
  }, [adapter, setPhase]);

  const togglePlayback = useCallback(() => {
    if (phaseRef.current === 'playing') {
      cancelAdvance();
      stopPlayback();
      return;
    }
    if (phaseRef.current !== 'idle') return;
    const entry = entries[cursorRef.current];
    if (entry) void playFile(entry.fileName);
  }, [cancelAdvance, entries, playFile, stopPlayback]);

  // ---------------------------------------------------------------- recording
  const scheduleAdvance = useCallback(
    (fromIndex: number) => {
      cancelAdvance();
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        if (phaseRef.current !== 'idle' || cursorRef.current !== fromIndex) return;
        if (fromIndex >= entries.length - 1) {
          if (findNextUnrecordedIndex(entries, fromIndex, recordedRef.current) === null) {
            showStatus({ tone: 'success', text: t('status.allRecorded') });
          }
          return;
        }
        setCursor(fromIndex + 1);
      }, Math.max(0, workflowRef.current.autoAdvanceDelayMs));
    },
    [cancelAdvance, entries, setCursor, showStatus, t]
  );

  const startRecording = useCallback((): boolean => {
    if (phaseRef.current === 'recording' || phaseRef.current === 'saving') return false;
    const entry = entries[cursorRef.current];
    if (!entry) return false;
    cancelAdvance();
    if (phaseRef.current === 'playing') {
      adapter.stopPlayback();
      setPlayback(null);
    }
    recordingFileRef.current = entry.fileName;
    feed.reset();
    setHygiene(null);
    setPhase('recording');
    const wf = workflowRef.current;
    startPromiseRef.current = adapter
      .startRecording({
        inputDeviceId: settings.inputDeviceId || undefined,
        outputDeviceId: settings.outputDeviceId || undefined,
        sampleRate: settings.wavFormat.sampleRate,
        targetNote: activeSet.scale,
        guide: wf.guideEnabled ? activeSet.guideAudio : { kind: 'none' },
        onTelemetry: (frame) => feed.push(frame)
      })
      .then(
        () => true,
        (err: unknown) => {
          const name = err instanceof Error ? err.name : '';
          const text =
            name === 'NotAllowedError' || name === 'SecurityError'
              ? t('warnings.micPermissionDenied')
              : name === 'NotFoundError' || name === 'OverconstrainedError'
                ? t('warnings.noMicrophone')
                : t('status.recordFailed', { error: errorMessage(err) });
          showStatus({ tone: 'error', text });
          setPhase('idle');
          return false;
        }
      );
    return true;
  }, [activeSet.guideAudio, activeSet.scale, adapter, cancelAdvance, entries, feed, setPhase, settings, showStatus, t]);

  const stopRecording = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;
    setPhase('saving');
    const started = (await startPromiseRef.current) ?? false;
    startPromiseRef.current = null;
    if (!started) {
      setPhase('idle');
      return;
    }
    let take: StudioTakeBuffer | null = null;
    try {
      take = await adapter.stopRecording();
    } catch (err) {
      showStatus({ tone: 'error', text: t('status.saveFailed', { error: errorMessage(err) }) });
    }
    const fileName = recordingFileRef.current;
    recordingFileRef.current = null;
    if (!take || take.samples.length === 0 || !fileName || !mountedRef.current) {
      setPhase('idle');
      return;
    }
    // 0 ms review transition: render straight from the in-memory buffer.
    const capturedTake = take;
    updateTakes((m) => m.set(fileName, capturedTake));
    const local = analyzeTake(fileName, take.samples, take.sampleRate);

    let canUndo = false;
    let verdict: TakeHygiene = local;
    const api = bridge();
    if (api) {
      try {
        const summary = await api.audioFile.saveTake({
          ...fileParams(fileName),
          samples: take.samples,
          format: settings.wavFormat
        });
        canUndo = summary.canUndoPreviousTake;
        verdict = {
          ...local,
          peakDb: summary.peakDb,
          clipped: summary.clipped,
          earlyCutoffWarning: summary.earlyCutoffWarning,
          durationMs: summary.durationMs
        };
      } catch (err) {
        if (!mountedRef.current) return;
        showStatus({ tone: 'error', text: t('status.saveFailed', { error: errorMessage(err) }) });
        setPhase('idle');
        return;
      }
    }
    if (!mountedRef.current) return;
    updateRecorded((s) => s.add(fileName));
    setDurations((d) => new Map(d).set(fileName, verdict.durationMs));
    setHygiene(verdict);
    setUndoTarget(canUndo ? fileName : null);
    showStatus({ tone: 'success', text: t('status.saved', { fileName }) });
    setPhase('idle');

    // Auto-Listen-Back → Auto-Advance pipeline (advance only after clean takes).
    const wf = workflowRef.current;
    const clean = !verdict.clipped && !verdict.earlyCutoffWarning;
    const recordedIndex = cursorRef.current;
    const advance = () => {
      if (workflowRef.current.autoAdvance && clean) scheduleAdvance(recordedIndex);
    };
    if (wf.autoListenBack) {
      const played = await playFile(fileName, advance);
      if (!played) advance();
    } else {
      advance();
    }
  }, [adapter, fileParams, playFile, scheduleAdvance, setPhase, settings.wavFormat, showStatus, t, updateRecorded, updateTakes]);

  // ---------------------------------------------------------------- reference tone
  const startTone = useCallback((): boolean => {
    setTonePlaying(true);
    adapter
      .startReferenceTone({ note: activeSet.scale, outputDeviceId: settings.outputDeviceId || undefined })
      .catch(() => {
        if (mountedRef.current) setTonePlaying(false);
      });
    return true;
  }, [activeSet.scale, adapter, settings.outputDeviceId]);

  const stopTone = useCallback(() => {
    adapter.stopReferenceTone();
    setTonePlaying(false);
  }, [adapter]);

  // ---------------------------------------------------------------- trash / undo
  const currentEntry: ReclistEntry | null = entries[cursor] ?? null;
  const currentFile = currentEntry?.fileName ?? null;
  const currentIsRecorded = currentFile !== null && recorded.has(currentFile);

  const requestTrash = useCallback(() => {
    if (phaseRef.current === 'recording' || phaseRef.current === 'saving') return;
    const entry = entries[cursorRef.current];
    if (!entry || !recordedRef.current.has(entry.fileName)) return;
    cancelAdvance();
    stopPlayback();
    setPendingTrash(entry.fileName);
  }, [cancelAdvance, entries, stopPlayback]);

  const cancelTrash = useCallback(() => setPendingTrash(null), []);

  const confirmTrash = useCallback(async () => {
    const fileName = pendingTrash;
    setPendingTrash(null);
    if (!fileName) return;
    try {
      await bridge()?.audioFile.trashTake(fileParams(fileName));
    } catch (err) {
      showStatus({ tone: 'error', text: t('status.trashFailed', { error: errorMessage(err) }) });
      return;
    }
    if (!mountedRef.current) return;
    updateRecorded((s) => s.delete(fileName));
    updateTakes((m) => m.delete(fileName));
    setDurations((d) => {
      const next = new Map(d);
      next.delete(fileName);
      return next;
    });
    setHygiene(null);
    setUndoTarget((u) => (u === fileName ? null : u));
    showStatus({ tone: 'info', text: t('workflow.trashTakeDone', { fileName }) });
  }, [fileParams, pendingTrash, showStatus, t, updateRecorded, updateTakes]);

  const undoRetake = useCallback(async () => {
    const fileName = undoTarget;
    const api = bridge();
    if (!fileName || !api || phaseRef.current === 'recording' || phaseRef.current === 'saving') {
      showStatus({ tone: 'info', text: t('workflow.undoRetakeUnavailable') });
      return;
    }
    stopPlayback();
    cancelAdvance();
    let restored = false;
    try {
      restored = await api.audioFile.undoLastRetake(fileParams(fileName));
    } catch {
      restored = false;
    }
    if (!mountedRef.current) return;
    setUndoTarget(null);
    if (restored) {
      // Drop the in-memory buffer; the review loader re-reads the restored file.
      updateTakes((m) => m.delete(fileName));
      setHygiene(null);
      showStatus({ tone: 'success', text: t('workflow.undoRetakeDone') });
    } else {
      showStatus({ tone: 'info', text: t('workflow.undoRetakeUnavailable') });
    }
  }, [cancelAdvance, fileParams, showStatus, stopPlayback, t, undoTarget, updateTakes]);

  // ---------------------------------------------------------------- shell handoffs
  const revealEntry = useCallback(
    (entry: ReclistEntry) => {
      void bridge()?.shell.revealInFileManager(joinPath(directoryPath, entry.fileName));
    },
    [directoryPath]
  );

  const openTool = useCallback(
    async (tool: 'vlabeler' | 'openutau') => {
      const api = bridge();
      if (!api) return;
      const toolName = tool === 'vlabeler' ? 'vLabeler' : 'OpenUtau';
      try {
        const result = await api.shell.openInExternalTool({ tool, projectRootPath: manifest.rootPath });
        if (!result.ok) {
          showStatus({ tone: 'error', text: t('status.openToolFailed', { tool: toolName, error: result.error ?? '' }) });
        }
      } catch (err) {
        showStatus({ tone: 'error', text: t('status.openToolFailed', { tool: toolName, error: errorMessage(err) }) });
      }
    },
    [manifest.rootPath, showStatus, t]
  );

  // ---------------------------------------------------------------- effects
  // Lazy-load the current take from disk for review when it is not in memory.
  useEffect(() => {
    if (!currentFile || !currentIsRecorded || takes.has(currentFile)) return;
    if (loadingRef.current.has(currentFile)) return;
    loadingRef.current.add(currentFile);
    void loadTake(currentFile).finally(() => loadingRef.current.delete(currentFile));
  }, [currentFile, currentIsRecorded, loadTake, takes]);

  // Quietly mirror external edits (vLabeler / Finder) into recorded badges.
  useEffect(() => {
    const api = bridge();
    if (!api?.audioFile.watchDirectory) return;
    const unsubscribe = api.audioFile.watchDirectory(directoryPath, (names) => {
      if (!mountedRef.current) return;
      const next = new Set(names);
      const prev = recordedRef.current;
      const same = prev.size === next.size && [...prev].every((n) => next.has(n));
      if (same) return;
      // Never drop the take being captured/saved right now.
      if (recordingFileRef.current && prev.has(recordingFileRef.current)) next.add(recordingFileRef.current);
      recordedRef.current = next;
      setRecorded(next);
      const stale = [...takesRef.current.keys()].filter((k) => !next.has(k));
      if (stale.length > 0) updateTakes((m) => stale.forEach((k) => m.delete(k)));
    });
    return () => unsubscribe?.();
  }, [directoryPath, updateTakes]);

  // Teardown.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      adapter.stopPlayback();
      adapter.stopReferenceTone();
      if (phaseRef.current === 'recording' || phaseRef.current === 'saving') {
        void adapter.stopRecording().catch(() => undefined);
      }
      if (ownsAdapter) adapter.dispose?.();
    };
  }, [adapter, ownsAdapter]);

  const currentOto = useMemo(
    () => (currentFile ? otoEntriesForFile(bundle.otoEntries, currentFile) : []),
    [bundle.otoEntries, currentFile]
  );

  return {
    feed,
    entries,
    cursor,
    currentEntry,
    currentOto,
    currentTake: currentFile ? (takes.get(currentFile) ?? null) : null,
    currentIsRecorded,
    phase,
    isRecording: phase === 'recording',
    isPlaying: phase === 'playing',
    isTonePlaying,
    recorded,
    durations,
    playback,
    hygiene,
    canUndo: undoTarget !== null && undoTarget === currentFile,
    pendingTrash,
    status,
    setCursor,
    goPrevious,
    goNext,
    goNextUnrecorded,
    startRecording,
    stopRecording,
    togglePlayback,
    startTone,
    stopTone,
    requestTrash,
    cancelTrash,
    confirmTrash,
    undoRetake,
    revealEntry,
    openTool
  };
}

export type StudioSession = ReturnType<typeof useStudioSession>;
