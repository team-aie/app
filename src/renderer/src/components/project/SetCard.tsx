import { CheckCircle2, FileSearch, Folder, ListMusic, Pencil, Play, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RecordingSetConfig, ReclistManifest, SetProgressSummary } from '@shared/types';
import { Badge, Button, IconButton, ProgressBar, cx } from '../shell/ui';
import { basename } from './setForm';

export function SetCard({
  setConfig,
  progress,
  builtins,
  active,
  onStart,
  onEdit,
  onPreview,
  onRemove
}: {
  setConfig: RecordingSetConfig;
  progress?: SetProgressSummary;
  builtins: ReclistManifest[];
  active: boolean;
  onStart: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('project');
  const recorded = progress?.recordedCount ?? 0;
  const total = progress?.totalCount ?? 0;
  const complete = total > 0 && recorded >= total;
  const started = recorded > 0 || setConfig.lastCursorIndex > 0;
  const source = setConfig.reclistSource;
  const reclistLabel =
    source.kind === 'builtin'
      ? (builtins.find((candidate) => candidate.id === source.builtinId)?.displayName ?? source.builtinId)
      : basename(source.reclistPath);

  return (
    <article
      data-testid="set-card"
      data-set-id={setConfig.id}
      className={cx(
        'group flex flex-col gap-4 rounded-2xl border bg-panel p-5 transition-colors',
        active ? 'border-accent/60 shadow-lg shadow-accent/5' : 'border-line hover:border-line-strong'
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-fg">{setConfig.name}</h3>
            {active ? <Badge tone="accent">{t('sets.active')}</Badge> : null}
            {complete ? (
              <Badge tone="ok">
                <CheckCircle2 aria-hidden className="size-3" />
                {t('sets.complete')}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent" mono title={t('sets.scale')} data-testid="set-card-scale">
              {setConfig.scale}
            </Badge>
            <Badge mono title={t('sets.folder')}>
              <Folder aria-hidden className="size-3" />
              {setConfig.targetLocation === 'root' ? t('rootLabel') : `${setConfig.subfolderName}/`}
            </Badge>
            {setConfig.aliasSuffix ? <Badge mono>{setConfig.aliasSuffix}</Badge> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconButton label={t('sets.preview')} onClick={onPreview} data-testid="set-preview-btn">
            <FileSearch className="size-4" />
          </IconButton>
          <IconButton label={t('sets.edit')} onClick={onEdit} data-testid="set-edit-btn">
            <Pencil className="size-4" />
          </IconButton>
          <IconButton
            label={t('sets.remove')}
            onClick={onRemove}
            data-testid="set-remove-btn"
            className="hover:text-danger"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </header>

      <p className="flex items-center gap-2 truncate text-xs text-muted" title={reclistLabel}>
        <ListMusic aria-hidden className="size-3.5 shrink-0 text-subtle" />
        <span className="text-subtle">{t('sets.reclist')}</span>
        <span className="truncate text-fg">{reclistLabel}</span>
        {source.kind === 'custom' ? <Badge>{t('sets.customReclist')}</Badge> : null}
      </p>

      <div className="flex flex-col gap-1.5">
        <span data-testid="set-card-progress" className="font-mono text-xs text-muted">
          {t('sets.progress', { recorded, total })}
        </span>
        <ProgressBar
          value={recorded}
          max={total}
          label={setConfig.name}
          tone={complete ? 'ok' : 'accent'}
        />
      </div>

      <Button
        variant={started ? 'secondary' : 'primary'}
        onClick={onStart}
        data-testid="set-start-btn"
        icon={<Play aria-hidden className="size-3.5 fill-current" />}
        className="self-start"
      >
        {started ? t('sets.resume') : t('sets.start')}
      </Button>
    </article>
  );
}
