import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getEggRepositoryEggs from '@/api/admin/egg-repositories/eggs/getEggRepositoryEggs.ts';
import installEgg from '@/api/admin/egg-repositories/eggs/installEgg.ts';
import createNest from '@/api/admin/nests/createNest.ts';
import getAvailableNodeAllocations from '@/api/admin/nodes/allocations/getAvailableNodeAllocations.ts';
import createServer from '@/api/admin/servers/createServer.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminNodeAllocationSchema } from '@/lib/schemas/admin/nodes.ts';
import { oobeServerSchema } from '@/lib/schemas/oobe.ts';
import { formatAllocation } from '@/lib/server.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useAuth } from '@/providers/contexts/authContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeServer({ onNext, onBack, canGoBack, skipFrom, data }: OobeComponentProps) {
  const { t } = useTranslations();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const node = data.nodes[0] ?? null;
  const existingServer = data.servers[0] ?? null;

  const [selectedEggRepositoryUuid, setSelectedEggRepositoryUuid] = useState<string | null>(null);
  const [selectedEgg, setSelectedEgg] = useState<z.infer<typeof adminEggRepositoryEggSchema> | null>(null);

  const eggs = useSearchableResource<z.infer<typeof adminEggRepositoryEggSchema>>({
    queryKey: selectedEggRepositoryUuid
      ? queryKeys.admin.eggRepositories.eggs(selectedEggRepositoryUuid)
      : ['oobe', 'eggs'],
    fetcher: (search) =>
      selectedEggRepositoryUuid
        ? getEggRepositoryEggs(selectedEggRepositoryUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    deps: [selectedEggRepositoryUuid],
  });
  const availablePrimaryAllocations = useSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: node ? queryKeys.admin.nodes.allocations(node.uuid) : ['oobe', 'primary-allocations'],
    fetcher: (search) =>
      node ? getAvailableNodeAllocations(node.uuid, 1, search) : Promise.resolve(getEmptyPaginationSet()),
    deps: [node?.uuid],
  });
  const availableAllocations = useSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: node ? queryKeys.admin.nodes.allocations(node.uuid) : ['oobe', 'allocations'],
    fetcher: (search) =>
      node ? getAvailableNodeAllocations(node.uuid, 1, search) : Promise.resolve(getEmptyPaginationSet()),
    deps: [node?.uuid],
  });

  const form = useForm<z.infer<typeof oobeServerSchema>>({
    initialValues: {
      nestName: '',
      name: '',
      limits: { cpu: 100, memory: 1024, swap: 0, disk: 10240 },
      image: '',
      startOnCompletion: true,
      featureLimits: { allocations: 5, databases: 5, backups: 5, schedules: 5 },
      allocationUuid: '',
      allocationUuids: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(oobeServerSchema),
  });

  useEffect(() => {
    if (!data.isLoading && data.eggRepositories.length === 0) {
      skipFrom('server');
    }
  }, [data.isLoading]);

  useEffect(() => {
    if (!selectedEgg) return;
    form.setFieldValue('image', Object.values(selectedEgg.exportedEgg.dockerImages)[0] ?? '');
  }, [selectedEgg]);

  const onSubmit = async () => {
    setLoading(true);

    try {
      const nest = await createNest({
        author: user!.email,
        name: form.getValues().nestName,
        description: null,
      });

      const installedEgg = await installEgg(selectedEggRepositoryUuid!, selectedEgg!.uuid, nest.uuid);

      await createServer({
        externalId: null,
        name: form.getValues().name,
        description: null,
        startOnCompletion: form.getValues().startOnCompletion,
        skipInstaller: false,
        limits: {
          cpu: form.getValues().limits.cpu,
          memory: form.getValues().limits.memory,
          memoryOverhead: 0,
          swap: form.getValues().limits.swap,
          disk: form.getValues().limits.disk,
          ioWeight: null,
        },
        pinnedCpus: [],
        startup: installedEgg.startup,
        image: form.getValues().image,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hugepagesPassthroughEnabled: false,
        kvmPassthroughEnabled: false,
        featureLimits: {
          allocations: form.getValues().featureLimits.allocations,
          databases: form.getValues().featureLimits.databases,
          backups: form.getValues().featureLimits.backups,
          schedules: form.getValues().featureLimits.schedules,
        },
        nodeUuid: node!.uuid,
        ownerUuid: user!.uuid,
        eggUuid: installedEgg.uuid,
        backupConfigurationUuid: null,
        allocationUuid: form.getValues().allocationUuid,
        allocationUuids: form.getValues().allocationUuids,
        variables: [],
      });

      data.refetch();
      onNext();
    } catch (msg) {
      setError(httpErrorToHuman(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap='lg'>
      <Title order={2}>{t('pages.oobe.server.title', {})}</Title>

      {error && <AlertError error={error} setError={setError} />}

      <Stack gap='xl'>
        {existingServer ? (
          <Card>
            <Stack gap='sm'>
              <Title order={4}>{existingServer.name}</Title>
              <Text size='sm' c='dimmed'>
                {t('pages.oobe.server.existingServer', {})}
              </Text>
            </Stack>
          </Card>
        ) : (
          <Stack gap='sm'>
            <Card>
              <Stack gap='sm'>
                <Title order={4}>{t('pages.oobe.server.egg.title', {})}</Title>
                <Text size='sm'>{t('pages.oobe.server.egg.description', {})}</Text>

                <div className='flex flex-col sm:flex-row gap-2'>
                  <Select
                    withAsterisk
                    className='flex-1'
                    label='Egg Repository'
                    placeholder='Egg Repository'
                    data={data.eggRepositories.map((repo) => ({
                      label: repo.name,
                      value: repo.uuid,
                    }))}
                    value={selectedEggRepositoryUuid}
                    onChange={(val) => setSelectedEggRepositoryUuid(val)}
                  />
                  <Select
                    withAsterisk
                    className='flex-1'
                    label='Egg'
                    placeholder='Egg'
                    data={eggs.items.map((egg) => ({
                      label: egg.name,
                      value: egg.uuid,
                    }))}
                    searchable
                    searchValue={eggs.search}
                    onSearchChange={eggs.setSearch}
                    loading={eggs.loading}
                    disabled={!selectedEggRepositoryUuid}
                    value={selectedEgg?.uuid}
                    onChange={(val) => setSelectedEgg(eggs.items.find((e) => e.uuid === val)!)}
                  />
                </div>

                <Stack gap='xs'>
                  <Text size='sm'>{t('pages.oobe.server.egg.nestDescription', {})}</Text>
                  <TextInput
                    withAsterisk
                    label='Nest Name'
                    placeholder='Nest Name'
                    key={form.key('nestName')}
                    {...form.getInputProps('nestName')}
                  />
                </Stack>
              </Stack>
            </Card>

            <Card>
              <Stack>
                <Title order={4}>{t('pages.oobe.server.server.title', {})}</Title>

                <TextInput
                  withAsterisk
                  label='Server Name'
                  placeholder='My Game Server'
                  key={form.key('name')}
                  {...form.getInputProps('name')}
                />

                <div className='flex flex-col sm:flex-row gap-2'>
                  <NumberInput
                    withAsterisk
                    className='flex-1'
                    label='CPU Limit (%)'
                    description='The CPU Limit in % that the server can use, 1 thread = 100%'
                    placeholder='100'
                    min={0}
                    key={form.key('limits.cpu')}
                    {...form.getInputProps('limits.cpu')}
                  />
                  <SizeInput
                    withAsterisk
                    label='Swap'
                    description='The amount of swap to give this server, -1 will not set a limit'
                    mode='mb'
                    min={-1}
                    flex={1}
                    value={form.getValues().limits.swap}
                    onChange={(value) => form.setFieldValue('limits.swap', value)}
                  />
                </div>

                <div className='flex flex-col sm:flex-row gap-2'>
                  <SizeInput
                    withAsterisk
                    label='Memory'
                    description='The Memory limit of the server container, 0 will not set a limit'
                    mode='mb'
                    min={0}
                    flex={1}
                    value={form.getValues().limits.memory}
                    onChange={(value) => form.setFieldValue('limits.memory', value)}
                  />
                  <SizeInput
                    withAsterisk
                    label='Disk Space'
                    description='The disk limit of the server, this is a soft-limit unless disk limiter configured on wings'
                    mode='mb'
                    min={0}
                    flex={1}
                    value={form.getValues().limits.disk}
                    onChange={(value) => form.setFieldValue('limits.disk', value)}
                  />
                </div>

                <Select
                  withAsterisk
                  label='Docker Image'
                  placeholder='ghcr.io/...'
                  data={Object.entries(selectedEgg?.exportedEgg.dockerImages || {}).map(([label, value]) => ({
                    label,
                    value,
                  }))}
                  searchable
                  disabled={!selectedEgg}
                  key={form.key('image')}
                  {...form.getInputProps('image')}
                />

                <Switch
                  label='Start on Completion'
                  description='Start server after installation completes'
                  key={form.key('startOnCompletion')}
                  {...form.getInputProps('startOnCompletion', { type: 'checkbox' })}
                />

                <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
                  <NumberInput
                    withAsterisk
                    label='Allocations'
                    placeholder='0'
                    min={0}
                    key={form.key('featureLimits.allocations')}
                    {...form.getInputProps('featureLimits.allocations')}
                  />
                  <NumberInput
                    withAsterisk
                    label='Databases'
                    placeholder='0'
                    min={0}
                    key={form.key('featureLimits.databases')}
                    {...form.getInputProps('featureLimits.databases')}
                  />
                  <NumberInput
                    withAsterisk
                    label='Backups'
                    placeholder='0'
                    min={0}
                    key={form.key('featureLimits.backups')}
                    {...form.getInputProps('featureLimits.backups')}
                  />
                  <NumberInput
                    withAsterisk
                    label='Schedules'
                    placeholder='0'
                    min={0}
                    key={form.key('featureLimits.schedules')}
                    {...form.getInputProps('featureLimits.schedules')}
                  />
                </div>

                <div className='flex flex-col sm:flex-row gap-2'>
                  <Select
                    className='flex-1'
                    label='Primary Allocation'
                    placeholder='Primary Allocation'
                    data={availablePrimaryAllocations.items
                      .filter((alloc) => !form.getValues().allocationUuids.includes(alloc.uuid))
                      .map((alloc) => ({
                        label: formatAllocation(alloc),
                        value: alloc.uuid,
                      }))}
                    searchable
                    searchValue={availablePrimaryAllocations.search}
                    onSearchChange={availablePrimaryAllocations.setSearch}
                    allowDeselect
                    key={form.key('allocationUuid')}
                    {...form.getInputProps('allocationUuid')}
                  />
                  <MultiSelect
                    className='flex-1'
                    label='Additional Allocations'
                    placeholder='Additional Allocations'
                    data={availableAllocations.items
                      .filter((alloc) => alloc.uuid !== form.getValues().allocationUuid)
                      .map((alloc) => ({
                        label: formatAllocation(alloc),
                        value: alloc.uuid,
                      }))}
                    searchable
                    searchValue={availableAllocations.search}
                    onSearchChange={availableAllocations.setSearch}
                    key={form.key('allocationUuids')}
                    {...form.getInputProps('allocationUuids')}
                  />
                </div>
              </Stack>
            </Card>
          </Stack>
        )}

        <Group justify='flex-end'>
          {canGoBack && (
            <Button variant='subtle' onClick={onBack} leftSection={<FontAwesomeIcon icon={faChevronLeft} />}>
              Back
            </Button>
          )}
          {!existingServer && (
            <Button variant='outline' onClick={() => skipFrom('server')}>
              {t('common.button.skip', {})}
            </Button>
          )}
          {existingServer ? (
            <Button onClick={() => onNext()}>{t('common.button.continue', {})}</Button>
          ) : (
            <Button
              type='submit'
              disabled={!selectedEgg || !form.isValid()}
              loading={loading}
              onClick={() => onSubmit()}
            >
              {t('pages.oobe.server.button.create', {})}
            </Button>
          )}
        </Group>
      </Stack>
    </Stack>
  );
}
