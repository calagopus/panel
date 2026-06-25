import { StateCreator } from 'zustand';
import { RelativePageStore } from '@/stores/relativePage.ts';

export interface DocumentSlice {
  title: string;

  setTitle: (title: string) => void;
}

export const createDocumentSlice: StateCreator<RelativePageStore, [], [], DocumentSlice> = (set): DocumentSlice => ({
  title: document.title,

  setTitle: (value) => set((state) => ({ ...state, title: value })),
});
