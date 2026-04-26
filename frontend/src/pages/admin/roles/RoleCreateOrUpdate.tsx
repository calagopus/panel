import { Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createRole from '@/api/admin/roles/createRole.ts';
import deleteRole from '@/api/admin/roles/deleteRole.ts';
import updateRole from '@/api/admin/roles/updateRole.ts';
import getPermissions from '@/api/getPermissions.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { adminRoleUpdateSchema } from '@/lib/schemas/admin/roles.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useGlobalStore } from '@/stores/global.ts';

export default function RoleCreateOrUpdate({ contextRole }: { contextRole?: z.infer<typeof roleSchema> }) {
  const { availablePermissions, setAvailablePermissions } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminRoleUpdateSchema>>({
    initialValues: {
      name: '',
      description: null,
      requireTwoFactor: false,
      adminPermissions: [],
      serverPermissions: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminRoleUpdateSchema),
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminRoleUpdateSchema>,
    z.infer<typeof roleSchema>
  >({
    form,
    createFn: () => createRole(adminRoleUpdateSchema.parse(form.getValues())),
    updateFn: contextRole
      ? () => updateRole(contextRole.uuid, adminRoleUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextRole ? () => deleteRole(contextRole.uuid) : undefined,
    doUpdate: !!contextRole,
    basePath: '/admin/roles',
    resourceName: 'Role',
  });

  useEffect(() => {
    if (contextRole) {
      form.setValues({
        name: contextRole.name,
        description: contextRole.description,
        adminPermissions: contextRole.adminPermissions,
        serverPermissions: contextRole.serverPermissions,
      });
    }
  }, [contextRole]);

  useEffect(() => {
    setLoading(true);

    getPermissions().then((res) => {
      setAvailablePermissions(res);
      setLoading(false);
    });
  }, []);

  return (
    <AdminContentContainer
      title={`${contextRole ? 'Update' : 'Create'} Role`}
      fullscreen={!!contextRole}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Role Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'roles']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />

          <TextArea
            label='Description'
            placeholder='Description'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <Switch
            label='Require Two Factor'
            description='Require users with this role to use two factor authentication.'
            key={form.key('requireTwoFactor')}
            {...form.getInputProps('requireTwoFactor', { type: 'checkbox' })}
          />

          {availablePermissions?.serverPermissions && (
            <PermissionSelector
              label='Server Permissions'
              className='col-span-full'
              permissionsMapType='serverPermissions'
              permissions={availablePermissions.serverPermissions}
              selectedPermissions={form.getValues().serverPermissions}
              setSelectedPermissions={(permissions) => form.setFieldValue('serverPermissions', permissions)}
            />
          )}
          {availablePermissions?.adminPermissions && (
            <PermissionSelector
              label='Admin Permissions'
              className='col-span-full'
              permissionsMapType='adminPermissions'
              permissions={availablePermissions.adminPermissions}
              selectedPermissions={form.getValues().adminPermissions}
              setSelectedPermissions={(permissions) => form.setFieldValue('adminPermissions', permissions)}
            />
          )}
        </div>

        <Group mt='md'>
          <AdminCan action={contextRole ? 'roles.update' : 'roles.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
            {!contextRole && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                Save & Stay
              </Button>
            )}
          </AdminCan>
          {contextRole && (
            <AdminCan action='roles.delete' cantDelete>
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
