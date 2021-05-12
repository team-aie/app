import fs from 'fs';
import path from 'path';

import fse from 'fs-extra';
import { first } from 'rxjs/operators';

import { FileMonitor } from './file-monitor';

describe('FileMonitor', () => {
  beforeAll(() => {
    fs.mkdirSync(__dirname + '/temp');
  });

  afterAll(() => {
    fse.emptyDirSync(__dirname + '/temp');
    fs.rmdirSync(__dirname + '/temp');
  });

  it('should report adding files', async () => {
    expect.assertions(1);

    const fileMonitor = new FileMonitor(__dirname + '/temp');
    fileMonitor.watch(['add']);
    const reportedFiles = fileMonitor.getSubject().pipe(first()).toPromise();

    fs.writeFileSync(path.join(__dirname, 'temp', 'test.txt'), __dirname);

    const message = await reportedFiles;

    expect(message).toStrictEqual(['add', path.join(__dirname, 'temp', 'test.txt')]);

    fs.unlinkSync(path.join(__dirname, 'temp', 'test.txt'));

    fileMonitor.closeAll();
  });

  it('getEvents should work', () => {
    const fileMonitor = new FileMonitor(__dirname + '/temp');
    fileMonitor.watch(['add', 'change']);

    expect(fileMonitor.getEvents()).toEqual(['add', 'change']);
  });

  it('getEvents watching should work', () => {
    const fileMonitor = new FileMonitor(__dirname + '/temp');
    fileMonitor.watch(['add', 'change']);
    fileMonitor.unwatch(['add']);

    expect(fileMonitor.getEventsWatching()).toEqual(['change']);
  });
});
