import { FolderOpen, Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@renderer/store/useAppStore';
import { Button, Field, ModalShell, TextInput } from '../shell/ui';

export function CreateProjectDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('hub');
  const { t: tc } = useTranslation('common');
  const bridge = useAppStore((state) => state.bridge);
  const createProject = useAppStore((state) => state.createProject);
  const creating = useAppStore((state) => state.busy.creating);

  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setAuthor('');
      setRootPath('');
      setSubmitted(false);
    }
  }, [open]);

  const nameError = submitted && !name.trim() ? t('create.nameRequired') : undefined;
  const folderError = submitted && !rootPath ? t('create.folderRequired') : undefined;

  const pickFolder = async (): Promise<void> => {
    try {
      const picked = await bridge.project.pickDirectory(t('create.pickFolderTitle'));
      if (picked) {
        setRootPath(picked);
      }
    } catch {
      // Picker unavailable (preview mode); keep the current value.
    }
  };

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !rootPath) {
      return;
    }
    const created = await createProject({
      name: name.trim(),
      rootPath,
      author: author.trim() || undefined
    });
    if (created) {
      onOpenChange(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={t('create.title')}
      description={t('create.description')}
      closeLabel={tc('actions.close')}
      testId="create-project-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="create-project-form"
            data-testid="create-project-submit"
            disabled={creating}
            icon={creating ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined}
          >
            {creating ? t('create.creating') : t('create.submit')}
          </Button>
        </>
      }
    >
      <form
        id="create-project-form"
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Field label={t('create.singerName')} error={nameError}>
          {({ inputId, describedBy, invalid }) => (
            <TextInput
              id={inputId}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('create.singerNamePlaceholder')}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              data-testid="create-project-name"
            />
          )}
        </Field>
        <Field label={t('create.author')}>
          {({ inputId }) => (
            <TextInput
              id={inputId}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder={t('create.authorPlaceholder')}
              data-testid="create-project-author"
            />
          )}
        </Field>
        <Field label={t('create.folder')} error={folderError} hint={t('create.turnkeyNote')}>
          {({ inputId, describedBy, invalid }) => (
            <div className="flex gap-2">
              <TextInput
                id={inputId}
                readOnly
                value={rootPath}
                placeholder={t('create.folderPlaceholder')}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                data-testid="create-project-folder"
                className="font-mono text-xs"
              />
              <Button
                onClick={() => void pickFolder()}
                icon={<FolderOpen aria-hidden className="size-4" />}
                data-testid="create-project-pick-folder"
              >
                {t('create.pickFolder')}
              </Button>
            </div>
          )}
        </Field>
      </form>
    </ModalShell>
  );
}
