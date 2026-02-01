import {
  faChevronDown,
  faFileDownload,
  faFileText,
  faMinus,
  faNetworkWired,
  faPlay,
  faPlus,
  faRefresh,
  faStop,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ActionIcon, Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import jsYaml from 'js-yaml';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { NIL as uuidNil } from 'uuid';
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
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { processConfigurationParserLabelMapping } from '@/lib/enums.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import EggMoveModal from './modals/EggMoveModal.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';

export default function EggCreateOrUpdate({
  contextNest,
  contextEgg,
}: {
  contextNest: AdminNest;
  contextEgg?: AdminNestEgg;
}) {
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'move' | 'delete' | null>(null);
  const [selectedEggRepositoryUuid, setSelectedEggRepositoryUuid] = useState<string>(
    contextEgg?.eggRepositoryEgg?.eggRepository.uuid ?? '',
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<z.infer<typeof adminEggSchema>>({
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
      configAllocations: {
        userSelfAssign: {
          enabled: false,
          requirePrimaryAllocation: false,
          startPort: 0,
          endPort: 0,
        },
      },
      startup: '',
      forceOutgoingIp: false,
      separatePort: false,
      features: [],
      dockerImages: {},
      fileDenylist: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminEggSchema),
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminEggSchema>,
    AdminNestEgg
  >({
    form,
    createFn: () =>
      createEgg(contextNest.uuid, {
        ...form.values,
        configScript: {
          container: 'ghcr.io/ptero-eggs/installers:debian',
          entrypoint: 'bash',
          content: '#!/bin/bash\n\n# Install script content goes here\n',
        },
      }),
    updateFn: () => updateEgg(contextNest.uuid, contextEgg!.uuid, form.values),
    deleteFn: () => deleteEgg(contextNest.uuid, contextEgg!.uuid),
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
        configAllocations: contextEgg.configAllocations,
        startup: contextEgg.startup,
        forceOutgoingIp: contextEgg.forceOutgoingIp,
        separatePort: contextEgg.separatePort,
        features: contextEgg.features,
        dockerImages: contextEgg.dockerImages,
        fileDenylist: contextEgg.fileDenylist,
      });
    }
  }, [contextEgg]);

  const eggRepositories = useSearchableResource<AdminEggRepository>({
    fetcher: (search) => getEggRepositories(1, search),
    defaultSearchValue: contextEgg?.eggRepositoryEgg?.eggRepository.name,
  });
  const eggRepositoryEggs = useSearchableResource<AdminEggRepositoryEgg>({
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
          const yamlData = jsYaml.dump(data, { flowLevel: -1, forceQuotes: true });
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

    const text = await file.text().then((t) => t.trim());
    let data: object;
    try {
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
    <AdminContentContainer title={`${contextEgg ? 'Update' : 'Create'} Egg`} hideTitleComponent>
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
        Are you sure you want to delete <Code>{form.values.name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false))}>
        <Stack>
          <Group grow>
            <TextInput withAsterisk label='Author' placeholder='Author' {...form.getInputProps('author')} />
            <TextInput withAsterisk label='Name' placeholder='Name' {...form.getInputProps('name')} />
          </Group>

          <TextArea label='Description' placeholder='Description' rows={3} {...form.getInputProps('description')} />

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
            />
            <Select
              label='Egg Repository Egg'
              placeholder='Egg Repository Egg'
              disabled={!selectedEggRepositoryUuid}
              data={eggRepositoryEggs.items.map((eggRepositoryEgg) => ({
                label: eggRepositoryEgg.name,
                value: eggRepositoryEgg.uuid,
              }))}
              searchable
              clearable
              searchValue={eggRepositoryEggs.search}
              onSearchChange={eggRepositoryEggs.setSearch}
              value={form.values.eggRepositoryEggUuid}
              onChange={(value) => form.setFieldValue('eggRepositoryEggUuid', value || uuidNil)}
            />
          </Group>

          <TitleCard title='Startup Configuration' icon={<FontAwesomeIcon icon={faPlay} size='sm' />}>
            <Group grow>
              <TagsInput
                withAsterisk
                label='Startup Done'
                placeholder='Startup Done'
                description='Console message indicating startup completion.'
                {...form.getInputProps('configStartup.done')}
              />

              <Switch
                label='Strip ANSI from startup messages'
                description='Removes ANSI control characters from the console output before matching startup completion.'
                {...form.getInputProps('configStartup.stripAnsi', { type: 'checkbox' })}
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
                {...form.getInputProps('configStop.type')}
              />
              {form.values.configStop.type === 'command' ? (
                <TextInput
                  withAsterisk
                  label='Stop Command'
                  placeholder='Stop Command'
                  {...form.getInputProps('configStop.value')}
                />
              ) : form.values.configStop.type === 'signal' ? (
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
                  {...form.getInputProps('configStop.value')}
                  value={form.values.configStop.value || 'SIGKILL'}
                />
              ) : null}
            </Group>
          </TitleCard>

          <TitleCard title='Allocation Configuration' icon={<FontAwesomeIcon icon={faNetworkWired} size='sm' />}>
            <Stack>
              <Group grow>
                <Switch
                  label='User Self Assign'
                  description='Allow users to create their own allocations from a specified port range.'
                  {...form.getInputProps('configAllocations.userSelfAssign.enabled', { type: 'checkbox' })}
                />

                <Switch
                  label='Require Primary Allocation'
                  description='Whether users must always have a primary allocation.'
                  {...form.getInputProps('configAllocations.userSelfAssign.requirePrimaryAllocation', {
                    type: 'checkbox',
                  })}
                />
              </Group>

              <Group grow>
                <NumberInput
                  label='Automatic Allocation Start'
                  placeholder='Automatic Allocation Start'
                  {...form.getInputProps('configAllocations.userSelfAssign.startPort')}
                />
                <NumberInput
                  label='Automatic Allocation End'
                  placeholder='Automatic Allocation End'
                  {...form.getInputProps('configAllocations.userSelfAssign.endPort')}
                />
              </Group>
            </Stack>
          </TitleCard>

          <TitleCard title='Config Files Configuration' icon={<FontAwesomeIcon icon={faFileText} size='sm' />}>
            {form.values.configFiles.length === 0 ? (
              <p className='mb-2'>No config files defined.</p>
            ) : (
              form.values.configFiles.map((_, index) => (
                <Card key={index} className='flex flex-row! justify-between mb-2'>
                  <Stack w='100%'>
                    <Group grow>
                      <TextInput
                        withAsterisk
                        label='File Path'
                        placeholder='File Path'
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
                        {...form.getInputProps(`configFiles.${index}.parser`)}
                      />
                    </Group>

                    <div className='flex flex-col'>
                      {form.values.configFiles[index].replace.length === 0 ? (
                        <p className='mb-2'>No replacements defined.</p>
                      ) : (
                        form.values.configFiles[index].replace.map((_, replaceIndex) => (
                          <Card key={replaceIndex} className='flex flex-row! mb-2'>
                            <Group grow w='100%'>
                              <TextInput
                                withAsterisk
                                label='Match'
                                placeholder='Match'
                                {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.match`)}
                              />
                              <TextInput
                                label='If Value'
                                placeholder='If Value'
                                {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.ifValue`)}
                                onChange={(e) =>
                                  form.setFieldValue(
                                    `configFiles.${index}.replace.${replaceIndex}.ifValue`,
                                    e.currentTarget.value || null,
                                  )
                                }
                              />
                              <TextInput
                                withAsterisk
                                label='Replace With'
                                placeholder='Replace With'
                                {...form.getInputProps(`configFiles.${index}.replace.${replaceIndex}.replaceWith`)}
                              />
                            </Group>

                            <ActionIcon
                              color='red'
                              variant='light'
                              size='input-md'
                              className='ml-4'
                              onClick={() =>
                                form.setValues({
                                  ...form.values,
                                  configFiles: form.values.configFiles.map((configFile, i) => {
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
                            ...form.values,
                            configFiles: form.values.configFiles.map((configFile, i) => {
                              if (i !== index) return configFile;
                              return {
                                ...configFile,
                                replace: [
                                  ...configFile.replace,
                                  {
                                    match: '',
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
                        ...form.values,
                        configFiles: form.values.configFiles.filter((_, i) => i !== index),
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
                  ...form.values,
                  configFiles: [
                    ...form.values.configFiles,
                    {
                      file: '',
                      parser: 'file',
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

          <TextInput withAsterisk label='Startup' placeholder='Startup' {...form.getInputProps('startup')} />

          <Group grow>
            <Switch label='Force Outgoing IP' {...form.getInputProps('forceOutgoingIp', { type: 'checkbox' })} />
            <Switch
              label='Separate IP and Port'
              description='Separates the primary IP and Port in the Console page instead of joining them with ":"'
              {...form.getInputProps('separatePort', { type: 'checkbox' })}
            />
          </Group>

          <Group grow>
            <TagsInput label='Features' placeholder='Feature' {...form.getInputProps('features')} />
            <TagsInput label='File Deny List' placeholder='File Deny List' {...form.getInputProps('fileDenylist')} />
          </Group>

          <MultiKeyValueInput
            label='Docker Images'
            withAsterisk
            options={form.values.dockerImages}
            onChange={(e) => form.setFieldValue('dockerImages', e)}
          />
        </Stack>

        <Group mt='md'>
          <AdminCan action={contextEgg ? 'eggs.update' : 'eggs.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
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
