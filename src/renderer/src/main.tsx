import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { createI18n, resolveLocale } from '@shared/i18n';
import { App } from './App';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

// Start in the OS language; `useDocumentSync` switches to the persisted
// locale as soon as app settings load.
const i18n = createI18n({
  locale: resolveLocale(navigator.language),
  modules: [initReactI18next]
});

createRoot(rootEl).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>
);
