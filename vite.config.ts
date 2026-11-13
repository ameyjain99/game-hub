import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatLayout, isBoardLayout, layoutPath } from './src/games/ticket-to-ride/engine/data/layout';

/** Dev-only endpoint behind the board editor's Save button: rewrites `<mapId>.layout.json`. */
function boardEditorSave(): Plugin {
  return {
    name: 'board-editor-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__board-editor/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { map, layout } = JSON.parse(body);
            const rel = layoutPath(map);
            const file = rel && resolve(server.config.root, rel);
            // Only overwrite an existing layout file; a new map creates its file once by hand.
            if (!file || !existsSync(file)) throw new Error(`no layout file for map "${map}"`);
            if (!isBoardLayout(layout)) throw new Error('malformed layout');
            writeFileSync(file, formatLayout(layout));
            res.end('ok');
          } catch (err) {
            res.statusCode = 400;
            res.end((err as Error).message);
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), boardEditorSave()],
  // Absolute base so hashed asset URLs resolve from the domain root on any deep
  // path (e.g. /ticket-to-ride/create or /ticket-to-ride/<code>); a relative
  // base would make a refreshed deep link request /ticket-to-ride/assets/… and
  // 404 into a blank page.
  base: '/',
  // Dev: proxy socket.io + the JSON API to the Node game server
  // (`npm run dev:server`).
  server: {
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
});
