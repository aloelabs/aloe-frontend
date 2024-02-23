import React from 'react';

import './index.css';
import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import { DEVELOPMENT, PRODUCTION } from 'shared/lib/data/constants/SentryEnvironments';
import { isProduction } from 'shared/lib/util/Utils';

import App from './App';
import generatedGitInfo from './gitInfo.json';

if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: isProduction() ? PRODUCTION : DEVELOPMENT,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    release: generatedGitInfo.commit || undefined,
    sampleRate: 1.0,
    tracesSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.2,
  });
}

ReactDOM.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
  document.getElementById('root')
);
