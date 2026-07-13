import { faList } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import type { RouteDefinition } from 'shared';
import { z } from 'zod';
import updateUserSettings from '@/api/admin/settings/updateUserSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import RouteOrderEditor from '@/elements/RouteOrderEditor.tsx';
import { adminSettingsUserSchema } from '@/lib/schemas/admin/settings.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type UserFormValues = z.infer<typeof adminSettingsUserSchema>;

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

  const form = useFormEngine<UserFormValues>('admin.settings.user', {
    schema: adminSettingsUserSchema,
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
  });

  useEffect(() => {
    form.setValues({ ...user });
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
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  const fields: FieldDef<UserFormValues>[] = [
    {
      type: 'number',
      name: 'maxServerGroupCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxServerGroupCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxApiKeyCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxApiKeyCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxCommandSnippetCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxCommandSnippetCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxSecurityKeyCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxSecurityKeyCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxSshKeyCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxSshKeyCount', {}),
      required: true,
    },
    {
      type: 'switch',
      name: 'allowChangingLanguage',
      label: t('pages.admin.settings.tabs.user.page.form.allowChangingLanguage', {}),
      description: t('pages.admin.settings.tabs.user.page.form.allowChangingLanguageDescription', {}),
    },
  ];

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.user.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <FormEngine form={form} fields={fields} />

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
