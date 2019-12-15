export const enum Locale {
  ZH_CN = 'zh-cn',
  EN_US = 'en-us',
  JA_JP = 'ja-jp',
}

type I18nCandidates = Partial<Record<Locale, string>>;

export interface I18nConfig {
  [i18nKey: string]: I18nCandidates;
}
