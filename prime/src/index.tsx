import React from 'react';

import './index.css';
import * as Sentry from '@sentry/react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router } from 'react-router-dom';

import App from './App';

if (process.env.REACT_APP_SENTRY_DSN_PRIME) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN_PRIME,
    integrations: [new Sentry.BrowserTracing()],
    // TODO: Automate this
    release: '0.0.1',
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
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
