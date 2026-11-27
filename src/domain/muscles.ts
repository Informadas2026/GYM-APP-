import type { MuscleId } from './types';

export const MUSCLES: { id: MuscleId; name: string }[] = [
  { id: 'pecho', name: 'Pecho' },
  { id: 'espalda', name: 'Espalda' },
  { id: 'hombros', name: 'Hombros' },
  { id: 'biceps', name: 'Bíceps' },
  { id: 'triceps', name: 'Tríceps' },
  { id: 'antebrazos', name: 'Antebrazos' },
  { id: 'cuadriceps', name: 'Cuádriceps' },
  { id: 'isquios', name: 'Isquiotibiales' },
  { id: 'gluteos', name: 'Glúteos' },
  { id: 'gemelos', name: 'Gemelos' },
  { id: 'abdominales', name: 'Abdominales' },
];

const BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m.name])) as Record<MuscleId, string>;
export const muscleName = (id: MuscleId) => BY_ID[id] ?? id;
