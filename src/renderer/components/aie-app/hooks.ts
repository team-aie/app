import { nativeTheme } from '@electron/remote';
import { useUpdateEffect } from 'react-use';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import useLocalStorage from 'react-use/lib/useLocalStorage';

import { Consumer, SupportedTheme } from '../../types';
import { getLSKey } from '../../utils';

/**
 * Using the OS's dark mode setting to calculate which theme (light or dark) should be used.
 */
const getSystemMappedTheme = () => {
  const isSystemDarkModeEnabled = nativeTheme.shouldUseDarkColors;
  return isSystemDarkModeEnabled ? SupportedTheme.DARK : SupportedTheme.LIGHT;
};

/**
 * Convert a {@link SupportedTheme} to an accepted value for {@link nativeTheme.themeSource}.
 */
const toSystemDarkModeValue = (theme: SupportedTheme): typeof nativeTheme.themeSource => {
  if (theme === SupportedTheme.LIGHT) {
    return 'light';
  } else {
    return 'dark';
  }
};

/**
 * Read OS's light/dark theme settings and sync app theme with it.
 */
export const useSyncSystemTheme = (): [SupportedTheme, Consumer<SupportedTheme>] => {
  const [isThemeOverriddenByUser = false, setIsThemeOverriddenByUser] = useLocalStorage(
    getLSKey('AieAppHooks', 'isThemeOverriddenByUser'),
    false,
  );
  const [theme = SupportedTheme.LIGHT, rawSetTheme] = useLocalStorage(
    getLSKey('AieAppHooks', 'theme'),
    // SupportedTheme.LIGHT shouldn't really be used if isThemeOverriddenByUser. However, just in case.
    isThemeOverriddenByUser ? SupportedTheme.LIGHT : getSystemMappedTheme(),
  );

  const setTheme = (nextTheme: SupportedTheme) => {
    setIsThemeOverriddenByUser(true);
    rawSetTheme(nextTheme);
  };

  useEffectOnce(() => {
    const syncAppThemeToSystemTheme = () => {
      if (nativeTheme.themeSource === 'system') {
        rawSetTheme(getSystemMappedTheme());
      }
    };

    nativeTheme.addListener('updated', syncAppThemeToSystemTheme);

    return () => {
      nativeTheme.removeListener('updated', syncAppThemeToSystemTheme);
    };
  });

  {
    // Only on launch, if the current theme matches system dark mode, then
    // override isThemeOverriddenByUser with false to give user the chance to follow system settings again.
    useEffectOnce(() => {
      if (theme === getSystemMappedTheme()) {
        setIsThemeOverriddenByUser(false);
      }
    });
    useUpdateEffect(() => {
      if (isThemeOverriddenByUser) {
        nativeTheme.themeSource = toSystemDarkModeValue(theme);
      }
    }, [isThemeOverriddenByUser, theme]);
  }

  return [theme, setTheme];
};
