import { create } from 'zustand';

export const usePlayer = create((set) => ({
  currentTrack: null,
  isPlaying: false,
  setTrack: (currentTrack) => set({ currentTrack }),
  setPlaying: (isPlaying) => set({ isPlaying }),
}));
