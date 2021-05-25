import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';

import './services/i18n';

import AppLoadFallback from './components/app-load-fallback';
import lifeCycleManager from './life-cycles';

import './index.scss';

const AieAppAsync = React.lazy(lifeCycleManager.bootstrap(() => import('./components/aie-app')));

ReactDOM.render(
  <Suspense fallback={<AppLoadFallback />}>
    <AieAppAsync />
  </Suspense>,
  document.getElementById('app'),
);

if (module.hot) {
  module.hot.accept();
}
