import { FolderInput, FolderPlus, Mic2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecentProjectSummary } from '@shared/types';
import { useAppStore } from '@renderer/store/useAppStore';
import { ContinueSessionCard } from './ContinueSessionCard';
import { CreateProjectDialog } from './CreateProjectDialog';
import { RecentProjectsList } from './RecentProjectsList';

function ActionTile({
  icon,
  title,
  description,
  onClick,
  disabled,
  testId
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="group flex items-start gap-4 rounded-2xl border border-line bg-panel p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 disabled:opacity-50"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-on-accent">
        {icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-fg">{title}</span>
        <span className="text-xs leading-relaxed text-muted">{description}</span>
      </span>
    </button>
  );
}

/** Screen 1 — merged Welcome & Project Hub. */
export function HubScreen() {
  const { t } = useTranslation('hub');
  const recentProjects = useAppStore((state) => state.recentProjects);
  const opening = useAppStore((state) => state.busy.opening);
  const bridge = useAppStore((state) => state.bridge);
  const continueLastSession = useAppStore((state) => state.continueLastSession);
  const openProject = useAppStore((state) => state.openProject);
  const pickAndOpenProject = useAppStore((state) => state.pickAndOpenProject);
  const [createOpen, setCreateOpen] = useState(false);

  const last = recentProjects[0];

  const reveal = (project: RecentProjectSummary): void => {
    void bridge.shell.revealInFileManager(project.projectPath).catch(() => undefined);
  };

  return (
    <div data-testid="hub-screen" className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.3em] text-rec uppercase">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-rec opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-rec" />
          </span>
          {t('linkStart')}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-fg">{t('welcomeTitle')}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">{t('welcomeSubtitle')}</p>
      </header>

      {last ? (
        <ContinueSessionCard
          project={last}
          busy={opening}
          onContinue={() => void continueLastSession()}
        />
      ) : (
        <section
          data-testid="hub-empty"
          className="flex items-center gap-5 rounded-3xl border border-dashed border-line-strong bg-panel/60 p-7"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Mic2 aria-hidden className="size-6" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-fg">{t('empty.title')}</h2>
            <p className="text-sm text-muted">{t('empty.description')}</p>
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ActionTile
          testId="hub-create-btn"
          icon={<FolderPlus aria-hidden className="size-5" />}
          title={t('actions.create')}
          description={t('actions.createDescription')}
          onClick={() => setCreateOpen(true)}
        />
        <ActionTile
          testId="hub-open-btn"
          icon={<FolderInput aria-hidden className="size-5" />}
          title={t('actions.open')}
          description={t('actions.openDescription')}
          disabled={opening}
          onClick={() => void pickAndOpenProject(t('open.pickTitle'))}
        />
      </div>

      <RecentProjectsList
        projects={recentProjects}
        busy={opening}
        onOpen={(project) => void openProject(project.projectPath)}
        onReveal={reveal}
      />

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
