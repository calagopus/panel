import { faList } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import type { RouteDefinition } from 'shared';
import { z } from 'zod';
import updateUserSettings from '@/api/admin/settings/updateUserSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import RouteOrderEditor from '@/elements/navigation/RouteOrderEditor.tsx';
import { adminSettingsUserSchema } from '@/lib/schemas/admin/settings.ts';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import SettingsSaveButton from '../SettingsSaveButton.tsx';
import { useSettingsSection } from '../useSettingsSection.ts';
import {
  userSettingsEmptyFormValues,
  userSettingsToFormValues,
  useUserSettingsFormFields,
} from './userSettingsFormValues.tsx';

const loadAccountRoutes = () => import('@/routers/routes/accountRoutes.ts');

type UserFormValues = z.infer<typeof adminSettingsUserSchema>;

export default function UserContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const user = useAdminStore((state) => state.user);
  const languages = useGlobalStore((state) => state.languages);

  const [defaultRoutes, setDefaultRoutes] = useState<{
    order: z.infer<typeof eggConfigurationRouteItemSchema>[];
    entries: RouteDefinition[];
  }>({ order: [], entries: [] });

  const form = useFormEngine<UserFormValues>('admin.settings.user', {
    schema: adminSettingsUserSchema,
    initialValues: userSettingsEmptyFormValues,
    validateInputOnBlur: true,
  });

  useHydrateForm(form, user, userSettingsToFormValues);

  useEffect(() => {
    loadAccountRoutes()
      .then((module) => {
        const entries = [...module.default, ...window.extensionContext.extensionRegistry.routes.accountRoutes];

        for (const interceptor of window.extensionContext.extensionRegistry.routes.accountRouteInterceptors) {
          interceptor(entries);
        }

        const order: z.infer<typeof eggConfigurationRouteItemSchema>[] = [];
        for (const route of entries) {
          if (route.name === undefined) continue;
          order.push({ type: 'route', path: route.path });
        }
        setDefaultRoutes({ order, entries });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  }, []);

  const { loading, submit } = useSettingsSection({
    form,
    schema: adminSettingsUserSchema,
    storeKey: 'user',
    update: updateUserSettings,
    successMessage: t('pages.admin.settings.tabs.user.page.toast.updated', {}),
    syncGlobalKey: 'user',
  });

  const fields = useUserSettingsFormFields();

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.user.page.title', {})} titleOrder={2}>
      <form onSubmit={form.onSubmit(submit)}>
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
          <SettingsSaveButton loading={loading} disabled={!form.isValid()} />
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
