import { BuiltInRecordingList } from '../../components/configure-recording-set-page/types';
import { RecordingList } from '../../types';
import { checkFileExistence, dirname, join, lineByLineParser, readFile } from '../../utils';

import { RecordingListData, RecordingListDataService } from './types';

const getBuiltInListData = async (listName: BuiltInRecordingList): Promise<RecordingListData> => {
  switch (listName) {
    case 'デルタ式英語リストver5 (Delta English Ver. 5)': {
      const [listContent, otoIni, dvcfg] = await Promise.all([
        import('delta_eng_ver5/デルタ式engver5_reclist.txt'),
        Promise.resolve({ default: undefined }),
        Promise.resolve({ default: undefined }),
      ]);
      return createRecordingListData(listContent.default, otoIni.default, dvcfg.default);
    }
    case 'DV JPN List by Alex': {
      const [listContent, otoIni, dvcfg] = await Promise.all([
        import('dv_jpn_list_by_alex/DV JPN List by Alex.txt'),
        Promise.resolve({ default: undefined }),
        Promise.resolve({ default: undefined }),
      ]);
      return createRecordingListData(listContent.default, otoIni.default, dvcfg.default);
    }
    case '扩展CVVC 8lite (Extended CVVC 8lite)': {
      const [listContent, otoIni, dvcfg] = await Promise.all([
        import('extended_cvvc_8lite/Reclist.txt'),
        import('extended_cvvc_8lite/oto.ini'),
        Promise.resolve({ default: undefined }),
      ]);
      return createRecordingListData(listContent.default, otoIni.default, dvcfg.default);
    }
    case 'Z式CVVC-Normal (Z Chinese CVVC - Normal)': {
      const [listContent, otoIni, dvcfg] = await Promise.all([
        import('z.cvvc_normal/Reclist.txt'),
        import('z.cvvc_normal/oto.ini'),
        Promise.resolve({ default: undefined }),
      ]);
      return createRecordingListData(listContent.default, otoIni.default, dvcfg.default);
    }
    default:
      throw new Error(`Unknown recording list name: ${listName}`);
  }
};

/**
 * @param listPath Path to the recording list file.
 */
const getCustomListData = async (listPath: string): Promise<RecordingListData> => {
  const baseFolder = dirname(listPath);
  const otoIniPath = join(baseFolder, 'oto.ini');
  const voiceDvcfgPath = join(baseFolder, 'voice.voiceDvcfg');
  const [listContent, otoIni, dvcfg] = await Promise.all([
    readFile(listPath),
    (await checkFileExistence(otoIniPath)) === 'file' ? readFile(otoIniPath) : undefined,
    (await checkFileExistence(voiceDvcfgPath)) === 'file' ? readFile(voiceDvcfgPath) : undefined,
  ]);

  return createRecordingListData(listContent, otoIni, dvcfg);
};

const createRecordingListData = async (
  listContent: string,
  otoIni?: string,
  voiceDvcfg?: string,
): Promise<RecordingListData> => {
  const recordingItems = await lineByLineParser.parse(listContent);
  return {
    listContent,
    recordingItems,
    otoIni,
    voiceDvcfg,
  };
};

export class RawRecordingListDataService implements RecordingListDataService {
  readData = async (list: RecordingList): Promise<RecordingListData> => {
    if (list.type === 'built-in') {
      return getBuiltInListData(list.name);
    } else {
      return getCustomListData(list.filePath);
    }
  };
}
