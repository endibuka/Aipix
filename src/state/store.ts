// Zustand store for global app state
import { create } from 'zustand';

interface AppState {
  currentTool: 'pencil' | 'eraser' | 'fill' | 'colorPicker';
  primaryColor: string;
  secondaryColor: string;
  brushSize: number;
  setCurrentTool: (tool: AppState['currentTool']) => void;
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setBrushSize: (size: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentTool: 'pencil',
  primaryColor: '#000000',
  secondaryColor: '#FFFFFF',
  brushSize: 1,
  setCurrentTool: (tool) => set({ currentTool: tool }),
  setPrimaryColor: (color) => set({ primaryColor: color }),
  setSecondaryColor: (color) => set({ secondaryColor: color }),
  setBrushSize: (size) => set({ brushSize: size }),
}));
