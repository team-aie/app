import { Tabs } from 'radix-ui';
import { ChevronDown, ExternalLink, FileArchive, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OssLicenseEntry } from '@shared/types';
import appIconUrl from '@renderer/assets/app-icon.png';
import { useAppStore } from '@renderer/store/use-app-store';
import { Badge, Button, ModalShell, TextInput, cx } from '../shell/ui';

export const DEVTOOLS_UNLOCK_CLICKS = 5;
export const DEVTOOLS_CLICK_WINDOW_MS = 1500;

/** Counts rapid clicks; fires `onUnlock` on the Nth click within the window. */
export function createClickUnlocker(
  onUnlock: () => void,
  required = DEVTOOLS_UNLOCK_CLICKS,
  windowMs = DEVTOOLS_CLICK_WINDOW_MS,
  now: () => number = () => Date.now()
): () => number {
  let count = 0;
  let last = 0;
  return () => {
    const ts = now();
    count = ts - last > windowMs ? 1 : count + 1;
    last = ts;
    if (count >= required) {
      count = 0;
      onUnlock();
      return required;
    }
    return count;
  };
}

type OssState =
  | { status: 'loading' }
  | { status: 'ready'; entries: OssLicenseEntry[] }
  | { status: 'unavailable' };

const TAB_TRIGGER =
  'relative h-9 px-3 text-sm font-medium text-muted transition-colors hover:text-fg ' +
  'data-[state=active]:text-fg data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 ' +
  'data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-accent';

export function filterOssLicenses(entries: OssLicenseEntry[], query: string): OssLicenseEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return entries;
  }
  return entries.filter((entry) =>
    `${entry.name}\n${entry.license}\n${entry.author}`.toLowerCase().includes(needle)
  );
}

function OssRow({ entry }: { entry: OssLicenseEntry }) {
  const { t } = useTranslation('settings');
  const [expanded, setExpanded] = useState(false);
  const bridge = useAppStore((state) => state.bridge);
  const repoUrl = entry.repository.replace(/^git\+/, '').replace(/\.git$/, '');
  return (
    <li data-testid="oss-row" className="flex flex-col">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            aria-hidden
            className={cx('size-3.5 shrink-0 text-subtle transition-transform', !expanded && '-rotate-90')}
          />
          <span className="truncate text-sm font-medium text-fg">{entry.name}</span>
          <span className="font-mono text-[11px] text-subtle">{entry.version}</span>
          <span className="sr-only">{expanded ? t('about.hideLicense') : t('about.showLicense')}</span>
        </button>
        <Badge mono>{entry.license}</Badge>
        {repoUrl.startsWith('http') ? (
          <button
            type="button"
            onClick={() => void bridge.shell.openExternalUrl(repoUrl)}
            title={t('about.repository')}
            aria-label={`${t('about.repository')} — ${entry.name}`}
            className="rounded p-1 text-subtle hover:text-fg"
          >
            <ExternalLink className="size-3.5" />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <pre className="mx-3 mb-3 max-h-56 overflow-auto rounded-lg border border-line bg-sunken p-3 font-mono text-[11px] whitespace-pre-wrap text-muted">
          {entry.licenseText || t('about.noLicenseText')}
        </pre>
      ) : null}
    </li>
  );
}

export function AboutModal() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const open = useAppStore((state) => state.modals.about);
  const closeModal = useAppStore((state) => state.closeModal);
  const version = useAppStore((state) => state.version);
  const bridge = useAppStore((state) => state.bridge);
  const builtins = useAppStore((state) => state.builtinReclists);
  const pushToast = useAppStore((state) => state.pushToast);

  const [oss, setOss] = useState<OssState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const unlockerRef = useRef<(() => number) | null>(null);
  unlockerRef.current ??= createClickUnlocker(() => {
    void bridgeRef.current.app.toggleDevTools().catch(() => undefined);
    pushToast({ kind: 'info', messageKey: 'settings:about.devToolsUnlocked' });
  });

  useEffect(() => {
    if (!open) {
      setClickCount(0);
      return undefined;
    }
    let cancelled = false;
    setOss({ status: 'loading' });
    bridge.app
      .getOssLicenses()
      .then((entries) => {
        if (!cancelled) {
          setOss(entries.length ? { status: 'ready', entries } : { status: 'unavailable' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOss({ status: 'unavailable' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, bridge]);

  const visibleOss = useMemo(
    () => (oss.status === 'ready' ? filterOssLicenses(oss.entries, query) : []),
    [oss, query]
  );

  const onVersionClick = (): void => {
    const count = unlockerRef.current?.() ?? 0;
    setClickCount(count >= DEVTOOLS_UNLOCK_CLICKS ? 0 : count);
  };

  const exportDiagnostics = async (): Promise<void> => {
    setExporting(true);
    try {
      const result = await bridge.app.exportDiagnosticZip();
      if (result.canceled || !result.zipPath) {
        pushToast({ kind: 'info', messageKey: 'settings:about.diagnosticsCanceled' });
      } else {
        pushToast({
          kind: 'success',
          messageKey: 'settings:about.diagnosticsExported',
          values: { path: result.zipPath }
        });
      }
    } catch (error) {
      pushToast({
        kind: 'error',
        messageKey: 'status.error',
        values: { message: error instanceof Error ? error.message : String(error) }
      });
    } finally {
      setExporting(false);
    }
  };

  const remaining = DEVTOOLS_UNLOCK_CLICKS - clickCount;

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => (next ? undefined : closeModal('about'))}
      title={t('about.title')}
      description={t('about.description')}
      closeLabel={tc('actions.close')}
      width="max-w-2xl"
      testId="about-modal"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-raised/40 p-4">
          <div className="flex items-center gap-3">
            <img
              src={appIconUrl}
              alt=""
              aria-hidden
              draggable={false}
              data-testid="about-app-icon"
              className="size-11 shrink-0 object-contain"
            />
            <div className="flex flex-col gap-1">
              <span className="text-lg font-bold tracking-tight text-fg">aie</span>
              <button
                type="button"
                onClick={onVersionClick}
                data-testid="about-version-badge"
                aria-label={t('about.versionBadgeHint')}
                title={
                  clickCount >= 2 ? t('about.devToolsCountdown', { count: remaining }) : undefined
                }
                className="self-start rounded-md border border-line bg-sunken px-2 py-0.5 font-mono text-[11px] text-muted select-none hover:text-fg"
              >
                {t('about.version', { version: version || '—' })}
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Button
              onClick={() => void exportDiagnostics()}
              disabled={exporting}
              data-testid="about-export-diagnostics"
              icon={
                exporting ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <FileArchive aria-hidden className="size-4" />
                )
              }
            >
              {exporting ? t('about.exportingDiagnostics') : t('about.exportDiagnostics')}
            </Button>
            <p className="max-w-64 text-right text-[11px] text-subtle">{t('about.diagnosticsNote')}</p>
          </div>
        </div>

        <Tabs.Root defaultValue="reclists" className="flex flex-col gap-4">
          <Tabs.List aria-label={t('about.title')} className="flex gap-1 border-b border-line">
            <Tabs.Trigger value="reclists" className={TAB_TRIGGER} data-testid="about-tab-reclists">
              {t('about.tabs.reclists')}
            </Tabs.Trigger>
            <Tabs.Trigger value="oss" className={TAB_TRIGGER} data-testid="about-tab-oss">
              {t('about.tabs.oss')}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="reclists" className="focus-visible:outline-none">
            {builtins.length === 0 ? (
              <p className="py-8 text-center text-sm text-subtle">{t('about.reclistsEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {builtins.map((manifest) => (
                  <li
                    key={manifest.id}
                    data-testid="about-reclist"
                    className="flex flex-col gap-2 rounded-xl border border-line p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-fg">{manifest.displayName}</span>
                        <span className="text-xs text-muted">
                          {t('about.reclistBy', { author: manifest.author })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge mono>v{manifest.version}</Badge>
                        <Badge>{manifest.style}</Badge>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-subtle">
                      <span className="font-semibold text-muted">{t('about.reclistTerms')}: </span>
                      {manifest.termsNotice}
                    </p>
                    {manifest.homepageUrl ? (
                      <button
                        type="button"
                        onClick={() => void bridge.shell.openExternalUrl(manifest.homepageUrl)}
                        className="inline-flex items-center gap-1 self-start text-xs font-medium text-accent hover:underline"
                      >
                        <ExternalLink aria-hidden className="size-3" />
                        {t('about.reclistHomepage')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Tabs.Content>

          <Tabs.Content value="oss" className="flex flex-col gap-3 focus-visible:outline-none">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
                />
                <TextInput
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('about.ossSearch')}
                  aria-label={t('about.ossSearch')}
                  className="h-8 pl-8 text-xs"
                  data-testid="oss-search"
                />
              </div>
              {oss.status === 'ready' ? (
                <span className="font-mono text-[11px] text-subtle">
                  {t('about.ossCount', { count: oss.entries.length })}
                </span>
              ) : null}
            </div>
            {oss.status === 'loading' ? (
              <p role="status" className="py-6 text-center text-sm text-subtle">
                {t('about.ossLoading')}
              </p>
            ) : oss.status === 'unavailable' ? (
              <p className="py-6 text-center text-sm text-subtle">{t('about.ossUnavailable')}</p>
            ) : visibleOss.length === 0 ? (
              <p className="py-6 text-center text-sm text-subtle">{t('about.ossEmpty')}</p>
            ) : (
              <ul className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {visibleOss.map((entry) => (
                  <OssRow key={`${entry.name}@${entry.version}`} entry={entry} />
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              data-testid="about-chromium-notices"
              icon={<ExternalLink aria-hidden className="size-3.5" />}
              onClick={() => void bridge.app.openChromiumNotices().catch(() => undefined)}
            >
              {t('about.chromiumNotices')}
            </Button>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </ModalShell>
  );
}
