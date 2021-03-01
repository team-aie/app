import { RawRecordingListDataService } from './raw-recording-list-data-service';
import { RecordingListDataService } from './types';

const instance: RecordingListDataService = new RawRecordingListDataService();
export default instance;
