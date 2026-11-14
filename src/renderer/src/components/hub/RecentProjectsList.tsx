import { FolderOpen, FolderX, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecentProjectSummary } from '@shared/types';
import { Badge, IconButton, ProgressBar, TextInput, cx } from '../shell/ui';
import { formatRelativeTime } from '../shell/format';

export function filterRecentProjects(
  projects: RecentProjectSummary[],
  query: string
): RecentProjectSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return projects;
  }
  return projects.filter((project) =>
    [project.name, project.projectPath, project.activeSetName ?? '', project.activeScale ?? '']
      .join('\n')
      .toLowerCase()
      .includes(needle)
  );
}

export function RecentProjectsList({
  projects,
  busy,
  onOpen,
  onReveal
}: {
  projects: RecentProjectSummary[];
  busy: boolean;
  onOpen: (project: RecentProjectSummary) => void;
  onReveal: (project: RecentProjectSummary) => void;
}) {
  const { t } = useTranslation('hub');
  const { t: tc } = useTranslation('common');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterRecentProjects(projects, query), [projects, query]);

  return (
    <section aria-labelledby="hub-recent-title" data-testid="hub-recent" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2
          id="hub-recent-title"
          className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase"
        >
          {t('recent.title')}
        </h2>
        {projects.length > 0 ? (
          <div className="relative w-64">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle"
            />
            <TextInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('recent.searchPlaceholder')}
              aria-label={t('recent.searchPlaceholder')}
              data-testid="hub-recent-search"
              className="h-8 pl-8 text-xs"
            />
          </div>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
          {t('recent.none')}
        </p>
      ) : visible.length === 0 ? (
        <p
          data-testid="hub-recent-empty"
          className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle"
        >
          {t('recent.noResults', { query })}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {visible.map((project) => (
            <li
              key={project.projectPath}
              data-testid="hub-recent-item"
              data-missing={project.missingOnDisk || undefined}
              className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-raised/60"
            >
              <button
                type="button"
                disabled={busy || project.missingOnDisk}
                onClick={() => onOpen(project)}
                aria-label={t('recent.openProject', { name: project.name })}
                className="flex min-w-0 flex-1 items-center gap-4 text-left disabled:cursor-not-allowed"
              >
                <span
                  aria-hidden
                  className={cx(
                    'grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold',
                    project.missingOnDisk ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent'
                  )}
                >
                  {project.missingOnDisk ? (
                    <FolderX className="size-4" />
                  ) : (
                    project.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-fg">{project.name}</span>
                    {project.activeScale ? (
                      <Badge tone="accent" mono>
                        {project.activeScale}
                      </Badge>
                    ) : null}
                    {project.missingOnDisk ? (
                      <Badge tone="warn" title={t('recent.missingDescription')}>
                        {t('recent.missing')}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="truncate font-mono text-[11px] text-subtle">
                    {project.projectPath}
                  </span>
                </span>
                <span className="hidden w-40 shrink-0 flex-col gap-1 sm:flex">
                  <span className="flex justify-between text-[11px] text-subtle">
                    <span>
                      {t('recent.lastOpened', {
                        time: formatRelativeTime(project.lastOpenedAt, tc)
                      })}
                    </span>
                    <span className="font-mono">
                      {t('recent.progress', {
                        recorded: project.recordedCount,
                        total: project.totalCount
                      })}
                    </span>
                  </span>
                  <ProgressBar
                    value={project.recordedCount}
                    max={project.totalCount}
                    label={project.name}
                  />
                </span>
              </button>
              <IconButton
                label={t('recent.reveal')}
                disabled={project.missingOnDisk}
                onClick={() => onReveal(project)}
                data-testid="hub-recent-reveal"
                className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <FolderOpen className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
