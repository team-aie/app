import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';

import './services/i18n';
import { isDevelopment } from '../common/env-and-consts';

import AppLoadFallback from './components/app-load-fallback';
import { globalKeyDownHandler, globalKeyUpHandler } from './services/key-event-handler-registry';

import './index.scss';

window.addEventListener('keydown', globalKeyDownHandler);
window.addEventListener('keyup', globalKeyUpHandler);

if (!isDevelopment) {
  document.body.style.overflow = 'hidden';
}

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
