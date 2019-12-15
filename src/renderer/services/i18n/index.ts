import { I18nConfig, Locale } from '../../types/i18n';

class I18nRegistry {
  private configs: I18nConfig = {};

  public register(...newConfigs: I18nConfig[]): void {
    let currentConfigs = {
      ...this.configs,
    };
    newConfigs.forEach((newConfig): void => {
      currentConfigs = {
        ...currentConfigs,
        ...newConfig,
      };
    });
    this.configs = currentConfigs;
  }

  public getTranslation(i18nKey: string, locale: Locale): string {
    const result = this.configs[i18nKey][locale];
    if (!result) {
      throw new Error(`Cannot find translation for ${i18nKey}!`);
    }
    return result;
  }
}

export const i18n = new I18nRegistry();
