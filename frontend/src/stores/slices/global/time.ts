import { StateCreator } from 'zustand';
import { GlobalStore } from '@/stores/global.ts';

export interface TimeSlice {
  timeOffset: number;

  setTimeOffset: (offset: number) => void;
}

export const createTimeSlice: StateCreator<GlobalStore, [], [], TimeSlice> = (set): TimeSlice => ({
  timeOffset: 0,

  setTimeOffset: (value) => set((state) => ({ ...state, timeOffset: value })),
});
