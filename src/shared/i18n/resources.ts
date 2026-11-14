import type { LocaleCode } from '@shared/types';
import jaCommon from './locales/ja-JP/common.json';
import jaHub from './locales/ja-JP/hub.json';
import jaProject from './locales/ja-JP/project.json';
import jaSettings from './locales/ja-JP/settings.json';
import jaStudio from './locales/ja-JP/studio.json';
import enCommon from './locales/en-US/common.json';
import enHub from './locales/en-US/hub.json';
import enProject from './locales/en-US/project.json';
import enSettings from './locales/en-US/settings.json';
import enStudio from './locales/en-US/studio.json';
import zhCommon from './locales/zh-CN/common.json';
import zhHub from './locales/zh-CN/hub.json';
import zhProject from './locales/zh-CN/project.json';
import zhSettings from './locales/zh-CN/settings.json';
import zhStudio from './locales/zh-CN/studio.json';

export const SUPPORTED_LOCALES = ['en-US', 'zh-CN', 'ja-JP'] as const satisfies readonly LocaleCode[];
export const NAMESPACES = ['common', 'hub', 'project', 'studio', 'settings'] as const;
export const DEFAULT_LOCALE: LocaleCode = 'en-US';
export const DEFAULT_NAMESPACE = 'common' as const;

export type I18nNamespace = (typeof NAMESPACES)[number];

/** en-US is the canonical source of truth for the key tree and for type inference. */
export const enUSResources = {
  common: enCommon,
  hub: enHub,
  project: enProject,
  studio: enStudio,
  settings: enSettings
} as const;

export type LocaleResourceBundle = typeof enUSResources;

/**
 * Structural "same key tree, string leaves" type. Translations are checked
 * against the en-US shape at compile time AND by `locale-parity.test.ts`.
 */
export type DeepStringTree<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringTree<T[K]>;
};

const zhCNResources: DeepStringTree<LocaleResourceBundle> = {
  common: zhCommon,
  hub: zhHub,
  project: zhProject,
  studio: zhStudio,
  settings: zhSettings
};

const jaJPResources: DeepStringTree<LocaleResourceBundle> = {
  common: jaCommon,
  hub: jaHub,
  project: jaProject,
  studio: jaStudio,
  settings: jaSettings
};

export const resources: Record<LocaleCode, DeepStringTree<LocaleResourceBundle>> = {
  'en-US': enUSResources,
  'zh-CN': zhCNResources,
  'ja-JP': jaJPResources
};
