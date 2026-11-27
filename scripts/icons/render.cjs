// node render.cjs <svg> [sizes...] -> ../../pwa/hamster-<size>.png ; node render.cjs --preview out.png a.svg b.svg c.svg
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const uri = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(f).toString('base64');
(async () => {
  const b = await chromium.launch(); const a = process.argv.slice(2);
  if (a[0] === '--preview') {
    const files = a.slice(2), labels = ['A', 'B', 'C'];
    const p = await b.newPage({ viewport: { width: 1080, height: 470 }, deviceScaleFactor: 2 });
    await p.setContent(`<body style="margin:0;background:#1b1e27;font:600 34px system-ui;color:#eef4fc;display:flex;gap:60px;justify-content:center;align-items:center;height:470px">${files.map((f, i) => `<div style="text-align:center"><img src="${uri(f)}" width="260" height="260" style="border-radius:58px;display:block"><div style="margin-top:22px">${labels[i]}</div></div>`).join('')}</body>`);
    await p.screenshot({ path: a[1] });
  } else {
    for (const s of [180, 192, 512]) { const p = await b.newPage({ viewport: { width: s, height: s } });
      await p.setContent(`<style>body{margin:0}</style><img src="${uri(a[0])}" width="${s}" height="${s}">`);
      await p.screenshot({ path: path.join(__dirname, '../../pwa', `hamster-${s}.png`) }); }
  }
  await b.close();
})();
