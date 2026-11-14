import type { StudioWorkflowPrefs } from '@shared/types';
import { AlertDialog } from 'radix-ui';
import { useStudioT } from './studioStrings';
import type { TakeHygiene } from './types';

interface ToggleProps {
  testId: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function WorkflowSwitch({ testId, label, description, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      title={description}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        checked
          ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
          : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-2 w-2 rounded-full ${checked ? 'bg-indigo-300' : 'bg-zinc-600'}`}
      />
      {label}
    </button>
  );
}

export interface StudioWorkflowBarProps {
  workflow: StudioWorkflowPrefs;
  onChange: (patch: Partial<StudioWorkflowPrefs>) => void;
  canUndo: boolean;
  canTrash: boolean;
  onUndo: () => void;
  onTrash: () => void;
  onOpenTool: (tool: 'vlabeler' | 'openutau') => void;
  onOpenAudioSettings: () => void;
}

/** Booth workflow toggles + take-management actions. */
export function StudioWorkflowBar(props: StudioWorkflowBarProps) {
  const t = useStudioT();
  const { workflow } = props;
  const isHold = workflow.recordMode === 'hold';
  const actionBtn =
    'rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div data-testid="studio-workflow-bar" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        data-testid="studio-mode-toggle"
        data-mode={workflow.recordMode}
        aria-label={`${t('mode.label')}: ${isHold ? t('mode.hold') : t('mode.toggle')}`}
        title={isHold ? t('mode.holdDescription') : t('mode.toggleDescription')}
        onClick={() => props.onChange({ recordMode: isHold ? 'toggle' : 'hold' })}
        className="flex items-center overflow-hidden rounded-full border border-zinc-700 text-xs"
      >
        <span className={`px-2.5 py-1 ${isHold ? 'bg-rose-500/80 text-white' : 'text-zinc-400'}`}>
          {t('mode.hold')}
        </span>
        <span className={`px-2.5 py-1 ${!isHold ? 'bg-rose-500/80 text-white' : 'text-zinc-400'}`}>
          {t('mode.toggle')}
        </span>
      </button>

      <WorkflowSwitch
        testId="studio-toggle-guide"
        label={t('workflow.guideBgm')}
        description={t('workflow.guideBgmDescription')}
        checked={workflow.guideEnabled}
        onChange={(v) => props.onChange({ guideEnabled: v })}
      />
      <WorkflowSwitch
        testId="studio-toggle-oto"
        label={t('workflow.otoGrid')}
        description={t('workflow.otoGridDescription')}
        checked={workflow.showOtoGrid}
        onChange={(v) => props.onChange({ showOtoGrid: v })}
      />
      <WorkflowSwitch
        testId="studio-toggle-listen-back"
        label={t('workflow.autoListenBack')}
        description={t('workflow.autoListenBackDescription')}
        checked={workflow.autoListenBack}
        onChange={(v) => props.onChange({ autoListenBack: v })}
      />
      <WorkflowSwitch
        testId="studio-toggle-advance"
        label={t('workflow.autoAdvance')}
        description={t('workflow.autoAdvanceDescription')}
        checked={workflow.autoAdvance}
        onChange={(v) => props.onChange({ autoAdvance: v })}
      />
      <WorkflowSwitch
        testId="studio-toggle-zoom"
        label={t('workflow.autoZoom')}
        checked={workflow.autoZoomQuietTakes}
        onChange={(v) => props.onChange({ autoZoomQuietTakes: v })}
      />

      <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden />

      <button
        type="button"
        data-testid="studio-undo-btn"
        disabled={!props.canUndo}
        onClick={props.onUndo}
        className={actionBtn}
        title={props.canUndo ? t('workflow.undoRetake') : t('workflow.undoRetakeUnavailable')}
      >
        ↶ {t('workflow.undoRetake')}
      </button>
      <button
        type="button"
        data-testid="studio-trash-btn"
        disabled={!props.canTrash}
        onClick={props.onTrash}
        className={actionBtn}
      >
        🗑 {t('workflow.trashTake')}
      </button>
      <button type="button" data-testid="studio-open-vlabeler" onClick={() => props.onOpenTool('vlabeler')} className={actionBtn}>
        {t('workflow.openVLabeler')}
      </button>
      <button type="button" data-testid="studio-open-openutau" onClick={() => props.onOpenTool('openutau')} className={actionBtn}>
        {t('workflow.openOpenUtau')}
      </button>
      <button type="button" data-testid="studio-audio-settings" onClick={props.onOpenAudioSettings} className={actionBtn}>
        {t('workflow.audioSettings')}
      </button>
    </div>
  );
}

/** Non-blocking clipping / early-cutoff / quiet-take hygiene badges for the latest take. */
export function TakeHygieneBadges({ hygiene }: { hygiene: TakeHygiene | null }) {
  const t = useStudioT();
  if (!hygiene) return null;
  return (
    <div className="flex flex-wrap gap-2" role="status" aria-live="polite">
      {hygiene.clipped ? (
        <span data-testid="studio-warning-clipping" className="rounded-md bg-red-500/15 px-2.5 py-1 text-xs text-red-300">
          ⚠ {t('warnings.clipping')}
        </span>
      ) : null}
      {hygiene.earlyCutoffWarning ? (
        <span data-testid="studio-warning-cutoff" className="rounded-md bg-amber-500/15 px-2.5 py-1 text-xs text-amber-200">
          ⚠ {t('warnings.earlyCutoff')}
        </span>
      ) : null}
      {hygiene.quiet && !hygiene.clipped ? (
        <span data-testid="studio-warning-quiet" className="rounded-md bg-sky-500/15 px-2.5 py-1 text-xs text-sky-200">
          {t('warnings.quietTake')}
        </span>
      ) : null}
    </div>
  );
}

export interface TrashTakeDialogProps {
  fileName: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Radix confirm for moving a take to the OS Trash (never `window.confirm()`). */
export function TrashTakeDialog({ fileName, onCancel, onConfirm }: TrashTakeDialogProps) {
  const t = useStudioT();
  return (
    <AlertDialog.Root open={fileName !== null} onOpenChange={(open) => (!open ? onCancel() : undefined)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60" />
        <AlertDialog.Content
          data-testid="studio-trash-dialog"
          className="fixed top-1/2 left-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100 shadow-2xl"
        >
          <AlertDialog.Title className="text-base font-semibold">{t('workflow.trashTake')}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-zinc-300">
            {t('workflow.trashTakeConfirm', { fileName: fileName ?? '' })}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <button type="button" data-testid="studio-trash-cancel" className="rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800">
                {t('workflow.cancel')}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                data-testid="studio-trash-confirm"
                onClick={onConfirm}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500"
              >
                {t('workflow.confirmTrash')}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
