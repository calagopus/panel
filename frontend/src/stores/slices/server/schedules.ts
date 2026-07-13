import { z } from 'zod';
import { StateCreator } from 'zustand';
import { serverScheduleSchema, serverScheduleStepSchema } from '@/lib/schemas/server/schedules.ts';
import { ServerStore } from '@/stores/server.ts';

export interface SchedulesSlice {
  runningScheduleSteps: Map<string, string | null>;

  setRunningScheduleStep: (schedule: string, step: string | null) => void;

  schedule: z.infer<typeof serverScheduleSchema> | null;
  scheduleSteps: z.infer<typeof serverScheduleStepSchema>[];

  setSchedule: (scheduleStep: z.infer<typeof serverScheduleSchema>) => void;
  setScheduleSteps: (scheduleSteps: z.infer<typeof serverScheduleStepSchema>[]) => void;
}

export const createSchedulesSlice: StateCreator<ServerStore, [], [], SchedulesSlice> = (set, get): SchedulesSlice => ({
  runningScheduleSteps: new Map(),

  setRunningScheduleStep: (schedule, step) =>
    set((state) => {
      state.runningScheduleSteps.set(schedule, step);

      return { ...state };
    }),

  schedule: null,
  scheduleSteps: [],

  setSchedule: (schedule) => set((state) => ({ ...state, schedule })),
  setScheduleSteps: (steps) => set((state) => ({ ...state, scheduleSteps: steps })),
});
