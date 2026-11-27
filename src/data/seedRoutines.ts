import type { Routine, RoutineItem } from '../domain/types';

// Rutina semanal de Olga (27/11/2026). Ids fijos: si se carga en dos dispositivos no se duplica.
// Donde indicó «3-4 series» se guardan 3 y queda anotado. Repeticiones sin indicar: vacías.
const item = (id: string, exerciseId: string, workSets: number, extra: Partial<RoutineItem> = {}): RoutineItem => ({
  id, exerciseId: 'lib-' + exerciseId, warmupSets: 0, workSets, ...extra,
});
const range = { note: 'Tu plan: 3-4 series' };

export const SEED_ROUTINES: Routine[] = [
  {
    id: 'r-lunes', name: 'Lunes · Pierna', weekday: 1, order: 1, notes: '', updatedAt: 1,
    items: [
      item('r1-1', 'sentadilla', 3, { warmupSets: 1, note: 'Sentadilla libre: 1 de calentamiento + 3 efectivas' }),
      item('r1-2', 'hip-thrust', 3),
      item('r1-3', 'step-up', 3),
      item('r1-4', 'sentadilla-bulgara', 2),
      item('r1-5', 'extension-cuadriceps', 3),
      item('r1-6', 'aduccion-maquina', 3),
    ],
  },
  {
    id: 'r-martes', name: 'Martes · Pecho y hombro', weekday: 2, order: 2, notes: '', updatedAt: 1,
    items: [
      item('r2-1', 'flexiones-rodillas', 3, range),
      item('r2-2', 'press-banca', 3, range),
      item('r2-3', 'press-hombro-mancuernas', 3),
      item('r2-4', 'elevaciones-laterales', 3),
      item('r2-5', 'face-pull', 3),
      item('r2-6', 'laterales-polea-doble', 3, { note: 'Polea, los dos brazos a la vez' }),
    ],
  },
  {
    id: 'r-miercoles', name: 'Miércoles · Espalda y brazos', weekday: 3, order: 3, notes: '', updatedAt: 1,
    items: [
      item('r3-1', 'dominadas-goma', 3),
      item('r3-2', 'jalon-pecho', 3),
      item('r3-3', 'remo-mancuerna', 3, { note: 'Remo unilateral' }),
      item('r3-4', 'pullover-polea', 3),
      item('r3-5', 'extension-polea', 3, range),
      item('r3-6', 'curl-mancuernas', 3, range),
      item('r3-7', 'crunch', 3, { optional: true, note: 'Opcional: algunos días' }),
    ],
  },
  {
    id: 'r-jueves', name: 'Jueves · Glúteo y femoral', weekday: 4, order: 4, notes: '', updatedAt: 1,
    items: [
      item('r4-1', 'hip-thrust', 3, range),
      item('r4-2', 'peso-muerto-rumano-mancuernas', 3, { note: 'Peso muerto con mancuernas' }),
      item('r4-3', 'zancadas-multipower', 3),
      item('r4-4', 'curl-femoral-tumbado', 3, { note: 'Femoral en máquina' }),
      item('r4-5', 'abduccion-maquina', 3),
    ],
  },
];
