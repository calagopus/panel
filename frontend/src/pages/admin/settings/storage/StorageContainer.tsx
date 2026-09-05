import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateStorageSettings from '@/api/admin/settings/updateStorageSettings.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { mappingToSelectData, storageDriverTypeLabelMapping } from '@/lib/enums.ts';
import { adminSettingsStorageSchema } from '@/lib/schemas/admin/settings.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import DiscriminatedSettingsForm from '../DiscriminatedSettingsForm.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import { storageEmptyFormValues, storageToFormValues, useStorageDriverVariants } from './storageFormValues.tsx';

type StorageValues = z.infer<typeof adminSettingsStorageSchema>;

export default function StorageContainer() {
  const { t } = useTranslations();
  const storageDriver = useAdminStore((state) => state.storageDriver);

  const form = useForm<StorageValues>({
    initialValues: storageEmptyFormValues,
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsStorageSchema),
  });

  useHydrateForm(form, storageDriver, storageToFormValues);

  const { loading, submit, confirmOpened, closeConfirm, confirmSave } = useSettingsSection({
    form,
    schema: adminSettingsStorageSchema,
    storeKey: 'storageDriver',
    update: updateStorageSettings,
    successMessage: t('pages.admin.settings.tabs.storage.page.toast.updated', {}),
    confirmBeforeSave: (values) => values.type !== storageDriver.type,
  });

  const variants = useStorageDriverVariants();

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.storage.page.title', {})} titleOrder={2}>
      <ConfirmationModal
        opened={confirmOpened}
        onClose={closeConfirm}
        title={t('pages.admin.settings.tabs.storage.page.modal.changeStorageType.title', {})}
        confirm={t('common.button.update', {})}
        onConfirmed={confirmSave}
      >
        {t('pages.admin.settings.tabs.storage.page.modal.changeStorageType.content', {})}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(submit)}>
        <Select
          label={t('pages.admin.settings.tabs.storage.page.form.driver', {})}
          data={mappingToSelectData(storageDriverTypeLabelMapping)}
          key={form.key('type')}
          {...form.getInputProps('type')}
        />

        <DiscriminatedSettingsForm form={form} discriminant='type' variants={variants} />

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
