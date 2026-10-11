import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { securityHeadersFor } from './shared/security-headers.js';
import { withBridge } from './scripts/lib/bridge.mjs';
import siteConfig from './site.config.json';

const componentsRoot = resolve(__dirname, '..', siteConfig.componentsDir);

/** Local development only: serves the component files the same way the built site does. */
function componentFiles(): Plugin {
  return {
    name: 'forever-component-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const match = /^\/(infinite|preview)\/(.+?)(\.html)?$/.exec(decodeURIComponent(url.pathname));
        if (!match) return next();
        const file = normalize(join(componentsRoot, `${match[2]}.html`));
        if (!file.startsWith(componentsRoot) || !existsSync(file)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        const html = readFileSync(file, 'utf8');
        for (const [name, value] of Object.entries(securityHeadersFor(url.pathname))) res.setHeader(name, value);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(match[1] === 'preview' ? withBridge(html) : html);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), componentFiles()],
  build: { target: 'es2022', sourcemap: false },
  server: { port: 5173 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as Parameters<typeof defineConfig>[0]);
