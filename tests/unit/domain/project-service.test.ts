import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import iconv from 'iconv-lite';
import type { RecordingSetConfig } from '@shared/types';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createProject,
  deleteRecordingSet,
  getSetProgress,
  openProject,
  saveProject,
  upsertRecordingSet
} from '../../../src/main/services/project';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('project service (CRUD, progress, legacy aie.config.json migration & raw OREMO adoption)', () => {
  it('creates, opens, updates sets, checks progress, and deletes sets with optional OS Trash callback', async () => {
    const rootDir = await makeTempDir('aie-proj-crud-');

    const created = await createProject({
      name: 'Nova Singer',
      rootPath: rootDir,
      author: 'Team Aie'
    });
    expect(created.schemaVersion).toBe(1);
    expect(created.name).toBe('Nova Singer');
    expect(created.sets).toEqual([]);

    const set1: RecordingSetConfig = {
      id: 'set-f#4',
      name: 'Bright F#4',
      targetLocation: 'subfolder',
      subfolderName: 'F#4',
      scale: 'F#4',
      aliasSuffix: '_F#4',
      reclistSource: { kind: 'builtin', builtinId: 'dv_jpn_list_by_alex' },
      guideAudio: { kind: 'none' },
      generateCompanionFiles: true,
      lastCursorIndex: 0,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    };

    const withSet = await upsertRecordingSet(rootDir, set1);
    expect(withSet.sets).toHaveLength(1);
    expect(withSet.activeSetId).toBe('set-f#4');

    // Reject colliding subfolder names across distinct set IDs
    await expect(
      upsertRecordingSet(rootDir, {
        ...set1,
        id: 'set-collision',
        subfolderName: 'f#4'
      })
    ).rejects.toThrow(/already used/i);

    // Record 2 WAV files and verify case-insensitive progress calculation
    await fs.writeFile(path.join(rootDir, 'F#4', 'a.wav'), 'RIFF-stub');
    await fs.writeFile(path.join(rootDir, 'F#4', 'KA-KA.WAV'), 'RIFF-stub');

    const progress = await getSetProgress(rootDir, withSet.sets[0]!);
    expect(progress.totalCount).toBe(213);
    expect(progress.recordedCount).toBe(2);
    expect(progress.recordedFileNames).toEqual(['a.wav', 'ka-ka.wav']);

    // Save updated manifest name
    const renamed = await saveProject({ ...withSet, name: 'Nova Singer v2' });
    const reopened = await openProject(rootDir);
    expect(reopened.name).toBe(renamed.name);

    // Delete set with trashWavFiles: true using injected trashFn
    const trashedPaths: string[] = [];
    const afterDelete = await deleteRecordingSet(
      {
        rootPath: rootDir,
        setId: 'set-f#4',
        trashWavFiles: true
      },
      async (targetPath) => {
        trashedPaths.push(targetPath);
        await fs.unlink(targetPath);
      }
    );

    expect(afterDelete.sets).toHaveLength(0);
    expect(afterDelete.activeSetId).toBeUndefined();
    expect(trashedPaths.sort()).toEqual(
      [
        path.join(rootDir, 'F#4', 'KA-KA.WAV'),
        path.join(rootDir, 'F#4', 'a.wav')
      ].sort()
    );
  });

  it('automatically migrates legacy v0.x aie.config.json (both LegacyAieV0Config and v0.17 ProjectFile shapes)', async () => {
    const legacyDirA = await makeTempDir('aie-legacy-v0-a-');
    await fs.writeFile(
      path.join(legacyDirA, 'aie.config.json'),
      JSON.stringify({
        name: 'Legacy Singer A',
        sets: [
          {
            name: 'Normal',
            scale: 'G4',
            recordingList: {
              type: 'built-in',
              value: 'z.cvvc_normal'
            }
          }
        ]
      }),
      'utf8'
    );

    const migratedA = await openProject(legacyDirA);
    expect(migratedA.name).toBe('Legacy Singer A');
    expect(migratedA.sets).toHaveLength(1);
    expect(migratedA.sets[0]?.scale).toBe('G4');
    expect(migratedA.sets[0]?.subfolderName).toBe('Normal');
    expect(migratedA.sets[0]?.aliasSuffix).toBe('_G4');
    expect(migratedA.sets[0]?.reclistSource).toEqual({
      kind: 'builtin',
      builtinId: 'z_cvvc_normal'
    });
    expect(migratedA.defaultPhonemizer).toBe(
      'OpenUtau.Plugin.Builtin.ChineseCVVCPhonemizer'
    );

    // Verify aie.project.json and character.yaml were persisted on disk
    const persistedJson = await fs.readFile(
      path.join(legacyDirA, 'aie.project.json'),
      'utf8'
    );
    expect(JSON.parse(persistedJson).schemaVersion).toBe(1);
    const persistedOto = await fs.readFile(
      path.join(legacyDirA, 'Normal', 'oto.ini'),
      'utf8'
    );
    expect(persistedOto).toContain('- a_G4');

    // Also test v0.17.2 ProjectFile shape (`recordingSets` + `{ key, octave }` + legacy display name)
    const legacyDirB = await makeTempDir('aie-legacy-v0-b-');
    await fs.writeFile(
      path.join(legacyDirB, 'aie.config.json'),
      JSON.stringify({
        name: 'Legacy Singer B',
        recordingSets: [
          {
            name: 'Lite8',
            scale: { key: 'A', octave: 4 },
            recordingList: {
              type: 'built-in',
              name: '扩展CVVC 8lite (Extended CVVC 8lite)'
            }
          }
        ]
      }),
      'utf8'
    );

    const migratedB = await openProject(legacyDirB);
    expect(migratedB.sets[0]?.scale).toBe('A4');
    expect(migratedB.sets[0]?.reclistSource).toEqual({
      kind: 'builtin',
      builtinId: 'extended_cvvc_8lite'
    });
    expect(migratedB.sets[0]?.guideAudio).toEqual({
      kind: 'pitched-metronome',
      bpm: 120,
      leadInBeats: 2,
      moraCount: 8
    });
  });

  it('adopts an existing raw OREMO multi-pitch voicebank folder and preserves hand-tuned oto.ini', async () => {
    const oremoDir = await makeTempDir('aie-raw-oremo-');

    // Legacy Shift-JIS character.txt + two pitch subfolders (C4 and G4)
    await fs.writeFile(
      path.join(oremoDir, 'character.txt'),
      iconv.encode(
        'name=小春音アミ\r\nauthor=OREMO Creator\r\nimage=icon.bmp\r\n',
        'shift_jis'
      )
    );

    await fs.mkdir(path.join(oremoDir, 'C4'), { recursive: true });
    await fs.writeFile(
      path.join(oremoDir, 'C4', 'oto.ini'),
      [
        '_あ.wav=あ_C4,125,45,-80,30,15',
        '_い.wav=い_C4,110,40,-75,28,12',
        '_う.wav=う_C4,115,42,-70,25,10'
      ].join('\r\n') + '\r\n',
      'utf8'
    );
    await fs.writeFile(path.join(oremoDir, 'C4', '_あ.wav'), 'RIFF-stub');
    await fs.writeFile(path.join(oremoDir, 'C4', '_い.wav'), 'RIFF-stub');

    await fs.mkdir(path.join(oremoDir, 'G4'), { recursive: true });
    await fs.writeFile(path.join(oremoDir, 'G4', '_あ.wav'), 'RIFF-stub');

    const adopted = await openProject(oremoDir);
    expect(adopted.name).toBe('小春音アミ');
    expect(adopted.author).toBe('OREMO Creator');
    expect(adopted.sets).toHaveLength(2);

    const c4Set = adopted.sets.find((s) => s.subfolderName === 'C4')!;
    const g4Set = adopted.sets.find((s) => s.subfolderName === 'G4')!;
    expect(c4Set.scale).toBe('C4');
    expect(c4Set.aliasSuffix).toBe('_C4');
    expect(g4Set.scale).toBe('G4');

    // Progress on C4 reflects 2 recorded WAVs out of 3 entries in oto.ini
    const c4Progress = await getSetProgress(oremoDir, c4Set);
    expect(c4Progress.totalCount).toBe(3);
    expect(c4Progress.recordedCount).toBe(2);
    expect(c4Progress.recordedFileNames).toEqual(['_あ.wav', '_い.wav']);

    // Verify hand-tuned oto.ini timings and custom image=icon.bmp in character.txt were preserved!
    const c4OtoAfter = await fs.readFile(
      path.join(oremoDir, 'C4', 'oto.ini'),
      'utf8'
    );
    expect(c4OtoAfter).toContain('_あ.wav=あ_C4,125,45,-80,30,15');

    const charTxtAfter = await fs.readFile(
      path.join(oremoDir, 'character.txt'),
      'utf8'
    );
    expect(charTxtAfter).toContain('name=小春音アミ');
    expect(charTxtAfter).toContain('image=icon.bmp');
  });

  it('adopts a monopitch root-level OREMO voicebank folder with root .wav files', async () => {
    const rootOremoDir = await makeTempDir('aie-root-oremo-F#3-');
    await fs.writeFile(path.join(rootOremoDir, '_ka.wav'), 'RIFF-stub');
    await fs.writeFile(path.join(rootOremoDir, '_ki.wav'), 'RIFF-stub');

    const adopted = await openProject(rootOremoDir);
    expect(adopted.sets).toHaveLength(1);
    expect(adopted.sets[0]?.targetLocation).toBe('root');
    expect(adopted.sets[0]?.scale).toBe('F#3');

    const progress = await getSetProgress(rootOremoDir, adopted.sets[0]!);
    expect(progress.recordedCount).toBe(2);
    expect(progress.totalCount).toBe(2);
  });
});
