import { Dialog, Tabs } from 'radix-ui';
import { ExternalLink, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AieProjectManifest, ParsedRecordingListBundle, RecordingSetConfig } from '@shared/types';
import { useAppStore } from '@renderer/store/use-app-store';
import { Button, IconButton, Segmented, TextInput, cx } from '../shell/ui';
import { buildCharacterYamlPreview } from './character-yaml';
import { MarkdownView } from './markdown-view';

type DrawerTab = 'reclist' | 'oto' | 'character' | 'readme';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; bundle: ParsedRecordingListBundle }
  | { status: 'error'; error: string };

const TAB_TRIGGER =
  'relative h-10 px-3 text-sm font-medium text-muted transition-colors hover:text-fg ' +
  'data-[state=active]:text-fg data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 ' +
  'data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-accent';

export function MetadataDrawer({
  manifest,
  setConfig,
  onClose,
  onOpenVLabeler
}: {
  manifest: AieProjectManifest;
  setConfig: RecordingSetConfig | null;
  onClose: () => void;
  onOpenVLabeler: () => void;
}) {
  const { t } = useTranslation('project');
  const { t: tc } = useTranslation('common');
  const bridge = useAppStore((state) => state.bridge);
  const builtins = useAppStore((state) => state.builtinReclists);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [tab, setTab] = useState<DrawerTab>('reclist');
  const [query, setQuery] = useState('');
  const [otoView, setOtoView] = useState<'table' | 'raw'>('table');

  useEffect(() => {
    if (!setConfig) {
      return undefined;
    }
    let cancelled = false;
    setLoad({ status: 'loading' });
    setTab('reclist');
    setQuery('');
    bridge.voicebank
      .loadRecordingList(manifest.rootPath, setConfig)
      .then((bundle) => {
        if (!cancelled) {
          setLoad({ status: 'ready', bundle });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoad({ status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bridge, manifest.rootPath, setConfig]);

  const bundle = load.status === 'ready' ? load.bundle : null;
  const filtered = useMemo(() => {
    if (!bundle) {
      return [];
    }
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return bundle.entries;
    }
    return bundle.entries.filter((entry) =>
      [entry.rawPrompt, entry.fileName, entry.pronunciationHint ?? '', entry.inlineComment ?? '']
        .join('\n')
        .toLowerCase()
        .includes(needle)
    );
  }, [bundle, query]);

  const characterYaml = useMemo(
    () => buildCharacterYamlPreview(manifest, builtins),
    [manifest, builtins]
  );

  const readme = bundle?.readmeMarkdown;

  return (
    <Dialog.Root open={setConfig !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="aie-anim-overlay fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          data-testid="metadata-drawer"
          className="aie-anim-drawer fixed inset-y-0 right-0 z-50 flex w-[min(760px,92vw)] flex-col border-l border-line bg-panel shadow-2xl shadow-black/40"
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="text-base font-semibold tracking-tight text-fg">
                {t('drawer.title')}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted">
                {t('drawer.description', { name: setConfig?.name ?? '' })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label={tc('actions.close')} className="-mt-1 -mr-2">
                <X className="size-4" />
              </IconButton>
            </Dialog.Close>
          </div>

          {load.status === 'loading' ? (
            <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-muted">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t('drawer.loading')}
            </div>
          ) : load.status === 'error' ? (
            <div role="alert" className="flex flex-1 items-center justify-center p-8 text-center text-sm text-danger">
              {t('drawer.loadFailed', { error: load.error })}
            </div>
          ) : (
            <Tabs.Root
              value={tab}
              onValueChange={(value) => setTab(value as DrawerTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <Tabs.List aria-label={t('drawer.title')} className="flex shrink-0 gap-1 border-b border-line px-4">
                <Tabs.Trigger value="reclist" className={TAB_TRIGGER} data-testid="drawer-tab-reclist">
                  {t('drawer.tabs.reclist')}
                </Tabs.Trigger>
                <Tabs.Trigger value="oto" className={TAB_TRIGGER} data-testid="drawer-tab-oto">
                  {t('drawer.tabs.oto')}
                </Tabs.Trigger>
                <Tabs.Trigger value="character" className={TAB_TRIGGER} data-testid="drawer-tab-character">
                  {t('drawer.tabs.character')}
                </Tabs.Trigger>
                <Tabs.Trigger value="readme" className={TAB_TRIGGER} data-testid="drawer-tab-readme">
                  {t('drawer.tabs.readme')}
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="reclist" className="flex min-h-0 flex-1 flex-col gap-3 p-5 focus-visible:outline-none">
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
                      placeholder={t('drawer.searchPlaceholder')}
                      aria-label={t('drawer.searchPlaceholder')}
                      className="h-8 pl-8 text-xs"
                      data-testid="drawer-reclist-search"
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-subtle">
                    {t('drawer.entries', {
                      count: bundle?.entries.length ?? 0,
                      encoding: bundle?.detectedEncoding ?? ''
                    })}
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-raised text-[11px] tracking-wide text-subtle uppercase">
                      <tr>
                        <th className="w-12 px-3 py-2 font-semibold">{t('drawer.columns.index')}</th>
                        <th className="px-3 py-2 font-semibold">{t('drawer.columns.prompt')}</th>
                        <th className="px-3 py-2 font-semibold">{t('drawer.columns.fileName')}</th>
                        <th className="px-3 py-2 font-semibold">{t('drawer.columns.hint')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {filtered.map((entry) => (
                        <tr key={entry.index} data-testid="drawer-reclist-row" className="hover:bg-raised/50">
                          <td className="px-3 py-1.5 font-mono text-subtle">{entry.index + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-fg">
                            {entry.rawPrompt}
                            {entry.inlineComment ? (
                              <span className="ml-2 text-subtle">@{entry.inlineComment}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-muted">{entry.fileName}</td>
                          <td className="px-3 py-1.5 text-accent">{entry.pronunciationHint ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tabs.Content>

              <Tabs.Content value="oto" className="flex min-h-0 flex-1 flex-col gap-3 p-5 focus-visible:outline-none">
                {bundle && (bundle.otoEntries.length > 0 || bundle.rawOtoText) ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <Segmented<'table' | 'raw'>
                        label={t('drawer.tabs.oto')}
                        value={otoView}
                        onChange={setOtoView}
                        options={[
                          { value: 'table', label: t('drawer.otoTable') },
                          { value: 'raw', label: t('drawer.otoRaw') }
                        ]}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onOpenVLabeler}
                        icon={<ExternalLink aria-hidden className="size-3.5" />}
                      >
                        {t('drawer.openInVLabeler')}
                      </Button>
                    </div>
                    {otoView === 'table' ? (
                      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line">
                        <table className="w-full text-left font-mono text-xs">
                          <thead className="sticky top-0 bg-raised font-sans text-[11px] tracking-wide text-subtle uppercase">
                            <tr>
                              {(
                                [
                                  'fileName',
                                  'alias',
                                  'offset',
                                  'consonant',
                                  'cutoff',
                                  'preutterance',
                                  'overlap'
                                ] as const
                              ).map((column) => (
                                <th key={column} className="px-3 py-2 font-semibold">
                                  {t(`drawer.columns.${column}`)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {bundle.otoEntries.map((entry, index) => (
                              <tr key={`${entry.fileName}-${entry.alias}-${index}`} className="hover:bg-raised/50">
                                <td className="px-3 py-1.5 text-muted">{entry.fileName}</td>
                                <td className="px-3 py-1.5 font-semibold text-fg">{entry.alias}</td>
                                <td className="px-3 py-1.5 text-muted">{entry.offsetMs}</td>
                                <td className="px-3 py-1.5 text-muted">{entry.consonantMs}</td>
                                <td className="px-3 py-1.5 text-muted">{entry.cutoffMs}</td>
                                <td className="px-3 py-1.5 text-muted">{entry.preutteranceMs}</td>
                                <td className="px-3 py-1.5 text-muted">{entry.overlapMs}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <pre className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-sunken p-4 font-mono text-xs whitespace-pre text-fg">
                        {bundle.rawOtoText ?? ''}
                      </pre>
                    )}
                  </>
                ) : (
                  <p className="py-10 text-center text-sm text-subtle">{t('drawer.noOto')}</p>
                )}
              </Tabs.Content>

              <Tabs.Content value="character" className="flex min-h-0 flex-1 flex-col gap-3 p-5 focus-visible:outline-none">
                <p className="text-xs text-subtle">{t('drawer.characterNote')}</p>
                <pre
                  data-testid="drawer-character-yaml"
                  className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-sunken p-4 font-mono text-xs whitespace-pre text-fg"
                >
                  {characterYaml}
                </pre>
              </Tabs.Content>

              <Tabs.Content
                value="readme"
                className={cx('min-h-0 flex-1 overflow-y-auto p-6 focus-visible:outline-none')}
              >
                {readme ? (
                  <MarkdownView source={readme} />
                ) : (
                  <p className="py-10 text-center text-sm text-subtle">{t('drawer.noReadme')}</p>
                )}
              </Tabs.Content>
            </Tabs.Root>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
