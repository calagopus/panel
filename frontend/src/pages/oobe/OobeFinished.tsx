import {
  faArrowRight,
  faCheckCircle,
  faCogs,
  faComputer,
  faDownload,
  faEarthAmerica,
  faServer,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getEggRepositories from '@/api/admin/egg-repositories/getEggRepositories.ts';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import updateOobeSettings from '@/api/admin/settings/updateOobeSettings.ts';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import Divider from '@/elements/Divider.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function OobeFinished() {
  const { t } = useTranslations();
  const { user } = useAuth();
  const { settings, setSettings } = useGlobalStore();
  const navigate = useNavigate();

  const eggRepositories = useSearchableResource<z.infer<typeof adminEggRepositorySchema>>({
    queryKey: queryKeys.admin.eggRepositories.all(),
    fetcher: () => getEggRepositories(1),
  });
  const locations = useSearchableResource<z.infer<typeof adminLocationSchema>>({
    queryKey: queryKeys.admin.locations.all(),
    fetcher: () => getLocations(1),
  });
  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: () => getNodes(1),
  });
  const servers = useSearchableResource<z.infer<typeof adminServerSchema>>({
    queryKey: queryKeys.admin.servers.all(),
    fetcher: () => getServers(1),
  });

  const handleFinish = () => {
    updateOobeSettings(null).then(() => {
      setSettings({ ...settings, oobeStep: null });
      navigate('/');
    });
  };

  return (
    <Stack gap='xl'>
      <div>
        <Title order={2} ta='center' mb='xs'>
          {t('pages.oobe.finished.title', {})}
        </Title>
        <Text size='lg' ta='center' c='dimmed'>
          {t('pages.oobe.finished.subtitle', {})}
        </Text>
      </div>

      <Paper p='lg' withBorder radius='md'>
        <Group mb='md'>
          <FontAwesomeIcon icon={faCheckCircle} style={{ color: 'var(--mantine-color-teal-6)' }} />
          <Text fw={600} size='sm'>
            {t('pages.oobe.finished.setupTitle', {})}
          </Text>
        </Group>

        <Stack gap='sm'>
          <Group gap='xs'>
            <ThemeIcon size='sm' radius='xl' color='blue' variant='light'>
              <FontAwesomeIcon icon={faUsers} size='xs' />
            </ThemeIcon>
            <div className='flex-1'>
              <Text size='sm' fw={500}>
                {t('pages.oobe.finished.items.account', {})}
              </Text>
              <Text size='xs' c='dimmed'>
                {user!.username} ({user!.email})
              </Text>
            </div>
          </Group>

          <Divider />

          <Group gap='xs'>
            <ThemeIcon size='sm' radius='xl' color='violet' variant='light'>
              <FontAwesomeIcon icon={faCogs} size='xs' />
            </ThemeIcon>
            <div className='flex-1'>
              <Text size='sm' fw={500}>
                {t('pages.oobe.finished.items.configuration.title', {})}
              </Text>
              <Text size='xs' c='dimmed'>
                {t('pages.oobe.finished.items.configuration.subtitle', {})}
              </Text>
            </div>
          </Group>

          <Divider />

          <Group gap='xs'>
            <ThemeIcon size='sm' radius='xl' color='red' variant='light'>
              <FontAwesomeIcon icon={faDownload} size='xs' />
            </ThemeIcon>
            <div className='flex-1'>
              <Text size='sm' fw={500}>
                {t('pages.oobe.finished.items.eggRepositories.title', {})}
              </Text>
              {eggRepositories.items.length > 0 && (
                <Text size='xs' c='dimmed'>
                  {t('pages.oobe.finished.items.eggRepositories.subtitle', {
                    count: eggRepositories.items.length,
                  })}
                </Text>
              )}
            </div>
            {eggRepositories.items.length < 1 && (
              <Badge color='orange' size='sm'>
                {t('pages.oobe.finished.badge.skipped', {})}
              </Badge>
            )}
          </Group>

          <Divider />

          <Group gap='xs'>
            <ThemeIcon size='sm' radius='xl' color='cyan' variant='light'>
              <FontAwesomeIcon icon={faEarthAmerica} size='xs' />
            </ThemeIcon>
            <div className='flex-1'>
              <Text size='sm' fw={500}>
                {t('pages.oobe.finished.items.location', {})}
              </Text>
              {locations.items.length > 0 && (
                <Text size='xs' c='dimmed'>
                  {locations.items[0].name}
                </Text>
              )}
            </div>
            {locations.items.length < 1 && (
              <Badge color='orange' size='sm'>
                {t('pages.oobe.finished.badge.skipped', {})}
              </Badge>
            )}
          </Group>

          <Divider />

          <Group gap='xs'>
            <ThemeIcon size='sm' radius='xl' color='orange' variant='light'>
              <FontAwesomeIcon icon={faServer} size='xs' />
            </ThemeIcon>
            <div className='flex-1'>
              <Text size='sm' fw={500}>
                {t('pages.oobe.finished.items.node', {})}
              </Text>
              {nodes.items.length > 0 && (
                <Text size='xs' c='dimmed'>
                  {nodes.items[0].name}
                </Text>
              )}
            </div>
            {nodes.items.length < 1 && (
              <Badge color='orange' size='sm'>
                {t('pages.oobe.finished.badge.skipped', {})}
              </Badge>
            )}
          </Group>

          <Divider />

          <Group gap='xs'>
            <ThemeIcon size='sm' radius='xl' color='green' variant='light'>
              <FontAwesomeIcon icon={faComputer} size='xs' />
            </ThemeIcon>
            <div className='flex-1'>
              <Text size='sm' fw={500}>
                {t('pages.oobe.finished.items.server', {})}
              </Text>
              {servers.items.length > 0 && (
                <Text size='xs' c='dimmed'>
                  {servers.items[0].name}
                </Text>
              )}
            </div>
            {servers.items.length < 1 && (
              <Badge color='orange' size='sm'>
                {t('pages.oobe.finished.badge.skipped', {})}
              </Badge>
            )}
          </Group>
        </Stack>
      </Paper>

      <Group justify='center' mt='lg'>
        <Button size='lg' rightSection={<FontAwesomeIcon icon={faArrowRight} />} onClick={handleFinish}>
          {t('pages.oobe.finished.button', {})}
        </Button>
      </Group>
    </Stack>
  );
}
