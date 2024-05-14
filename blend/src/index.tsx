import React from 'react';

import { createRoot } from 'react-dom/client';
import './index.css';
import { HashRouter as Router } from 'react-router-dom';

import App from './App';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
