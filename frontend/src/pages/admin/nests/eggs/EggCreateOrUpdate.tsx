import {
  faChevronDown,
  faFileDownload,
  faFileText,
  faMinus,
  faPlay,
  faPlus,
  faRefresh,
  faStop,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { dump, load } from 'js-yaml';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import getEggRepositoryEggs from '@/api/admin/egg-repositories/eggs/getEggRepositoryEggs.ts';
import getEggRepositories from '@/api/admin/egg-repositories/getEggRepositories.ts';
import createEgg from '@/api/admin/nests/eggs/createEgg.ts';
import deleteEgg from '@/api/admin/nests/eggs/deleteEgg.ts';
import exportEgg from '@/api/admin/nests/eggs/exportEgg.ts';
import getEgg from '@/api/admin/nests/eggs/getEgg.ts';
import updateEgg from '@/api/admin/nests/eggs/updateEgg.ts';
import updateEggUsingImport from '@/api/admin/nests/eggs/updateEggUsingImport.ts';
import updateEggUsingRepository from '@/api/admin/nests/eggs/updateEggUsingRepository.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import JsonInput from '@/elements/input/JsonInput.tsx';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { processConfigurationParserLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminEggSchema, adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggDuplicateModal from './modals/EggDuplicateModal.tsx';
import EggMoveModal from './modals/EggMoveModal.tsx';

export default function EggCreateOrUpdate({
  contextNest,
  contextEgg,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg?: z.infer<typeof adminEggSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'move' | 'delete' | 'duplicate' | null>(null);
  const [selectedEggRepositoryUuid, setSelectedEggRepositoryUuid] = useState<string>(
    contextEgg?.eggRepositoryEgg?.eggRepository.uuid ?? '',
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<z.infer<typeof adminEggUpdateSchema>>({
    mode: 'uncontrolled',
    initialValues: {
      eggRepositoryEggUuid: null,
      author: '',
      name: '',
      description: null,
      configFiles: [],
      configStartup: {
        done: [],
        stripAnsi: false,
      },
      configStop: {
        type: '',
        value: null,
      },
      startupCommands: { Default: '' },
      forceOutgoingIp: false,
      separatePort: false,
      features: [],
      dockerImages: {},
      fileDenylist: [],
    },
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
    validate: zod4Resolver(adminEggUpdateSchema),
  });

  const [stopType, setStopType] = useState(() => form.getValues().configStop.type);
  form.watch('configStop.type', ({ value }) => setStopType(value));

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminEggUpdateSchema>,
    z.infer<typeof adminEggSchema>
  >({
    form,
    createFn: () =>
      createEgg(contextNest.uuid, {
        ...adminEggUpdateSchema.parse(form.getValues()),
        configScript: {
          container: 'debian:latest',
          entrypoint: '/bin/bash',
          content: '#!/bin/bash\n\n# Install script content goes here\n',
        },
      }),
    updateFn: contextEgg
      ? () => updateEgg(contextNest.uuid, contextEgg.uuid, adminEggUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextEgg ? () => deleteEgg(contextNest.uuid, contextEgg.uuid) : undefined,
    doUpdate: !!contextEgg,
    basePath: `/admin/nests/${contextNest.uuid}/eggs`,
    resourceName: t('pages.admin.nests.tabs.eggs.page.resourceName', {}),
  });

  useEffect(() => {
    if (contextEgg) {
      form.setValues({
        eggRepositoryEggUuid: contextEgg.eggRepositoryEgg?.uuid || null,
        author: contextEgg.author,
        name: contextEgg.name,
        description: contextEgg.description,
        configFiles: contextEgg.configFiles,
        configStartup: contextEgg.configStartup,
        configStop: contextEgg.configStop,
        startupCommands: contextEgg.startupCommands,
        forceOutgoingIp: contextEgg.forceOutgoingIp,
        separatePort: contextEgg.separatePort,
        features: contextEgg.features,
        dockerImages: contextEgg.dockerImages,
        fileDenylist: contextEgg.fileDenylist,
      });
    }
  }, [contextEgg]);

  const eggRepositories = useSearchableResource<z.infer<typeof adminEggRepositorySchema>>({
    queryKey: queryKeys.admin.eggRepositories.all(),
    fetcher: (search) => getEggRepositories(1, search),
    defaultSearchValue: contextEgg?.eggRepositoryEgg?.eggRepository.name,
  });
  const eggRepositoryEggs = useSearchableResource<z.infer<typeof adminEggRepositoryEggSchema>>({
    queryKey: selectedEggRepositoryUuid
      ? queryKeys.admin.eggRepositories.eggs(selectedEggRepositoryUuid)
      : ['admin', 'egg-repository-eggs'],
    fetcher: (search) =>
      selectedEggRepositoryUuid
        ? getEggRepositoryEggs(selectedEggRepositoryUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    defaultSearchValue: contextEgg?.eggRepositoryEgg?.exportedEgg.name,
    deps: [selectedEggRepositoryUuid],
  });

  const doExport = (format: 'json' | 'yaml') => {
    setLoading(true);

    exportEgg(contextNest?.uuid, contextEgg!.uuid)
      .then((data) => {
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.general.page.toast.exported', {}), 'success');

        if (format === 'json') {
          const jsonData = JSON.stringify(data, undefined, 2);
          const fileURL = URL.createObjectURL(new Blob([jsonData], { type: 'text/plain' }));
          const downloadLink = document.createElement('a');
          downloadLink.href = fileURL;
          downloadLink.download = `egg-${contextEgg!.uuid}.json`;
          document.body.appendChild(downloadLink);
          downloadLink.click();

          URL.revokeObjectURL(fileURL);
          downloadLink.remove();
        } else {
          const yamlData = dump(data, {
            flowLevel: -1,
            forceQuotes: true,
          });
          const fileURL = URL.createObjectURL(new Blob([yamlData], { type: 'text/plain' }));
          const downloadLink = document.createElement('a');
          downloadLink.href = fileURL;
          downloadLink.download = `egg-${contextEgg!.uuid}.yml`;
          document.body.appendChild(downloadLink);
          downloadLink.click();

          URL.revokeObjectURL(fileURL);
          downloadLink.remove();
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doRepositoryUpdate = () => {
    setLoading(true);

    updateEggUsingRepository(contextNest.uuid, contextEgg!.uuid)
      .then(() => getEgg(contextNest.uuid, contextEgg!.uuid))
      .then((egg) => {
        form.setValues({
          ...egg,
          eggRepositoryEggUuid: egg.eggRepositoryEgg?.uuid || null,
        });
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.general.page.toast.updated', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    setLoading(true);

    let data: object;
    try {
      const text = await file.text().then((t) => t.trim());

      if (text.startsWith('{')) {
        data = JSON.parse(text);
      } else {
        data = load(text) as object;
      }
    } catch (err) {
      addToast(t('pages.admin.nests.tabs.eggs.page.toast.parseFailed', { error: String(err) }), 'error');
      setLoading(false);
      return;
    }

    updateEggUsingImport(contextNest.uuid, contextEgg!.uuid, data)
      .then(() => getEgg(contextNest.uuid, contextEgg!.uuid))
      .then((egg) => {
        form.setValues({
          ...egg,
          eggRepositoryEggUuid: egg.eggRepositoryEgg?.uuid || null,
        });
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.general.page.toast.updated', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminContentContainer
      title={
        contextEgg
          ? t('pages.admin.nests.tabs.eggs.page.tabs.general.page.titleUpdate', {})
          : t('pages.admin.nests.tabs.eggs.page.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextEgg}
      hideTitleComponent
    >
      {contextEgg && (
        <EggMoveModal
          opened={openModal === 'move'}
          onClose={() => setOpenModal(null)}
          nest={contextNest}
          egg={contextEgg}
        />
      )}
      {contextEgg && (
        <EggDuplicateModal
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
          nest={contextNest}
          egg={contextEgg}
        />
      )}
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.modal.delete.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.nests.eggs(contextNest.uuid)))}>
        <Stack>
          <Group grow>
            <TextInput
              withAsterisk
              label={t('common.form.author', {})}
              key={form.key('author')}
              {...form.getInputProps('author')}
            />
            <TextInput
              withAsterisk
              label={t('common.form.name', {})}
              key={form.key('name')}
              {...form.getInputProps('name')}
            />
          </Group>

          <TextArea
            label={t('common.form.description', {})}
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <Group grow>
            <Select
              label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.eggRepository', {})}
              value={selectedEggRepositoryUuid}
              onChange={(value) => {
                setSelectedEggRepositoryUuid(value ?? '');
                form.setFieldValue('eggRepositoryEggUuid', null);
              }}
              data={eggRepositories.items.map((eggRepository) => ({
                label: eggRepository.name,
                value: eggRepository.uuid,
              }))}
              searchable
              searchValue={eggRepositories.search}
              onSearchChange={eggRepositories.setSearch}
              loading={eggRepositories.loading}
            />
            <Select
              label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.eggRepositoryEgg', {})}
              placeholder={t('common.none', {})}
              disabled={!selectedEggRepositoryUuid}
              data={eggRepositoryEggs.items.map((eggRepositoryEgg) => ({
                label: eggRepositoryEgg.exportedEgg.name,
                value: eggRepositoryEgg.uuid,
              }))}
              searchable
              allowDeselect
              clearable
              searchValue={eggRepositoryEggs.search}
              onSearchChange={eggRepositoryEggs.setSearch}
              loading={eggRepositoryEggs.loading}
              key={form.key('eggRepositoryEggUuid')}
              {...form.getInputProps('eggRepositoryEggUuid')}
            />
          </Group>

          <TitleCard
            title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.card.startupConfiguration', {})}
            icon={<FontAwesomeIcon icon={faPlay} size='sm' />}
          >
            <Group grow align='top'>
              <TagsInput
                withAsterisk
                label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.startupDone', {})}
                description={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.startupDoneDescription', {})}
                key={form.key('configStartup.done')}
                {...form.getInputProps('configStartup.done')}
              />

              <Switch
                label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.stripAnsi', {})}
                description={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.stripAnsiDescription', {})}
                key={form.key('configStartup.stripAnsi')}
                {...form.getInputProps('configStartup.stripAnsi', {
                  type: 'checkbox',
                })}
              />
            </Group>
          </TitleCard>

          <TitleCard
            title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.card.stopConfiguration', {})}
            icon={<FontAwesomeIcon icon={faStop} size='sm' />}
          >
            <Group grow>
              <Select
                withAsterisk
                label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.stopType', {})}
                data={[
                  {
                    label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.enum.stopType.command', {}),
                    value: 'command',
                  },
                  {
                    label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.enum.stopType.signal', {}),
                    value: 'signal',
                  },
                  {
                    label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.enum.stopType.docker', {}),
                    value: 'docker',
                  },
                ]}
                key={form.key('configStop.type')}
                {...form.getInputProps('configStop.type')}
                onChange={(value) => {
                  if (!value) return;
                  form.setFieldValue('configStop.type', value as 'command' | 'signal' | 'docker');

                  if (
                    value === 'signal' &&
                    !['SIGABRT', 'SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGKILL'].includes(
                      form.getValues().configStop.value ?? '',
                    )
                  ) {
                    form.setFieldValue('configStop.value', 'SIGKILL');
                  }
                }}
              />
              {stopType === 'command' ? (
                <TextInput
                  withAsterisk
                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.stopCommand', {})}
                  key={form.key('configStop.value')}
                  {...form.getInputProps('configStop.value')}
                />
              ) : stopType === 'signal' ? (
                <Select
                  withAsterisk
                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.stopSignal', {})}
                  data={[
                    { label: 'SIGABRT', value: 'SIGABRT' },
                    { label: 'SIGINT (^C)', value: 'SIGINT' },
                    { label: 'SIGTERM', value: 'SIGTERM' },
                    { label: 'SIGQUIT', value: 'SIGQUIT' },
                    { label: 'SIGKILL', value: 'SIGKILL' },
                  ]}
                  key={form.key('configStop.value')}
                  {...form.getInputProps('configStop.value')}
                />
              ) : null}
            </Group>
          </TitleCard>

          <TitleCard
            title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.card.configFiles', {})}
            icon={<FontAwesomeIcon icon={faFileText} size='sm' />}
          >
            {form.getValues().configFiles.length === 0 ? (
              <p className='mb-2'>{t('pages.admin.nests.tabs.eggs.page.tabs.general.page.emptyConfigFiles', {})}</p>
            ) : (
              form.getValues().configFiles.map((_, index) => (
                <Card key={index} className='flex flex-row! justify-between mb-2'>
                  <Stack w='100%'>
                    <Group grow>
                      <TextInput
                        withAsterisk
                        label={t('common.form.filePath', {})}
                        key={form.key(`configFiles.${index}.file`)}
                        {...form.getInputProps(`configFiles.${index}.file`)}
                      />
                      <Select
                        withAsterisk
                        label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.parser', {})}
                        data={Object.entries(processConfigurationParserLabelMapping).map(([value, label]) => ({
                          label,
                          value,
                        }))}
                        key={form.key(`configFiles.${index}.parser`)}
                        {...form.getInputProps(`configFiles.${index}.parser`)}
                      />
                    </Group>

                    <Switch
                      label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.createNewFile', {})}
                      description={t(
                        'pages.admin.nests.tabs.eggs.page.tabs.general.page.form.createNewFileDescription',
                        {},
                      )}
                      key={form.key(`configFiles.${index}.createNew`)}
                      {...form.getInputProps(`configFiles.${index}.createNew`, {
                        type: 'checkbox',
                      })}
                    />

                    <div className='flex flex-col'>
                      {form.getValues().configFiles[index].replace.length === 0 ? (
                        <p className='mb-2'>
                          {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.emptyReplacements', {})}
                        </p>
                      ) : (
                        form.getValues().configFiles[index].replace.map((_, replaceIndex) => (
                          <Card key={replaceIndex} className='flex flex-row! mb-2'>
                            <div className='flex flex-col w-full'>
                              <Group grow w='100%' align='flex-start'>
                                <TextInput
                                  withAsterisk
                                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.match', {})}
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.match`)}
                                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.match`)}
                                />
                                <TextInput
                                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.ifValue', {})}
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.ifValue`)}
                                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.ifValue`)}
                                />
                                <JsonInput
                                  withAsterisk
                                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.replaceWith', {})}
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.replaceWith`)}
                                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.replaceWith`)}
                                />
                              </Group>
                              <Group grow mt='md'>
                                <Switch
                                  label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.insertNew', {})}
                                  description={t(
                                    'pages.admin.nests.tabs.eggs.page.tabs.general.page.form.insertNewDescription',
                                    {},
                                  )}
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.insertNew`)}
                                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.insertNew`, {
                                    type: 'checkbox',
                                  })}
                                />
                                <Switch
                                  label={t(
                                    'pages.admin.nests.tabs.eggs.page.tabs.general.page.form.updateExisting',
                                    {},
                                  )}
                                  description={t(
                                    'pages.admin.nests.tabs.eggs.page.tabs.general.page.form.updateExistingDescription',
                                    {},
                                  )}
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.updateExisting`)}
                                  {...form.getInputProps(
                                    `configFiles.${index}.replace.${replaceIndex}.updateExisting`,
                                    { type: 'checkbox' },
                                  )}
                                />
                              </Group>
                            </div>

                            <ActionIcon
                              color='red'
                              variant='light'
                              size='input-md'
                              className='ml-4'
                              onClick={() =>
                                form.setValues({
                                  ...form.getValues(),
                                  configFiles: form.getValues().configFiles.map((configFile, i) => {
                                    if (i !== index) return configFile;
                                    return {
                                      ...configFile,
                                      replace: configFile.replace.filter((_, j) => j !== replaceIndex),
                                    };
                                  }),
                                })
                              }
                            >
                              <FontAwesomeIcon icon={faMinus} />
                            </ActionIcon>
                          </Card>
                        ))
                      )}

                      <Button
                        variant='light'
                        onClick={() =>
                          form.setValues({
                            ...form.getValues(),
                            configFiles: form.getValues().configFiles.map((configFile, i) => {
                              if (i !== index) return configFile;
                              return {
                                ...configFile,
                                replace: [
                                  ...configFile.replace,
                                  {
                                    match: '',
                                    insertNew: false,
                                    updateExisting: true,
                                    ifValue: null,
                                    replaceWith: '',
                                  },
                                ],
                              };
                            }),
                          })
                        }
                        className='w-fit!'
                        leftSection={<FontAwesomeIcon icon={faPlus} />}
                      >
                        {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.button.addReplacement', {})}
                      </Button>
                    </div>
                  </Stack>

                  <ActionIcon
                    color='red'
                    variant='light'
                    size='input-md'
                    className='ml-4'
                    onClick={() =>
                      form.setValues({
                        ...form.getValues(),
                        configFiles: form.getValues().configFiles.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </ActionIcon>
                </Card>
              ))
            )}

            <Button
              variant='light'
              onClick={() =>
                form.setValues({
                  ...form.getValues(),
                  configFiles: [
                    ...form.getValues().configFiles,
                    {
                      file: '',
                      parser: 'file',
                      createNew: true,
                      replace: [],
                    },
                  ],
                })
              }
              className='w-fit!'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('pages.admin.nests.tabs.eggs.page.tabs.general.page.button.addConfigFile', {})}
            </Button>
          </TitleCard>

          <MultiKeyValueInput
            label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.startupCommands', {})}
            withAsterisk
            options={form.getValues().startupCommands}
            onChange={(e) => form.setFieldValue('startupCommands', e)}
          />

          <Group grow>
            <Switch
              label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.forceOutgoingIp', {})}
              key={form.key('forceOutgoingIp')}
              {...form.getInputProps('forceOutgoingIp', { type: 'checkbox' })}
            />
            <Switch
              label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.separatePort', {})}
              description={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.separatePortDescription', {})}
              key={form.key('separatePort')}
              {...form.getInputProps('separatePort', { type: 'checkbox' })}
            />
          </Group>

          <Group grow align='top'>
            <TagsInput
              label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.features', {})}
              placeholder={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.featurePlaceholder', {})}
              key={form.key('features')}
              {...form.getInputProps('features')}
            />
            <TagsInput
              label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.fileDenylist', {})}
              key={form.key('fileDenylist')}
              {...form.getInputProps('fileDenylist')}
            />
          </Group>

          <MultiKeyValueInput
            label={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.form.dockerImages', {})}
            withAsterisk
            options={form.getValues().dockerImages}
            onChange={(e) => form.setFieldValue('dockerImages', e)}
          />
        </Stack>

        <Group mt='md'>
          <AdminCan action={contextEgg ? 'eggs.update' : 'eggs.create'} cantSave>
            <Button type='submit' disabled={!isValid} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {contextEgg && (
              <>
                <ContextMenu
                  menuProps={{ position: 'top', offset: 40 }}
                  items={[
                    {
                      type: 'action',
                      icon: faUpload,
                      label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.button.fromFile', {}),
                      onClick: () => fileInputRef.current?.click(),
                      color: 'gray',
                    },
                    {
                      type: 'action',
                      icon: faRefresh,
                      label: t('pages.admin.nests.tabs.eggs.page.tabs.general.page.button.fromRepository', {}),
                      disabled: !contextEgg.eggRepositoryEgg,
                      onClick: doRepositoryUpdate,
                      color: 'gray',
                    },
                  ]}
                >
                  {({ openMenu }) => (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        openMenu(rect.left, rect.bottom);
                      }}
                      loading={loading}
                      variant='outline'
                      rightSection={<FontAwesomeIcon icon={faChevronDown} />}
                    >
                      {t('common.button.update', {})}
                    </Button>
                  )}
                </ContextMenu>
                <ContextMenu
                  menuProps={{ position: 'top', offset: 40 }}
                  items={[
                    {
                      type: 'action',
                      icon: faFileDownload,
                      label: t('common.button.exportAs', { format: 'JSON' }),
                      onClick: () => doExport('json'),
                      color: 'gray',
                    },
                    {
                      type: 'action',
                      icon: faFileDownload,
                      label: t('common.button.exportAs', { format: 'YAML' }),
                      onClick: () => doExport('yaml'),
                      color: 'gray',
                    },
                  ]}
                >
                  {({ openMenu }) => (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        openMenu(rect.left, rect.bottom);
                      }}
                      loading={loading}
                      variant='outline'
                      rightSection={<FontAwesomeIcon icon={faChevronDown} />}
                    >
                      {t('common.button.export', {})}
                    </Button>
                  )}
                </ContextMenu>

                <input
                  type='file'
                  accept='.json,.yml,.yaml'
                  ref={fileInputRef}
                  className='hidden'
                  onChange={handleFileUpload}
                />
              </>
            )}
          </AdminCan>
          {contextEgg && (
            <Button variant='outline' onClick={() => setOpenModal('move')} loading={loading}>
              {t('common.button.move', {})}
            </Button>
          )}
          {contextEgg && (
            <AdminCan action='eggs.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextEgg && (
            <AdminCan action='eggs.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
