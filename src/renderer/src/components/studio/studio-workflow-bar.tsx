import type { StudioWorkflowPrefs } from '@shared/types';
import { AlertDialog, Popover } from 'radix-ui';
import { useState } from 'react';
import { useStudioT } from './studio-strings';
import type { TakeHygiene } from './types';

interface ToggleProps {
  testId: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function WorkflowSwitchRow({ testId, label, description, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      title={description}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-zinc-800/80"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-zinc-100">{label}</span>
        {description ? <span className="text-[11px] leading-snug text-zinc-400">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          checked ? 'border-indigo-400/70 bg-indigo-500/80' : 'border-zinc-700 bg-zinc-800'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

const headerTriggerBtn =
  'rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';

export interface BoothOptionsPopoverProps {
  workflow: StudioWorkflowPrefs;
  onChange: (patch: Partial<StudioWorkflowPrefs>) => void;
  onOpenAudioSettings: () => void;
}

/** Header `Booth Options ▾` popover grouping Recording Behavior & Canvas Display toggles. */
export function BoothOptionsPopover({ workflow, onChange, onOpenAudioSettings }: BoothOptionsPopoverProps) {
  const t = useStudioT();
  const [open, setOpen] = useState(false);
  const isHold = workflow.recordMode === 'hold';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" data-testid="studio-options-btn" className={headerTriggerBtn}>
          {t('header.boothOptions')} ▾
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          data-testid="studio-options-popover"
          className="z-50 w-84 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 shadow-2xl"
        >
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                {t('header.behaviorGroup')}
              </div>
              <div className="mb-1 px-2">
                <button
                  type="button"
                  data-testid="studio-mode-toggle"
                  data-mode={workflow.recordMode}
                  aria-label={`${t('mode.label')}: ${isHold ? t('mode.hold') : t('mode.toggle')}`}
                  title={isHold ? t('mode.holdDescription') : t('mode.toggleDescription')}
                  onClick={() => onChange({ recordMode: isHold ? 'toggle' : 'hold' })}
                  className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-xs font-medium"
                >
                  <span className={`px-2.5 py-1.5 text-center ${isHold ? 'bg-rose-500/85 text-white' : 'text-zinc-400'}`}>
                    {t('mode.hold')}
                  </span>
                  <span className={`px-2.5 py-1.5 text-center ${!isHold ? 'bg-rose-500/85 text-white' : 'text-zinc-400'}`}>
                    {t('mode.toggle')}
                  </span>
                </button>
              </div>
              <WorkflowSwitchRow
                testId="studio-toggle-guide"
                label={t('workflow.guideBgm')}
                description={t('workflow.guideBgmDescription')}
                checked={workflow.guideEnabled}
                onChange={(v) => onChange({ guideEnabled: v })}
              />
              <WorkflowSwitchRow
                testId="studio-toggle-listen-back"
                label={t('workflow.autoListenBack')}
                description={t('workflow.autoListenBackDescription')}
                checked={workflow.autoListenBack}
                onChange={(v) => onChange({ autoListenBack: v })}
              />
              <WorkflowSwitchRow
                testId="studio-toggle-advance"
                label={t('workflow.autoAdvance')}
                description={t('workflow.autoAdvanceDescription')}
                checked={workflow.autoAdvance}
                onChange={(v) => onChange({ autoAdvance: v })}
              />
            </div>

            <div className="border-t border-zinc-800 pt-2.5">
              <div className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                {t('header.displayGroup')}
              </div>
              <WorkflowSwitchRow
                testId="studio-toggle-oto"
                label={t('workflow.otoGrid')}
                description={t('workflow.otoGridDescription')}
                checked={workflow.showOtoGrid}
                onChange={(v) => onChange({ showOtoGrid: v })}
              />
              <WorkflowSwitchRow
                testId="studio-toggle-zoom"
                label={t('workflow.autoZoom')}
                checked={workflow.autoZoomQuietTakes}
                onChange={(v) => onChange({ autoZoomQuietTakes: v })}
              />
            </div>

            <div className="border-t border-zinc-800 pt-2.5">
              <button
                type="button"
                data-testid="studio-audio-settings"
                onClick={() => {
                  setOpen(false);
                  onOpenAudioSettings();
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                {t('workflow.audioSettings')}
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export interface OpenInPopoverProps {
  onRevealFolder: () => void;
  onOpenTool: (tool: 'vlabeler' | 'openutau') => void;
}

/** Header `Open In ▾` menu for Reveal Folder, vLabeler, and OpenUtau handoffs. */
export function OpenInPopover({ onRevealFolder, onOpenTool }: OpenInPopoverProps) {
  const t = useStudioT();
  const [open, setOpen] = useState(false);

  const items: Array<{
    testId: string;
    label: string;
    hint: string;
    onSelect: () => void;
  }> = [
    {
      testId: 'studio-reveal-folder',
      label: t('header.revealFolder'),
      hint: t('header.revealFolderHint'),
      onSelect: onRevealFolder
    },
    {
      testId: 'studio-open-vlabeler',
      label: t('workflow.openVLabeler'),
      hint: t('header.openVLabelerHint'),
      onSelect: () => onOpenTool('vlabeler')
    },
    {
      testId: 'studio-open-openutau',
      label: t('workflow.openOpenUtau'),
      hint: t('header.openOpenUtauHint'),
      onSelect: () => onOpenTool('openutau')
    }
  ];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" data-testid="studio-open-in-btn" className={headerTriggerBtn}>
          {t('header.openIn')} ▾
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          data-testid="studio-open-in-menu"
          className="z-50 w-76 rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-100 shadow-2xl"
        >
          <div className="flex flex-col gap-0.5" role="menu" aria-label={t('header.openIn')}>
            {items.map((item) => (
              <button
                key={item.testId}
                type="button"
                role="menuitem"
                data-testid={item.testId}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-800"
              >
                <span className="text-xs font-medium text-zinc-100">{item.label}</span>
                <span className="text-[11px] text-zinc-400">{item.hint}</span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Header `?` Shortcuts popover replacing the old bottom `<details>` block. */
export function ShortcutsPopover() {
  const t = useStudioT();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-testid="studio-hotkeys-btn"
          aria-label={t('hotkeys.title')}
          title={t('hotkeys.title')}
          className={headerTriggerBtn}
        >
          ? <span className="hidden lg:inline">{t('header.shortcuts')}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          data-testid="studio-hotkeys-popover"
          className="z-50 w-76 rounded-xl border border-zinc-700 bg-zinc-900 p-3.5 text-zinc-100 shadow-2xl"
        >
          <div className="mb-2 text-xs font-semibold text-zinc-200">{t('hotkeys.title')}</div>
          <ul className="flex flex-col gap-1.5 text-xs text-zinc-300">
            <li>{t('hotkeys.record')}</li>
            <li>{t('hotkeys.play')}</li>
            <li>{t('hotkeys.reference')}</li>
            <li>{t('hotkeys.navigate')}</li>
            <li>{t('hotkeys.nextUnrecorded')}</li>
            <li>{t('hotkeys.trash')}</li>
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
  onRevealFolder?: () => void;
}

/** Compact composite workflow controls (preserved export for standalone consumers). */
export function StudioWorkflowBar(props: StudioWorkflowBarProps) {
  const t = useStudioT();
  const actionBtn =
    'rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div data-testid="studio-workflow-bar" className="flex flex-wrap items-center gap-2">
      <BoothOptionsPopover
        workflow={props.workflow}
        onChange={props.onChange}
        onOpenAudioSettings={props.onOpenAudioSettings}
      />
      <OpenInPopover
        onRevealFolder={() => props.onRevealFolder?.()}
        onOpenTool={props.onOpenTool}
      />
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
    </div>
  );
}

/** Non-blocking clipping / early-cutoff / quiet-take hygiene badges for the latest take. */
export function TakeHygieneBadges({ hygiene }: { hygiene: TakeHygiene | null }) {
  const t = useStudioT();
  const showQuiet = Boolean(hygiene && hygiene.quiet && !hygiene.clipped);
  if (!hygiene || (!hygiene.clipped && !hygiene.earlyCutoffWarning && !showQuiet)) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2" role="status" aria-live="polite">
      {hygiene.clipped ? (
        <span data-testid="studio-warning-clipping" className="rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300">
          ⚠ {t('warnings.clipping')}
        </span>
      ) : null}
      {hygiene.earlyCutoffWarning ? (
        <span data-testid="studio-warning-cutoff" className="rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-200">
          ⚠ {t('warnings.earlyCutoff')}
        </span>
      ) : null}
      {showQuiet ? (
        <span data-testid="studio-warning-quiet" className="rounded-md bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-200">
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
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <AlertDialog.Content
          data-testid="studio-trash-dialog"
          className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100 shadow-2xl"
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
