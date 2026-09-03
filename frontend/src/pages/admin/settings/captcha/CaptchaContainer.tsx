import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateCaptchaSettings from '@/api/admin/settings/updateCaptchaSettings.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import { captchaProviderTypeLabelMapping, mappingToSelectData } from '@/lib/enums.ts';
import { adminSettingsCaptchaProviderSchema } from '@/lib/schemas/admin/settings.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import DiscriminatedSettingsForm from '../DiscriminatedSettingsForm.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import { captchaEmptyFormValues, captchaToFormValues, useCaptchaProviderVariants } from './captchaFormValues.tsx';

type CaptchaValues = z.infer<typeof adminSettingsCaptchaProviderSchema>;

export default function CaptchaContainer() {
  const { t } = useTranslations();
  const captchaProvider = useAdminStore((state) => state.captchaProvider);

  const form = useForm<CaptchaValues>({
    initialValues: captchaEmptyFormValues,
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsCaptchaProviderSchema),
  });

  useHydrateForm(form, captchaProvider, captchaToFormValues);

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsCaptchaProviderSchema,
    storeKey: 'captchaProvider',
    update: updateCaptchaSettings,
    successMessage: t('pages.admin.settings.tabs.captcha.page.toast.updated', {}),
  });

  const variants = useCaptchaProviderVariants();

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.captcha.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(submit)}>
        <Select
          label={t('common.form.provider', {})}
          data={mappingToSelectData(captchaProviderTypeLabelMapping)}
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
