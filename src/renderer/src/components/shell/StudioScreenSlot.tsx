import { ArrowLeft, Mic, SlidersHorizontal } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AieProjectManifest,
  AppSettings,
  ParsedRecordingListBundle,
  RecordingSetConfig,
  StudioWorkflowPrefs
} from '@shared/types';
import { Badge, Button, Card, ProgressBar, cx } from './ui';

/**
 * Props contract for Screen 3. Mirrors `RecordingStudioProps` exported by
 * `@renderer/components/studio` (minus the optional `audioAdapter`), so the
 * real `RecordingStudioScreen` is assignable to `StudioScreenComponent`.
 */
export interface StudioScreenProps {
  manifest: AieProjectManifest;
  activeSet: RecordingSetConfig;
  bundle: ParsedRecordingListBundle;
  initialRecordedFiles: string[];
  settings: AppSettings;
  onUpdateWorkflow: (patch: Partial<StudioWorkflowPrefs>) => void;
  onCursorChange?: (index: number) => void;
  onBackToProject: () => void;
  onOpenAudioSettings: () => void;
}

export type StudioScreenComponent = ComponentType<StudioScreenProps>;

/**
 * Standalone placeholder for Screen 3 until the `studio-ui` workstream merges.
 * Stage 3 swaps it for `RecordingStudioScreen` with a single import line in
 * `App.tsx`.
 */
export function StudioScreenSlot({
  activeSet,
  bundle,
  initialRecordedFiles,
  onBackToProject,
  onOpenAudioSettings,
  onCursorChange
}: StudioScreenProps) {
  const { t } = useTranslation('studio');
  const recorded = new Set(initialRecordedFiles.map((name) => name.toLowerCase()));
  const total = bundle.entries.length;
  const cursor = Math.min(Math.max(0, activeSet.lastCursorIndex), Math.max(0, total - 1));
  const current = bundle.entries[cursor];

  return (
    <div data-testid="studio-slot" className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBackToProject}>
          {t('backToProject')}
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <Badge tone="accent" mono>
          {activeSet.scale}
        </Badge>
        <div className="ml-auto">
          <Button
            variant="secondary"
            icon={<SlidersHorizontal className="size-4" />}
            onClick={onOpenAudioSettings}
          >
            {t('workflow.audioSettings')}
          </Button>
        </div>
      </div>
      <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="font-mono text-xs text-subtle">
          {t('prompt.position', { current: total === 0 ? 0 : cursor + 1, total })}
        </span>
        <p data-testid="studio-slot-current" className="text-4xl font-bold tracking-tight">
          {current?.rawPrompt ?? '—'}
        </p>
        {current?.pronunciationHint ? (
          <p className="text-sm text-muted">{current.pronunciationHint}</p>
        ) : null}
        <p className="inline-flex items-center gap-2 text-sm text-subtle">
          <Mic aria-hidden className="size-4" />
          {t('transport.holdToRecord')}
        </p>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{t('sidebar.title')}</span>
          <span>{t('sidebar.progress', { recorded: recorded.size, total })}</span>
        </div>
        <ProgressBar value={recorded.size} max={total} label={t('sidebar.title')} />
        <ol className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {bundle.entries.map((entry) => (
            <li key={entry.index}>
              <button
                type="button"
                onClick={() => onCursorChange?.(entry.index)}
                className={cx(
                  'w-full truncate rounded-md px-2 py-1 text-left font-mono text-xs transition-colors hover:bg-raised',
                  entry.index === cursor ? 'bg-accent-soft text-accent' : 'text-muted',
                  recorded.has(entry.fileName.toLowerCase()) && 'text-ok'
                )}
              >
                {entry.rawPrompt}
              </button>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
