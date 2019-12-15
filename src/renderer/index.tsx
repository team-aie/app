import 'semantic-ui-css/semantic.min.css';
import './index.scss';

import React from 'react';
import ReactDOM from 'react-dom';

import AieApp from './aie-app';
import { globalKeyDownHandler, globalKeyUpHandler } from './services/key-event-handler-registry';

window.addEventListener('keydown', globalKeyDownHandler);
window.addEventListener('keyup', globalKeyUpHandler);

ReactDOM.render(<AieApp />, document.getElementById('app'));

if (module.hot) {
  module.hot.accept();
}
