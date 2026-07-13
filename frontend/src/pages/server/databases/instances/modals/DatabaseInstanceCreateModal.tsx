import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useMemo } from 'react';
import { z } from 'zod';
import createDatabaseInstance from '@/api/server/databases/instances/createDatabaseInstance.ts';
import getDatabaseInstanceTemplates from '@/api/server/databases/instances/getDatabaseInstanceTemplates.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceCreateSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type GroupedTemplates = Record<string, { group: string; items: { value: string; label: string }[] }>;

export default function DatabaseInstanceCreateModal(props: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const { data: templates = [] } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.templates(),
    queryFn: () => getDatabaseInstanceTemplates(server.uuid),
    enabled: props.opened,
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverDatabaseInstanceCreateSchema>
  >({
    initialValues: { name: '', templateUuid: '', image: '' },
    validate: zod4Resolver(serverDatabaseInstanceCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createDatabaseInstance(server.uuid, values);
      addToast(t('pages.server.databases.instance.modal.createDatabaseInstance.toast.created', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).databases.instances.all() });
    },
  });

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.uuid === form.getValues().templateUuid),
    [templates, form.getValues().templateUuid],
  );
  const imageEntries = Object.entries(selectedTemplate?.dockerImages ?? {});

  form.watch('templateUuid', ({ value }) => {
    const template = templates.find((tpl) => tpl.uuid === value);
    form.setFieldValue('image', Object.keys(template?.dockerImages ?? {})[0] ?? '');
  });

  return (
    <FormModal
      title={t('pages.server.databases.instance.modal.createDatabaseInstance.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('pages.server.databases.form.databaseName', {})}
          {...form.getInputProps('name')}
        />

        <Select
          withAsterisk
          label={t('pages.server.databases.instance.modal.createDatabaseInstance.form.template', {})}
          searchable
          nothingFoundMessage={t(
            'pages.server.databases.instance.modal.createDatabaseInstance.form.noTemplatesFound',
            {},
          )}
          data={Object.values(
            templates.reduce(
              (acc, { uuid, name, type }) => (
                (acc[type] ??= { group: databaseAgentTypeLabelMapping[type], items: [] }).items.push({
                  value: uuid,
                  label: name,
                }),
                acc
              ),
              {} as GroupedTemplates,
            ),
          )}
          {...form.getInputProps('templateUuid')}
        />

        {imageEntries.length > 1 && (
          <Select
            withAsterisk
            label={t('pages.server.databases.instance.modal.createDatabaseInstance.form.image', {})}
            data={imageEntries.map(([label]) => ({ value: label, label }))}
            {...form.getInputProps('image')}
          />
        )}

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
