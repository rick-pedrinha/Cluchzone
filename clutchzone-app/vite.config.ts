import { defineConfig, type ViteDevServer } from 'vite';
import { resolve } from 'path';
import { copyFileSync, readFileSync } from 'fs';

const sharedChatAssets = {
  js: resolve(__dirname, '..', 'chat.js'),
  css: resolve(__dirname, '..', 'chat.css'),
};
const sharedLegacyAssets = {
  'api.js': resolve(__dirname, '..', 'api.js'),
  'config.js': resolve(__dirname, '..', 'config.js'),
  'auth.js': resolve(__dirname, '..', 'auth.js'),
  'auth.css': resolve(__dirname, '..', 'auth.css'),
  'premium.js': resolve(__dirname, '..', 'premium.js'),
  'main.js': resolve(__dirname, '..', 'main.js'),
  'teams.js': resolve(__dirname, '..', 'teams.js'),
  'organizer-panel.js': resolve(__dirname, '..', 'organizer-panel.js'),
  'style.css': resolve(__dirname, '..', 'style.css'),
  'inventory.js': resolve(__dirname, '..', 'inventory.js'),
  'inventory.css': resolve(__dirname, '..', 'inventory.css'),
  'passport.js': resolve(__dirname, '..', 'passport.js'),
  'marketplace.css': resolve(__dirname, '..', 'marketplace.css'),
  'marketplace.js': resolve(__dirname, '..', 'marketplace.js'),
  'seller-erp.js': resolve(__dirname, '..', 'seller-erp.js'),
};

// Mantém o widget social idêntico na versão estática e na versão Vite.
const sharedChatPlugin = {
  name: 'shared-clutch-chat',
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      const acceptsHtml = String(req.headers.accept || '').includes('text/html');
      if (!acceptsHtml) {
        next();
        return;
      }
      res.statusCode = 307;
      res.setHeader('Location', `http://localhost:3000${req.url || '/'}`);
      res.setHeader('Cache-Control', 'no-store');
      res.end();
    });
    server.middlewares.use('/shared-chat.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.end(readFileSync(sharedChatAssets.js));
    });
    server.middlewares.use('/shared-chat.css', (_req, res) => {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.end(readFileSync(sharedChatAssets.css));
    });
    Object.entries(sharedLegacyAssets).forEach(([name, path]) => {
      server.middlewares.use(`/${name}`, (_req, res) => {
        res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
        res.end(readFileSync(path));
      });
    });
  },
  closeBundle() {
    copyFileSync(sharedChatAssets.js, resolve(__dirname, 'dist', 'shared-chat.js'));
    copyFileSync(sharedChatAssets.css, resolve(__dirname, 'dist', 'shared-chat.css'));
    Object.entries(sharedLegacyAssets).forEach(([name, path]) => {
      copyFileSync(path, resolve(__dirname, 'dist', name));
    });
  },
};

export default defineConfig({
  root: '.',
  base: './',
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@features': resolve(__dirname, 'src/features'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  plugins: [sharedChatPlugin],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        csgo: resolve(__dirname, 'csgo.html'),
        'tournament-details': resolve(__dirname, 'tournament-details.html'),
        'my-teams': resolve(__dirname, 'my-teams.html'),
        'team-create': resolve(__dirname, 'team-create.html'),
        passport: resolve(__dirname, 'passport.html'),
        'organizer-panel': resolve(__dirname, 'organizer-panel.html'),
        marketplace: resolve(__dirname, 'marketplace.html'),
        'seller-erp': resolve(__dirname, 'seller-erp.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/zod')) return 'zod';
          if (id.includes('/features/tournaments/')) return 'tournaments';
          if (id.includes('/features/teams/')) return 'teams';
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
