import { AlertDialog, Checkbox } from 'radix-ui';
import { Check, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecordingSetConfig } from '@shared/types';
import { Button } from '../shell/ui';

/** Safe set removal — `.wav` trashing is strictly opt-in (unchecked by default). */
export function RemoveSetDialog({
  setConfig,
  onCancel,
  onConfirm
}: {
  setConfig: RecordingSetConfig | null;
  onCancel: () => void;
  onConfirm: (setId: string, trashWavFiles: boolean) => Promise<void> | void;
}) {
  const { t } = useTranslation('project');
  const { t: tc } = useTranslation('common');
  const [trashWavs, setTrashWavs] = useState(false);
  const [busy, setBusy] = useState(false);
  const checkboxId = useId();

  useEffect(() => {
    setTrashWavs(false);
    setBusy(false);
  }, [setConfig?.id]);

  return (
    <AlertDialog.Root open={setConfig !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="aie-anim-overlay fixed inset-0 z-40 bg-black/55" />
        <AlertDialog.Content
          data-testid="remove-set-dialog"
          className="aie-anim-dialog fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border border-line bg-panel p-6 shadow-2xl shadow-black/40"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger">
              <Trash2 aria-hidden className="size-4" />
            </span>
            <div className="flex flex-col gap-1.5">
              <AlertDialog.Title className="text-base font-semibold text-fg">
                {t('remove.title', { name: setConfig?.name ?? '' })}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-muted">
                {t('remove.description')}
              </AlertDialog.Description>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-line bg-raised/50 p-3">
            <Checkbox.Root
              id={checkboxId}
              checked={trashWavs}
              onCheckedChange={(checked) => setTrashWavs(checked === true)}
              data-testid="remove-set-trash-checkbox"
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-line-strong bg-sunken data-[state=checked]:border-danger data-[state=checked]:bg-danger"
            >
              <Checkbox.Indicator>
                <Check aria-hidden className="size-3 text-white" strokeWidth={3} />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <label htmlFor={checkboxId} className="flex cursor-pointer flex-col gap-0.5">
              <span className="text-sm font-medium text-fg">{t('remove.trashWavs')}</span>
              <span className="text-xs text-subtle">{t('remove.trashWavsHint')}</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" data-testid="remove-set-cancel">
                {tc('actions.cancel')}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="danger"
              disabled={busy}
              data-testid="remove-set-confirm"
              onClick={() => {
                if (!setConfig) {
                  return;
                }
                setBusy(true);
                void Promise.resolve(onConfirm(setConfig.id, trashWavs)).finally(() => setBusy(false));
              }}
            >
              {t('remove.confirm')}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
