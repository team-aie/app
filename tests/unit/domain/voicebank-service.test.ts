import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import iconv from 'iconv-lite';
import { parse as parseYaml } from 'yaml';
import type { AieProjectManifest, RecordingSetConfig } from '@shared/types';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listBuiltinReclists,
  loadRecordingList,
  syncSingerScaffolding
} from '../../../src/main/services/voicebank';

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

function createSetConfig(
  overrides: Partial<RecordingSetConfig>
): RecordingSetConfig {
  const now = '2026-11-14T00:00:00.000Z';
  return {
    id: 'set-1',
    name: 'Normal',
    targetLocation: 'subfolder',
    subfolderName: 'G4',
    scale: 'G4',
    aliasSuffix: '_G4',
    reclistSource: { kind: 'builtin', builtinId: 'z_cvvc_normal' },
    guideAudio: { kind: 'none' },
    generateCompanionFiles: true,
    lastCursorIndex: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('voicebank service (built-in reclists, loader & singer scaffolding)', () => {
  it('lists all 4 built-in reclist manifests in dev and custom resourcesRoot modes', async () => {
    const manifests = await listBuiltinReclists();
    expect(manifests.map((m) => m.id)).toEqual([
      'delta_eng_ver5',
      'dv_jpn_list_by_alex',
      'extended_cvvc_8lite',
      'z_cvvc_normal'
    ]);

    const viaParentResources = await listBuiltinReclists(
      path.resolve('resources')
    );
    expect(viaParentResources).toHaveLength(4);
  });

  it('loads built-in delta_eng_ver5 with X-SAMPA hints and README.md, and extended_cvvc_8lite with 8-mora oto syllables', async () => {
    const rootDir = await makeTempDir('aie-vb-builtin-');

    const deltaBundle = await loadRecordingList(
      rootDir,
      createSetConfig({
        reclistSource: { kind: 'builtin', builtinId: 'delta_eng_ver5' }
      })
    );
    expect(deltaBundle.entries).toHaveLength(415);
    const xsampaItem = deltaBundle.entries.find(
      (e) => e.rawPrompt === '_i+_{_i+'
    );
    expect(xsampaItem?.pronunciationHint).toContain('[ɪ] - [æ] - [ɪ]');
    expect(deltaBundle.readmeMarkdown).toContain('発音記号の解説');

    const cvvc8Bundle = await loadRecordingList(
      rootDir,
      createSetConfig({
        reclistSource: { kind: 'builtin', builtinId: 'extended_cvvc_8lite' }
      })
    );
    expect(cvvc8Bundle.entries).toHaveLength(365);
    expect(cvvc8Bundle.entries[0]?.syllables).toEqual([
      '- a',
      'ba',
      'pa',
      'ma',
      'fa',
      'da',
      'ta',
      'na',
      'a b',
      'a p',
      'a m',
      'a f',
      'a d',
      'a t',
      'a n',
      'a R'
    ]);
  });

  it('resolves packaged process.resourcesPath and respects generateCompanionFiles=false', async () => {
    const rootDir = await makeTempDir('aie-vb-packaged-');
    const prevDescriptor = Object.getOwnPropertyDescriptor(
      process,
      'resourcesPath'
    );
    Object.defineProperty(process, 'resourcesPath', {
      value: path.resolve('resources'),
      configurable: true,
      writable: true
    });
    try {
      const manifests = await listBuiltinReclists();
      expect(manifests).toHaveLength(4);
    } finally {
      if (prevDescriptor) {
        Object.defineProperty(process, 'resourcesPath', prevDescriptor);
      } else {
        Reflect.deleteProperty(process, 'resourcesPath');
      }
    }

    const noCompanionSet = createSetConfig({
      id: 'set-no-comp',
      subfolderName: 'C3',
      scale: 'C3',
      aliasSuffix: '_C3',
      generateCompanionFiles: false
    });
    await syncSingerScaffolding({
      schemaVersion: 1,
      id: 'proj-no-comp',
      name: 'Minimal Singer',
      rootPath: rootDir,
      sets: [noCompanionSet],
      activeSetId: 'set-no-comp',
      createdAt: '2026-11-14T00:00:00.000Z',
      updatedAt: '2026-11-14T00:00:00.000Z'
    });

    await expect(
      fs.stat(path.join(rootDir, 'C3', 'oto.ini'))
    ).rejects.toThrow();
    const charYamlRaw = await fs.readFile(
      path.join(rootDir, 'character.yaml'),
      'utf8'
    );
    expect(charYamlRaw).toContain('text_file_encoding: utf-8');
  });

  it('loads custom Shift-JIS reclist, OREMO-comment.txt, oto.ini, and voice.dvcfg cleanly', async () => {
    const rootDir = await makeTempDir('aie-vb-custom-');
    const customDir = path.join(rootDir, 'custom-list');
    await fs.mkdir(customDir, { recursive: true });

    await fs.writeFile(
      path.join(customDir, 'reclist.txt'),
      iconv.encode('_あ_い\r\n_か_き\r\n', 'shift_jis')
    );
    await fs.writeFile(
      path.join(customDir, 'OREMO-comment.txt'),
      iconv.encode('_あ_い\t明るく発音\r\n', 'shift_jis')
    );
    await fs.writeFile(
      path.join(customDir, 'oto.ini'),
      iconv.encode(
        '_あ_い.wav=あ,100,40,-50,20,10\r\n_あ_い.wav=い,300,40,-50,20,10\r\n',
        'shift_jis'
      )
    );
    await fs.writeFile(
      path.join(customDir, 'voice.dvcfg'),
      '{"singer":"DeepVocalTest"}\n',
      'utf8'
    );

    const bundle = await loadRecordingList(
      rootDir,
      createSetConfig({
        reclistSource: {
          kind: 'custom',
          reclistPath: path.join(customDir, 'reclist.txt'),
          encoding: 'auto'
        }
      })
    );

    expect(bundle.detectedEncoding).toBe('shift_jis');
    expect(bundle.entries).toHaveLength(2);
    expect(bundle.entries[0]?.pronunciationHint).toBe('明るく発音');
    expect(bundle.entries[0]?.syllables).toEqual(['あ', 'い']);
    expect(bundle.rawDvcfgText).toContain('DeepVocalTest');
  });

  it('scaffolds UTF-8 character.txt, OpenUtau character.yaml with multi-pitch subbanks, prefix.map, and suffixed companion files', async () => {
    const rootDir = await makeTempDir('aie-vb-scaffold-');
    const now = '2026-11-14T00:00:00.000Z';

    const setC4 = createSetConfig({
      id: 'set-c4',
      name: 'Low C4',
      subfolderName: 'C4',
      scale: 'C4',
      aliasSuffix: '_C4',
      reclistSource: { kind: 'builtin', builtinId: 'z_cvvc_normal' }
    });
    const setG4 = createSetConfig({
      id: 'set-g4',
      name: 'High G4',
      subfolderName: 'G4',
      scale: 'G4',
      aliasSuffix: '_G4',
      reclistSource: { kind: 'builtin', builtinId: 'extended_cvvc_8lite' }
    });
    const setDelta = createSetConfig({
      id: 'set-delta',
      name: 'Soft',
      subfolderName: 'G4_Soft',
      scale: 'G4',
      aliasSuffix: '_G4_Soft',
      reclistSource: { kind: 'builtin', builtinId: 'delta_eng_ver5' }
    });

    const manifest: AieProjectManifest = {
      schemaVersion: 1,
      id: 'proj-1',
      name: 'Aie Test Singer',
      rootPath: rootDir,
      author: 'Studio Producer',
      sets: [setC4, setG4, setDelta],
      activeSetId: 'set-c4',
      createdAt: now,
      updatedAt: now
    };

    await syncSingerScaffolding(manifest);

    // 1. character.txt
    const charTxt = await fs.readFile(
      path.join(rootDir, 'character.txt'),
      'utf8'
    );
    expect(charTxt).toContain('name=Aie Test Singer');
    expect(charTxt).toContain('author=Studio Producer');

    // 2. OpenUtau character.yaml
    const charYamlRaw = await fs.readFile(
      path.join(rootDir, 'character.yaml'),
      'utf8'
    );
    const charYaml = parseYaml(charYamlRaw) as {
      name: string;
      singer_type: string;
      text_file_encoding: string;
      default_phonemizer: string;
      subbanks: Array<{
        color: string;
        prefix: string;
        suffix: string;
        tone_ranges: string[];
      }>;
    };

    expect(charYaml.name).toBe('Aie Test Singer');
    expect(charYaml.singer_type).toBe('utau');
    expect(charYaml.text_file_encoding).toBe('utf-8');
    expect(charYaml.default_phonemizer).toBe(
      'OpenUtau.Plugin.Builtin.ChineseCVVCPhonemizer'
    );
    expect(charYaml.subbanks).toEqual([
      {
        color: '',
        prefix: '',
        suffix: '_C4',
        tone_ranges: ['C1-D#4']
      },
      {
        color: '',
        prefix: '',
        suffix: '_G4',
        tone_ranges: ['E4-B7']
      },
      {
        color: 'Soft',
        prefix: '',
        suffix: '_G4_Soft',
        tone_ranges: ['C1-B7']
      }
    ]);

    // 3. prefix.map
    const prefixMap = await fs.readFile(
      path.join(rootDir, 'prefix.map'),
      'utf8'
    );
    const prefixLines = prefixMap.trim().split('\n');
    expect(prefixLines).toHaveLength(84); // B7 down to C1
    expect(prefixMap).toContain('C4\t\t_C4');
    expect(prefixMap).toContain('D#4\t\t_C4');
    expect(prefixMap).toContain('E4\t\t_G4');
    expect(prefixMap).toContain('G4\t\t_G4');

    // 4. Companion files with _C4 / _G4 oto suffixing and clean UTF-8 without BOM
    const c4Oto = await fs.readFile(
      path.join(rootDir, 'C4', 'oto.ini'),
      'utf8'
    );
    expect(c4Oto.split('\n')[0]).toBe(
      '_a_a_a.wav=- a_C4,1207.1,128.6,-300,42.9,14.3'
    );

    const g4Oto = await fs.readFile(
      path.join(rootDir, 'G4', 'oto.ini'),
      'utf8'
    );
    expect(g4Oto.split('\n')[0]).toBe(
      '_a_ba_pa_ma_fa_da_ta_na.wav=- a_G4,1200,150,-350,50,16.7'
    );

    const presampRoot = await fs.readFile(
      path.join(rootDir, 'presamp.ini'),
      'utf8'
    );
    const presampChnRoot = await fs.readFile(
      path.join(rootDir, 'presampCHN.ini'),
      'utf8'
    );
    expect(presampRoot).toContain('[VERSION]');
    expect(presampChnRoot).toContain('[VERSION]');

    const mkototempBuf = await fs.readFile(
      path.join(rootDir, 'G4_Soft', 'mkototemp.ini')
    );
    // Verify UTF-8 BOM from source mkototemp.ini was stripped cleanly
    expect(mkototempBuf[0]).not.toBe(0xef);
    expect(mkototempBuf.toString('utf8')).toContain('[TEMPO]');
  });

  it('respects manifest.singerFiles in syncSingerScaffolding without deleting existing unchecked files', async () => {
    const noneDir = await makeTempDir('aie-vb-singer-none-');
    const now = '2026-11-14T00:00:00.000Z';

    await syncSingerScaffolding({
      schemaVersion: 1,
      id: 'proj-none',
      name: 'No Root Metadata',
      rootPath: noneDir,
      singerFiles: {
        characterTxt: false,
        characterYaml: false,
        prefixMap: false
      },
      sets: [createSetConfig({ generateCompanionFiles: true })],
      activeSetId: 'set-1',
      createdAt: now,
      updatedAt: now
    });

    await expect(fs.stat(path.join(noneDir, 'character.txt'))).rejects.toThrow();
    await expect(fs.stat(path.join(noneDir, 'character.yaml'))).rejects.toThrow();
    await expect(fs.stat(path.join(noneDir, 'prefix.map'))).rejects.toThrow();
    // Per-set oto.ini still follows setConfig.generateCompanionFiles
    const setOto = await fs.readFile(path.join(noneDir, 'G4', 'oto.ini'), 'utf8');
    expect(setOto).toContain('- a_G4');

    // Enable only characterYaml and verify only character.yaml is written
    await syncSingerScaffolding({
      schemaVersion: 1,
      id: 'proj-yaml-only',
      name: 'YAML Only Singer',
      rootPath: noneDir,
      singerFiles: {
        characterTxt: false,
        characterYaml: true,
        prefixMap: false
      },
      sets: [createSetConfig({ generateCompanionFiles: true })],
      activeSetId: 'set-1',
      createdAt: now,
      updatedAt: now
    });

    await expect(fs.stat(path.join(noneDir, 'character.txt'))).rejects.toThrow();
    await expect(fs.stat(path.join(noneDir, 'prefix.map'))).rejects.toThrow();
    const yamlText = await fs.readFile(
      path.join(noneDir, 'character.yaml'),
      'utf8'
    );
    expect(yamlText).toContain('name: YAML Only Singer');
  });
});
