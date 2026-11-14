import fs from 'node:fs';
import path from 'node:path';

/**
 * Links pre-installed node_modules into isolated git worktrees (such as Swarm `workspace:"share"`)
 * so parallel agents can run `tsc`, `vitest`, and `electron-vite` inside the sandbox with zero network calls.
 */
const localNodeModules = path.resolve('node_modules');
if (fs.existsSync(localNodeModules)) {
  console.log('[bootstrap-worktree] node_modules already present.');
  process.exit(0);
}

const candidates = ['/tmp/aie-v1-deps/node_modules', '/Users/iluminar/dev/aie/node_modules'];
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    fs.symlinkSync(candidate, localNodeModules, 'dir');
    console.log(`[bootstrap-worktree] Symlinked node_modules -> ${candidate}`);
    process.exit(0);
  }
}

console.error('[bootstrap-worktree] Could not find shared node_modules cache.');
process.exit(1);
