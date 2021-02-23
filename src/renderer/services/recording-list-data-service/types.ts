import { RecordingItem, RecordingList } from '../../types';

export interface RecordingListData {
  recordingItems: RecordingItem[];
  otoIni?: string;
  voiceDvcfg?: string;
}

export interface RecordingListDataService {
  readData(list: RecordingList): Promise<RecordingListData>;
}
