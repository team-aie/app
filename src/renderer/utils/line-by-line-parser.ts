import sanitize from 'sanitize-filename';

import { RecordingItem, RecordingListParser } from '../types';

import { ensureLF } from './string-utils';

class LineByLineParser implements RecordingListParser {
  public async parse(content: string): Promise<RecordingItem[]> {
    const displayTextSet = new Set();
    const fileSystemNameMap: { [key: string]: number } = {};
    let endingIndex = Number.MAX_VALUE;
    return ensureLF(content)
      .split('\n')
      .map((line): string => line.trim())
      .filter((item, i): boolean => {
        const itemLowerCase = item.toLowerCase();
        if (itemLowerCase === 'end') {
          endingIndex = i;
          return false;
        }
        return !!itemLowerCase && itemLowerCase !== 'start' && !itemLowerCase.startsWith('@') && i < endingIndex;
      })
      .map((displayText): [string, string] => [displayText, sanitize(displayText)])
      .filter(([displayText, fileSystemName]): boolean => {
        if (!fileSystemName) {
          return false;
        }

        if (displayTextSet.has(displayText)) {
          throw new Error(`Duplicate recording items to record: ${displayText}`);
        }
        displayTextSet.add(displayText);

        return true;
      })
      .map(([displayText, fileSystemName]): [string, string] => {
        if (fileSystemNameMap[fileSystemName]) {
          const previousCounts = fileSystemNameMap[fileSystemName];
          fileSystemName = `${fileSystemName}_${previousCounts}`;
          fileSystemNameMap[fileSystemName]++;
        } else {
          fileSystemNameMap[fileSystemName] = 1;
        }

        return [displayText, fileSystemName];
      })
      .map(
        ([displayText, dedupedFileSystemName]): RecordingItem => ({
          displayText,
          fileSystemName: dedupedFileSystemName,
        }),
      );
  }
}

export const lineByLineParser = new LineByLineParser();
