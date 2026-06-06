// Type-safe wrapper around the Electron contextBridge API.
// Falls back gracefully in plain browser (cargo run --server-only).

export interface ElectronBridge {
  setZoom(factor: number): Promise<void>;
  saveFile(path: string, content: string): Promise<void>;
  getDocumentsDir(): Promise<string>;
  openDirectory(): Promise<string | null>;
  revealInFolder(path: string): Promise<void>;
  windowMinimize(): void;
  windowMaximize(): void;
  windowClose(): void;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}

export const isElectron = (): boolean =>
  typeof window !== 'undefined' && 'electron' in window;
