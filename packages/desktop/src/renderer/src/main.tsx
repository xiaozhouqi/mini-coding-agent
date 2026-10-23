import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Renderer entry point. React 18's createRoot mounts the app into #root.
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
