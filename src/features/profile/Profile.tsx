import { useEffect, useRef, useState } from 'react';
import { useAppData } from '../../state';
import { saveSettings } from '../../data/repo';
import { buildBackup, buildSetsCsv, importBackup, parseBackup } from '../../data/backup';
import { onSyncState, type SyncState } from '../../data/sync';
import type { CloudDownloads } from '../../data/cloudTypes';
import { Segmented, Sheet } from '../../ui/Sheet';
import type { PaletteId } from '../../domain/types';
import { Icon } from '../../ui/Icon';

const PALETTES: { id: PaletteId; name: string; main: string; second: string }[] = [
  { id: 'electrico', name: 'Menta y azul océano', main: '#5df9c0', second: '#3b1eff' },
  { id: 'lima', name: 'Lima y lavanda', main: '#d9f23c', second: '#b5a5f6' },
  { id: 'coral', name: 'Coral y arena', main: '#ff8a65', second: '#f5d6b8' },
  { id: 'oceano', name: 'Cielo y menta', main: '#7cc4ff', second: '#b9f0d5' },
  { id: 'salvia', name: 'Melocotón y salvia', main: '#ffb37c', second: '#c3d7b4' },
];

const SYNC_TEXT: Record<SyncState, string> = {
  local: 'Guardado solo en este dispositivo',
  connecting: 'Conectando con tu copia en la nube…',
  synced: 'Sincronizado con tu cuenta de Claude',
  syncing: 'Sincronizando…',
  offline: 'Sin conexión: se guarda en el dispositivo y se enviará al volver',
};

export function Profile() {
  const { settings, sessions, exercises } = useAppData();
  const [sync, setSync] = useState<SyncState>('local');
  const [msg, setMsg] = useState<string | null>(null);
  const [fallback, setFallback] = useState<{ name: string; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const off = onSyncState(setSync); return () => { off(); }; }, []);

  const done = sessions.filter((s) => s.status === 'done').length;
  const custom = exercises.filter((e) => e.custom).length;

  async function offerFile(name: string, text: string, type: string) {
    const dl = (await window.claude?.use('downloads').catch(() => null)) as CloudDownloads | null;
    if (dl) {
      try { await dl.save({ filename: name, data: new Blob([text], { type }) }); setMsg(`Archivo ${name} listo.`); return; }
      catch { /* rechazado: mostramos el texto para copiar */ }
    }
    // Fuera de Claude (app instalada): hoja de compartir del iPhone (Guardar en Archivos) o descarga normal.
    if (!window.claude) {
      const file = new File([text], name, { type });
      try {
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); setMsg(`Archivo ${name} listo.`); return; }
      } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
      const url = URL.createObjectURL(file);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg(`Archivo ${name} descargado.`);
      return;
    }
    setFallback({ name, text });
  }
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="gutter pb-40 pt-8">
      <h1 className="font-display text-[38px] font-semibold leading-none">Perfil</h1>

      <section className="mt-6 rounded-[32px] bg-paper p-5 text-paper-ink">
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 place-items-center rounded-full ${sync === 'synced' ? 'bg-lime' : 'bg-black/10'}`}><Icon name="cloud" /></span>
          <div className="min-w-0">
            <p className="font-semibold">{SYNC_TEXT[sync]}</p>
            <p className="text-[13px] opacity-65">{done} entrenamientos · {custom} ejercicios personalizados</p>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-6">
        <Field title="Esfuerzo por serie" help="RIR: repeticiones que te quedaban en reserva (0 = al fallo). RPE: esfuerzo del 6 al 10. Siempre es opcional.">
          <Segmented label="Escala de esfuerzo" value={settings.effortScale} onChange={(v) => void saveSettings({ effortScale: v })}
            options={[{ value: 'RIR', label: 'RIR' }, { value: 'RPE', label: 'RPE' }]} />
        </Field>
        <Field title="Descanso por defecto" help="Para ejercicios nuevos. Cada ejercicio recuerda el suyo.">
          <Segmented label="Descanso por defecto" value={settings.defaultRestSec} onChange={(v) => void saveSettings({ defaultRestSec: v })}
            options={[60, 90, 120, 180].map((v) => ({ value: v, label: `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` }))} />
        </Field>
        <Field title="Salto de peso en los botones ±">
          <Segmented label="Salto de peso" value={settings.weightStep} onChange={(v) => void saveSettings({ weightStep: v })}
            options={[1, 1.25, 2.5, 5].map((v) => ({ value: v, label: `${String(v).replace('.', ',')} kg` }))} />
        </Field>
        <div>
          <p className="mb-1 font-semibold">Colores</p>
          <p className="mb-3 text-[13px] text-muted">Se aplican al momento: prueba y quédate con la que más te guste.</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Colores">
            {PALETTES.map((p) => {
              const on = (settings.palette ?? 'electrico') === p.id;
              return (
                <button key={p.id} role="radio" aria-checked={on} onClick={() => void saveSettings({ palette: p.id })}
                  className={`flex items-center gap-3 rounded-[24px] bg-card p-3 text-left ring-1 ${on ? 'ring-2 ring-[var(--fg)]' : 'ring-line'}`}>
                  <span className="flex shrink-0 -space-x-2">
                    <span className="h-8 w-8 rounded-full ring-2 ring-[var(--card)]" style={{ background: p.main }} />
                    <span className="h-8 w-8 rounded-full ring-2 ring-[var(--card)]" style={{ background: p.second }} />
                  </span>
                  <span className="min-w-0 text-[14px] font-semibold leading-tight">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <Field title="Tema">
          <Segmented label="Tema" value={settings.theme} onChange={(v) => void saveSettings({ theme: v })}
            options={[{ value: 'system', label: 'Automático' }, { value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }]} />
        </Field>
      </section>

      <h2 className="mb-3 mt-10 font-display text-[20px] font-semibold">Copias de seguridad</h2>
      <div className="space-y-2">
        <Action icon="download" label="Exportar copia completa (JSON)" sub="Incluye entrenamientos, ejercicios personalizados y ajustes"
          onClick={async () => offerFile(`cuaderno-fuerza-${stamp}.json`, JSON.stringify(await buildBackup(), null, 2), 'application/json')} />
        <Action icon="download" label="Exportar series (CSV)" sub="Una fila por serie, para hojas de cálculo"
          onClick={async () => offerFile(`series-${stamp}.csv`, await buildSetsCsv(), 'text/csv')} />
        <Action icon="upload" label="Importar copia (JSON)" sub="Se fusiona con lo que tienes; gana la versión más reciente de cada registro"
          onClick={() => fileRef.current?.click()} />
        <input ref={fileRef} id="import-file" type="file" accept="application/json,.json" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const r = await importBackup(parseBackup(await f.text()));
              setMsg(`Importado: ${r.sessions} entrenamientos y ${r.exercises} ejercicios nuevos o actualizados.`);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'No se pudo importar el archivo.');
            }
          }} />
      </div>
      {msg && <p role="status" className="mt-3 rounded-[20px] bg-card2 p-4 text-[14px]">{msg}</p>}

      <p className="mt-10 text-[13px] text-muted">Cuaderno de Fuerza · fase 1 · tus datos se guardan en este dispositivo y, si estás en claude.ai, en un espacio privado de tu cuenta.</p>

      <Sheet open={!!fallback} onClose={() => setFallback(null)} title={fallback?.name ?? ''} full>
        <p className="mb-3 text-[14px] text-muted">Este navegador no permite descargar el archivo directamente. Copia el contenido y guárdalo en un archivo con este nombre.</p>
        <button className="mb-3 flex h-12 items-center gap-2 rounded-full bg-lime px-5 font-semibold text-lime-ink"
          onClick={async () => {
            try { await navigator.clipboard.writeText(fallback?.text ?? ''); setMsg('Copiado al portapapeles.'); setFallback(null); }
            catch { (document.getElementById('fallback-text') as HTMLTextAreaElement | null)?.select(); }
          }}><Icon name="copy" size={18} /> Copiar</button>
        <textarea id="fallback-text" readOnly value={fallback?.text ?? ''} className="h-[60vh] w-full rounded-3xl bg-card p-4 font-mono text-[12px] ring-1 ring-line" />
      </Sheet>
    </div>
  );
}

function Field({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-semibold">{title}</p>
      {help && <p className="mb-3 text-[13px] text-muted">{help}</p>}
      {!help && <div className="mb-2" />}
      {children}
    </div>
  );
}

function Action({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-[28px] bg-card p-4 text-left ring-1 ring-line active:bg-card2">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lav text-lav-ink"><Icon name={icon} size={20} /></span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="block text-[13px] text-muted">{sub}</span>
      </span>
    </button>
  );
}
