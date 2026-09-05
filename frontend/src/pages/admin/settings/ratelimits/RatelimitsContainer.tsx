import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateRatelimitSettings from '@/api/admin/settings/updateRatelimitSettings.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Card from '@/elements/data-display/Card.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminSettingsRatelimitsSchema } from '@/lib/schemas/admin/settings.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import { ratelimitEndpoints, ratelimitsEmptyFormValues, ratelimitsToFormValues } from './ratelimitsFormValues.tsx';

type RatelimitsSchema = z.infer<typeof adminSettingsRatelimitsSchema>;

export default function RatelimitsContainer() {
  const { t } = useTranslations();
  const ratelimits = useAdminStore((state) => state.ratelimits);

  const form = useForm<RatelimitsSchema>({
    initialValues: ratelimitsEmptyFormValues,
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsRatelimitsSchema),
  });

  useHydrateForm(form, ratelimits, ratelimitsToFormValues);

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsRatelimitsSchema,
    storeKey: 'ratelimits',
    update: updateRatelimitSettings,
    successMessage: t('pages.admin.settings.tabs.ratelimits.page.toast.updated', {}),
  });

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.ratelimits.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(submit)}>
        <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2'>
          {ratelimitEndpoints.map(({ label, key }) => (
            <Card key={key} withBorder radius='md' p='md'>
              <Stack gap='xs'>
                <Code w='fit-content' title={label}>
                  {label}
                </Code>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                  <NumberInput
                    withAsterisk
                    label={t('pages.admin.settings.tabs.ratelimits.page.form.hits', {})}
                    description={t('pages.admin.settings.tabs.ratelimits.page.form.hitsDescription', {})}
                    key={form.key(`${key}.hits`)}
                    {...form.getInputProps(`${key}.hits`)}
                  />
                  <NumberInput
                    withAsterisk
                    label={t('pages.admin.settings.tabs.ratelimits.page.form.windowSeconds', {})}
                    description={t('pages.admin.settings.tabs.ratelimits.page.form.windowSecondsDescription', {})}
                    key={form.key(`${key}.windowSeconds`)}
                    {...form.getInputProps(`${key}.windowSeconds`)}
                  />
                </div>
              </Stack>
            </Card>
          ))}
        </div>

        <Group mt='md'>
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
