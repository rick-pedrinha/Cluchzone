import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, readFileSync } from 'fs';

const sharedChatAssets = {
  js: resolve(__dirname, '..', 'chat.js'),
  css: resolve(__dirname, '..', 'chat.css'),
};

// Mantém o widget social idêntico na versão estática e na versão Vite.
const sharedChatPlugin = {
  name: 'shared-cluch-chat',
  configureServer(server: { middlewares: { use: (path: string, handler: (req: unknown, res: { setHeader: (name: string, value: string) => void; end: (body: Buffer) => void }) => void) => void } }) {
    server.middlewares.use('/shared-chat.js', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.end(readFileSync(sharedChatAssets.js));
    });
    server.middlewares.use('/shared-chat.css', (_req, res) => {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.end(readFileSync(sharedChatAssets.css));
    });
  },
  closeBundle() {
    copyFileSync(sharedChatAssets.js, resolve(__dirname, 'dist', 'shared-chat.js'));
    copyFileSync(sharedChatAssets.css, resolve(__dirname, 'dist', 'shared-chat.css'));
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
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
