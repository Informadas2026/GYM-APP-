# Cuaderno de Fuerza

App personal para registrar entrenamientos de fuerza y carreras. Funciona sin conexión y se instala en el iPhone desde Safari (Compartir → Añadir a pantalla de inicio).

Los datos se guardan solo en el dispositivo (IndexedDB). Para pasar datos entre dispositivos: Perfil → Exportar copia (JSON) e Importar copia.

## Desarrollo

```bash
npm install
npm run dev          # servidor local
npm test             # pruebas
npm run build:pages  # versión instalable (dist-pages/), la que publica GitHub Pages
npm run build && node scripts/to-artifact.mjs   # versión para claude.ai (dist/artifact.html)
```

Cada push a `main` publica la app en GitHub Pages (`.github/workflows/pages.yml`).
Al cambiar `pwa/sw.js`, sube el número de `CACHE` para que el iPhone descargue la versión nueva.
