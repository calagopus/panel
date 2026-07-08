import { faList } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import type { RouteDefinition } from 'shared';
import { z } from 'zod';
import updateUserSettings from '@/api/admin/settings/updateUserSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import RouteOrderEditor from '@/elements/RouteOrderEditor.tsx';
import { adminSettingsUserSchema } from '@/lib/schemas/admin/settings.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function UserContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const user = useAdminStore((state) => state.user);
  const updateAdminSettings = useAdminStore((state) => state.updateSettings);
  const updateSettings = useGlobalStore((state) => state.updateSettings);
  const languages = useGlobalStore((state) => state.languages);

  const [loading, setLoading] = useState(false);
  const [defaultRoutes, setDefaultRoutes] = useState<{
    order: z.infer<typeof eggConfigurationRouteItemSchema>[];
    entries: RouteDefinition[];
  }>({ order: [], entries: [] });

  const form = useForm<z.infer<typeof adminSettingsUserSchema>>({
    initialValues: {
      maxServerGroupCount: 0,
      maxApiKeyCount: 0,
      maxCommandSnippetCount: 0,
      maxSecurityKeyCount: 0,
      maxSshKeyCount: 0,
      allowChangingLanguage: true,
      routeOrder: null,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsUserSchema),
  });

  useEffect(() => {
    form.setValues({
      ...user,
    });
  }, [user]);

  useEffect(() => {
    import('@/routers/routes/accountRoutes.ts')
      .then((module) => {
        const entries = [...module.default, ...window.extensionContext.extensionRegistry.routes.accountRoutes];
        const order: z.infer<typeof eggConfigurationRouteItemSchema>[] = [];

        for (const route of entries) {
          if (route.name === undefined) continue;
          order.push({ type: 'route', path: route.path });
        }

        setDefaultRoutes({ order, entries });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  }, []);

  const doUpdate = () => {
    setLoading(true);

    updateUserSettings(adminSettingsUserSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.user.page.toast.updated', {}), 'success');
        updateSettings({ user: { ...form.getValues() } });
        updateAdminSettings({ user: adminSettingsUserSchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.user.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <NumberInput
            withAsterisk
            label={t('pages.admin.settings.tabs.user.page.form.maxServerGroupCount', {})}
            key={form.key('maxServerGroupCount')}
            {...form.getInputProps('maxServerGroupCount')}
          />
          <NumberInput
            withAsterisk
            label={t('pages.admin.settings.tabs.user.page.form.maxApiKeyCount', {})}
            key={form.key('maxApiKeyCount')}
            {...form.getInputProps('maxApiKeyCount')}
          />
          <NumberInput
            withAsterisk
            label={t('pages.admin.settings.tabs.user.page.form.maxCommandSnippetCount', {})}
            key={form.key('maxCommandSnippetCount')}
            {...form.getInputProps('maxCommandSnippetCount')}
          />
          <NumberInput
            withAsterisk
            label={t('pages.admin.settings.tabs.user.page.form.maxSecurityKeyCount', {})}
            key={form.key('maxSecurityKeyCount')}
            {...form.getInputProps('maxSecurityKeyCount')}
          />
          <NumberInput
            withAsterisk
            label={t('pages.admin.settings.tabs.user.page.form.maxSshKeyCount', {})}
            key={form.key('maxSshKeyCount')}
            {...form.getInputProps('maxSshKeyCount')}
          />

          <Switch
            label={t('pages.admin.settings.tabs.user.page.form.allowChangingLanguage', {})}
            description={t('pages.admin.settings.tabs.user.page.form.allowChangingLanguageDescription', {})}
            key={form.key('allowChangingLanguage')}
            {...form.getInputProps('allowChangingLanguage', { type: 'checkbox' })}
          />
        </div>

        <CollapsibleSection
          className='mt-4'
          icon={<FontAwesomeIcon icon={faList} />}
          title={t('pages.admin.settings.tabs.user.page.routeOrder.title', {})}
          enabled={form.values.routeOrder !== null}
          onToggle={(enabled) => form.setFieldValue('routeOrder', enabled ? defaultRoutes.order : null)}
        >
          {form.values.routeOrder && (
            <RouteOrderEditor
              value={form.values.routeOrder}
              onChange={(order) => form.setFieldValue('routeOrder', order)}
              routes={defaultRoutes.entries}
              languages={languages}
            />
          )}
        </CollapsibleSection>

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
