import { faEye, faFingerprint, faMagnifyingGlass, faPeopleGroup } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getServers from '@/api/admin/servers/getServers.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import Group from '@/elements/layout/Group.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import { ResourceLookupResult } from '@/elements/ResourceLookup.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TeamLookupPopover() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const tr = 'pages.admin.teams.lookup';
  const canLookup = useAdminCan(['teams.read', 'servers.read'], false);

  const [opened, setOpened] = useState(false);
  const [server, setServer] = useState<z.infer<typeof adminServerSchema> | null>(null);

  if (!canLookup) return null;

  return (
    <Popover opened={opened} onChange={setOpened} width={380} position='bottom-end' shadow='md' withinPortal>
      <Popover.Target>
        <Button
          onClick={() => setOpened((o) => !o)}
          variant='default'
          leftSection={<FontAwesomeIcon icon={faFingerprint} />}
        >
          {t(`${tr}.button`, {})}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap='sm'>
          <SegmentedControl fullWidth value='server' data={[{ value: 'server', label: t(`${tr}.mode.server`, {}) }]} />

          <ServerSelect<z.infer<typeof adminServerSchema>>
            label={t('common.form.server', {})}
            queryKey={queryKeys.admin.servers.all()}
            paginatedFetcher={(page, search) => getServers(page, search)}
            value={server?.uuid ?? null}
            selectedItem={server}
            onChange={(_, selected) => setServer(selected)}
            comboboxProps={{ withinPortal: false }}
          />

          {server &&
            (server.teamUuid ? (
              <>
                <ResourceLookupResult
                  title={t(`${tr}.result.title`, {})}
                  icon={faPeopleGroup}
                  fields={[
                    { label: t(`${tr}.result.name`, {}), value: server.teamName ?? t('common.na', {}) },
                    { label: t(`${tr}.result.owner`, {}), value: server.owner.username },
                  ]}
                />
                <Group justify='flex-end'>
                  <Button
                    color='blue'
                    leftSection={<FontAwesomeIcon icon={faEye} />}
                    onClick={() => {
                      setOpened(false);
                      navigate(`/admin/teams/${server.teamUuid}`);
                    }}
                  >
                    {t(`${tr}.result.viewTeam`, {})}
                  </Button>
                </Group>
              </>
            ) : (
              <Alert icon={faMagnifyingGlass}>{t(`${tr}.notFound`, {})}</Alert>
            ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
