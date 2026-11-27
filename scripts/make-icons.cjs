// Genera los iconos de la app instalable (pwa/icon-*.png) con el Chromium preinstalado.
const { chromium } = require('playwright');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1b1e27"/>
  <circle cx="256" cy="256" r="178" fill="#5df9c0"/>
  <g fill="#3b1eff">
    <rect x="120" y="196" width="40" height="120" rx="16"/>
    <rect x="166" y="170" width="44" height="172" rx="18"/>
    <rect x="352" y="196" width="40" height="120" rx="16"/>
    <rect x="302" y="170" width="44" height="172" rx="18"/>
    <rect x="206" y="240" width="100" height="32" rx="12"/>
  </g>
</svg>`;
(async () => {
  const b = await chromium.launch();
  for (const size of [180, 192, 512]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}">`);
    await p.screenshot({ path: `pwa/icon-${size}.png` });
    await p.close();
  }
  await b.close();
})();
