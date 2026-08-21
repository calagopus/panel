import { Input } from '@mantine/core';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import Group from '@/elements/Group.tsx';
import ScrollArea from '@/elements/ScrollArea.tsx';
import SegmentedControl from '@/elements/SegmentedControl.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { serverDatabaseInstanceUserPermissionLabelMapping } from '@/lib/enums.ts';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceUserDatabaseGrantSchema,
  serverDatabaseInstanceUserPermission,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Grant = z.infer<typeof serverDatabaseInstanceUserDatabaseGrantSchema>;
type Permission = z.infer<typeof serverDatabaseInstanceUserPermission>;

export default function DatabaseInstanceUserDatabasesInput({
  databases,
  value,
  onChange,
  label,
}: {
  databases: z.infer<typeof serverDatabaseInstanceDatabaseSchema>[];
  value: Grant[];
  onChange: (value: Grant[]) => void;
  label?: string;
}) {
  const { t } = useTranslations();

  const permissionByUuid = new Map(value.map((grant) => [grant.databaseUuid, grant.permission]));

  const permissions: Permission[] = ['none', 'read_only', 'read_write'];
  const data = permissions.map((permission) => ({
    value: permission,
    label: serverDatabaseInstanceUserPermissionLabelMapping[permission](),
  }));

  const setPermission = (databaseUuid: string, permission: Permission) => {
    onChange(
      databases
        .map((database) => ({
          databaseUuid: database.uuid,
          permission: database.uuid === databaseUuid ? permission : (permissionByUuid.get(database.uuid) ?? 'none'),
        }))
        .filter((grant) => grant.permission !== 'none'),
    );
  };

  return (
    <Stack gap={4}>
      {label && <Input.Label>{label}</Input.Label>}

      {databases.length === 0 ? (
        <Text size='sm' c='dimmed'>
          {t('pages.server.databases.instance.users.form.noDatabases', {})}
        </Text>
      ) : (
        <ScrollArea mah={300} type='auto'>
          <Stack gap='xs' pr='xs'>
            {databases.map((database) => (
              <Group key={database.uuid} justify='space-between' wrap='nowrap' gap='sm'>
                <Code>{database.name}</Code>
                <SegmentedControl
                  size='xs'
                  value={permissionByUuid.get(database.uuid) ?? 'none'}
                  onChange={(permission) => setPermission(database.uuid, permission as Permission)}
                  data={data}
                />
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}
