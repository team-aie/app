import type { ReclistEntry } from '@shared/types';
import { useStudioT } from './studio-strings';

export interface PromptStageProps {
  previous: ReclistEntry | null;
  current: ReclistEntry | null;
  next: ReclistEntry | null;
  index: number;
  total: number;
  isRecorded: boolean;
}

/** Prompt carousel + phoneme coach: Previous (muted) / Current (booth-legible) / Next. */
export function PromptStage({ previous, current, next, index, total, isRecorded }: PromptStageProps) {
  const t = useStudioT();
  return (
    <section
      data-testid="studio-prompt-stage"
      className="flex shrink-0 flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 text-center"
    >
      <div className="flex w-full items-center justify-between text-xs text-zinc-500">
        <span data-testid="studio-prompt-position">
          {t('prompt.position', { current: total === 0 ? 0 : index + 1, total })}
        </span>
        <span
          data-testid="studio-prompt-recorded"
          className={
            isRecorded
              ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300'
              : 'rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-400'
          }
        >
          {isRecorded ? `✓ ${t('prompt.recorded')}` : t('prompt.notRecorded')}
        </span>
      </div>

      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="truncate text-right text-base text-zinc-600" data-testid="studio-prompt-previous" aria-label={t('prompt.previous')}>
          {previous?.rawPrompt ?? ''}
        </div>
        <div
          data-testid="studio-prompt-current"
          aria-label={t('prompt.current')}
          className="max-w-[60vw] font-semibold break-all text-zinc-50"
          style={{ fontSize: 'clamp(2rem, 4.2vw, 3.5rem)', lineHeight: 1.1 }}
        >
          {current?.rawPrompt ?? '—'}
        </div>
        <div className="truncate text-left text-base text-zinc-600" data-testid="studio-prompt-next" aria-label={t('prompt.next')}>
          {next ? next.rawPrompt : current ? t('prompt.endOfList') : ''}
        </div>
      </div>

      {current?.pronunciationHint ? (
        <div
          data-testid="studio-prompt-hint"
          className="rounded-lg bg-indigo-500/10 px-3.5 py-1 font-mono text-xl text-indigo-200"
          title={t('prompt.hint')}
        >
          {current.pronunciationHint}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {current ? (
          <span
            data-testid="studio-prompt-filename"
            title={t('prompt.fileName')}
            className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-0.5 font-mono text-zinc-300"
          >
            {current.fileName}
          </span>
        ) : null}
        {current?.inlineComment ? (
          <span data-testid="studio-prompt-comment" className="text-amber-200/90">
            {t('prompt.comment')}: {current.inlineComment}
          </span>
        ) : null}
      </div>

      {current && current.syllables.length > 0 ? (
        <ul
          data-testid="studio-prompt-syllables"
          aria-label={t('prompt.syllables')}
          className="flex flex-wrap justify-center gap-1.5"
        >
          {current.syllables.map((syllable, i) => (
            <li
              key={`${syllable}-${i}`}
              className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-200"
            >
              {syllable}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
