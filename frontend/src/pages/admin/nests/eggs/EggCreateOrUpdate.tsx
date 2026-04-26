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
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import jsYaml from 'js-yaml';
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
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { processConfigurationParserLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminEggSchema, adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import EggMoveModal from './modals/EggMoveModal.tsx';

export default function EggCreateOrUpdate({
  contextNest,
  contextEgg,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg?: z.infer<typeof adminEggSchema>;
}) {
  const { addToast } = useToast();

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'move' | 'delete' | null>(null);
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
      startup: '',
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
    resourceName: 'Egg',
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
        startup: contextEgg.startup,
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
    defaultSearchValue: contextEgg?.eggRepositoryEgg?.name,
    deps: [selectedEggRepositoryUuid],
  });

  const doExport = (format: 'json' | 'yaml') => {
    setLoading(true);

    exportEgg(contextNest?.uuid, contextEgg!.uuid)
      .then((data) => {
        addToast('Egg exported.', 'success');

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
          const yamlData = jsYaml.dump(data, {
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
        addToast('Egg updated.', 'success');
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
        data = jsYaml.load(text) as object;
      }
    } catch (err) {
      addToast(`Failed to parse egg: ${err}`, 'error');
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
        addToast('Egg updated.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminContentContainer
      title={`${contextEgg ? 'Update' : 'Create'} Egg`}
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
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Egg Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'eggs']))}>
        <Stack>
          <Group grow>
            <TextInput
              withAsterisk
              label='Author'
              placeholder='Author'
              key={form.key('author')}
              {...form.getInputProps('author')}
            />
            <TextInput
              withAsterisk
              label='Name'
              placeholder='Name'
              key={form.key('name')}
              {...form.getInputProps('name')}
            />
          </Group>

          <TextArea
            label='Description'
            placeholder='Description'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <Group grow>
            <Select
              label='Egg Repository'
              placeholder='Egg Repository'
              value={selectedEggRepositoryUuid}
              onChange={(value) => setSelectedEggRepositoryUuid(value ?? '')}
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
              label='Egg Repository Egg'
              placeholder='None'
              disabled={!selectedEggRepositoryUuid}
              data={eggRepositoryEggs.items.map((eggRepositoryEgg) => ({
                label: eggRepositoryEgg.name,
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

          <TitleCard title='Startup Configuration' icon={<FontAwesomeIcon icon={faPlay} size='sm' />}>
            <Group grow align='top'>
              <TagsInput
                withAsterisk
                label='Startup Done'
                placeholder='Startup Done'
                description='Console message indicating startup completion.'
                key={form.key('configStartup.done')}
                {...form.getInputProps('configStartup.done')}
              />

              <Switch
                label='Strip ANSI from startup messages'
                description='Removes ANSI control characters from the console output before matching startup completion.'
                key={form.key('configStartup.stripAnsi')}
                {...form.getInputProps('configStartup.stripAnsi', {
                  type: 'checkbox',
                })}
              />
            </Group>
          </TitleCard>

          <TitleCard title='Stop Configuration' icon={<FontAwesomeIcon icon={faStop} size='sm' />}>
            <Group grow>
              <Select
                withAsterisk
                label='Stop Type'
                placeholder='Stop Type'
                data={[
                  { label: 'Send Command', value: 'command' },
                  { label: 'Send Signal', value: 'signal' },
                  { label: 'Docker Stop', value: 'docker' },
                ]}
                key={form.key('configStop.type')}
                {...form.getInputProps('configStop.type')}
              />
              {form.getValues().configStop.type === 'command' ? (
                <TextInput
                  withAsterisk
                  label='Stop Command'
                  placeholder='Stop Command'
                  key={form.key('configStop.value')}
                  {...form.getInputProps('configStop.value')}
                />
              ) : form.getValues().configStop.type === 'signal' ? (
                <Select
                  withAsterisk
                  label='Stop Signal'
                  placeholder='Stop Signal'
                  data={[
                    { label: 'SIGABRT', value: 'SIGABRT' },
                    { label: 'SIGINT (^C)', value: 'SIGINT' },
                    { label: 'SIGTERM', value: 'SIGTERM' },
                    { label: 'SIGQUIT', value: 'SIGQUIT' },
                    { label: 'SIGKILL', value: 'SIGKILL' },
                  ]}
                  key={form.key('configStop.value')}
                  {...form.getInputProps('configStop.value')}
                  value={form.getValues().configStop.value || 'SIGKILL'}
                />
              ) : null}
            </Group>
          </TitleCard>

          <TitleCard title='Config Files Configuration' icon={<FontAwesomeIcon icon={faFileText} size='sm' />}>
            {form.getValues().configFiles.length === 0 ? (
              <p className='mb-2'>No config files defined.</p>
            ) : (
              form.getValues().configFiles.map((_, index) => (
                <Card key={index} className='flex flex-row! justify-between mb-2'>
                  <Stack w='100%'>
                    <Group grow>
                      <TextInput
                        withAsterisk
                        label='File Path'
                        placeholder='File Path'
                        key={form.key(`configFiles.${index}.file`)}
                        {...form.getInputProps(`configFiles.${index}.file`)}
                      />
                      <Select
                        withAsterisk
                        label='Parser'
                        placeholder='Parser'
                        data={Object.entries(processConfigurationParserLabelMapping).map(([value, label]) => ({
                          label,
                          value,
                        }))}
                        key={form.key(`configFiles.${index}.parser`)}
                        {...form.getInputProps(`configFiles.${index}.parser`)}
                      />
                    </Group>

                    <Switch
                      label='Create New File'
                      description='If enabled, the file will be created if it does not exist. If disabled, the file must already exist or the replacement will fail.'
                      key={form.key(`configFiles.${index}.createNew`)}
                      {...form.getInputProps(`configFiles.${index}.createNew`, {
                        type: 'checkbox',
                      })}
                    />

                    <div className='flex flex-col'>
                      {form.getValues().configFiles[index].replace.length === 0 ? (
                        <p className='mb-2'>No replacements defined.</p>
                      ) : (
                        form.getValues().configFiles[index].replace.map((_, replaceIndex) => (
                          <Card key={replaceIndex} className='flex flex-row! mb-2'>
                            <div className='flex flex-col w-full'>
                              <Group grow w='100%'>
                                <TextInput
                                  withAsterisk
                                  label='Match'
                                  placeholder='Match'
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.match`)}
                                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.match`)}
                                />
                                <TextInput
                                  label='If Value'
                                  placeholder='If Value'
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.ifValue`)}
                                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.ifValue`)}
                                />
                                <TextInput
                                  withAsterisk
                                  label='Replace With'
                                  placeholder='Replace With'
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.replaceWith`)}
                                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.replaceWith`)}
                                />
                              </Group>
                              <Group grow mt='md'>
                                <Switch
                                  label='Insert New'
                                  description='If enabled, if no existing value matches the "Match" field, the "Replace With" value will be inserted into the file. If disabled, if no match is found, no changes will be made to the file.'
                                  key={form.key(`configFiles.${index}.replace.${replaceIndex}.insertNew`)}
                                  {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.insertNew`, {
                                    type: 'checkbox',
                                  })}
                                />
                                <Switch
                                  label='Update Existing'
                                  description='If enabled, if a match is found, it will be replaced with the "Replace With" value. If disabled, the replacement will only insert new values and will fail if a match is found.'
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
                        Add Replacement
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
              Add Config File
            </Button>
          </TitleCard>

          <TextInput
            withAsterisk
            label='Startup'
            placeholder='Startup'
            key={form.key('startup')}
            {...form.getInputProps('startup')}
          />

          <Group grow>
            <Switch
              label='Force Outgoing IP'
              key={form.key('forceOutgoingIp')}
              {...form.getInputProps('forceOutgoingIp', { type: 'checkbox' })}
            />
            <Switch
              label='Separate IP and Port'
              description='Separates the primary IP and Port in the Console page instead of joining them with ":"'
              key={form.key('separatePort')}
              {...form.getInputProps('separatePort', { type: 'checkbox' })}
            />
          </Group>

          <Group grow align='top'>
            <TagsInput
              label='Features'
              placeholder='Feature'
              key={form.key('features')}
              {...form.getInputProps('features')}
            />
            <TagsInput
              label='File Deny List'
              placeholder='File Deny List'
              key={form.key('fileDenylist')}
              {...form.getInputProps('fileDenylist')}
            />
          </Group>

          <MultiKeyValueInput
            label='Docker Images'
            withAsterisk
            options={form.getValues().dockerImages}
            onChange={(e) => form.setFieldValue('dockerImages', e)}
          />
        </Stack>

        <Group mt='md'>
          <AdminCan action={contextEgg ? 'eggs.update' : 'eggs.create'} cantSave>
            <Button type='submit' disabled={!isValid} loading={loading}>
              Save
            </Button>
            {contextEgg && (
              <>
                <ContextMenuProvider menuProps={{ position: 'top', offset: 40 }}>
                  <ContextMenu
                    items={[
                      {
                        icon: faUpload,
                        label: 'from File',
                        onClick: () => fileInputRef.current?.click(),
                        color: 'gray',
                      },
                      {
                        icon: faRefresh,
                        label: 'from Repository',
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
                        Update
                      </Button>
                    )}
                  </ContextMenu>
                </ContextMenuProvider>
                <ContextMenuProvider menuProps={{ position: 'top', offset: 40 }}>
                  <ContextMenu
                    items={[
                      {
                        icon: faFileDownload,
                        label: 'as JSON',
                        onClick: () => doExport('json'),
                        color: 'gray',
                      },
                      {
                        icon: faFileDownload,
                        label: 'as YAML',
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
                        Export
                      </Button>
                    )}
                  </ContextMenu>
                </ContextMenuProvider>

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
              Move
            </Button>
          )}
          {contextEgg && (
            <AdminCan action='eggs.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                Delete
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
