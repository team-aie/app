import { FolderX, Play, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RecentProjectSummary } from '@shared/types';
import { Badge, Button, ProgressBar } from '../shell/ui';
import { formatRelativeTime, percent } from '../shell/format';

export function ContinueSessionCard({
  project,
  busy,
  onContinue
}: {
  project: RecentProjectSummary;
  busy: boolean;
  onContinue: () => void;
}) {
  const { t } = useTranslation('hub');
  const { t: tc } = useTranslation('common');
  const pct = percent(project.recordedCount, project.totalCount);

  return (
    <section
      data-testid="hub-continue-card"
      aria-labelledby="hub-continue-title"
      className="relative overflow-hidden rounded-3xl border border-line bg-panel p-7 shadow-xl shadow-black/10"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 left-10 size-64 rounded-full bg-rec/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
            <Sparkles aria-hidden className="size-3.5" />
            {t('continue.eyebrow')}
          </p>
          <h2
            id="hub-continue-title"
            data-testid="hub-continue-name"
            className="truncate text-3xl font-bold tracking-tight text-fg"
          >
            {project.name}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            {project.activeSetName ? (
              <>
                <span className="text-subtle">{t('continue.activeSet')}</span>
                <span className="font-medium text-fg">{project.activeSetName}</span>
              </>
            ) : (
              <span>{t('continue.noActiveSet')}</span>
            )}
            {project.activeScale ? (
              <Badge tone="accent" mono data-testid="hub-continue-scale" title={t('continue.scale')}>
                {project.activeScale}
              </Badge>
            ) : null}
            <span aria-hidden className="text-subtle">·</span>
            <span className="text-subtle">
              {t('continue.lastOpened', { time: formatRelativeTime(project.lastOpenedAt, tc) })}
            </span>
          </div>
          {project.missingOnDisk ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-warn">
              <FolderX aria-hidden className="size-4" />
              {t('continue.missing')}
            </p>
          ) : null}
          {project.totalCount > 0 ? (
            <div className="flex max-w-md flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span data-testid="hub-continue-progress" className="font-mono text-muted">
                  {t('continue.progress', {
                    recorded: project.recordedCount,
                    total: project.totalCount
                  })}
                </span>
                <span className="font-mono text-subtle">{tc('units.percent', { value: pct })}</span>
              </div>
              <ProgressBar
                value={project.recordedCount}
                max={project.totalCount}
                label={t('continue.eyebrow')}
              />
            </div>
          ) : null}
        </div>
        <Button
          variant="primary"
          size="lg"
          data-testid="hub-continue-btn"
          disabled={busy || project.missingOnDisk}
          onClick={onContinue}
          icon={<Play aria-hidden className="size-4 fill-current" />}
          className="aie-link-start h-12 rounded-2xl px-6 text-base"
        >
          {t('continue.button')}
        </Button>
      </div>
    </section>
  );
}
