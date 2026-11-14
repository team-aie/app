import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NAMESPACES } from '@shared/i18n';
import { useAppStore, type ToastItem } from '@renderer/store/useAppStore';
import { cx } from './ui';

const TOAST_TIMEOUT_MS = 4500;

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle
} as const;

const TONES = {
  info: 'text-accent',
  success: 'text-ok',
  warning: 'text-warn',
  error: 'text-danger'
} as const;

function ToastRow({ toast }: { toast: ToastItem }) {
  const { t } = useTranslation([...NAMESPACES]);
  const dismiss = useAppStore((state) => state.dismissToast);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);
  const Icon = ICONS[toast.kind];
  return (
    <li
      data-testid="toast"
      data-kind={toast.kind}
      className="aie-anim-toast pointer-events-auto flex w-80 items-start gap-3 rounded-xl border border-line bg-panel/95 px-3.5 py-3 text-sm shadow-xl shadow-black/30 backdrop-blur"
    >
      <Icon aria-hidden className={cx('mt-0.5 size-4 shrink-0', TONES[toast.kind])} />
      <p className="min-w-0 flex-1 break-words text-fg">
        {t(toast.messageKey, { ...toast.values })}
      </p>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label={t('actions.dismiss')}
        className="-mt-0.5 -mr-1 rounded-md p-0.5 text-subtle hover:text-fg"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/** Non-blocking booth notification stack. */
export function Toaster() {
  const { t } = useTranslation();
  const toasts = useAppStore((state) => state.toasts);
  return (
    <section
      aria-label={t('toast.region')}
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[60]"
    >
      <ol className="flex flex-col items-end gap-2">
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} />
        ))}
      </ol>
    </section>
  );
}
