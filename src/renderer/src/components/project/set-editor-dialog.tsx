import { FileText, FileUp, ListMusic, Loader2, Music2, Square, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  OctaveNumber,
  RecordingSetConfig,
  ReclistManifest,
  ScaleNote,
  SupportedEncoding
} from '@shared/types';
import {
  ALL_SCALE_NOTES,
  OCTAVES,
  scaleNoteToFrequencyHz,
  scaleNoteToMidi
} from '@shared/music/chromatic';
import { useAppStore } from '@renderer/store/use-app-store';
import {
  Badge,
  Button,
  Field,
  ModalShell,
  NativeSelect,
  Segmented,
  Switch,
  TextInput,
  cx
} from '../shell/ui';
import { playAuditionTone, type AuditionHandle } from './audition-pitch';
import {
  basename,
  configFromDraft,
  defaultDraft,
  draftFromConfig,
  effectiveSubfolder,
  sanitizeFolderName,
  suggestAliasSuffix,
  SUPPORTED_ENCODINGS,
  validateDraft,
  type GuideKind,
  type SetDraft
} from './set-form';

export type PlayTone = (note: ScaleNote) => AuditionHandle | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FilePickRow({
  label,
  value,
  onPick,
  onClear,
  error,
  testId
}: {
  label: string;
  value: string;
  onPick: () => void;
  onClear?: () => void;
  error?: string;
  testId: string;
}) {
  const { t } = useTranslation('project');
  const { t: tc } = useTranslation('common');
  return (
    <Field label={label} error={error}>
      {({ inputId, describedBy, invalid }) => (
        <div className="flex gap-2">
          <TextInput
            id={inputId}
            readOnly
            value={value ? basename(value) : ''}
            title={value}
            placeholder={t('editor.noFile')}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className="font-mono text-xs"
            data-testid={`${testId}-path`}
          />
          {value && onClear ? (
            <Button variant="ghost" onClick={onClear}>
              {tc('actions.clear')}
            </Button>
          ) : null}
          <Button
            onClick={onPick}
            icon={<FileText aria-hidden className="size-4" />}
            data-testid={`${testId}-pick`}
          >
            {t('editor.pickFile')}
          </Button>
        </div>
      )}
    </Field>
  );
}

export function SetEditorDialog({
  open,
  onOpenChange,
  editing,
  existingSets,
  builtins,
  rootPath,
  onSave,
  playTone = playAuditionTone
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: RecordingSetConfig;
  existingSets: RecordingSetConfig[];
  builtins: ReclistManifest[];
  rootPath: string;
  onSave: (config: RecordingSetConfig) => Promise<boolean>;
  playTone?: PlayTone;
}) {
  const { t } = useTranslation('project');
  const { t: tc } = useTranslation('common');
  const bridge = useAppStore((state) => state.bridge);
  const [draft, setDraft] = useState<SetDraft>(() => defaultDraft(builtins));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [auditioning, setAuditioning] = useState(false);
  const toneRef = useRef<AuditionHandle | null>(null);

  useEffect(() => {
    if (!open) {
      toneRef.current?.stop();
      toneRef.current = null;
      setAuditioning(false);
      return;
    }
    setSubmitted(false);
    setSaving(false);
    if (editing) {
      setDraft(draftFromConfig(editing, builtins));
    } else {
      const fresh = defaultDraft(builtins);
      setDraft({ ...fresh, subfolderName: fresh.scale });
    }
    // Only reset when the dialog opens or the edited set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  useEffect(() => () => toneRef.current?.stop(), []);

  const errors = useMemo(() => validateDraft(draft, existingSets), [draft, existingSets]);
  const visibleErrors = submitted
    ? errors
    : { subfolder: errors.subfolder === 'subfolderRequired' ? undefined : errors.subfolder };

  const update = (patch: Partial<SetDraft>): void => setDraft((prev) => ({ ...prev, ...patch }));

  const onScaleChange = (scale: ScaleNote): void => {
    setDraft((prev) => ({
      ...prev,
      scale,
      aliasSuffix:
        prev.aliasSuffixTouched || prev.targetLocation === 'root'
          ? prev.aliasSuffix
          : suggestAliasSuffix(scale),
      subfolderName: prev.subfolderTouched ? prev.subfolderName : scale
    }));
  };

  const onLocationChange = (location: 'root' | 'subfolder'): void => {
    setDraft((prev) => ({
      ...prev,
      targetLocation: location,
      aliasSuffix: prev.aliasSuffixTouched
        ? prev.aliasSuffix
        : location === 'root'
          ? ''
          : suggestAliasSuffix(prev.scale)
    }));
  };

  const onBuiltinChange = (id: string): void => {
    const manifest = builtins.find((candidate) => candidate.id === id);
    setDraft((prev) => ({
      ...prev,
      builtinId: id,
      bpm: manifest?.recommendedBpm ?? prev.bpm
    }));
  };

  const pick = async (
    field: 'reclistPath' | 'commentFilePath' | 'otoFilePath' | 'guideFilePath',
    extensions: string[]
  ): Promise<void> => {
    try {
      const picked = await bridge.project.pickFile({ title: t(`editor.${fieldLabel(field)}`), extensions });
      if (picked) {
        update({ [field]: picked } as Partial<SetDraft>);
      }
    } catch {
      // Picker unavailable in preview mode.
    }
  };

  const audition = (): void => {
    if (toneRef.current) {
      toneRef.current.stop();
      toneRef.current = null;
      setAuditioning(false);
      return;
    }
    const handle = playTone(draft.scale);
    if (!handle) {
      return;
    }
    toneRef.current = handle;
    setAuditioning(true);
    void handle.finished.then(() => {
      if (toneRef.current === handle) {
        toneRef.current = null;
        setAuditioning(false);
      }
    });
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      return;
    }
    setSaving(true);
    const ok = await onSave(configFromDraft(draft));
    setSaving(false);
    if (ok) {
      onOpenChange(false);
    }
  };

  const folder = effectiveSubfolder(draft);
  const sanitizedDiffers =
    draft.targetLocation === 'subfolder' &&
    draft.subfolderName.trim() !== '' &&
    sanitizeFolderName(draft.subfolderName) !== draft.subfolderName;
  const separator = rootPath.includes('\\') ? '\\' : '/';
  const previewPath =
    draft.targetLocation === 'root' ? rootPath : `${rootPath}${separator}${folder}`;

  const errorText = (key: string | undefined): string | undefined => {
    switch (key) {
      case 'nameRequired':
        return t('editor.nameRequired');
      case 'subfolderRequired':
        return t('editor.subfolderRequired');
      case 'subfolderCollision':
        return t('editor.subfolderCollision', { name: folder });
      case 'rootCollision':
        return t('editor.rootCollision');
      case 'reclistRequired':
        return t('editor.reclistRequired');
      case 'guideFileRequired':
        return t('editor.guideFileRequired');
      default:
        return undefined;
    }
  };

  const registerLabelForOctave = (octave: OctaveNumber): string => {
    if (octave <= 3) {
      return t('editor.registerLow');
    }
    if (octave === 4) {
      return t('editor.registerMid');
    }
    return t('editor.registerHigh');
  };

  const registerLabelForNote = (note: ScaleNote): string => {
    const midi = scaleNoteToMidi(note);
    if (midi < 60) {
      return t('editor.registerLow');
    }
    if (midi < 67) {
      return t('editor.registerMid');
    }
    return t('editor.registerHigh');
  };

  const selectedHz = Math.round(scaleNoteToFrequencyHz(draft.scale));
  const selectedScaleWithHz = t('editor.scaleWithHz', { note: draft.scale, hz: selectedHz });

  const scaleGroups = OCTAVES.map((octave) => ({
    octave,
    registerLabel: registerLabelForOctave(octave),
    notes: ALL_SCALE_NOTES.filter((note) => note.endsWith(String(octave)))
  }));

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('editor.editTitle') : t('editor.createTitle')}
      description={t('editor.description')}
      closeLabel={tc('actions.close')}
      width="max-w-3xl"
      testId="set-editor"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="set-editor-form"
            disabled={saving}
            data-testid="set-save-btn"
            icon={saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined}
          >
            {saving ? t('editor.saving') : editing ? t('editor.save') : t('editor.create')}
          </Button>
        </>
      }
    >
      <form
        id="set-editor-form"
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-6"
      >
        <Section title={t('editor.sections.reclist')}>
          <div
            role="radiogroup"
            aria-label={t('editor.reclistSource')}
            className="grid gap-2.5 sm:grid-cols-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={draft.reclistKind === 'builtin'}
              data-testid="set-reclist-mode-builtin"
              onClick={() => update({ reclistKind: 'builtin' })}
              className={cx(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                draft.reclistKind === 'builtin'
                  ? 'border-accent bg-accent-soft text-fg shadow-sm'
                  : 'border-line bg-raised/40 text-muted hover:border-line-strong hover:text-fg'
              )}
            >
              <span
                className={cx(
                  'grid size-8 shrink-0 place-items-center rounded-lg',
                  draft.reclistKind === 'builtin'
                    ? 'bg-accent text-on-accent'
                    : 'bg-sunken text-subtle'
                )}
              >
                <ListMusic aria-hidden className="size-4" />
              </span>
              <span className="text-sm font-semibold">{t('editor.builtin')}</span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={draft.reclistKind === 'custom'}
              data-testid="set-reclist-mode-custom"
              onClick={() => update({ reclistKind: 'custom' })}
              className={cx(
                'flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                draft.reclistKind === 'custom'
                  ? 'border-accent bg-accent-soft text-fg shadow-sm'
                  : 'border-line bg-raised/40 text-muted hover:border-line-strong hover:text-fg'
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  className={cx(
                    'grid size-8 shrink-0 place-items-center rounded-lg',
                    draft.reclistKind === 'custom'
                      ? 'bg-accent text-on-accent'
                      : 'bg-sunken text-subtle'
                  )}
                >
                  <FileUp aria-hidden className="size-4" />
                </span>
                <span className="text-sm font-semibold">{t('editor.importCustomCta')}</span>
              </span>
              <Badge tone={draft.reclistKind === 'custom' ? 'accent' : 'neutral'}>
                {t('editor.custom')}
              </Badge>
            </button>
          </div>

          {draft.reclistKind === 'builtin' ? (
            builtins.length === 0 ? (
              <p className="text-sm text-subtle">{t('editor.noBuiltins')}</p>
            ) : (
              <div role="radiogroup" aria-label={t('editor.builtin')} className="grid gap-2 sm:grid-cols-2">
                {builtins.map((manifest) => {
                  const selected = draft.builtinId === manifest.id;
                  return (
                    <label
                      key={manifest.id}
                      data-testid={`set-reclist-builtin-${manifest.id}`}
                      className={cx(
                        'flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition-colors',
                        selected ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="set-builtin"
                          value={manifest.id}
                          checked={selected}
                          onChange={() => onBuiltinChange(manifest.id)}
                          className="mt-1 accent-[var(--aie-accent)]"
                        />
                        <span className="text-sm font-medium text-fg">{manifest.displayName}</span>
                      </span>
                      <span className="pl-5 text-xs text-muted">
                        {t('editor.builtinMeta', { author: manifest.author, style: manifest.style })}
                      </span>
                      <span className="flex flex-wrap gap-1.5 pl-5">
                        <Badge>{t(`editor.reclistLanguage.${manifest.language}`)}</Badge>
                        {manifest.recommendedBpm ? (
                          <Badge tone="accent">
                            {t('editor.recommendedBpm', { bpm: manifest.recommendedBpm })}
                          </Badge>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-raised/30 p-3.5">
              <FilePickRow
                label={t('editor.reclistFile')}
                value={draft.reclistPath}
                error={submitted ? errorText(errors.reclist) : undefined}
                onPick={() => void pick('reclistPath', ['txt'])}
                testId="set-reclist-file"
              />
              <FilePickRow
                label={t('editor.commentFile')}
                value={draft.commentFilePath}
                onPick={() => void pick('commentFilePath', ['txt'])}
                onClear={() => update({ commentFilePath: '' })}
                testId="set-comment-file"
              />
              <FilePickRow
                label={t('editor.otoFile')}
                value={draft.otoFilePath}
                onPick={() => void pick('otoFilePath', ['ini'])}
                onClear={() => update({ otoFilePath: '' })}
                testId="set-oto-file"
              />
              <Field label={t('editor.encoding')}>
                {({ inputId }) => (
                  <NativeSelect
                    id={inputId}
                    value={draft.encoding}
                    onChange={(event) => update({ encoding: event.target.value as SupportedEncoding })}
                    className="max-w-64"
                    data-testid="set-encoding-select"
                  >
                    {SUPPORTED_ENCODINGS.map((encoding) => (
                      <option key={encoding} value={encoding}>
                        {t(`editor.encodingOptions.${encoding}`)}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            </div>
          )}
        </Section>

        <Section title={t('editor.sections.pitch')}>
          <Field label={t('editor.scale')} hint={t('editor.scaleHint')}>
            {({ inputId, describedBy }) => (
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect
                  id={inputId}
                  value={draft.scale}
                  onChange={(event) => onScaleChange(event.target.value as ScaleNote)}
                  aria-describedby={describedBy}
                  className="max-w-52 font-mono"
                  data-testid="set-scale-select"
                >
                  {scaleGroups.map((group) => (
                    <optgroup
                      key={group.octave}
                      label={`${t('editor.octave', { octave: group.octave })} · ${group.registerLabel}`}
                    >
                      {group.notes.map((note) => (
                        <option key={note} value={note}>
                          {t('editor.scaleWithHz', {
                            note,
                            hz: Math.round(scaleNoteToFrequencyHz(note))
                          })}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </NativeSelect>
                <Badge tone="accent" data-testid="set-scale-register-badge">
                  {registerLabelForNote(draft.scale)}
                </Badge>
                <Button
                  onClick={audition}
                  data-testid="set-audition-btn"
                  aria-pressed={auditioning}
                  icon={
                    auditioning ? (
                      <Square aria-hidden className="size-3.5 fill-current" />
                    ) : (
                      <Volume2 aria-hidden className="size-4" />
                    )
                  }
                >
                  {auditioning
                    ? t('editor.auditionPlaying', { note: selectedScaleWithHz })
                    : `${t('editor.audition')} · ${selectedScaleWithHz}`}
                </Button>
              </div>
            )}
          </Field>
          <p data-testid="set-octave-guide" className="text-xs leading-relaxed text-muted">
            {t('editor.octaveGuide')}
          </p>
        </Section>

        <Section title={t('editor.sections.basics')}>
          <Field label={t('editor.name')} error={errorText(visibleErrors.name)}>
            {({ inputId, describedBy, invalid }) => (
              <TextInput
                id={inputId}
                value={draft.name}
                placeholder={t('editor.namePlaceholder')}
                onChange={(event) => update({ name: event.target.value })}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                data-testid="set-name-input"
              />
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted">{t('editor.location')}</span>
            <div role="radiogroup" aria-label={t('editor.location')} className="grid gap-2 sm:grid-cols-2">
              {(['subfolder', 'root'] as const).map((location) => {
                const selected = draft.targetLocation === location;
                return (
                  <label
                    key={location}
                    data-testid={`set-location-${location}`}
                    className={cx(
                      'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors',
                      selected ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-fg">
                      <input
                        type="radio"
                        name="set-location"
                        value={location}
                        checked={selected}
                        onChange={() => onLocationChange(location)}
                        className="accent-[var(--aie-accent)]"
                      />
                      {location === 'subfolder' ? t('editor.locationSubfolder') : t('editor.locationRoot')}
                    </span>
                    <span className="pl-5 text-xs text-subtle">
                      {location === 'subfolder'
                        ? t('editor.locationSubfolderDescription')
                        : t('editor.locationRootDescription')}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {draft.targetLocation === 'subfolder' ? (
              <Field
                label={t('editor.subfolderName')}
                error={errorText(visibleErrors.subfolder)}
                hint={
                  sanitizedDiffers
                    ? t('editor.subfolderSanitized', { name: folder })
                    : undefined
                }
              >
                {({ inputId, describedBy, invalid }) => (
                  <TextInput
                    id={inputId}
                    value={draft.subfolderName}
                    onChange={(event) =>
                      update({ subfolderName: event.target.value, subfolderTouched: true })
                    }
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="font-mono"
                    data-testid="set-subfolder-input"
                  />
                )}
              </Field>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted">{t('editor.subfolderName')}</span>
                <div className="flex h-9 items-center rounded-lg border border-dashed border-line px-3 font-mono text-sm text-subtle">
                  {t('rootLabel')}
                </div>
                {visibleErrors.subfolder ? (
                  <p role="alert" className="text-xs text-danger">
                    {errorText(visibleErrors.subfolder)}
                  </p>
                ) : null}
              </div>
            )}
            <Field label={t('editor.aliasSuffix')} hint={t('editor.aliasSuffixHint')}>
              {({ inputId, describedBy }) => (
                <div className="flex gap-2">
                  <TextInput
                    id={inputId}
                    value={draft.aliasSuffix}
                    onChange={(event) =>
                      update({ aliasSuffix: event.target.value, aliasSuffixTouched: true })
                    }
                    aria-describedby={describedBy}
                    className="font-mono"
                    data-testid="set-alias-input"
                  />
                  {draft.aliasSuffix !== suggestAliasSuffix(draft.scale) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      data-testid="set-alias-suggest"
                      onClick={() =>
                        update({ aliasSuffix: suggestAliasSuffix(draft.scale), aliasSuffixTouched: true })
                      }
                    >
                      {t('editor.aliasSuggest', { suffix: suggestAliasSuffix(draft.scale) })}
                    </Button>
                  ) : null}
                </div>
              )}
            </Field>
          </div>
          <p data-testid="set-path-preview" className="truncate font-mono text-[11px] text-subtle" title={previewPath}>
            {t('editor.subfolderPreview', { path: previewPath })}
          </p>
        </Section>

        <Section title={t('editor.sections.guide')}>
          <Segmented<GuideKind>
            label={t('editor.guide')}
            value={draft.guideKind}
            onChange={(kind) => update({ guideKind: kind })}
            size="md"
            options={[
              { value: 'none', label: t('editor.guideNone'), testId: 'set-guide-none' },
              {
                value: 'pitched-metronome',
                label: (
                  <>
                    <Music2 aria-hidden className="size-3.5" />
                    {t('editor.guideMetronome')}
                  </>
                ),
                testId: 'set-guide-metronome'
              },
              { value: 'custom-file', label: t('editor.guideCustom'), testId: 'set-guide-custom' }
            ]}
          />
          {draft.guideKind === 'pitched-metronome' ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ['bpm', t('editor.bpm'), 30, 300],
                  ['leadInBeats', t('editor.leadInBeats'), 0, 16],
                  ['moraCount', t('editor.moraCount'), 1, 32]
                ] as const
              ).map(([key, label, min, max]) => (
                <Field key={key} label={label}>
                  {({ inputId }) => (
                    <TextInput
                      id={inputId}
                      type="number"
                      min={min}
                      max={max}
                      value={Number.isFinite(draft[key]) ? draft[key] : ''}
                      onChange={(event) => update({ [key]: event.target.valueAsNumber } as Partial<SetDraft>)}
                      className="font-mono"
                      data-testid={`set-guide-${key}`}
                    />
                  )}
                </Field>
              ))}
            </div>
          ) : null}
          {draft.guideKind === 'custom-file' ? (
            <FilePickRow
              label={t('editor.guideFile')}
              value={draft.guideFilePath}
              error={submitted ? errorText(errors.guideFile) : undefined}
              onPick={() => void pick('guideFilePath', ['wav', 'mp3', 'ogg', 'flac'])}
              testId="set-guide-file"
            />
          ) : null}
        </Section>

        <Section title={t('editor.sections.turnkey')}>
          <Switch
            checked={draft.generateCompanionFiles}
            onCheckedChange={(checked) => update({ generateCompanionFiles: checked })}
            label={t('editor.companion')}
            description={t('editor.companionDescription')}
            testId="set-companion-toggle"
          />
        </Section>
      </form>
    </ModalShell>
  );
}

function fieldLabel(
  field: 'reclistPath' | 'commentFilePath' | 'otoFilePath' | 'guideFilePath'
): 'reclistFile' | 'commentFile' | 'otoFile' | 'guideFile' {
  switch (field) {
    case 'reclistPath':
      return 'reclistFile';
    case 'commentFilePath':
      return 'commentFile';
    case 'otoFilePath':
      return 'otoFile';
    case 'guideFilePath':
      return 'guideFile';
  }
}
