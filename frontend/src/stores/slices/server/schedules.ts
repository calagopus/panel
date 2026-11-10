import { StateCreator } from 'zustand';
import { ServerSchedule, ServerScheduleStep } from '@/lib/schemas/server/schedules.ts';
import { ServerStore } from '@/stores/server.ts';

interface ScheduleCompletion {
  lastRun: Date;
  lastFailure: Date | null;
}

const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

// wings reports completions to the panel in batches, so a refetch shortly after a
// completion event can still return the previous lastRun/lastFailure
export const applyScheduleCompletion = (schedule: ServerSchedule, completions: Map<string, ScheduleCompletion>) => {
  const completion = completions.get(schedule.uuid);
  if (!completion) return schedule;

  const lastRun = later(schedule.lastRun, completion.lastRun);
  const lastFailure = later(schedule.lastFailure, completion.lastFailure);
  if (lastRun === schedule.lastRun && lastFailure === schedule.lastFailure) return schedule;

  return { ...schedule, lastRun, lastFailure };
};

export interface SchedulesSlice {
  runningScheduleSteps: Map<string, string | null>;
  scheduleCompletions: Map<string, ScheduleCompletion>;

  setRunningScheduleStep: (schedule: string, step: string | null) => void;
  recordScheduleCompletion: (schedule: string, timestamp: Date, successful: boolean) => void;

  schedule: ServerSchedule | null;
  scheduleSteps: ServerScheduleStep[];

  setSchedule: (schedule: ServerSchedule) => void;
  setScheduleSteps: (scheduleSteps: ServerScheduleStep[]) => void;
}

export const createSchedulesSlice: StateCreator<ServerStore, [], [], SchedulesSlice> = (set, _get): SchedulesSlice => ({
  runningScheduleSteps: new Map(),
  scheduleCompletions: new Map(),

  setRunningScheduleStep: (schedule, step) =>
    set((state) => {
      if (state.runningScheduleSteps.get(schedule) === step) {
        return state;
      }

      return { ...state, runningScheduleSteps: new Map(state.runningScheduleSteps).set(schedule, step) };
    }),

  recordScheduleCompletion: (schedule, timestamp, successful) =>
    set((state) => {
      const previous = state.scheduleCompletions.get(schedule);

      return {
        ...state,
        scheduleCompletions: new Map(state.scheduleCompletions).set(schedule, {
          lastRun: previous && previous.lastRun > timestamp ? previous.lastRun : timestamp,
          lastFailure: successful ? (previous?.lastFailure ?? null) : later(previous?.lastFailure ?? null, timestamp),
        }),
      };
    }),

  schedule: null,
  scheduleSteps: [],

  setSchedule: (schedule) =>
    set((state) => ({ ...state, schedule: applyScheduleCompletion(schedule, state.scheduleCompletions) })),
  setScheduleSteps: (steps) => set((state) => ({ ...state, scheduleSteps: steps })),
});
