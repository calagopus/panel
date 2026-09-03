import { faBroom, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType } from '@mantine/form';
import cronstrue from 'cronstrue/i18n';
import { z } from 'zod';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationResticSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupProviderSection from './BackupProviderSection.tsx';

type ResticFormValues = z.infer<typeof adminBackupConfigurationResticSchema>;
type ResticForm = UseFormReturnType<ResticFormValues>;
type NodeResource = ReturnType<typeof useSearchableResource<z.infer<typeof adminNodeSchema>>>;

function cronDescription(cron: string, language: string): string | null {
  try {
    return cronstrue.toString(cron, { locale: language });
  } catch {
    return null;
  }
}

function PruneJobRow({ form, index, nodes }: { form: ResticForm; index: number; nodes: NodeResource }) {
  const { t, language } = useTranslations();

  const description = cronDescription(form.values.pruneJobs[index].cron, language);

  return (
    <Card withBorder padding='md'>
      <Group align='flex-start' wrap='nowrap'>
        <Stack gap='xs' className='flex-1'>
          <TextInput
            withAsterisk
            label={t('pages.admin.backupConfigurations.tabs.general.page.restic.form.cronSchedule', {})}
            placeholder='0 0 0 * * *'
            description={
              description ??
              t('pages.admin.backupConfigurations.tabs.general.page.restic.form.cronScheduleDescription', {})
            }
            key={form.key(`pruneJobs.${index}.cron`)}
            {...form.getInputProps(`pruneJobs.${index}.cron`)}
          />
          <MultiSelect
            searchable
            label={t('pages.admin.backupConfigurations.tabs.general.page.restic.form.nodes', {})}
            placeholder={t('pages.admin.backupConfigurations.tabs.general.page.restic.form.nodesPlaceholder', {})}
            data={nodes.items.map((node) => ({ value: node.uuid, label: node.name }))}
            searchValue={nodes.search}
            onSearchChange={nodes.setSearch}
            key={form.key(`pruneJobs.${index}.nodes`)}
            {...form.getInputProps(`pruneJobs.${index}.nodes`)}
          />
        </Stack>
        <ActionIcon color='red' variant='subtle' onClick={() => form.removeListItem('pruneJobs', index)}>
          <FontAwesomeIcon icon={faTrash} />
        </ActionIcon>
      </Group>
    </Card>
  );
}

export default function BackupRestic({ form }: { form: ResticForm }) {
  const { t } = useTranslations();
  const canReadNodes = useAdminCan('nodes.read');
  const pruneJobs = form.values.pruneJobs ?? [];

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
    canRequest: canReadNodes,
  });

  const fields: FieldDef<ResticFormValues>[] = [
    {
      type: 'text',
      name: 'repository',
      label: t('pages.admin.backupConfigurations.tabs.general.page.restic.form.repository', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'retryLockSeconds',
      label: t('pages.admin.backupConfigurations.tabs.general.page.restic.form.retryLockSeconds', {}),
      required: true,
    },
  ];

  return (
    <BackupProviderSection title={t('pages.admin.backupConfigurations.tabs.general.page.restic.title', {})}>
      <Stack>
        <FormEngine form={form} fields={fields} />

        <PasswordInput
          withAsterisk
          label={t('common.form.password', {})}
          value={form.values.environment?.RESTIC_PASSWORD || ''}
          onChange={(e) => form.setFieldValue('environment.RESTIC_PASSWORD', e.target.value)}
        />

        <MultiKeyValueInput
          label={t('pages.admin.backupConfigurations.tabs.general.page.restic.form.environmentVariables', {})}
          allowReordering={false}
          options={form.values.environment}
          onChange={(e) => form.setFieldValue('environment', e)}
          transformValue={(key, value) => (key === 'AWS_SECRET_ACCESS_KEY' ? '*'.repeat(value.length) : value)}
          hideKey={(key) => key === 'RESTIC_PASSWORD'}
        />
      </Stack>

      <TitleCard
        title={t('pages.admin.backupConfigurations.tabs.general.page.restic.pruneJobs.title', {})}
        icon={<FontAwesomeIcon icon={faBroom} />}
        className='mt-2'
      >
        <Stack>
          <Text size='sm' c='dimmed'>
            {t('pages.admin.backupConfigurations.tabs.general.page.restic.pruneJobs.description', {})}
          </Text>

          {pruneJobs.map((_, index) => (
            <PruneJobRow key={form.key(`pruneJobs.${index}`)} form={form} index={index} nodes={nodes} />
          ))}

          <Group>
            <Button
              variant='light'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
              onClick={() => form.insertListItem('pruneJobs', { cron: '0 0 0 * * *', nodes: [] })}
            >
              {t('pages.admin.backupConfigurations.tabs.general.page.restic.pruneJobs.button.add', {})}
            </Button>
          </Group>
        </Stack>
      </TitleCard>
    </BackupProviderSection>
  );
}
