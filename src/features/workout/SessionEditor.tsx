import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, Session, SessionExercise } from '../../domain/types';
import { completeSet, lastPerformance, sessionDoneSets, sessionDurationMin, setsFromHistory } from '../../domain/calc';
import { newId } from '../../domain/ids';
import { muscleName } from '../../domain/muscles';
import { saveSession } from '../../data/repo';
import { useAppData, useRest, fmtClock } from '../../state';
import { Icon } from '../../ui/Icon';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';

/** Editor de una sesión. En modo «live» incluye cronómetro y descansos; en «edit» corrige una sesión pasada. */
export function SessionEditor({ session, mode, onFinish, onClose }: {
  session: Session; mode: 'live' | 'edit'; onFinish?: () => void; onClose?: () => void;
}) {
  const { sessions, exById, settings, exercises } = useAppData();
  const rest = useRest();
  const [draft, setDraft] = useState<Session>(session);
  const [expanded, setExpanded] = useState<string | null>(() => session.exercises.find((e) => e.sets.some((s) => !s.done))?.id ?? session.exercises[0]?.id ?? null);
  const [picker, setPicker] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<Session | null>(null);

  useEffect(() => { setDraft(session); }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Cambios que llegan de fuera (otro dispositivo, importación) si no hay edición local pendiente.
  useEffect(() => {
    if (!pending.current && session.updatedAt > draft.updatedAt) setDraft(session);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    if (pending.current) { void saveSession(pending.current); pending.current = null; }
  }, []);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => { flush(); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); };
  }, [flush]);

  const update = useCallback((next: Session, immediate = false) => {
    setDraft(next);
    pending.current = next;
    clearTimeout(saveTimer.current);
    if (immediate) flush();
    else saveTimer.current = setTimeout(flush, 400);
  }, [flush]);

  const lastById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof lastPerformance>>();
    for (const e of draft.exercises) m.set(e.exerciseId, lastPerformance(e.exerciseId, sessions, draft.id));
    return m;
  }, [draft.exercises, sessions, draft.id]);

  const addExercise = (ex: Exercise) => {
    const last = lastPerformance(ex.id, sessions, draft.id);
    const prevItem = sessions.find((s) => s.id === last?.sessionId)?.exercises.find((e) => e.exerciseId === ex.id);
    const item: SessionExercise = {
      id: newId('e'),
      exerciseId: ex.id,
      restSec: prevItem?.restSec ?? settings.defaultRestSec,
      notes: '',
      sets: setsFromHistory(last, 3),
    };
    update({ ...draft, exercises: [...draft.exercises, item] }, true);
    setExpanded(item.id);
  };

  const replaceItem = (item: SessionExercise) =>
    update({ ...draft, exercises: draft.exercises.map((e) => (e.id === item.id ? item : e)) });

  const onSetDone = (item: SessionExercise, index: number) => {
    const sets = completeSet(item.sets, index);
    const next = { ...draft, exercises: draft.exercises.map((e) => (e.id === item.id ? { ...e, sets } : e)) };
    update(next, true);
    if (mode !== 'live') return;
    const pos = next.exercises.findIndex((e) => e.id === item.id);
    const name = (id: string) => exById.get(id)?.name ?? '';
    // Superserie: pasa al siguiente ejercicio del grupo sin descanso; descansa al acabar el último.
    if (item.groupId) {
      const group = next.exercises.filter((e) => e.groupId === item.groupId);
      const after = next.exercises.slice(pos + 1).find((e) => e.groupId === item.groupId && e.sets.some((s) => !s.done));
      if (after) { setExpanded(after.id); return; }
      const first = group.find((e) => e.sets.some((s) => !s.done));
      if (first) {
        setExpanded(first.id);
        rest.start(item.restSec, `Siguiente ronda: ${name(first.exerciseId)}`);
        return;
      }
    }
    const pendingHere = sets.findIndex((s) => !s.done);
    let label = '';
    if (pendingHere >= 0 && !item.groupId) label = `Siguiente: ${name(item.exerciseId)} · serie ${pendingHere + 1}`;
    else {
      const nextEx = next.exercises.slice(pos + 1).find((e) => e.sets.some((s) => !s.done));
      if (nextEx) { label = `Siguiente: ${name(nextEx.exerciseId)}`; setExpanded(nextEx.id); }
      else label = 'Último ejercicio completado';
    }
    rest.start(item.restSec, label);
  };

  const linkNext = (i: number) => {
    const a = draft.exercises[i];
    const b = draft.exercises[i + 1];
    if (!a || !b) return;
    const gid = a.groupId ?? b.groupId ?? newId('g');
    const oldB = b.groupId;
    update({ ...draft, exercises: draft.exercises.map((e) => (e.id === a.id || e.id === b.id || (oldB && e.groupId === oldB) ? { ...e, groupId: gid } : e)) }, true);
  };
  const unlink = (item: SessionExercise) => {
    const gid = item.groupId;
    let exercises = draft.exercises.map((e) => (e.id === item.id ? { ...e, groupId: undefined } : e));
    if (exercises.filter((e) => e.groupId === gid).length < 2) exercises = exercises.map((e) => (e.groupId === gid ? { ...e, groupId: undefined } : e));
    update({ ...draft, exercises }, true);
  };

  const inSession = useMemo(() => new Set(draft.exercises.map((e) => e.exerciseId)), [draft.exercises]);
  const muscles = [...new Set(draft.exercises.map((e) => exById.get(e.exerciseId)?.primary).filter(Boolean))].slice(0, 3)
    .map((m) => muscleName(m!)).join(' · ');

  return (
    <div className="pb-40">
      {mode === 'live' ? <LiveHeader session={draft} onFinish={() => { flush(); onFinish?.(); }} /> : (
        <EditHeader session={draft} onChange={(s) => update(s)} onClose={() => { flush(); onClose?.(); }} />
      )}

      <div className="gutter mt-2 flex gap-2">
        <Stat label="Series" value={String(sessionDoneSets(draft))} />
        <Stat label="Ejercicios" value={String(draft.exercises.length)} />
        <Stat label="Músculos" value={muscles || '—'} small />
      </div>

      {mode === 'edit' && (
        <p className="gutter mt-3 text-[13px] text-muted">Escribe peso y repeticiones y la serie cuenta sola. Si hiciste justo lo que aparece, toca ✓.</p>
      )}
      <div className="gutter mt-5 space-y-3">
        {draft.exercises.map((item, i) => {
          const prevSame = i > 0 && !!item.groupId && draft.exercises[i - 1].groupId === item.groupId;
          const nextSame = !!item.groupId && draft.exercises[i + 1]?.groupId === item.groupId;
          return (
            <div key={item.id} className={prevSame ? '-mt-1' : ''}>
              {item.groupId && !prevSame && (
                <p className="mb-1.5 ml-4 inline-flex items-center gap-1.5 rounded-full bg-pill px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-pill-fg">
                  Superserie · {draft.exercises.filter((e) => e.groupId === item.groupId).length} ejercicios
                </p>
              )}
              {prevSame && <div className="mx-auto -mb-1 h-4 w-10 rounded-b-full bg-pill" aria-hidden="true" />}
              <ExerciseCard item={item} exercise={exById.get(item.exerciseId)} last={lastById.get(item.exerciseId) ?? null}
                tone={i} expanded={expanded === item.id} settings={settings} autoDone={mode === 'edit'}
                onExpand={() => setExpanded(expanded === item.id ? null : item.id)}
                onChange={replaceItem}
                onRemove={() => { if (item.groupId) unlink(item); update({ ...draft, exercises: draft.exercises.filter((e) => e.id !== item.id) }, true); }}
                onSetDone={(idx) => onSetDone(item, idx)}
                link={{ canLinkNext: i < draft.exercises.length - 1 && !nextSame, linked: !!item.groupId, onLink: () => linkNext(i), onUnlink: () => unlink(item) }} />
            </div>
          );
        })}
        {draft.exercises.length === 0 && (
          <div className="rounded-[32px] border-2 border-dashed border-line p-8 text-center text-muted">
            Añade tu primer ejercicio. Si ya lo hiciste antes, verás tus pesos y repeticiones de la última vez.
          </div>
        )}
        <button onClick={() => setPicker(true)} className="flex h-16 w-full items-center justify-center gap-2 rounded-full bg-pill text-[16px] font-semibold text-pill-fg">
          <Icon name="plus" size={22} /> Añadir ejercicio
        </button>
      </div>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercise}
        exercises={exercises} sessions={sessions} inSession={inSession} />
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="min-w-0 flex-1 rounded-[24px] bg-card px-4 py-3 ring-1 ring-line">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 truncate font-display font-semibold ${small ? 'text-[13px] leading-6' : 'text-[17px]'}`}>{value}</p>
    </div>
  );
}

function LiveHeader({ session, onFinish }: { session: Session; onFinish: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const sec = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  const h = Math.floor(sec / 3600);
  const clock = h > 0 ? `${h}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` : fmtClock(sec);
  return (
    <header className="gutter flex items-end justify-between gap-3 pt-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted">Entrenamiento en curso</p>
        <p className="font-display text-[44px] font-semibold leading-none" aria-label={`Tiempo transcurrido ${clock}`}>{clock}</p>
      </div>
      <button onClick={onFinish} className="h-12 shrink-0 rounded-full bg-lime px-5 font-semibold text-lime-ink">Terminar</button>
    </header>
  );
}

const toLocalInput = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function EditHeader({ session, onChange, onClose }: { session: Session; onChange: (s: Session) => void; onClose: () => void }) {
  return (
    <header className="gutter space-y-4 pt-5">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="grid h-12 w-12 place-items-center rounded-full bg-pill text-pill-fg" aria-label="Volver"><Icon name="back" /></button>
        <h1 className="font-display text-xl font-semibold">Editar sesión</h1>
        <button onClick={onClose} className="ml-auto h-12 rounded-full bg-lime px-5 font-semibold text-lime-ink">Listo</button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
        <label className="min-w-0 rounded-[24px] bg-card px-4 py-2 ring-1 ring-line">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Fecha y hora</span>
          <input id="edit-date" type="datetime-local" value={toLocalInput(session.startedAt)} className="w-full min-w-0 bg-transparent py-1 text-[15px] font-semibold outline-none"
            onChange={(e) => { const t = new Date(e.target.value).getTime(); if (Number.isFinite(t)) onChange({ ...session, startedAt: t, endedAt: undefined, durationMin: sessionDurationMin(session) }); }} />
        </label>
        <label className="rounded-[24px] bg-card px-4 py-2 ring-1 ring-line">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Minutos</span>
          <input id="edit-duration" inputMode="numeric" defaultValue={sessionDurationMin(session)} className="w-full bg-transparent py-1 font-semibold outline-none"
            onBlur={(e) => { const v = parseInt(e.target.value, 10); if (v >= 0) onChange({ ...session, durationMin: v }); }} />
        </label>
      </div>
    </header>
  );
}
