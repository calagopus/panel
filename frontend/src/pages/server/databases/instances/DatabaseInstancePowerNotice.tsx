import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Group from '@/elements/layout/Group.tsx';
import Text from '@/elements/typography/Text.tsx';
import { serverPowerStateLabelMapping } from '@/lib/enums.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useDatabaseInstancePowerState } from './useDatabaseInstancePowerState.ts';

export default function DatabaseInstancePowerNotice({
  power,
  action,
}: {
  power: ReturnType<typeof useDatabaseInstancePowerState>;
  action: 'restore' | 'backup';
}) {
  const { t } = useTranslations();

  if (!power.state || power.state === 'running') {
    return null;
  }

  return (
    <Alert color='yellow'>
      <Group justify='space-between' wrap='nowrap'>
        <Text size='sm'>
          {t(
            action === 'restore'
              ? 'pages.server.databases.instance.backups.notRunning.restore'
              : 'pages.server.databases.instance.backups.notRunning.backup',
            { state: serverPowerStateLabelMapping[power.state]().toLowerCase() },
          )}
        </Text>
        {(power.canStart || power.starting) && (
          <Button size='xs' color='green' loading={power.starting} onClick={power.start}>
            {t('common.enum.serverPowerAction.start', {})}
          </Button>
        )}
      </Group>
    </Alert>
  );
}
