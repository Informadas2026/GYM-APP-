// Convierte dist/index.html (un solo archivo) en el formato de página de claude.ai:
// sin <!doctype>/<html>/<head>/<body> propios; el título y los estilos van primero.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const cleanHead = head
  .replace(/<meta charset="UTF-8" \/>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/(<title>[^<]*<\/title>)/, '$1\n<meta name="claude:viewport-fit-sides" content="cover">');
writeFileSync('dist/artifact.html', cleanHead.trim() + '\n' + body.trim() + '\n');
console.log('dist/artifact.html', (cleanHead.length + body.length) / 1024 | 0, 'KB');
