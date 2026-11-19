import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import createDevice from '@/api/admin/devices/createDevice.ts';
import deleteDevice from '@/api/admin/devices/deleteDevice.ts';
import updateDevice from '@/api/admin/devices/updateDevice.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDeviceSchema, adminDeviceUpdateSchema } from '@/lib/schemas/admin/devices.ts';
import DeviceDuplicateModal from '@/pages/admin/devices/modals/DeviceDuplicateModal.tsx';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  type DeviceFormValues,
  deviceEmptyFormValues,
  deviceToFormValues,
  useDeviceFormFields,
} from './deviceFormValues.tsx';

export default function DeviceCreateOrUpdate({ contextDevice }: { contextDevice?: z.infer<typeof adminDeviceSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const form = useFormEngine<DeviceFormValues>('admin.devices.createOrUpdate', {
    schema: adminDeviceUpdateSchema.unwrap(),
    initialValues: deviceEmptyFormValues,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<DeviceFormValues, z.infer<typeof adminDeviceSchema>>({
    form,
    createFn: () => createDevice(adminDeviceUpdateSchema.parse(form.getValues())),
    updateFn: contextDevice
      ? () => updateDevice(contextDevice.uuid, adminDeviceUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextDevice ? () => deleteDevice(contextDevice.uuid) : undefined,
    doUpdate: !!contextDevice,
    basePath: '/admin/devices',
    resourceName: t('pages.admin.devices.resourceName', {}),
  });

  useHydrateForm(form, contextDevice, deviceToFormValues, { key: (device) => device.uuid });

  const fields = useDeviceFormFields();

  return (
    <AdminContentContainer
      title={t(
        contextDevice
          ? 'pages.admin.devices.tabs.general.page.titleUpdate'
          : 'pages.admin.devices.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextDevice}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.devices.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('common.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      {contextDevice && (
        <DeviceDuplicateModal
          device={contextDevice}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <Alert color='yellow' icon={faExclamationTriangle} mb='md'>
        {t('pages.admin.devices.tabs.general.page.alert', {})}
      </Alert>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.devices.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan action={contextDevice ? 'devices.update' : 'devices.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextDevice && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextDevice && (
            <AdminCan action='devices.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextDevice && (
            <AdminCan action='devices.delete' cantDelete>
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
