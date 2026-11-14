import { useEffect } from 'react';
import { AppHeader } from '@renderer/components/shell/AppHeader';
import { StudioHost } from '@renderer/components/shell/StudioHost';
import { Toaster } from '@renderer/components/shell/Toaster';
import { useDocumentSync } from '@renderer/components/shell/useDocumentSync';
import { HubScreen } from '@renderer/components/hub';
import { ProjectScreen } from '@renderer/components/project';
import { AboutModal, AudioSettingsModal } from '@renderer/components/modals';
import { useAppStore } from '@renderer/store/useAppStore';
// Stage 3 merge: replace this single line with
// `import { RecordingStudioScreen as StudioScreen } from '@renderer/components/studio';`
import { StudioScreenSlot as StudioScreen } from '@renderer/components/shell/StudioScreenSlot';

export function App() {
  const screen = useAppStore((state) => state.screen);
  const init = useAppStore((state) => state.init);
  const resolvedTheme = useDocumentSync();

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div
      data-testid="app-root"
      data-screen={screen}
      data-resolved-theme={resolvedTheme}
      className="flex min-h-screen flex-col"
    >
      <AppHeader />
      <main className="flex min-h-0 flex-1 flex-col">
        {screen === 'hub' ? <HubScreen /> : null}
        {screen === 'project' ? <ProjectScreen /> : null}
        {screen === 'studio' ? <StudioHost Screen={StudioScreen} /> : null}
      </main>
      <AudioSettingsModal />
      <AboutModal />
      <Toaster />
    </div>
  );
}
