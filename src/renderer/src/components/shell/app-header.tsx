import { ArrowUpCircle, ChevronRight, Info, Monitor, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LocaleCode, ThemeMode } from '@shared/types';
import { SUPPORTED_LOCALES } from '@shared/i18n';
import { selectActiveSet, useAppStore } from '@renderer/store/use-app-store';
import { Badge, IconButton, Segmented, cx } from './ui';

function Wordmark() {
  return (
    <div className="flex items-center gap-2 select-none" aria-label="aie">
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-rec text-[13px] font-black tracking-tight text-white shadow-md shadow-accent/30"
      >
        ai
      </span>
      <span className="text-[17px] font-bold tracking-tight text-fg">aie</span>
    </div>
  );
}

function Breadcrumb() {
  const { t } = useTranslation();
  const screen = useAppStore((state) => state.screen);
  const manifest = useAppStore((state) => state.manifest);
  const activeSet = useAppStore(selectActiveSet);
  const goToHub = useAppStore((state) => state.goToHub);
  const goToProject = useAppStore((state) => state.goToProject);

  const crumbs: Array<{ key: string; label: string; onClick?: () => void; current: boolean }> = [
    { key: 'hub', label: t('nav.hub'), onClick: goToHub, current: screen === 'hub' }
  ];
  if (manifest && screen !== 'hub') {
    crumbs.push({
      key: 'project',
      label: manifest.name,
      onClick: goToProject,
      current: screen === 'project'
    });
  }
  if (screen === 'studio' && activeSet) {
    crumbs.push({ key: 'set', label: activeSet.name, current: true });
  }

  return (
    <nav aria-label={t('nav.breadcrumb')} data-testid="breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => (
          <li key={crumb.key} className="flex min-w-0 items-center gap-1">
            {index > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0 text-subtle" /> : null}
            {crumb.current || !crumb.onClick ? (
              <span
                aria-current={crumb.current ? 'page' : undefined}
                className="truncate px-1.5 font-medium text-fg"
              >
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={crumb.onClick}
                data-testid={`breadcrumb-${crumb.key}`}
                className="truncate rounded-md px-1.5 py-0.5 text-muted transition-colors hover:bg-raised hover:text-fg"
              >
                {crumb.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function UpdatePill() {
  const { t } = useTranslation();
  const updateStatus = useAppStore((state) => state.updateStatus);
  const bridge = useAppStore((state) => state.bridge);
  if (updateStatus.status !== 'available' && updateStatus.status !== 'downloaded') {
    return null;
  }
  const version = updateStatus.version ?? '';
  const canInstall = updateStatus.status === 'downloaded' && updateStatus.canSelfInstall;
  const label = canInstall
    ? t('update.downloaded', { version })
    : t('update.available', { version });
  const onClick = (): void => {
    if (canInstall) {
      void bridge.updater.installDownloadedUpdate();
    } else if (updateStatus.releaseUrl) {
      void bridge.shell.openExternalUrl(updateStatus.releaseUrl);
    }
  };
  return (
    <button
      type="button"
      data-testid="update-pill"
      onClick={onClick}
      title={canInstall ? t('update.install') : t('update.viewRelease')}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-ok/30 bg-ok-soft px-2.5 text-xs font-semibold text-ok transition-colors hover:border-ok/60"
    >
      <ArrowUpCircle aria-hidden className="size-3.5" />
      {label}
    </button>
  );
}

export function AppHeader() {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.settings.locale);
  const theme = useAppStore((state) => state.settings.theme);
  const setLocale = useAppStore((state) => state.setLocale);
  const setTheme = useAppStore((state) => state.setTheme);
  const openModal = useAppStore((state) => state.openModal);
  const bridgeAvailable = useAppStore((state) => state.bridgeAvailable);

  const themeIcons: Record<ThemeMode, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-canvas/80 px-5 backdrop-blur-md"
    >
      <Wordmark />
      <span aria-hidden className="h-5 w-px bg-line" />
      <Breadcrumb />
      <div className="ml-auto flex items-center gap-2">
        {!bridgeAvailable ? (
          <Badge tone="warn" title={t('status.bridgeUnavailable')}>
            {t('status.preview')}
          </Badge>
        ) : null}
        <UpdatePill />
        <Segmented<LocaleCode>
          label={t('header.language')}
          value={locale}
          onChange={(next) => void setLocale(next)}
          options={SUPPORTED_LOCALES.map((code) => ({
            value: code,
            label: <span lang={code}>{t(`language.short.${code}`)}</span>,
            title: t(`language.${code}`),
            testId: `header-lang-${code}`
          }))}
        />
        <Segmented<ThemeMode>
          label={t('header.theme')}
          value={theme}
          onChange={(next) => void setTheme(next)}
          options={(['system', 'light', 'dark'] as const).map((mode) => {
            const Icon = themeIcons[mode];
            return {
              value: mode,
              label: <Icon aria-hidden className="size-3.5" />,
              title: t(`theme.${mode}`),
              testId: `header-theme-${mode}`
            };
          })}
        />
        <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />
        <IconButton
          label={t('header.audioSettings')}
          data-testid="header-audio-settings"
          onClick={() => openModal('audioSettings')}
        >
          <SlidersHorizontal className="size-4" />
        </IconButton>
        <IconButton
          label={t('header.about')}
          data-testid="header-about"
          onClick={() => openModal('about')}
          className={cx()}
        >
          <Info className="size-4" />
        </IconButton>
      </div>
    </header>
  );
}
