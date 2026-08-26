import { useShallow } from 'zustand/react/shallow';
import { queryKeys } from '@/lib/queryKeys.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/useWebsocketEvent.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import useInvalidateServerCache from './useInvalidateServerCache.ts';

export default function useServerScheduleSocket() {
  const serverStoreApi = useServerStoreApi();
  const invalidateCacheKey = useInvalidateServerCache();
  const { setRunningScheduleStep, setScheduleSteps } = useServerStore(
    useShallow((state) => ({
      setRunningScheduleStep: state.setRunningScheduleStep,
      setScheduleSteps: state.setScheduleSteps,
    })),
  );

  useWebsocketEvent(SocketEvent.SCHEDULE_STARTED, (uuid) => {
    const { schedule, scheduleSteps } = serverStoreApi.getState();
    if (schedule?.uuid === uuid) {
      setScheduleSteps(scheduleSteps.map((s) => ({ ...s, error: null })));
    }
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_STEP_STATUS, (uuid, stepUuid) => {
    setRunningScheduleStep(uuid, stepUuid);
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_STEP_ERROR, (uuid, stepUuid, error) => {
    const { schedule, scheduleSteps } = serverStoreApi.getState();
    if (schedule?.uuid === uuid) {
      setScheduleSteps(scheduleSteps.map((s) => (s.uuid === stepUuid ? { ...s, error } : s)));
    }
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_COMPLETED, (uuid) => {
    setRunningScheduleStep(uuid, null);
    invalidateCacheKey(queryKeys.server(serverStoreApi.getState().server.uuid).schedules.all());
  });
}
