import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

// Dev-only board layout editor at `/?editor`; stripped from production builds.
const BoardEditor =
  import.meta.env.DEV && new URLSearchParams(location.search).has('editor')
    ? lazy(() => import('./games/ticket-to-ride/ui/editor/BoardEditor'))
    : null;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {BoardEditor ? (
      <Suspense fallback={null}>
        <BoardEditor />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
