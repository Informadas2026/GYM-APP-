/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Etiquetas de app instalable: solo en la versión web (GitHub Pages), no en el artefacto. */
function pwaHead(): Plugin {
  return {
    name: 'pwa-head',
    transformIndexHtml: (html) => html.replace('</head>', `    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" href="./icon-180.png" />
    <link rel="icon" type="image/png" href="./icon-192.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Fuerza" />
    <meta name="theme-color" content="#1b1e27" />
  </head>`),
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: mode === 'pages' ? 'pwa' : false,
  build: { outDir: mode === 'pages' ? 'dist-pages' : 'dist' },
  plugins: [react(), viteSingleFile(), ...(mode === 'pages' ? [pwaHead()] : [])],
  test: { globals: true, environment: 'node' },
}));
