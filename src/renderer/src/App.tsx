import { ALL_SCALE_NOTES } from '@shared/music/chromatic';

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">aie v1 Foundation</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Desktop Vocal Booth &amp; Turnkey OpenUtau / vLabeler Voicebank Builder (
        {ALL_SCALE_NOTES.length} chromatic target notes ready).
      </p>
    </main>
  );
}
