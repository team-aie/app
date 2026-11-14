import {
  AudioWaveform,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  Piano,
  Plus,
  Settings2,
  TriangleAlert,
  X
} from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecordingSetConfig } from '@shared/types';
import { resolveSingerFiles, useAppStore } from '@renderer/store/use-app-store';
import { Badge, Button, CheckboxItem, IconButton } from '../shell/ui';
import { MetadataDrawer } from './metadata-drawer';
import { RemoveSetDialog } from './remove-set-dialog';
import { SetCard } from './set-card';
import { SetEditorDialog, type PlayTone } from './set-editor-dialog';

type ExternalTool = 'vlabeler' | 'openutau';
const TOOL_NAMES: Record<ExternalTool, string> = { vlabeler: 'vLabeler', openutau: 'OpenUtau' };

/** Screen 2 — Project Workspace & Recording Sets. */
export function ProjectScreen({ playTone }: { playTone?: PlayTone }) {
  const { t } = useTranslation('project');
  const { t: tc } = useTranslation('common');
  const manifest = useAppStore((state) => state.manifest);
  const setProgress = useAppStore((state) => state.setProgress);
  const builtins = useAppStore((state) => state.builtinReclists);
  const bridge = useAppStore((state) => state.bridge);
  const updateSingerFiles = useAppStore((state) => state.updateSingerFiles);
  const upsertRecordingSet = useAppStore((state) => state.upsertRecordingSet);
  const deleteRecordingSet = useAppStore((state) => state.deleteRecordingSet);
  const enterStudio = useAppStore((state) => state.enterStudio);
  const openModal = useAppStore((state) => state.openModal);
  const pushToast = useAppStore((state) => state.pushToast);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RecordingSetConfig | undefined>(undefined);
  const [previewSet, setPreviewSet] = useState<RecordingSetConfig | null>(null);
  const [removeSet, setRemoveSet] = useState<RecordingSetConfig | null>(null);
  const [missingTool, setMissingTool] = useState<ExternalTool | null>(null);
  const [singerFilesOpen, setSingerFilesOpen] = useState(false);
  const [openInOpen, setOpenInOpen] = useState(false);

  if (!manifest) {
    return null;
  }

  const singerFiles = resolveSingerFiles(manifest);
  const enabledSingerFilesCount =
    Number(singerFiles.characterTxt) +
    Number(singerFiles.characterYaml) +
    Number(singerFiles.prefixMap);

  const openTool = async (tool: ExternalTool): Promise<void> => {
    setOpenInOpen(false);
    try {
      const result = await bridge.shell.openInExternalTool({ tool, projectRootPath: manifest.rootPath });
      if (result.ok) {
        setMissingTool(null);
        pushToast({ kind: 'success', messageKey: 'project:handoff.launched', values: { tool: TOOL_NAMES[tool] } });
      } else {
        setMissingTool(tool);
      }
    } catch {
      setMissingTool(tool);
    }
  };

  const reveal = (): void => {
    setOpenInOpen(false);
    void bridge.shell.revealInFileManager(manifest.rootPath).catch(() => undefined);
  };

  const openCreate = (): void => {
    setEditing(undefined);
    setEditorOpen(true);
  };

  const openEditSet = (setConfig: RecordingSetConfig): void => {
    setEditing(setConfig);
    setEditorOpen(true);
  };

  return (
    <div data-testid="project-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">{t('title')}</p>
          <h1 data-testid="project-name" className="truncate text-3xl font-bold tracking-tight text-fg">
            {manifest.name}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {manifest.author ? <span>{t('author', { author: manifest.author })}</span> : null}
            <span className="truncate font-mono text-xs text-subtle" title={manifest.rootPath}>
              {manifest.rootPath}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover.Root open={singerFilesOpen} onOpenChange={setSingerFilesOpen}>
            <Popover.Trigger asChild>
              <Button
                variant="secondary"
                icon={<FileCheck2 aria-hidden className="size-4 text-accent" />}
                data-testid="project-singer-files-btn"
              >
                <span>{t('singerFiles.title')}</span>
                <Badge mono>{enabledSingerFilesCount}/3</Badge>
                <ChevronDown aria-hidden className="size-3.5 text-subtle" />
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={8}
                data-testid="project-singer-files"
                className="z-50 flex w-88 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl border border-line bg-panel p-4 text-fg shadow-2xl shadow-black/40"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold tracking-wide text-fg">
                    {t('singerFiles.title')}
                  </p>
                  <p className="text-xs leading-relaxed text-subtle">
                    {t('singerFiles.description')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <CheckboxItem
                    checked={singerFiles.characterTxt}
                    onCheckedChange={(checked) =>
                      void updateSingerFiles({ ...singerFiles, characterTxt: checked })
                    }
                    label={t('singerFiles.characterTxt')}
                    description={t('singerFiles.characterTxtHint')}
                    testId="project-singer-file-character-txt"
                    monoLabel
                  />
                  <CheckboxItem
                    checked={singerFiles.characterYaml}
                    onCheckedChange={(checked) =>
                      void updateSingerFiles({ ...singerFiles, characterYaml: checked })
                    }
                    label={t('singerFiles.characterYaml')}
                    description={t('singerFiles.characterYamlHint')}
                    testId="project-singer-file-character-yaml"
                    monoLabel
                  />
                  <CheckboxItem
                    checked={singerFiles.prefixMap}
                    onCheckedChange={(checked) =>
                      void updateSingerFiles({ ...singerFiles, prefixMap: checked })
                    }
                    label={t('singerFiles.prefixMap')}
                    description={t('singerFiles.prefixMapHint')}
                    testId="project-singer-file-prefix-map"
                    monoLabel
                  />
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Popover.Root open={openInOpen} onOpenChange={setOpenInOpen}>
            <Popover.Trigger asChild>
              <Button
                variant="secondary"
                icon={<ExternalLink aria-hidden className="size-4 text-accent" />}
                data-testid="project-open-in-btn"
              >
                <span>{t('handoff.menuButton')}</span>
                <ChevronDown aria-hidden className="size-3.5 text-subtle" />
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={8}
                data-testid="project-open-in-menu"
                aria-label={t('handoff.title')}
                className="z-50 flex w-84 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-2xl border border-line bg-panel p-2 text-fg shadow-2xl shadow-black/40"
              >
                <button
                  type="button"
                  onClick={reveal}
                  data-testid="handoff-reveal"
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <FolderOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-fg">{t('handoff.reveal')}</span>
                    <span className="text-xs leading-snug text-subtle">
                      {t('handoff.revealDescription')}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void openTool('vlabeler')}
                  data-testid="handoff-vlabeler"
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <AudioWaveform aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-fg">{t('handoff.openVLabeler')}</span>
                    <span className="text-xs leading-snug text-subtle">
                      {t('handoff.vlabelerDescription')}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void openTool('openutau')}
                  data-testid="handoff-openutau"
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-raised"
                >
                  <Piano aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-fg">{t('handoff.openOpenUtau')}</span>
                    <span className="text-xs leading-snug text-subtle">
                      {t('handoff.openutauDescription')}
                    </span>
                  </span>
                </button>
                <div className="mt-1 border-t border-line pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenInOpen(false);
                      openModal('audioSettings');
                    }}
                    data-testid="project-open-in-settings"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-fg"
                  >
                    <Settings2 aria-hidden className="size-3.5 shrink-0" />
                    <span>{t('handoff.openSettings')}</span>
                  </button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </header>

      {missingTool ? (
        <div
          role="status"
          data-testid="handoff-tool-missing"
          className="flex items-center gap-3 rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-warn"
        >
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          <span className="flex-1">{t('handoff.toolMissing', { tool: TOOL_NAMES[missingTool] })}</span>
          <Button
            size="sm"
            variant="secondary"
            icon={<Settings2 aria-hidden className="size-3.5" />}
            onClick={() => openModal('audioSettings')}
            data-testid="handoff-open-settings"
          >
            {t('handoff.openSettings')}
          </Button>
          <IconButton label={tc('actions.dismiss')} onClick={() => setMissingTool(null)} className="size-7">
            <X className="size-3.5" />
          </IconButton>
        </div>
      ) : null}

      <section aria-labelledby="sets-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="sets-title" className="text-lg font-semibold tracking-tight text-fg">
              {t('sets.title')}
            </h2>
            <p className="text-sm text-muted">{t('sets.subtitle')}</p>
          </div>
          <Button
            variant="primary"
            icon={<Plus aria-hidden className="size-4" />}
            onClick={openCreate}
            data-testid="set-add-btn"
          >
            {t('sets.add')}
          </Button>
        </div>

        {manifest.sets.length === 0 ? (
          <button
            type="button"
            onClick={openCreate}
            data-testid="sets-empty"
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center transition-colors hover:border-accent/60 hover:bg-accent-soft"
          >
            <Plus aria-hidden className="size-6 text-accent" />
            <span className="text-base font-semibold text-fg">{t('sets.empty')}</span>
            <span className="max-w-md text-sm text-muted">{t('sets.emptyDescription')}</span>
          </button>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {manifest.sets.map((setConfig) => (
              <SetCard
                key={setConfig.id}
                setConfig={setConfig}
                progress={setProgress[setConfig.id]}
                builtins={builtins}
                active={manifest.activeSetId === setConfig.id}
                onStart={() => void enterStudio(setConfig.id)}
                onEdit={() => openEditSet(setConfig)}
                onChangeReclist={() => openEditSet(setConfig)}
                onPreview={() => setPreviewSet(setConfig)}
                onRemove={() => setRemoveSet(setConfig)}
              />
            ))}
          </div>
        )}
      </section>

      <SetEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={editing}
        existingSets={manifest.sets}
        builtins={builtins}
        rootPath={manifest.rootPath}
        playTone={playTone}
        onSave={async (config) => (await upsertRecordingSet(config)) !== null}
      />
      <MetadataDrawer
        manifest={manifest}
        setConfig={previewSet}
        onClose={() => setPreviewSet(null)}
        onOpenVLabeler={() => void openTool('vlabeler')}
      />
      <RemoveSetDialog
        setConfig={removeSet}
        onCancel={() => setRemoveSet(null)}
        onConfirm={async (setId, trash) => {
          const ok = await deleteRecordingSet(setId, trash);
          if (ok) {
            setRemoveSet(null);
          }
        }}
      />
    </div>
  );
}
