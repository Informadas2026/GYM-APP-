// Tipos mínimos del entorno de claude.ai que usa la app (opcional: fuera de claude.ai no existe).
export interface CloudDocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined; metadata: { fromCache: boolean } }
export interface CloudQuerySnap { docs: CloudDocSnap[]; metadata: { fromCache: boolean } }
export interface CloudDocRef {
  set(data: Record<string, unknown>): Promise<void>;
  get(): Promise<CloudDocSnap>;
  collection(path: string): CloudCollectionRef;
}
export interface CloudCollectionRef {
  doc(id?: string): CloudDocRef;
  get(): Promise<CloudQuerySnap>;
  onSnapshot(next: (s: CloudQuerySnap) => void, error?: (e: { code: string; message: string }) => void): () => void;
}
export interface CloudDB { doc(path: string): CloudDocRef; collection(path: string): CloudCollectionRef }
export interface CloudUser { id(): Promise<string | null> }
export interface CloudDownloads { save(o: { filename: string; data: string | Blob }): Promise<unknown> }

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}
