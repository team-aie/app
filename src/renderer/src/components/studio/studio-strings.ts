import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * English fallbacks for every `studio` namespace key used by Screen 3.
 * Mirrors `src/shared/i18n/locales/en-US/studio.json` owned by `i18n-hub-project`,
 * so the Studio renders crisp labels standalone (Vitest) and with the 3-locale bundle.
 */
export const STUDIO_STRINGS_EN = {
  title: 'Recording Studio',
  backToProject: 'Back to Project',
  'transport.record': 'Record',
  'transport.recording': 'Recording…',
  'transport.stopRecording': 'Stop Recording',
  'transport.play': 'Play',
  'transport.playing': 'Playing…',
  'transport.stop': 'Stop',
  'transport.referenceTone': 'Reference Tone',
  'transport.referenceToneHint': 'Hold S to hear {{note}}',
  'transport.holdToRecord': 'Hold R to record',
  'transport.pressToToggle': 'Press R to start / stop recording',
  'transport.previous': 'Previous prompt',
  'transport.next': 'Next prompt',
  'transport.nextUnrecorded': 'Next unrecorded',
  'mode.label': 'Record Mode',
  'mode.hold': 'PTT (Hold R)',
  'mode.toggle': 'Toggle R',
  'mode.holdDescription': 'Recording continues only while R is held down',
  'mode.toggleDescription': 'Press R once to start and again to stop',
  'workflow.autoListenBack': 'Auto-Listen-Back',
  'workflow.autoListenBackDescription': 'Play each take back immediately after it is saved',
  'workflow.autoAdvance': 'Auto-Advance',
  'workflow.autoAdvanceDescription': 'Move to the next prompt after a clean take',
  'workflow.guideBgm': 'Guide BGM',
  'workflow.guideBgmDescription': 'Play the guide metronome or BGM while recording',
  'workflow.otoGrid': 'oto.ini Grid',
  'workflow.otoGridDescription': 'Overlay read-only oto.ini timing markers on the waveform',
  'workflow.autoZoom': 'Auto-Zoom Quiet Takes',
  'workflow.undoRetake': 'Undo Retake',
  'workflow.undoRetakeDone': 'Previous take restored',
  'workflow.undoRetakeUnavailable': 'No previous take to restore',
  'workflow.trashTake': 'Trash Take',
  'workflow.trashTakeConfirm': 'Move {{fileName}} to the Trash?',
  'workflow.trashTakeDone': '{{fileName}} moved to the Trash',
  'workflow.confirmTrash': 'Move to Trash',
  'workflow.cancel': 'Cancel',
  'workflow.openVLabeler': 'Open in vLabeler',
  'workflow.openOpenUtau': 'Open in OpenUtau',
  'workflow.audioSettings': 'Audio Settings',
  'warnings.clipping': 'Clipping detected (0 dBFS) — lower your input gain and retake',
  'warnings.earlyCutoff': 'Early cutoff — the take may have ended before the phrase finished',
  'warnings.quietTake': 'This take is very quiet — move closer to the microphone',
  'warnings.noMicrophone': 'No microphone found. Connect one and check Audio Settings.',
  'warnings.micPermissionDenied':
    'Microphone access was denied. Allow access in your system privacy settings.',
  'prompt.previous': 'Previous',
  'prompt.current': 'Current',
  'prompt.next': 'Next',
  'prompt.fileName': 'File',
  'prompt.hint': 'Pronunciation',
  'prompt.comment': 'Note',
  'prompt.syllables': 'Syllables',
  'prompt.position': '{{current}} / {{total}}',
  'prompt.recorded': 'Recorded',
  'prompt.notRecorded': 'Not recorded',
  'prompt.endOfList': 'End of list',
  'sidebar.title': 'Prompts',
  'sidebar.searchPlaceholder': 'Search prompts, filenames, or hints…',
  'sidebar.filterAll': 'All',
  'sidebar.filterRecorded': 'Recorded',
  'sidebar.filterUnrecorded': 'Unrecorded',
  'sidebar.progress': '{{recorded}} / {{total}} recorded',
  'sidebar.noResults': 'No prompts match your search',
  'sidebar.revealWav': 'Reveal in Finder / Explorer',
  'sidebar.duration': '{{seconds}} s',
  'sidebar.collapse': 'Collapse sidebar',
  'sidebar.expand': 'Expand sidebar',
  'pitch.target': 'Target',
  'pitch.detected': 'Detected',
  'pitch.hz': '{{value}} Hz',
  'pitch.cents': '{{value}} cents',
  'pitch.noPitch': 'No pitch detected',
  'pitch.inTune': 'In tune',
  'pitch.sharp': 'Sharp',
  'pitch.flat': 'Flat',
  'meter.peak': 'Peak',
  'meter.rms': 'RMS',
  'meter.db': '{{value}} dB',
  'canvas.live': 'Live',
  'canvas.review': 'Review',
  'canvas.waveform': 'Waveform',
  'canvas.spectrogram': 'Spectrogram',
  'canvas.pitchCurve': 'Pitch Curve',
  'canvas.empty': 'Press R to record this prompt',
  'canvas.otoOffset': 'Offset',
  'canvas.otoConsonant': 'Consonant',
  'canvas.otoCutoff': 'Cutoff',
  'canvas.otoPreutterance': 'Preutterance',
  'canvas.otoOverlap': 'Overlap',
  'hotkeys.title': 'Keyboard Shortcuts',
  'hotkeys.record': 'R — Record',
  'hotkeys.play': 'Space — Play / Stop',
  'hotkeys.reference': 'S — Reference tone',
  'hotkeys.navigate': '↑ ↓ ← → — Previous / Next prompt',
  'hotkeys.nextUnrecorded': 'N — Next unrecorded prompt',
  'hotkeys.trash': 'Delete — Move take to Trash',
  'status.saved': 'Saved {{fileName}}',
  'status.saveFailed': 'Could not save the take: {{error}}',
  'status.allRecorded': 'Every prompt in this set has been recorded!',
  'status.externalChange': 'Recording folder changed on disk — progress refreshed',
  'status.recordFailed': 'Could not start recording: {{error}}',
  'status.playbackFailed': 'Could not play the take: {{error}}',
  'status.trashFailed': 'Could not move the take to the Trash: {{error}}',
  'status.openToolFailed': 'Could not open {{tool}}: {{error}}'
} as const;

export type StudioStringKey = keyof typeof STUDIO_STRINGS_EN;
export type StudioTranslate = (key: StudioStringKey, vars?: Record<string, string | number>) => string;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

/**
 * `useTranslation('studio')` with English `defaultValue` fallbacks. Any leftover
 * `{{var}}` placeholders are interpolated locally so labels stay crisp even when
 * no i18next instance is initialized (standalone Vitest renders).
 */
export function useStudioT(): StudioTranslate {
  const { t } = useTranslation('studio');
  return useCallback<StudioTranslate>(
    (key, vars) => {
      const defaultValue = STUDIO_STRINGS_EN[key];
      // Cast keeps this wrapper compatible with strict CustomTypeOptions key typing.
      const loose = t as unknown as (k: string, opts: Record<string, unknown>) => unknown;
      const raw = loose(key, { ...vars, defaultValue });
      const text = typeof raw === 'string' && raw.length > 0 && raw !== key ? raw : defaultValue;
      return interpolate(text, vars);
    },
    [t]
  );
}
