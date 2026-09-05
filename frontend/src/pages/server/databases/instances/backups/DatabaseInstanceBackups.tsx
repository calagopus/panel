import { useMemo, useState } from 'react';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import ServerBackups from '@/pages/server/backups/ServerBackups.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DatabaseInstanceBackups({
  instance,
  offline,
}: {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  offline: boolean;
}) {
  const { t } = useTranslations();
  const restoring = useServerStore((state) => state.databaseInstance?.status === 'restoring_backup');
  const [showAllEngineBackups, setShowAllEngineBackups] = useState(false);

  const filter = useMemo(
    () =>
      showAllEngineBackups
        ? { kind: 'database_instance' as const, databaseType: instance.type }
        : { kind: 'database_instance' as const, databaseInstanceUuid: instance.uuid },
    [showAllEngineBackups, instance.type, instance.uuid],
  );

  const createBlockedReason = restoring
    ? t('pages.server.databases.instance.backups.tooltip.restoring', {})
    : offline
      ? t('pages.server.databases.instance.backups.tooltip.offline', {})
      : null;

  return (
    <ServerBackups
      variant='section'
      dataSource='local'
      filter={filter}
      showKind={false}
      showSource={showAllEngineBackups}
      showFiles={false}
      createDefaults={{ databaseInstanceUuid: instance.uuid }}
      createBlockedReason={createBlockedReason}
      modifyParams={false}
      headerActions={
        <Switch
          label={t('pages.server.databases.instance.backups.toggle.allEngineBackups', {
            engine: databaseAgentTypeLabelMapping[instance.type],
          })}
          checked={showAllEngineBackups}
          onChange={(e) => setShowAllEngineBackups(e.currentTarget.checked)}
        />
      }
    />
  );
}
