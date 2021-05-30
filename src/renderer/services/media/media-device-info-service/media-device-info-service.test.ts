import { mocked } from 'ts-jest/utils';

import { MediaDeviceInfoService } from './media-device-info-service';

import '../../../../common/test-utils/jest-rxjs-matchers';

jest.mock('electron-log');

type RequiredMediaDeviceInfo = Omit<MediaDeviceInfo, 'toJSON'>;
const createMockMediaDeviceInfo = (info: RequiredMediaDeviceInfo): MediaDeviceInfo => {
  return {
    ...info,
    toJSON: () => info,
  };
};

// Alias to make test more readable.
const m = createMockMediaDeviceInfo;

// TODO: Complete test cases with more realistic data and scenarios.
describe('MediaDeviceInfoService', () => {
  it('should fetch new device lists on creation', async () => {
    expect.assertions(2);

    const { mediaDevices } = navigator;

    jest.spyOn(mediaDevices, 'enumerateDevices').mockResolvedValue([
      m({
        deviceId: 'a',
        groupId: 'a',
        kind: 'audioinput',
        label: 'Input A',
      }),
      m({
        deviceId: 'b',
        groupId: 'a',
        kind: 'audiooutput',
        label: 'Output A',
      }),
    ]);

    const enumerateDevicesMock = mocked(mediaDevices.enumerateDevices);

    const service = new MediaDeviceInfoService(mediaDevices);

    expect(enumerateDevicesMock).toHaveBeenCalledTimes(1);

    await expect(service.categorizedDeviceInfo$).toEmit({
      audioInputs: [
        {
          deviceId: 'a',
          groupId: 'a',
          isAudioInput: true,
          isAudioOutput: false,
          isDefaultAudioInput: false,
          isDefaultAudioOutput: false,
          isDefaultVideoInput: false,
          isVideoInput: false,
          name: 'Input A',
        },
      ],
      audioOutputs: [
        {
          deviceId: 'b',
          groupId: 'a',
          isAudioInput: false,
          isAudioOutput: true,
          isDefaultAudioInput: false,
          isDefaultAudioOutput: false,
          isDefaultVideoInput: false,
          isVideoInput: false,
          name: 'Output A',
        },
      ],
      videoInputs: [],
    });
  });

  it('should fetch new device lists on `devicechange` event', async () => {
    expect.assertions(2);

    const { mediaDevices } = navigator;

    jest
      .spyOn(mediaDevices, 'enumerateDevices')
      .mockResolvedValue([
        m({
          deviceId: 'a',
          groupId: 'a',
          kind: 'audioinput',
          label: 'Input A',
        }),
        m({
          deviceId: 'b',
          groupId: 'a',
          kind: 'audiooutput',
          label: 'Output A',
        }),
      ])
      .mockResolvedValue([
        m({
          deviceId: 'a',
          groupId: 'a',
          kind: 'audioinput',
          label: 'Input A',
        }),
        m({
          deviceId: 'b',
          groupId: 'a',
          kind: 'audiooutput',
          label: 'Output A',
        }),
      ]);

    const enumerateDevicesMock = mocked(mediaDevices.enumerateDevices);

    const service = new MediaDeviceInfoService(mediaDevices);

    mediaDevices.dispatchEvent(new Event('devicechange'));

    expect(enumerateDevicesMock).toHaveBeenCalledTimes(2);

    await expect(service.categorizedDeviceInfo$).toEmit({
      audioInputs: [
        {
          deviceId: 'a',
          groupId: 'a',
          isAudioInput: true,
          isAudioOutput: false,
          isDefaultAudioInput: false,
          isDefaultAudioOutput: false,
          isDefaultVideoInput: false,
          isVideoInput: false,
          name: 'Input A',
        },
      ],
      audioOutputs: [
        {
          deviceId: 'b',
          groupId: 'a',
          isAudioInput: false,
          isAudioOutput: true,
          isDefaultAudioInput: false,
          isDefaultAudioOutput: false,
          isDefaultVideoInput: false,
          isVideoInput: false,
          name: 'Output A',
        },
      ],
      videoInputs: [],
    });
  });
});
