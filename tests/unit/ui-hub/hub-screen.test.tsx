import '@testing-library/jest-dom/vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@renderer/app';
import { resetAppStore, useAppStore } from '@renderer/store/use-app-store';
import {
  installDomShims,
  makeBridge,
  makeManifest,
  makeRecent,
  makeSet,
  renderWithI18n
} from './test-utils';

installDomShims();

describe('Screen 1 — Welcome & Project Hub + Top Shell Header', () => {
  it('renders Vocal Booth branding, Resume Session hero card, and jumps to a viewport-locked Studio at lastCursorIndex', async () => {
    const user = userEvent.setup();
    const manifest = makeManifest({
      sets: [makeSet({ id: 'set-g4', name: 'Normal G4', scale: 'G4', lastCursorIndex: 3 })],
      activeSetId: 'set-g4'
    });
    const bridge = makeBridge({
      manifest,
      recent: [
        makeRecent({
          name: 'Kasane Teto',
          activeSetName: 'Normal G4',
          activeScale: 'G4',
          recordedCount: 142,
          totalCount: 365
        })
      ]
    });
    resetAppStore(bridge);

    renderWithI18n(<App />);

    expect(await screen.findByTestId('hub-continue-card')).toBeInTheDocument();
    expect(screen.getByText('Vocal Booth')).toBeInTheDocument();
    expect(screen.queryByText(/Link Start/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('hub-continue-btn')).toHaveTextContent('Resume Session');
    expect(screen.getByTestId('hub-continue-name')).toHaveTextContent('Kasane Teto');
    expect(screen.getByTestId('hub-continue-scale')).toHaveTextContent('G4');
    expect(screen.getByTestId('hub-continue-progress')).toHaveTextContent('142 / 365 recorded');

    const appRoot = screen.getByTestId('app-root');
    expect(appRoot).toHaveClass('min-h-screen');
    expect(appRoot).not.toHaveClass('overflow-hidden');

    await user.click(screen.getByTestId('hub-continue-btn'));

    expect(await screen.findByTestId('studio-screen')).toBeInTheDocument();
    expect(useAppStore.getState().screen).toBe('studio');
    expect(screen.getByTestId('studio-prompt-current')).toHaveTextContent('_ka_ki_ku_3');
    expect(appRoot).toHaveClass('h-screen', 'overflow-hidden');
    expect(appRoot.querySelector('main')).toHaveClass('overflow-hidden');

    // Breadcrumb supports navigating Studio -> Project -> Hub and restores scrollable layout
    await user.click(screen.getByTestId('breadcrumb-project'));
    expect(await screen.findByTestId('project-screen')).toBeInTheDocument();
    expect(appRoot).toHaveClass('min-h-screen');
    expect(appRoot).not.toHaveClass('overflow-hidden');

    await user.click(screen.getByTestId('breadcrumb-hub'));
    expect(await screen.findByTestId('hub-screen')).toBeInTheDocument();
  });

  it('renders empty state when there are no recent projects and handles missingOnDisk safely', async () => {
    const emptyBridge = makeBridge({ recent: [] });
    resetAppStore(emptyBridge);

    const view = renderWithI18n(<App />);
    expect(await screen.findByTestId('hub-empty')).toBeInTheDocument();
    view.unmount();

    const missingBridge = makeBridge({
      recent: [makeRecent({ missingOnDisk: true })]
    });
    resetAppStore(missingBridge);
    renderWithI18n(<App />);

    const continueBtn = await screen.findByTestId('hub-continue-btn');
    expect(continueBtn).toBeDisabled();

    await useAppStore.getState().continueLastSession();
    expect(await screen.findByTestId('toast')).toBeInTheDocument();
    expect(useAppStore.getState().screen).toBe('hub');
  });

  it('validates and creates a new singer project with customizable singer metadata checkboxes', async () => {
    const user = userEvent.setup();
    const bridge = makeBridge({ recent: [] });
    bridge.project.pickDirectory = vi.fn(async () => '/voicebanks/momo');
    const createSpy = vi.spyOn(bridge.project, 'createProject');
    resetAppStore(bridge);

    renderWithI18n(<App />);
    await screen.findByTestId('hub-screen');

    await user.click(screen.getByTestId('hub-create-btn'));
    const dialog = await screen.findByTestId('create-project-dialog');

    // All 3 companion singer metadata checkboxes default to checked
    const charTxtBox = within(dialog).getByTestId('create-singer-file-character-txt');
    const charYamlBox = within(dialog).getByTestId('create-singer-file-character-yaml');
    const prefixMapBox = within(dialog).getByTestId('create-singer-file-prefix-map');
    expect(charTxtBox).toHaveAttribute('aria-checked', 'true');
    expect(charYamlBox).toHaveAttribute('aria-checked', 'true');
    expect(prefixMapBox).toHaveAttribute('aria-checked', 'true');

    // Submit empty -> validation messages without closing
    await user.click(within(dialog).getByTestId('create-project-submit'));
    expect(within(dialog).getAllByRole('alert')).toHaveLength(2);
    expect(createSpy).not.toHaveBeenCalled();

    // Uncheck character.yaml and prefix.map so only character.txt is requested
    await user.click(charYamlBox);
    await user.click(prefixMapBox);
    expect(charYamlBox).toHaveAttribute('aria-checked', 'false');
    expect(prefixMapBox).toHaveAttribute('aria-checked', 'false');

    await user.type(within(dialog).getByTestId('create-project-name'), 'Momone Momo');
    await user.type(within(dialog).getByTestId('create-project-author'), 'Fujimoto');
    await user.click(within(dialog).getByTestId('create-project-pick-folder'));

    await waitFor(() =>
      expect(within(dialog).getByTestId('create-project-folder')).toHaveValue('/voicebanks/momo')
    );

    await user.click(within(dialog).getByTestId('create-project-submit'));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        name: 'Momone Momo',
        rootPath: '/voicebanks/momo',
        author: 'Fujimoto',
        singerFiles: {
          characterTxt: true,
          characterYaml: false,
          prefixMap: false
        }
      })
    );
    expect(await screen.findByTestId('project-screen')).toBeInTheDocument();
    expect(screen.getByTestId('project-name')).toHaveTextContent('Momone Momo');

    // Returning to Hub and opening CreateProjectDialog resets checkboxes back to DEFAULT_SINGER_FILES
    await user.click(screen.getByTestId('breadcrumb-hub'));
    await user.click(await screen.findByTestId('hub-create-btn'));
    const reopenedDialog = await screen.findByTestId('create-project-dialog');
    expect(within(reopenedDialog).getByTestId('create-singer-file-character-yaml')).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(within(reopenedDialog).getByTestId('create-singer-file-prefix-map')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('filters Recent Projects by search query, reveals in file manager, and opens existing folders', async () => {
    const user = userEvent.setup();
    const tetoManifest = makeManifest({ name: 'Kasane Teto', rootPath: '/vb/teto' });
    const defokoManifest = makeManifest({ id: 'project-defoko', name: 'Utane Uta', rootPath: '/vb/defoko' });
    const bridge = makeBridge({
      manifest: tetoManifest,
      recent: [
        makeRecent({ name: 'Kasane Teto', projectPath: '/vb/teto', activeScale: 'G4' }),
        makeRecent({
          name: 'Utane Uta',
          projectPath: '/vb/defoko',
          activeScale: 'C4',
          lastOpenedAt: new Date(Date.now() - 3600_000).toISOString()
        })
      ]
    });
    bridge.project.openProject = vi.fn(async (rootPath: string) =>
      rootPath === '/vb/defoko' ? defokoManifest : tetoManifest
    );
    bridge.project.pickDirectory = vi.fn(async () => '/vb/defoko');
    const revealSpy = vi.spyOn(bridge.shell, 'revealInFileManager');
    resetAppStore(bridge);

    renderWithI18n(<App />);
    await screen.findByTestId('hub-recent');
    expect(screen.getAllByTestId('hub-recent-item')).toHaveLength(2);

    await user.type(screen.getByTestId('hub-recent-search'), 'Utane');
    expect(screen.getAllByTestId('hub-recent-item')).toHaveLength(1);

    await user.click(screen.getByTestId('hub-recent-reveal'));
    expect(revealSpy).toHaveBeenCalledWith('/vb/defoko');

    // Open Existing Folder tile
    await user.click(screen.getByTestId('hub-open-btn'));
    expect(await screen.findByTestId('project-screen')).toBeInTheDocument();
    expect(screen.getByTestId('project-name')).toHaveTextContent('Utane Uta');
  });

  it('syncs <html lang data-theme> dynamically on locale & theme switches and shows Update pill', async () => {
    const user = userEvent.setup();
    const bridge = makeBridge();
    bridge.updater.checkForUpdates = vi.fn(async () => ({
      status: 'available' as const,
      version: '1.1.0',
      releaseUrl: 'https://github.com/team-aie/app/releases/tag/v1.1.0',
      canSelfInstall: false
    }));
    const openUrlSpy = vi.spyOn(bridge.shell, 'openExternalUrl');
    resetAppStore(bridge);

    renderWithI18n(<App />);
    await screen.findByTestId('hub-screen');

    // Switch locale to Japanese
    await user.click(screen.getByTestId('header-lang-ja-JP'));
    await waitFor(() => expect(document.documentElement.lang).toBe('ja-JP'));
    expect(screen.getByText('ボーカルブース')).toBeInTheDocument();
    expect(screen.getByTestId('hub-continue-btn')).toHaveTextContent('セッションを再開');

    // Switch locale to Simplified Chinese
    await user.click(screen.getByTestId('header-lang-zh-CN'));
    await waitFor(() => expect(document.documentElement.lang).toBe('zh-CN'));
    expect(screen.getByText('人声录音棚')).toBeInTheDocument();
    expect(screen.getByTestId('hub-continue-btn')).toHaveTextContent('继续录制');

    // Switch theme to Light -> Dark
    await user.click(screen.getByTestId('header-theme-light'));
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('light'));

    await user.click(screen.getByTestId('header-theme-dark'));
    await waitFor(() => expect(document.documentElement.dataset['theme']).toBe('dark'));

    // Non-blocking Update Available pill
    const pill = await screen.findByTestId('update-pill');
    await user.click(pill);
    expect(openUrlSpy).toHaveBeenCalledWith('https://github.com/team-aie/app/releases/tag/v1.1.0');
  });
});
