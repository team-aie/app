import { Dialog, Switch as RadixSwitch, ToggleGroup } from 'radix-ui';
import { X } from 'lucide-react';
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes
} from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'record';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent-strong shadow-[0_1px_0_rgb(255_255_255/0.15)_inset]',
  secondary: 'bg-raised text-fg border border-line hover:border-line-strong hover:bg-sunken',
  ghost: 'text-muted hover:text-fg hover:bg-raised',
  danger: 'bg-danger text-white hover:opacity-90',
  record: 'bg-rec text-white hover:opacity-90'
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl font-semibold'
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors',
        'hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-45',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

const FIELD_BASE =
  'h-9 w-full rounded-lg border border-line bg-sunken px-3 text-sm text-fg placeholder:text-subtle ' +
  'transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus-visible:outline-none ' +
  'disabled:opacity-50 aria-[invalid=true]:border-danger';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(FIELD_BASE, className)} {...rest} />;
  }
);

export const NativeSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function NativeSelect({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cx(FIELD_BASE, 'cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (ids: { inputId: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Label + control + hint/error with correct aria wiring. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-xs font-medium tracking-wide text-muted">
        {label}
      </label>
      {children({ inputId, describedBy: describedBy || undefined, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'rec';
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-raised text-muted border-line',
  accent: 'bg-accent-soft text-accent border-transparent',
  ok: 'bg-ok-soft text-ok border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  rec: 'bg-rec-soft text-rec border-transparent'
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  mono,
  ...rest
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  mono?: boolean;
  title?: string;
  'data-testid'?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-4 font-semibold',
        mono && 'font-mono',
        BADGE_TONES[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  label,
  tone = 'accent',
  className
}: {
  value: number;
  max: number;
  label: string;
  tone?: 'accent' | 'ok';
  className?: string;
}) {
  const safeMax = Math.max(0, max);
  const clamped = Math.min(Math.max(0, value), safeMax);
  const pct = safeMax === 0 ? 0 : (clamped / safeMax) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-sunken', className)}
    >
      <div
        className={cx(
          'h-full rounded-full transition-[width] duration-500',
          tone === 'ok' ? 'bg-ok' : 'bg-accent'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
  testId?: string;
}

/** Keyboard-accessible single-select segmented control (Radix ToggleGroup). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'sm',
  className
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<SegmentedOption<T>>;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        if (next) {
          onChange(next as T);
        }
      }}
      className={cx('inline-flex items-center rounded-lg border border-line bg-sunken p-0.5', className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          title={option.title}
          aria-label={option.title}
          data-testid={option.testId}
          className={cx(
            'inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-muted transition-colors',
            'hover:text-fg data-[state=on]:bg-raised data-[state=on]:text-fg data-[state=on]:shadow-sm',
            size === 'sm' ? 'h-7 min-w-7 px-2 text-xs' : 'h-8 px-3 text-sm'
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  testId,
  disabled
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  testId?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description ? <p className="text-xs text-subtle">{description}</p> : null}
      </div>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        data-testid={testId}
        className={cx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-line transition-colors',
          'bg-sunken data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50'
        )}
      >
        <RadixSwitch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-fg shadow transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-on-accent" />
      </RadixSwitch.Root>
    </div>
  );
}

/** Centered Radix dialog with consistent booth chrome. */
export function ModalShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
  width = 'max-w-xl',
  testId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
  width?: string;
  testId?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="aie-anim-overlay fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" />
        <Dialog.Content
          data-testid={testId}
          aria-describedby={description ? undefined : undefined}
          className={cx(
            'aie-anim-dialog fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'overflow-hidden rounded-2xl border border-line bg-panel text-fg shadow-2xl shadow-black/40',
            width
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="text-base font-semibold tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton label={closeLabel} className="-mt-1 -mr-2">
                <X className="size-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-line bg-raised/40 px-6 py-3.5">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">{children}</h2>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <div className={cx('rounded-2xl border border-line bg-panel', className)} {...rest}>
      {children}
    </div>
  );
}
