import { UseFormReturnType, useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateCaptchaSettings from '@/api/admin/settings/updateCaptchaSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import { captchaProviderTypeLabelMapping } from '@/lib/enums.ts';
import {
  adminSettingsCaptchaProviderFriendlyCaptchaSchema,
  adminSettingsCaptchaProviderHcaptchaSchema,
  adminSettingsCaptchaProviderRecaptchaSchema,
  adminSettingsCaptchaProviderSchema,
  adminSettingsCaptchaProviderTurnstileSchema,
} from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import CaptchaFriendlyCaptcha from './forms/CaptchaFriendlyCaptcha.tsx';
import CaptchaHcaptcha from './forms/CaptchaHcaptcha.tsx';
import CaptchaRecaptcha from './forms/CaptchaRecaptcha.tsx';
import CaptchaTurnstile from './forms/CaptchaTurnstile.tsx';

export default function CaptchaContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const captchaProvider = useAdminStore((state) => state.captchaProvider);
  const updateSettings = useAdminStore((state) => state.updateSettings);

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminSettingsCaptchaProviderSchema>>({
    initialValues: {
      type: 'none',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsCaptchaProviderSchema),
  });

  useEffect(() => {
    form.setValues<z.infer<typeof adminSettingsCaptchaProviderSchema>>({
      ...captchaProvider,
    });
  }, [captchaProvider]);

  const doUpdate = () => {
    setLoading(true);

    updateCaptchaSettings(adminSettingsCaptchaProviderSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.captcha.page.toast.updated', {}), 'success');
        updateSettings({ captchaProvider: adminSettingsCaptchaProviderSchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.captcha.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Select
          label={t('common.form.provider', {})}
          data={Object.entries(captchaProviderTypeLabelMapping).map(([value, label]) => ({
            value,
            label,
          }))}
          key={form.key('type')}
          {...form.getInputProps('type')}
        />

        {form.getValues().type === 'turnstile' ? (
          <CaptchaTurnstile
            form={form as UseFormReturnType<z.infer<typeof adminSettingsCaptchaProviderTurnstileSchema>>}
          />
        ) : form.getValues().type === 'recaptcha' ? (
          <CaptchaRecaptcha
            form={form as UseFormReturnType<z.infer<typeof adminSettingsCaptchaProviderRecaptchaSchema>>}
          />
        ) : form.getValues().type === 'hcaptcha' ? (
          <CaptchaHcaptcha
            form={form as UseFormReturnType<z.infer<typeof adminSettingsCaptchaProviderHcaptchaSchema>>}
          />
        ) : form.getValues().type === 'friendly_captcha' ? (
          <CaptchaFriendlyCaptcha
            form={form as UseFormReturnType<z.infer<typeof adminSettingsCaptchaProviderFriendlyCaptchaSchema>>}
          />
        ) : null}

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
