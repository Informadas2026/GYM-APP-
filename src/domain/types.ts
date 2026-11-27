export type MuscleId =
  | 'pecho' | 'espalda' | 'biceps' | 'triceps' | 'hombros' | 'antebrazos'
  | 'cuadriceps' | 'isquios' | 'gluteos' | 'gemelos' | 'abdominales';

export type Equipment =
  | 'barra' | 'mancuernas' | 'maquina' | 'polea' | 'peso corporal' | 'kettlebell' | 'banda' | 'barra Z' | 'otro';

export interface Exercise {
  id: string;
  name: string;
  primary: MuscleId;
  secondary: MuscleId[];
  equipment: Equipment;
  description?: string;
  custom: boolean;
  archived?: boolean;
  updatedAt: number;
}

/** work = efectiva, warmup = calentamiento, drop = serie descendente encadenada (cuenta como efectiva). */
export type SetKind = 'work' | 'warmup' | 'drop';

export interface SetEntry {
  id: string;
  weight: number | null; // kg
  reps: number | null;
  effort: number | null; // RIR (0-5) or RPE (6-10), según ajustes
  kind: SetKind;
  done: boolean;
  doneAt?: number;
  /** Valores copiados automáticamente de la serie anterior (se reemplazan si cambia esa serie). */
  auto?: boolean;
  /** La usuaria ha escrito o cambiado algún dato de esta serie. */
  edited?: boolean;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  restSec: number;
  notes: string;
  /** Repeticiones objetivo heredadas de la rutina, si las tiene. */
  targetReps?: string;
  /** Ejercicios consecutivos con el mismo groupId forman una superserie. */
  groupId?: string;
  sets: SetEntry[];
}

export type ActivityType = 'gym' | 'running' | 'ciclismo' | 'senderismo';

export interface Session {
  id: string;
  status: 'active' | 'done';
  type: ActivityType;
  title: string;
  startedAt: number;
  endedAt?: number;
  /** Duración en minutos; si existe, manda sobre endedAt - startedAt. */
  durationMin?: number;
  notes: string;
  exercises: SessionExercise[];
  routineId?: string;
  cardio?: CardioData;
  updatedAt: number;
  deleted?: boolean;
}

/** Datos de running, ciclismo o senderismo (los que da Strava). */
export interface CardioData {
  distanceKm?: number;
  durationSec?: number;
  /** Ritmo medio en segundos por km. */
  paceSecPerKm?: number;
  elevationM?: number;
  avgHr?: number;
  calories?: number;
  /** 1 = muy mal … 5 = genial */
  feeling?: number;
}

export interface RoutineItem {
  id: string;
  exerciseId: string;
  warmupSets: number;
  workSets: number;
  /** Repeticiones objetivo en texto libre: «8-10», «12»… Vacío si no se ha decidido. */
  targetReps?: string;
  restSec?: number;
  /** Ejercicio opcional: al empezar la sesión aparece desmarcado. */
  optional?: boolean;
  note?: string;
  groupId?: string;
}

export interface Routine {
  id: string;
  name: string;
  /** 1 = lunes … 7 = domingo, para sugerir la rutina del día. */
  weekday?: number;
  notes: string;
  items: RoutineItem[];
  order: number;
  updatedAt: number;
  deleted?: boolean;
}

export type EffortScale = 'RIR' | 'RPE';
export type ThemePref = 'system' | 'light' | 'dark';
export type PaletteId = 'electrico' | 'lima' | 'coral' | 'oceano' | 'salvia';

export interface Settings {
  id: 'settings';
  effortScale: EffortScale;
  defaultRestSec: number;
  theme: ThemePref;
  /** Combinación de colores de acento. */
  palette?: PaletteId;
  weightStep: number;
  /** Ya se cargaron las rutinas iniciales (para no volver a crearlas si se borran). */
  routinesSeeded?: boolean;
  /** Correcciones de datos ya aplicadas. */
  fixes?: string[];
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  effortScale: 'RIR',
  defaultRestSec: 90,
  theme: 'system',
  weightStep: 2.5,
  updatedAt: 0,
};
