import { useEffect, useState } from 'react';
import { z } from 'zod';
import getServerVariables from '@/api/admin/servers/variables/getServerVariables.ts';
import updateServerVariables from '@/api/admin/servers/variables/updateServerVariables.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import VariableContainer from '@/elements/VariableContainer.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useKeyboardShortcut } from '@/plugins/useKeyboardShortcuts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminServerVariables({ server }: { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const serverVariables = useAdminStore((state) => state.serverVariables);
  const setServerVariables = useAdminStore((state) => state.setServerVariables);
  const updateServerVariable = useAdminStore((state) => state.updateServerVariable);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getServerVariables(server.uuid).then((data) => {
      setServerVariables(data);
    });
  }, []);

  const doUpdate = () => {
    setLoading(true);
    updateServerVariables(
      server.uuid,
      Object.entries(values).map(([envVariable, value]) => ({ envVariable, value })),
    )
      .then(() => {
        addToast(t('pages.admin.servers.tabs.variables.page.toast.updated', {}), 'success');
        for (const [envVariable, value] of Object.entries(values)) {
          updateServerVariable(envVariable, { value });
        }

        setValues({});
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  useKeyboardShortcut(
    's',
    () => {
      if (Object.keys(values).length > 0 && !loading) {
        doUpdate();
      }
    },
    {
      modifiers: ['ctrlOrMeta'],
      allowWhenInputFocused: true,
      deps: [values, loading],
    },
  );

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.variables.page.title', {})}
      titleOrder={2}
      contentRight={
        <Button onClick={doUpdate} disabled={Object.keys(values).length === 0} loading={loading} color='blue'>
          {t('common.button.save', {})}
        </Button>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.variables.subContainer}
      registryProps={{ server }}
    >
      <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4'>
        {serverVariables.map((variable) => (
          <VariableContainer
            key={variable.envVariable}
            variable={variable}
            loading={loading}
            overrideReadonly
            value={values[variable.envVariable] ?? variable.value ?? variable.defaultValue ?? ''}
            setValue={(value) => setValues((prev) => ({ ...prev, [variable.envVariable]: value }))}
          />
        ))}
      </div>
    </AdminSubContentContainer>
  );
}
