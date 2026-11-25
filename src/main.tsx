import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/router';
import './styles/globals.css';
import './styles/details.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
