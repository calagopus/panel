import { faSkull } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import getCrashes from '@/api/server/logs/getCrashes.ts';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { isConflictingState } from '@/lib/domain/server.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const RECENT_CRASH_WINDOW = 24 * 60 * 60 * 1000;

export default function CrashHistoryLink() {
  'use no memo';

  const { t } = useTranslations();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const server = useServerStore((state) => state.server);
  const powerState = useServerStore((state) => state.state);
  const canReadConsole = useServerCan('control.read-console');

  const { data: crashes } = useResource({
    queryKey: queryKeys.server(server.uuid).crashes.all(),
    queryFn: () => getCrashes(server.uuid),
    enabled: canReadConsole && !isConflictingState(server, user),
    silent: true,
  });

  const previousPowerState = useRef(powerState);
  useEffect(() => {
    if (previousPowerState.current === powerState) return;
    previousPowerState.current = powerState;

    if (powerState === 'offline' || powerState === 'starting') {
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).crashes.all() });
    }
  }, [powerState]);

  if (!crashes || crashes.length === 0) return null;

  const latest = crashes.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  const recent = Date.now() - latest.timestamp.getTime() < RECENT_CRASH_WINDOW;

  return (
    <Tooltip
      label={
        recent ? t('pages.server.console.tooltip.recentCrash', {}) : t('pages.server.console.tooltip.crashHistory', {})
      }
    >
      <NavLink
        to={`/server/${server.uuidShort}/console/crashes?crash=${latest.id}`}
        className='group relative inline-flex'
        aria-label={t('pages.server.console.tooltip.crashHistory', {})}
      >
        <FontAwesomeIcon
          icon={faSkull}
          className={
            recent
              ? 'text-(--mantine-color-red-filled)'
              : 'text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
          }
        />
      </NavLink>
    </Tooltip>
  );
}
