import log from 'electron-log';
import { BackendModule, ReadCallback, Services } from 'i18next';

import { isDevelopment } from '../../env-and-consts';

interface WebpackImportBackendOptions {
  saveMissingAllHierarchy: boolean;
}

/**
 * It turns out, Webpack dynamic import only works if the path is specified statically.
 * So we have to fallback to the switch statements.
 */
async function loadLanguageFile(
  language: string,
  namespace: string,
): Promise<{
  default: { [key: string]: string };
}> {
  switch (language) {
    case 'zh-CN': {
      switch (namespace) {
        case 'translation':
          return import('../../../locales/zh-CN/translation.json');
      }
      break;
    }
    case 'en-US': {
      switch (namespace) {
        case 'translation':
          return import('../../../locales/en-US/translation.json');
      }
      break;
    }
    case 'ja-JP': {
      switch (namespace) {
        case 'translation':
          return import('../../../locales/ja-JP/translation.json');
      }
      break;
    }
  }

  throw new Error(`Translation file not found for language: ${language}; namespace: ${namespace}`);
}

const saveLoadPathPattern = '../../../locales/{{lng}}/{{ns}}.{{ext}}';

export default class WebpackImportBackend implements BackendModule<WebpackImportBackendOptions> {
  // Need this extra static variable to so the constructor has the field as well
  static type: 'backend' = 'backend';
  type: 'backend' = 'backend';
  private saveMissingAllHierarchy = false;

  init(
    services: Services,
    { saveMissingAllHierarchy }: WebpackImportBackendOptions = { saveMissingAllHierarchy: false },
  ): void {
    this.saveMissingAllHierarchy = saveMissingAllHierarchy;
  }

  create(languages: string[], namespace: string, key: string, fallbackValue: string): void {
    log.info(
      `WebpackImportBackend.create: languages: ${languages}; namespace: ${namespace}; key: ${key}; fallbackValue: ${fallbackValue}`,
    );

    if (isDevelopment) {
      (async (): Promise<void> => {
        const fs = await import('fs');
        const path = await import('path');

        const onSaveLanguageMissingFile = (language: string): void => {
          const missingFile = path.join(
            __dirname,
            saveLoadPathPattern
              .replace('{{lng}}', language)
              .replace('{{ns}}', namespace)
              .replace('{{ext}}', 'missing.json'),
          );

          const tryCreateNewFile = (): void => {
            const missingFileDir = path.dirname(missingFile);
            if (!fs.existsSync(missingFileDir)) {
              fs.mkdirSync(missingFileDir, { recursive: true });
            }
            fs.writeFileSync(missingFile, JSON.stringify({ [key]: fallbackValue }, null, 2));
          };

          if (fs.existsSync(missingFile)) {
            let missing;
            try {
              missing = JSON.parse(String(fs.readFileSync(missingFile)));
            } catch (e) {
              log.error(`Failed to read ${missingFile}`, e);
              tryCreateNewFile();
              return;
            }
            missing[key] = fallbackValue;
            fs.writeFileSync(missingFile, JSON.stringify(missing, null, 2));
          } else {
            tryCreateNewFile();
          }
        };

        if (this.saveMissingAllHierarchy) {
          languages.forEach(onSaveLanguageMissingFile);
        } else {
          onSaveLanguageMissingFile(languages[0]);
        }
      })();
    } else {
      log.warn(new Error('saveMissing is turned ON. This should not be done in production!'));
    }
  }

  read(language: string, namespace: string, callback: ReadCallback): void {
    log.info(`WebpackImportBackend.read: language: ${language}; namespace: ${namespace}`);
    loadLanguageFile(language, namespace)
      // We don't have to use ".default" but this can make TypeScript check better, since it doesn't add the content of JSON to the imported object
      .then((translations) => callback(null, translations.default))
      .catch((error) => callback(error, false));
  }
}
