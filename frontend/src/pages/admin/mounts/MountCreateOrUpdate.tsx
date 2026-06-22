import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createMount from '@/api/admin/mounts/createMount.ts';
import deleteMount from '@/api/admin/mounts/deleteMount.ts';
import updateMount from '@/api/admin/mounts/updateMount.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema, adminMountUpdateSchema } from '@/lib/schemas/admin/mounts.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type MountFormValues = z.infer<typeof adminMountUpdateSchema>;

export default function MountCreateOrUpdate({ contextMount }: { contextMount?: z.infer<typeof adminMountSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<MountFormValues>('admin.mounts.createOrUpdate');
  const mergedSchema = adminMountUpdateSchema.unwrap().extend(zodShape);

  const form = useForm<MountFormValues>({
    initialValues: {
      name: '',
      description: null,
      source: '',
      target: '',
      readOnly: false,
      userMountable: false,
      ...(extInitialValues as Partial<MountFormValues>),
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<MountFormValues, z.infer<typeof adminMountSchema>>({
    form,
    createFn: () => createMount(adminMountUpdateSchema.parse(form.getValues())),
    updateFn: contextMount
      ? () => updateMount(contextMount.uuid, adminMountUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextMount ? () => deleteMount(contextMount.uuid) : undefined,
    doUpdate: !!contextMount,
    basePath: '/admin/mounts',
    resourceName: t('pages.admin.mounts.resourceName', {}),
  });

  useEffect(() => {
    if (contextMount) {
      form.setValues({
        name: contextMount.name,
        description: contextMount.description,
        source: contextMount.source,
        target: contextMount.target,
        readOnly: contextMount.readOnly,
        userMountable: contextMount.userMountable,
      });
    }
  }, [contextMount]);

  const fields: FieldDef<MountFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
    { type: 'text', name: 'source', label: t('pages.admin.mounts.tabs.general.page.form.source', {}), required: true },
    { type: 'text', name: 'target', label: t('pages.admin.mounts.tabs.general.page.form.target', {}), required: true },
    { type: 'switch', name: 'readOnly', label: t('pages.admin.mounts.tabs.general.page.form.readOnly', {}) },
    { type: 'switch', name: 'userMountable', label: t('pages.admin.mounts.tabs.general.page.form.userMountable', {}) },
  ];

  return (
    <AdminContentContainer
      title={t(
        contextMount
          ? 'pages.admin.mounts.tabs.general.page.titleUpdate'
          : 'pages.admin.mounts.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextMount}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.mounts.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.mounts.tabs.general.page.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
        {t('pages.admin.mounts.tabs.general.page.alert', {})}
      </Alert>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.mounts.all()))}>
        <FormEngine form={form} fields={fields} extensions={[formExtension]} />

        <Group mt='md'>
          <AdminCan action={contextMount ? 'mounts.update' : 'mounts.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextMount && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextMount && (
            <AdminCan action='mounts.delete' cantDelete>
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
