import { StateCreator } from 'zustand';
import { RelativePageStore } from '@/stores/relativePage.ts';

export interface PageHeader {
  title: string;
  subtitle?: string;
}

export interface DocumentSlice {
  title: string;
  pageHeader: PageHeader | null;
  hasMobileNavbar: boolean;

  setTitle: (title: string) => void;
  setPageHeader: (pageHeader: PageHeader | null) => void;
  setHasMobileNavbar: (hasMobileNavbar: boolean) => void;
}

export const createDocumentSlice: StateCreator<RelativePageStore, [], [], DocumentSlice> = (set): DocumentSlice => ({
  title: document.title,
  pageHeader: null,
  hasMobileNavbar: false,

  setTitle: (value) => set((state) => ({ ...state, title: value })),
  setPageHeader: (value) => set((state) => ({ ...state, pageHeader: value })),
  setHasMobileNavbar: (value) => set((state) => ({ ...state, hasMobileNavbar: value })),
});
