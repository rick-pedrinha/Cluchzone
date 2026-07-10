import { defineConfig } from 'vite';
import { resolve } from 'path';

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
