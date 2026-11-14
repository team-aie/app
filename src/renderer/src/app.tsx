import { useEffect } from 'react';
import { AppHeader } from '@renderer/components/shell/app-header';
import { StudioHost } from '@renderer/components/shell/studio-host';
import { Toaster } from '@renderer/components/shell/toaster';
import { useDocumentSync } from '@renderer/components/shell/use-document-sync';
import { HubScreen } from '@renderer/components/hub';
import { ProjectScreen } from '@renderer/components/project';
import { AboutModal, AudioSettingsModal } from '@renderer/components/modals';
import { useAppStore } from '@renderer/store/use-app-store';
import { RecordingStudioScreen as StudioScreen } from '@renderer/components/studio';

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
