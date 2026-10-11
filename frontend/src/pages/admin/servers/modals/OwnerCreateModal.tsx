import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import getRoles from '@/api/admin/roles/getRoles.ts';
import createUser from '@/api/admin/users/createUser.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { FormEngine } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminFullUserSchema, adminUserUpdateSchema } from '@/lib/schemas/admin/users.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { userEmptyFormValues, useUserFormFields } from '@/pages/admin/users/userFormValues.tsx';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type UserFormValues = z.infer<typeof adminUserUpdateSchema>;

interface OwnerCreateModalProps {
  opened: boolean;
  onClose: () => void;
  initialSearch: string;
  onCreated: (user: z.infer<typeof adminFullUserSchema>) => void;
}

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function OwnerCreateModal({ opened, onClose, initialSearch, onCreated }: OwnerCreateModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user } = useAuth();
  const settings = useGlobalStore((state) => state.settings);
  const languages = useGlobalStore((state) => state.languages);
  const queryClient = useQueryClient();
  const canReadRoles = useAdminCan('roles.read');
  const isRootAdmin = !!user?.admin;

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<UserFormValues>({
    formId: 'admin.users.createOrUpdate',
    schema: adminUserUpdateSchema.unwrap(),
    initialValues: { ...userEmptyFormValues, language: settings.app.language },
    opened,
    onClose,
    hydrate: () => {
      const term = initialSearch.trim();
      const base = { ...userEmptyFormValues, language: settings.app.language };
      if (!term) return base;
      return looksLikeEmail(term)
        ? { ...base, email: term, username: term.slice(0, term.indexOf('@')) }
        : { ...base, username: term };
    },
    onSubmit: async (values) => {
      const created = await createUser(adminUserUpdateSchema.parse(values));
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all() });
      addToast(
        t('elements.resource.tooltip.created', { resource: t('pages.admin.users.resourceName', {}) }),
        'success',
      );
      onCreated(created);
    },
  });

  const roles = useSearchableResource<z.infer<typeof roleSchema>>({
    queryKey: queryKeys.admin.roles.all(),
    fetcher: (search) => getRoles(1, search),
    canRequest: canReadRoles,
  });

  const fields = useUserFormFields({
    isRootAdmin,
    editingOtherUser: false,
    languages,
    roles,
    canReadRoles,
  });

  return (
    <FormModal
      opened={opened}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      title={t('pages.admin.users.tabs.general.page.titleCreate', {})}
      size='lg'
    >
      <Stack gap='md'>
        <FormEngine form={form} fields={fields} />

        <ModalFooter>
          <AdminCan action='users.create' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('pages.admin.users.tabs.general.page.titleCreate', {})}
            </Button>
          </AdminCan>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
