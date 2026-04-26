import { faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
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
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { backupDiskLabelMapping } from '@/lib/enums.ts';
import {
  adminBackupConfigurationResticSchema,
  adminBackupConfigurationS3Schema,
  adminBackupConfigurationSchema,
  adminBackupConfigurationUpdateSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';
import BackupRestic from '@/pages/admin/backupConfigurations/forms/BackupRestic.tsx';
import BackupS3 from '@/pages/admin/backupConfigurations/forms/BackupS3.tsx';
import { useResourceForm } from '@/plugins/useResourceForm.ts';

export default function BackupConfigurationCreateOrUpdate({
  contextBackupConfiguration,
}: {
  contextBackupConfiguration?: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<Partial<z.infer<typeof adminBackupConfigurationUpdateSchema>>>({
    initialValues: {
      name: '',
      description: null,
      maintenanceEnabled: false,
      backupDisk: 'local',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminBackupConfigurationUpdateSchema),
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
    Partial<z.infer<typeof adminBackupConfigurationUpdateSchema>>,
    z.infer<typeof adminBackupConfigurationSchema>
  >({
    form,
    createFn: () =>
      createBackupConfiguration({
        ...adminBackupConfigurationUpdateSchema.parse(form.getValues()),
        backupConfigs: {
          s3: backupConfigS3Form.isDirty()
            ? adminBackupConfigurationS3Schema.parse(backupConfigS3Form.getValues())
            : null,
          restic: backupConfigResticForm.isDirty()
            ? adminBackupConfigurationResticSchema.parse(backupConfigResticForm.getValues())
            : null,
        },
      }),
    updateFn: contextBackupConfiguration
      ? () =>
          updateBackupConfiguration(contextBackupConfiguration.uuid, {
            ...adminBackupConfigurationUpdateSchema.parse(form.getValues()),
            backupConfigs: {
              s3: backupConfigS3Form.isDirty()
                ? adminBackupConfigurationS3Schema.parse(backupConfigS3Form.getValues())
                : null,
              restic: backupConfigResticForm.isDirty()
                ? adminBackupConfigurationResticSchema.parse(backupConfigResticForm.getValues())
                : null,
            },
          })
      : undefined,
    deleteFn: contextBackupConfiguration ? () => deleteBackupConfiguration(contextBackupConfiguration.uuid) : undefined,
    doUpdate: !!contextBackupConfiguration,
    basePath: '/admin/backup-configurations',
    resourceName: 'Backup configuration',
  });

  useEffect(() => {
    if (contextBackupConfiguration) {
      form.setValues({
        name: contextBackupConfiguration.name,
        description: contextBackupConfiguration.description,
        maintenanceEnabled: contextBackupConfiguration.maintenanceEnabled,
        backupDisk: contextBackupConfiguration.backupDisk,
      });
      if (contextBackupConfiguration.backupConfigs?.s3) {
        backupConfigS3Form.setValues(contextBackupConfiguration.backupConfigs.s3);
      }
      if (contextBackupConfiguration.backupConfigs?.restic) {
        backupConfigResticForm.setValues(contextBackupConfiguration.backupConfigs.restic);
      }
    }
  }, [contextBackupConfiguration]);

  return (
    <AdminContentContainer
      title={`${contextBackupConfiguration ? 'Update' : 'Create'} Backup Config`}
      fullscreen={!!contextBackupConfiguration}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Backup Configuration Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'backupConfigurations']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Select
            withAsterisk
            label='Backup Disk'
            placeholder='Backup Disk'
            data={Object.entries(backupDiskLabelMapping).map(([value, label]) => ({
              value,
              label,
            }))}
            key={form.key('backupDisk')}
            {...form.getInputProps('backupDisk')}
          />

          <TextArea
            label='Description'
            placeholder='Description'
            className='col-span-full'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <Switch
            label='Maintenance Enabled'
            key={form.key('maintenanceEnabled')}
            {...form.getInputProps('maintenanceEnabled', { type: 'checkbox' })}
          />
        </div>

        <Group mt='md'>
          <AdminCan
            action={contextBackupConfiguration ? 'backup-configurations.update' : 'backup-configurations.create'}
            cantSave
          >
            <Button
              type='submit'
              disabled={
                !form.isValid() ||
                ((form.getValues().backupDisk === 's3' || backupConfigS3Form.isDirty()) &&
                  !backupConfigS3Form.isValid()) ||
                ((form.getValues().backupDisk === 'restic' || backupConfigResticForm.isDirty()) &&
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
                  ((form.getValues().backupDisk === 's3' || backupConfigS3Form.isDirty()) &&
                    !backupConfigS3Form.isValid()) ||
                  ((form.getValues().backupDisk === 'restic' || backupConfigResticForm.isDirty()) &&
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
          <a
            href='https://calagopus.com/docs/advanced/setting-up-backup-configurations'
            target='_blank'
            rel='noopener noreferrer'
          >
            <Button variant='subtle' leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
              View Documentation
            </Button>
          </a>
        </Group>

        {(form.getValues().backupDisk === 's3' || backupConfigS3Form.isDirty() || backupConfigS3Form.isTouched()) && (
          <BackupS3 form={backupConfigS3Form} />
        )}
        {(form.getValues().backupDisk === 'restic' ||
          backupConfigResticForm.isDirty() ||
          backupConfigResticForm.isTouched()) && <BackupRestic form={backupConfigResticForm} />}
      </form>
    </AdminContentContainer>
  );
}
