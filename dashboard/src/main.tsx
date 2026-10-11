import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.css';

const root = document.getElementById('fc-app-root');
// The dashboard must never run inside a frame (for example inside one of its own previews).
if (root && window.top === window.self) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // Ask the browser to keep saved favourites and collections for as long as it can.
  void navigator.storage?.persist?.().catch(() => undefined);
}
