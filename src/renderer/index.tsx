import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';

import './services/i18n';
import { isDevelopment } from '../common/env-and-consts';

import AppLoadFallback from './components/app-load-fallback';
import { RETAINED_LOCALSTORAGE_KEYS } from './utils/localstorage-clear';
import './index.scss';

if (!isDevelopment) {
  document.body.style.overflow = 'hidden';
}

const resetLocalStorage = () => {
  const reservedStateValues = RETAINED_LOCALSTORAGE_KEYS.map((state) => localStorage.getItem(state));
  localStorage.clear();
  if (!reservedStateValues.includes(null)) {
    for (let index = 0; index < RETAINED_LOCALSTORAGE_KEYS.length; index++) {
      localStorage.setItem(RETAINED_LOCALSTORAGE_KEYS[index], reservedStateValues[index] || '');
    }
  }
};

resetLocalStorage();

const AieAppAsync = React.lazy(() => import('./components/aie-app'));

ReactDOM.render(
  <Suspense fallback={<AppLoadFallback />}>
    <AieAppAsync />
  </Suspense>,
  document.getElementById('app'),
);

if (module.hot) {
  module.hot.accept();
}
