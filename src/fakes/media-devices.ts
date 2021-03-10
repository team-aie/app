class FakeMediaDevices extends EventTarget implements MediaDevices {
  constructor() {
    super();
    this.addEventListener('devicechange', (e) => {
      if (this.ondevicechange) {
        this.ondevicechange(e);
      }
    });
  }

  ondevicechange: ((this: MediaDevices, ev: Event) => unknown) | null = null;

  enumerateDevices = (): Promise<MediaDeviceInfo[]> => {
    throw new Error('Not implemented. Mock it using jest.spyOn()');
  };

  getSupportedConstraints = (): MediaTrackSupportedConstraints => {
    throw new Error('Not implemented. Mock it using jest.spyOn()');
  };

  getUserMedia = (): Promise<MediaStream> => {
    throw new Error('Not implemented. Mock it using jest.spyOn()');
  };
}

export const createMediaDevices = (): MediaDevices => new FakeMediaDevices();
