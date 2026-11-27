import { useState } from 'react';
import { useAppData, useRest } from '../../state';
import { deleteSession, saveSession, startSession } from '../../data/repo';
import { sessionDoneSets, sessionDurationMin } from '../../domain/calc';
import { muscleName } from '../../domain/muscles';
import type { Session } from '../../domain/types';
import { SessionEditor } from './SessionEditor';
import { ConfirmSheet, Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { RoutineList } from '../routines/Routines';
import { PastWorkoutButton } from './PastWorkout';
import { CardioButton } from '../cardio/CardioForm';

export function WorkoutTab({ onSaved, onPast }: { onSaved: (id: string) => void; onPast: (id: string) => void }) {
  const { active, sessions } = useAppData();
  const [finishing, setFinishing] = useState(false);

  if (!active) return <StartScreen hasHistory={sessions.length > 0} onPast={onPast} onSaved={onSaved} />;
  return (
    <>
      <SessionEditor key={active.id} session={active} mode="live" onFinish={() => setFinishing(true)} />
      <FinishSheet open={finishing} session={active} onClose={() => setFinishing(false)} onSaved={onSaved} />
    </>
  );
}

function StartScreen({ hasHistory, onPast, onSaved }: { hasHistory: boolean; onPast: (id: string) => void; onSaved: (id: string) => void }) {
  const today = new Date();
  return (
    <div className="gutter pb-40 pt-8">
      <p className="text-sm font-semibold capitalize text-muted">{today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1 className="mt-1 font-display text-[38px] font-semibold leading-[1.05]">¿Entrenamos?</h1>
      <div className="relative mt-8 overflow-hidden rounded-[36px] bg-lime p-6 text-lime-ink">
        <p className="max-w-[28ch] text-[15px] font-medium opacity-80">
          Elige una de tus rutinas o empieza una sesión vacía. {hasHistory ? 'Verás lo que hiciste la última vez en cada ejercicio.' : 'Tu primera sesión servirá de referencia para las siguientes.'}
        </p>
        <button onClick={() => void startSession()} className="mt-6 flex h-16 w-full items-center justify-between rounded-full bg-[#131313] pl-2 pr-6 text-white">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-hi text-hi-ink"><Icon name="play" size={20} /></span>
          <span className="font-semibold">Sesión vacía</span>
          <span className="tracking-[-0.2em] opacity-60">›››</span>
        </button>
      </div>
      <PastWorkoutButton onCreated={onPast} className="mt-3" />
      <CardioButton onSaved={onSaved} className="mt-2" />
      <RoutineList />
    </div>
  );
}

function FinishSheet({ open, session, onClose, onSaved }: { open: boolean; session: Session; onClose: () => void; onSaved: (id: string) => void }) {
  const { exById } = useAppData();
  const rest = useRest();
  const [discard, setDiscard] = useState(false);
  const minutes = sessionDurationMin(session);
  const keepIt = (s: Session['exercises'][number]['sets'][number]) => s.done || (!!s.edited && (s.reps ?? 0) > 0);
  const pendingSets = session.exercises.reduce((a, e) => a + e.sets.filter((s) => !keepIt(s)).length, 0);
  const unmarked = session.exercises.reduce((a, e) => a + e.sets.filter((s) => !s.done && keepIt(s)).length, 0);
  const suggested = [...new Set(session.exercises.map((e) => exById.get(e.exerciseId)?.primary).filter(Boolean))].slice(0, 3).map((m) => muscleName(m!)).join(' · ');

  return (
    <>
      <Sheet open={open && !discard} onClose={onClose} title="Terminar entrenamiento">
        <form className="space-y-4" onSubmit={async (ev) => {
          ev.preventDefault();
          const f = new FormData(ev.currentTarget);
          const dur = parseInt(String(f.get('duration')), 10);
          // Series con datos escritos pero sin ✓ se guardan como hechas; las intactas se descartan.
          const now = Date.now();
          const exercises = session.exercises
            .map((e) => ({ ...e, sets: e.sets.filter(keepIt).map((s) => (s.done ? s : { ...s, done: true, doneAt: now })) }))
            .filter((e) => e.sets.length > 0);
          const saved = await saveSession({
            ...session, exercises, status: 'done', endedAt: Date.now(),
            durationMin: Number.isFinite(dur) && dur >= 0 ? dur : minutes,
            title: String(f.get('title') ?? '').trim() || suggested,
            notes: String(f.get('notes') ?? '').trim(),
          });
          rest.stop();
          onClose();
          onSaved(saved.id);
        }}>
          <div className="grid grid-cols-3 gap-2">
            <Box label="Series" value={String(sessionDoneSets(session) + unmarked)} />
            <Box label="Ejercicios" value={String(session.exercises.length)} />
            <label className="rounded-[24px] bg-card px-4 py-3 ring-1 ring-line">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Minutos</span>
              <input id="finish-duration" name="duration" inputMode="numeric" defaultValue={minutes} className="w-full bg-transparent font-display text-[19px] font-semibold outline-none" />
            </label>
          </div>
          {unmarked > 0 && <p className="text-[14px] text-muted">{unmarked} {unmarked === 1 ? 'serie con datos sin ✓ se guardará' : 'series con datos sin ✓ se guardarán'} como hecha{unmarked === 1 ? '' : 's'}.</p>}
          {pendingSets > 0 && <p className="text-[14px] text-muted">{pendingSets} {pendingSets === 1 ? 'serie sin tocar no se guardará' : 'series sin tocar no se guardarán'}.</p>}
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-muted">Nombre</span>
            <input id="finish-title" name="title" defaultValue={session.title} placeholder={suggested || 'Entrenamiento'}
              className="h-14 w-full rounded-full bg-card px-5 outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--lav)]" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-muted">Sensaciones y notas</span>
            <textarea id="finish-notes" name="notes" defaultValue={session.notes} rows={3} placeholder="¿Cómo te has sentido?"
              className="w-full rounded-3xl bg-card p-4 outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--lav)]" />
          </label>
          <button type="submit" className="h-14 w-full rounded-full bg-lime font-semibold text-lime-ink">Guardar entrenamiento</button>
          <button type="button" onClick={() => setDiscard(true)} className="h-12 w-full rounded-full font-semibold text-danger">Descartar sesión</button>
        </form>
      </Sheet>
      <ConfirmSheet open={discard} onClose={() => setDiscard(false)} danger title="¿Descartar la sesión?"
        body="Se borrará este entrenamiento y todas sus series. No se puede deshacer."
        confirmLabel="Descartar" onConfirm={() => { void deleteSession(session.id); rest.stop(); onClose(); }} />
    </>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-card px-4 py-3 ring-1 ring-line">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display text-[19px] font-semibold">{value}</p>
    </div>
  );
}
