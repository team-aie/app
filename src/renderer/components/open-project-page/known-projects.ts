import { PathLike } from 'fs';

import Dexie from 'dexie';

import { RecordingProject } from '../../types';

class KnownProjectDatabase extends Dexie {
  knownProjects: Dexie.Table<RecordingProject, [string, PathLike]>; // `number` is the type of the primkey.
  constructor() {
    super('KnownProjectDatabase');
    this.version(1).stores({
      knownProjects: '&rootPath',
    });
    this.knownProjects = this.table('knownProjects');
  }
}

const knownProjectDb = new KnownProjectDatabase();

export default knownProjectDb.knownProjects;
