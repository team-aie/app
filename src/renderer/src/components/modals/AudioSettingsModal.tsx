import { Mic, RefreshCw, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SampleRateHz, WavBitDepth } from '@shared/types';
import { useAppStore } from '@renderer/store/useAppStore';
import { Button, Field, ModalShell, NativeSelect, Segmented, Switch, TextInput, cx } from '../shell/ui';

interface DeviceOption {
  deviceId: string;
  label: string;
}

const METER_FLOOR_DB = -60;

export function peakToDb(peak: number): number {
  if (peak <= 0) {
    return -Infinity;
  }
  return 20 * Math.log10(peak);
}

/** Maps dBFS onto a 0..1 meter scale with a −60 dB floor. */
export function dbToMeter(db: number): number {
  if (!Number.isFinite(db)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

function useAudioDevices(open: boolean) {
  const [inputs, setInputs] = useState<DeviceOption[]>([]);
  const [outputs, setOutputs] = useState<DeviceOption[]>([]);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!media?.enumerateDevices) {
      setFailed(true);
      return;
    }
    try {
      const devices = await media.enumerateDevices();
      const map = (kind: MediaDeviceKind): DeviceOption[] =>
        devices
          .filter((device) => device.kind === kind && device.deviceId && device.deviceId !== 'default')
          .map((device) => ({ deviceId: device.deviceId, label: device.label }));
      setInputs(map('audioinput'));
      setOutputs(map('audiooutput'));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    void refresh();
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    media?.addEventListener?.('devicechange', refresh);
    return () => media?.removeEventListener?.('devicechange', refresh);
  }, [open, refresh]);

  return { inputs, outputs, failed, refresh };
}

function useMicCheck(inputDeviceId: string) {
  const [running, setRunning] = useState(false);
  const [levelDb, setLevelDb] = useState(-Infinity);
  const [clipping, setClipping] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setRunning(false);
    setLevelDb(-Infinity);
    setClipping(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined;
    if (!media?.getUserMedia || !Ctor) {
      return;
    }
    try {
      const stream = await media.getUserMedia({
        audio: {
          deviceId: inputDeviceId && inputDeviceId !== 'default' ? { exact: inputDeviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      const ctx = new Ctor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      let frame = 0;
      let clipHoldUntil = 0;
      const tick = (): void => {
        analyser.getFloatTimeDomainData(buffer);
        let peak = 0;
        for (const sample of buffer) {
          const abs = Math.abs(sample);
          if (abs > peak) {
            peak = abs;
          }
        }
        const now = performance.now();
        if (peak >= 0.999) {
          clipHoldUntil = now + 1200;
        }
        setLevelDb(peakToDb(peak));
        setClipping(now < clipHoldUntil);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      cleanupRef.current = () => {
        cancelAnimationFrame(frame);
        source.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        void ctx.close();
      };
      setRunning(true);
    } catch {
      stop();
    }
  }, [inputDeviceId, stop]);

  useEffect(() => stop, [stop]);

  return { running, levelDb, clipping, start, stop };
}

export function AudioSettingsModal() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const open = useAppStore((state) => state.modals.audioSettings);
  const closeModal = useAppStore((state) => state.closeModal);
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const bridge = useAppStore((state) => state.bridge);
  const { inputs, outputs, failed, refresh } = useAudioDevices(open);
  const mic = useMicCheck(settings.inputDeviceId);

  useEffect(() => {
    if (!open) {
      mic.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setFormat = (patch: Partial<typeof settings.wavFormat>): void =>
    void updateSettings({ wavFormat: { ...settings.wavFormat, ...patch } });

  const pickTool = async (key: 'vLabelerPath' | 'openUtauPath', tool: string): Promise<void> => {
    try {
      const picked = await bridge.project.pickFile({ title: t('audio.pickExecutableTitle', { tool }) });
      if (picked) {
        void updateSettings({ externalTools: { ...settings.externalTools, [key]: picked } });
      }
    } catch {
      // Picker unavailable in preview mode.
    }
  };

  const deviceLabel = (device: DeviceOption, index: number): string =>
    device.label || t('audio.unnamedDevice', { index: index + 1 });

  const meter = dbToMeter(mic.levelDb);

  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => (next ? undefined : closeModal('audioSettings'))}
      title={t('audio.title')}
      description={t('audio.description')}
      closeLabel={tc('actions.close')}
      width="max-w-2xl"
      testId="audio-settings-modal"
    >
      <div className="flex flex-col gap-7">
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">
              {t('audio.devices')}
            </h3>
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw aria-hidden className="size-3.5" />}
              onClick={() => void refresh()}
            >
              {t('audio.refreshDevices')}
            </Button>
          </div>
          {failed ? <p className="text-xs text-warn">{t('audio.devicesUnavailable')}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('audio.input')}>
              {({ inputId }) => (
                <NativeSelect
                  id={inputId}
                  value={settings.inputDeviceId || 'default'}
                  onChange={(event) => void updateSettings({ inputDeviceId: event.target.value })}
                  data-testid="settings-input-device"
                >
                  <option value="default">{t('audio.defaultDevice')}</option>
                  {inputs.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {deviceLabel(device, index)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label={t('audio.output')}>
              {({ inputId }) => (
                <NativeSelect
                  id={inputId}
                  value={settings.outputDeviceId || 'default'}
                  onChange={(event) => void updateSettings({ outputDeviceId: event.target.value })}
                  data-testid="settings-output-device"
                >
                  <option value="default">{t('audio.defaultDevice')}</option>
                  {outputs.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {deviceLabel(device, index)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-line bg-raised/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-fg">{t('audio.micCheck')}</span>
              <Button
                size="sm"
                variant={mic.running ? 'record' : 'secondary'}
                onClick={() => (mic.running ? mic.stop() : void mic.start())}
                data-testid="settings-mic-check"
                icon={
                  mic.running ? (
                    <Square aria-hidden className="size-3 fill-current" />
                  ) : (
                    <Mic aria-hidden className="size-3.5" />
                  )
                }
              >
                {mic.running ? t('audio.micCheckStop') : t('audio.micCheckStart')}
              </Button>
            </div>
            <div
              role="meter"
              aria-label={t('audio.micCheck')}
              aria-valuemin={METER_FLOOR_DB}
              aria-valuemax={0}
              aria-valuenow={Number.isFinite(mic.levelDb) ? Math.round(mic.levelDb) : METER_FLOOR_DB}
              className="relative h-2.5 overflow-hidden rounded-full bg-sunken"
            >
              <div
                className={cx(
                  'absolute inset-y-0 left-0 rounded-full transition-[width] duration-75',
                  mic.clipping ? 'bg-rec' : meter > 0.85 ? 'bg-warn' : 'bg-ok'
                )}
                style={{ width: `${meter * 100}%` }}
              />
            </div>
            <p className={cx('text-xs', mic.clipping ? 'text-rec' : 'text-subtle')}>
              {mic.clipping
                ? t('audio.micCheckClipping')
                : mic.running && Number.isFinite(mic.levelDb)
                  ? t('audio.micCheckLevel', { value: mic.levelDb.toFixed(1) })
                  : t('audio.micCheckIdle')}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">
            {t('audio.format')}
          </h3>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">{t('audio.sampleRate')}</span>
              <Segmented<'44100' | '48000'>
                label={t('audio.sampleRate')}
                size="md"
                value={String(settings.wavFormat.sampleRate) as '44100' | '48000'}
                onChange={(value) => setFormat({ sampleRate: Number(value) as SampleRateHz })}
                options={[
                  { value: '44100', label: t('audio.sampleRateValue', { value: '44.1' }), testId: 'settings-rate-44100' },
                  { value: '48000', label: t('audio.sampleRateValue', { value: '48' }), testId: 'settings-rate-48000' }
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">{t('audio.bitDepth')}</span>
              <Segmented<'16' | '24' | '32'>
                label={t('audio.bitDepth')}
                size="md"
                value={String(settings.wavFormat.bitDepth) as '16' | '24' | '32'}
                onChange={(value) => setFormat({ bitDepth: Number(value) as WavBitDepth })}
                options={[
                  { value: '16', label: t('audio.bitDepth16'), testId: 'settings-depth-16' },
                  { value: '24', label: t('audio.bitDepth24'), testId: 'settings-depth-24' },
                  { value: '32', label: t('audio.bitDepth32'), testId: 'settings-depth-32' }
                ]}
              />
            </div>
          </div>
          <Switch
            checked={settings.wavFormat.removeDcOffset}
            onCheckedChange={(checked) => setFormat({ removeDcOffset: checked })}
            label={t('audio.removeDcOffset')}
            description={t('audio.removeDcOffsetDescription')}
            testId="settings-dc-offset"
          />
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">
            {t('audio.externalTools')}
          </h3>
          {(
            [
              ['vLabelerPath', 'vLabeler', t('audio.vLabelerPath')],
              ['openUtauPath', 'OpenUtau', t('audio.openUtauPath')]
            ] as const
          ).map(([key, tool, label]) => (
            <Field key={key} label={label}>
              {({ inputId }) => (
                <div className="flex gap-2">
                  <TextInput
                    id={inputId}
                    value={settings.externalTools[key]}
                    placeholder={t('audio.pathPlaceholder')}
                    onChange={(event) =>
                      void updateSettings({
                        externalTools: { ...settings.externalTools, [key]: event.target.value }
                      })
                    }
                    className="font-mono text-xs"
                    data-testid={`settings-${key}`}
                  />
                  <Button onClick={() => void pickTool(key, tool)}>{t('audio.pickExecutable')}</Button>
                </div>
              )}
            </Field>
          ))}
        </section>
      </div>
    </ModalShell>
  );
}
