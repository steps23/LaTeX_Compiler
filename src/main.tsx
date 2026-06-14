import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress harmless ResizeObserver errors
window.addEventListener('error', (e) => {
  if (e.message.includes('ResizeObserver') || e.message.includes('undelivered notifications')) {
    const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
    const viteOverlay = document.getElementById('vite-error-overlay');
    if (viteOverlay) {
        viteOverlay.remove();
    }
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('ResizeObserver')) {
    return;
  }
  originalError.call(console, ...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
