import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createBackupConfiguration from '@/api/admin/backup-configurations/createBackupConfiguration.ts';
import deleteBackupConfiguration from '@/api/admin/backup-configurations/deleteBackupConfiguration.ts';
import updateBackupConfiguration from '@/api/admin/backup-configurations/updateBackupConfiguration.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { backupDiskLabelMapping } from '@/lib/enums.ts';
import {
  adminBackupConfigurationResticSchema,
  adminBackupConfigurationS3Schema,
  adminBackupConfigurationSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';
import BackupRestic from '@/pages/admin/backupConfigurations/forms/BackupRestic.tsx';
import BackupS3 from '@/pages/admin/backupConfigurations/forms/BackupS3.tsx';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer';

export default function BackupConfigurationCreateOrUpdate({
  contextBackupConfiguration,
}: {
  contextBackupConfiguration?: BackupConfiguration;
}) {
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminBackupConfigurationSchema>>({
    initialValues: {
      name: '',
      description: null,
      backupDisk: 'local',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationSchema),
  });

  const backupConfigS3Form = useForm<z.infer<typeof adminBackupConfigurationS3Schema>>({
    initialValues: {
      accessKey: '',
      secretKey: '',
      bucket: '',
      region: '',
      endpoint: '',
      pathStyle: true,
      partSize: 1024 * 1024 * 1024,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationS3Schema),
  });

  const backupConfigResticForm = useForm<z.infer<typeof adminBackupConfigurationResticSchema>>({
    initialValues: {
      repository: '',
      retryLockSeconds: 0,
      environment: {},
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationResticSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminBackupConfigurationSchema>,
    BackupConfiguration
  >({
    form,
    createFn: () =>
      createBackupConfiguration({
        ...form.values,
        backupConfigs: { s3: backupConfigS3Form.values, restic: backupConfigResticForm.values },
      }),
    updateFn: () =>
      updateBackupConfiguration(contextBackupConfiguration!.uuid, {
        ...form.values,
        backupConfigs: { s3: backupConfigS3Form.values, restic: backupConfigResticForm.values },
      }),
    deleteFn: () => deleteBackupConfiguration(contextBackupConfiguration!.uuid),
    doUpdate: !!contextBackupConfiguration,
    basePath: '/admin/backup-configurations',
    resourceName: 'Backup configuration',
  });

  useEffect(() => {
    if (contextBackupConfiguration) {
      form.setValues({
        name: contextBackupConfiguration.name,
        description: contextBackupConfiguration.description,
        backupDisk: contextBackupConfiguration.backupDisk,
      });
      backupConfigS3Form.setValues(contextBackupConfiguration.backupConfigs.s3);
      backupConfigResticForm.setValues(contextBackupConfiguration.backupConfigs.restic);
    }
  }, [contextBackupConfiguration]);

  return (
    <AdminContentContainer
      title={`${contextBackupConfiguration ? 'Update' : 'Create'} Backup Config`}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Backup Configuration Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.values.name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false))}>
        <Stack mt='xs'>
          <Group grow>
            <TextInput withAsterisk label='Name' placeholder='Name' {...form.getInputProps('name')} />
            <Select
              withAsterisk
              label='Backup Disk'
              placeholder='Backup Disk'
              data={Object.entries(backupDiskLabelMapping).map(([value, label]) => ({
                value,
                label,
              }))}
              {...form.getInputProps('backupDisk')}
            />
          </Group>
          <Group grow align='start'>
            <TextArea label='Description' placeholder='Description' rows={3} {...form.getInputProps('description')} />
          </Group>
          <Group>
            <AdminCan
              action={contextBackupConfiguration ? 'backup-configurations.update' : 'backup-configurations.create'}
              cantSave
            >
              <Button
                type='submit'
                disabled={
                  !form.isValid() ||
                  ((form.values.backupDisk === 's3' || backupConfigS3Form.isDirty()) &&
                    !backupConfigS3Form.isValid()) ||
                  ((form.values.backupDisk === 'restic' || backupConfigResticForm.isDirty()) &&
                    !backupConfigResticForm.isValid())
                }
                loading={loading}
              >
                Save
              </Button>
              {!contextBackupConfiguration && (
                <Button
                  onClick={() => doCreateOrUpdate(true)}
                  disabled={
                    !form.isValid() ||
                    ((form.values.backupDisk === 's3' || backupConfigS3Form.isDirty()) &&
                      !backupConfigS3Form.isValid()) ||
                    ((form.values.backupDisk === 'restic' || backupConfigResticForm.isDirty()) &&
                      !backupConfigResticForm.isValid())
                  }
                  loading={loading}
                >
                  Save & Stay
                </Button>
              )}
            </AdminCan>
            {contextBackupConfiguration && (
              <AdminCan action='backup-configurations.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  Delete
                </Button>
              </AdminCan>
            )}
          </Group>
          {(form.values.backupDisk === 's3' || backupConfigS3Form.isDirty()) && <BackupS3 form={backupConfigS3Form} />}
          {(form.values.backupDisk === 'restic' || backupConfigResticForm.isDirty()) && (
            <BackupRestic form={backupConfigResticForm} />
          )}
        </Stack>
      </form>
    </AdminContentContainer>
  );
}
