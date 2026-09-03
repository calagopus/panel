import { faPlay } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { dump } from 'js-yaml';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { ChangeEvent, useState } from 'react';
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
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { toPterodactylEgg } from '@/lib/domain/pterodactylEgg.ts';
import { downloadTextFile } from '@/lib/download/download.ts';
import { parseStructuredDocument } from '@/lib/parseStructuredDocument.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositoryEggSchema, adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminEggSchema, adminEggUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { EggExportMenu, EggUpdateFromMenu } from './EggActionsMenu.tsx';
import EggConfigFilesEditor from './EggConfigFilesEditor.tsx';
import EggStopConfigEditor from './EggStopConfigEditor.tsx';
import { DEFAULT_EGG_CONFIG_SCRIPT, eggEmptyFormValues, eggToFormValues } from './eggFormValues.ts';
import EggDuplicateModal from './modals/EggDuplicateModal.tsx';
import EggMoveModal from './modals/EggMoveModal.tsx';
import EggUpdateUrlModal from './modals/EggUpdateUrlModal.tsx';

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
  const [openModal, setOpenModal] = useState<'move' | 'delete' | 'duplicate' | 'updateUrl' | null>(null);
  const [selectedEggRepositoryUuid, setSelectedEggRepositoryUuid] = useState<string>(
    contextEgg?.eggRepositoryEgg?.eggRepository.uuid ?? '',
  );

  const form = useForm<z.infer<typeof adminEggUpdateSchema>>({
    mode: 'uncontrolled',
    initialValues: eggEmptyFormValues,
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
        configScript: DEFAULT_EGG_CONFIG_SCRIPT,
      }),
    updateFn: contextEgg
      ? () => updateEgg(contextNest.uuid, contextEgg.uuid, adminEggUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextEgg ? () => deleteEgg(contextNest.uuid, contextEgg.uuid) : undefined,
    doUpdate: !!contextEgg,
    basePath: `/admin/nests/${contextNest.uuid}/eggs`,
    resourceName: t('pages.admin.nests.tabs.eggs.page.resourceName', {}),
  });

  useHydrateForm(form, contextEgg, eggToFormValues);

  const eggRepositories = useSearchableResource<z.infer<typeof adminEggRepositorySchema>>({
    queryKey: queryKeys.admin.eggRepositories.all(),
    fetcher: (search) => getEggRepositories(1, search),
    defaultSearchValue: contextEgg?.eggRepositoryEgg?.eggRepository.name,
  });
  const eggRepositoryEggs = useSearchableResource<z.infer<typeof adminEggRepositoryEggSchema>>({
    queryKey: selectedEggRepositoryUuid
      ? queryKeys.admin.eggRepositories.eggs(selectedEggRepositoryUuid)
      : queryKeys.admin.eggRepositories.eggsUnscoped(),
    fetcher: (search) =>
      selectedEggRepositoryUuid
        ? getEggRepositoryEggs(selectedEggRepositoryUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    defaultSearchValue: contextEgg?.eggRepositoryEgg?.exportedEgg.name,
    deps: [selectedEggRepositoryUuid],
  });

  const doExport = (format: 'calagopus' | 'pterodactyl', fileType: 'json' | 'yaml') => {
    if (!contextEgg) return;

    setLoading(true);

    exportEgg(contextNest.uuid, contextEgg.uuid)
      .then((exported) => {
        const data = format === 'pterodactyl' ? toPterodactylEgg(exported) : exported;

        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.general.page.toast.exported', {}), 'success');

        if (fileType === 'json') {
          downloadTextFile(JSON.stringify(data, undefined, 2), `egg-${contextEgg!.uuid}.json`);
        } else {
          downloadTextFile(dump(data, { flowLevel: -1, forceQuotes: true }), `egg-${contextEgg!.uuid}.yml`);
        }
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const applyEggUpdate = () => {
    if (!contextEgg) return;

    getEgg(contextNest.uuid, contextEgg.uuid)
      .then((egg) => {
        form.setValues(eggToFormValues(egg));
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.general.page.toast.updated', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doRepositoryUpdate = () => {
    if (!contextEgg) return;

    setLoading(true);

    updateEggUsingRepository(contextNest.uuid, contextEgg!.uuid)
      .then(applyEggUpdate)
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
      data = parseStructuredDocument(await file.text()) as object;
    } catch (err) {
      addToast(t('pages.admin.nests.tabs.eggs.page.toast.parseFailed', { error: String(err) }), 'error');
      setLoading(false);
      return;
    }

    updateEggUsingImport(contextNest.uuid, contextEgg!.uuid, data)
      .then(applyEggUpdate)
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
          eggs={[contextEgg]}
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
      {contextEgg && (
        <EggUpdateUrlModal
          opened={openModal === 'updateUrl'}
          onClose={() => setOpenModal(null)}
          nest={contextNest}
          egg={contextEgg}
          onUpdated={applyEggUpdate}
        />
      )}
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nests.tabs.eggs.page.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('common.modal.delete.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      <form
        onSubmit={form.onSubmit(() =>
          doCreateOrUpdate(false, queryKeys.admin.nests.eggs(contextNest.uuid), queryKeys.admin.eggs.all()),
        )}
      >
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

          <EggStopConfigEditor form={form} />

          <EggConfigFilesEditor form={form} />

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
              <EggUpdateFromMenu
                hasEggRepositoryEgg={!!contextEgg.eggRepositoryEgg}
                loading={loading}
                onFromUrl={() => setOpenModal('updateUrl')}
                onFromRepository={doRepositoryUpdate}
                onFileUpload={handleFileUpload}
              />
            )}
          </AdminCan>
          {contextEgg && <EggExportMenu loading={loading} onExport={doExport} />}
          {contextEgg && (
            <AdminCan action='eggs.update'>
              <Button variant='outline' onClick={() => setOpenModal('move')} loading={loading}>
                {t('common.button.move', {})}
              </Button>
            </AdminCan>
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
