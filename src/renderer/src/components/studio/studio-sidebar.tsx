import type { ReclistEntry } from '@shared/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { filterEntries, formatSeconds } from './studio-math';
import { useStudioT } from './studio-strings';
import type { SidebarFilter } from './types';
import { blurOnPointerClick } from './use-studio-hotkeys';

export const SIDEBAR_PAGE_SIZE = 30;

export interface StudioSidebarProps {
  entries: ReclistEntry[];
  cursor: number;
  recorded: ReadonlySet<string>;
  durations: ReadonlyMap<string, number>;
  onSelect: (index: number) => void;
  onReveal: (entry: ReclistEntry) => void;
  /** Disable navigation while recording/saving. */
  navigationLocked: boolean;
}

/** Collapsible, searchable, filterable, paginated item sidebar with progress counter. */
export function StudioSidebar(props: StudioSidebarProps) {
  const t = useStudioT();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [page, setPage] = useState(() => {
    const initialVisible = filterEntries(props.entries, '', 'all', props.recorded);
    const pos = initialVisible.findIndex((entry) => entry.index === props.cursor);
    return pos >= 0 ? Math.floor(pos / SIDEBAR_PAGE_SIZE) : 0;
  });
  const activeRef = useRef<HTMLLIElement>(null);

  const visible = useMemo(
    () => filterEntries(props.entries, query, filter, props.recorded),
    [props.entries, query, filter, props.recorded]
  );
  const recordedCount = useMemo(
    () => props.entries.reduce((n, e) => n + (props.recorded.has(e.fileName) ? 1 : 0), 0),
    [props.entries, props.recorded]
  );
  const total = props.entries.length;
  const percent = total === 0 ? 0 : Math.round((recordedCount / total) * 100);

  const totalPages = Math.max(1, Math.ceil(visible.length / SIDEBAR_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const pagedVisible = useMemo(
    () => visible.slice(safePage * SIDEBAR_PAGE_SIZE, (safePage + 1) * SIDEBAR_PAGE_SIZE),
    [visible, safePage]
  );

  // Sync sidebar page to the page containing `cursor` whenever `cursor` or the list changes.
  const latestFilterState = useRef({
    entries: props.entries,
    query,
    filter,
    recorded: props.recorded
  });
  latestFilterState.current = {
    entries: props.entries,
    query,
    filter,
    recorded: props.recorded
  };

  useEffect(() => {
    const { entries, query: q, filter: f, recorded } = latestFilterState.current;
    const currentVisible = filterEntries(entries, q, f, recorded);
    const pos = currentVisible.findIndex((entry) => entry.index === props.cursor);
    if (pos >= 0) {
      setPage(Math.floor(pos / SIDEBAR_PAGE_SIZE));
    }
  }, [props.cursor, props.entries]);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [props.cursor, collapsed, safePage]);

  const progress = (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span data-testid="studio-progress" className="text-xs text-zinc-400 tabular-nums">
        {t('sidebar.progress', { recorded: recordedCount, total })}
      </span>
    </div>
  );

  if (collapsed) {
    return (
      <aside
        data-testid="studio-sidebar"
        data-collapsed="true"
        className="flex h-full min-h-0 w-10 shrink-0 flex-col items-center gap-3 border-r border-zinc-800 py-3"
      >
        <button
          type="button"
          onClick={(e) => {
            blurOnPointerClick(e);
            setCollapsed(false);
          }}
          aria-label={t('sidebar.expand')}
          title={t('sidebar.expand')}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          »
        </button>
        <div className="sr-only">{progress}</div>
      </aside>
    );
  }

  const filters: Array<{ id: SidebarFilter; label: string }> = [
    { id: 'all', label: t('sidebar.filterAll') },
    { id: 'unrecorded', label: t('sidebar.filterUnrecorded') },
    { id: 'recorded', label: t('sidebar.filterRecorded') }
  ];

  return (
    <aside
      data-testid="studio-sidebar"
      data-collapsed="false"
      className="flex h-full min-h-0 w-72 shrink-0 flex-col gap-2.5 border-r border-zinc-800 p-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">{t('sidebar.title')}</h2>
        <button
          type="button"
          onClick={(e) => {
            blurOnPointerClick(e);
            setCollapsed(true);
          }}
          aria-label={t('sidebar.collapse')}
          title={t('sidebar.collapse')}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          «
        </button>
      </div>
      {progress}
      <input
        type="search"
        data-testid="studio-search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
        placeholder={t('sidebar.searchPlaceholder')}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none"
      />
      <div className="flex gap-1" role="radiogroup" aria-label={t('sidebar.title')}>
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            data-testid={`studio-filter-${f.id}`}
            onClick={(e) => {
              blurOnPointerClick(e);
              setFilter(f.id);
              setPage(0);
            }}
            className={
              filter === f.id
                ? 'rounded-full bg-indigo-500 px-2.5 py-0.5 text-xs text-white'
                : 'rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700'
            }
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul data-testid="studio-item-list" className="-mx-1 min-h-0 flex-1 overflow-y-auto">
        {pagedVisible.length === 0 ? (
          <li className="px-2 py-4 text-center text-xs text-zinc-500">{t('sidebar.noResults')}</li>
        ) : (
          pagedVisible.map((entry) => {
            const isActive = entry.index === props.cursor;
            const isRecorded = props.recorded.has(entry.fileName);
            const duration = props.durations.get(entry.fileName);
            return (
              <li
                key={entry.index}
                ref={isActive ? activeRef : undefined}
                data-testid={`studio-item-${entry.index}`}
                data-recorded={isRecorded}
                className={`group flex items-center gap-2 rounded-md px-2 py-1 ${isActive ? 'bg-indigo-500/20' : 'hover:bg-zinc-800/70'}`}
              >
                <button
                  type="button"
                  disabled={props.navigationLocked}
                  onClick={(e) => {
                    blurOnPointerClick(e);
                    props.onSelect(entry.index);
                  }}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
                >
                  <span className={`w-4 text-center text-xs ${isRecorded ? 'text-emerald-400' : 'text-zinc-600'}`} aria-hidden>
                    {isRecorded ? '✓' : '○'}
                  </span>
                  <span className="truncate text-sm text-zinc-100">{entry.rawPrompt}</span>
                </button>
                {isRecorded && duration !== undefined ? (
                  <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400 tabular-nums">
                    {t('sidebar.duration', { seconds: formatSeconds(duration) })}
                  </span>
                ) : null}
                {isRecorded ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      blurOnPointerClick(e);
                      props.onReveal(entry);
                    }}
                    aria-label={t('sidebar.revealWav')}
                    title={t('sidebar.revealWav')}
                    data-testid={`studio-reveal-${entry.index}`}
                    className="invisible rounded px-1 text-xs text-zinc-400 group-hover:visible hover:text-zinc-100 focus:visible"
                  >
                    ⤴
                  </button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
      <div
        data-testid="studio-pagination"
        className="flex shrink-0 items-center justify-between border-t border-zinc-800/80 pt-2 text-xs text-zinc-400"
      >
        <button
          type="button"
          data-testid="studio-page-prev"
          disabled={safePage <= 0}
          aria-label={t('sidebar.prevPage')}
          title={t('sidebar.prevPage')}
          onClick={(e) => {
            blurOnPointerClick(e);
            setPage(Math.max(0, safePage - 1));
          }}
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ◀
        </button>
        <span data-testid="studio-page-indicator" className="tabular-nums">
          {t('sidebar.pageIndicator', { page: safePage + 1, totalPages })}
        </span>
        <button
          type="button"
          data-testid="studio-page-next"
          disabled={safePage >= totalPages - 1}
          aria-label={t('sidebar.nextPage')}
          title={t('sidebar.nextPage')}
          onClick={(e) => {
            blurOnPointerClick(e);
            setPage(Math.min(totalPages - 1, safePage + 1));
          }}
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ▶
        </button>
      </div>
    </aside>
  );
}
