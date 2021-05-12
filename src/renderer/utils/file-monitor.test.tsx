import fs from 'fs';
import path from 'path';

import { first } from 'rxjs/operators';

import { FileMonitor } from './file-monitor';

beforeAll(() => {
  fs.mkdirSync(__dirname + '/temp');
});

afterAll(() => {
  fs.rmdirSync(__dirname + '/temp');
});

describe('FileMonitor', () => {
  it('should report adding files', async () => {
    expect.assertions(1);

    const fileMonitor = new FileMonitor(__dirname + '/temp');
    fileMonitor.watch(['add']);
    const reportedFiles = fileMonitor.getSubject().pipe(first()).toPromise();

    fs.writeFileSync(path.join(__dirname, 'temp', 'test.txt'), __dirname);

    const message = await reportedFiles;

    expect(message).toStrictEqual(['add', __dirname + '\\temp\\test.txt']);

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
