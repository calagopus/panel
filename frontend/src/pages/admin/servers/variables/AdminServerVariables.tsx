import { useState } from 'react';
import { z } from 'zod';
import getServerVariables from '@/api/admin/servers/variables/getServerVariables.ts';
import updateServerVariables from '@/api/admin/servers/variables/updateServerVariables.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import VariableContainer from '@/elements/VariableContainer.tsx';
import { getExcludedVariables } from '@/lib/domain/eggVariableRules.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useRuleValidator } from '@/lib/ruleValidator.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { serverVariableSchema } from '@/lib/schemas/server/startup.ts';
import { useUnsavedChanges } from '@/plugins/form/useFormDraft.ts';
import { useKeyboardShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminServerVariables({ server }: { server: AdminServer }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const blocker = useUnsavedChanges('variables', Object.keys(values).length > 0);

  const { data: serverVariables = [], invalidate } = useResource<z.infer<typeof serverVariableSchema>[]>({
    queryKey: queryKeys.admin.servers.variables(server.uuid),
    queryFn: () => getServerVariables(server.uuid),
  });

  const ruleValidator = useRuleValidator();

  const ruleVariables = serverVariables.map((variable) => ({
    envVariable: variable.envVariable,
    rules: variable.rules,
    value: values[variable.envVariable] ?? variable.value,
  }));
  const validation = ruleValidator?.validate(ruleVariables);
  const excludedVariables = validation?.excluded ?? getExcludedVariables(ruleVariables);
  const variableErrors = Object.fromEntries(
    Object.entries(validation?.errors ?? {}).filter(([envVariable]) => envVariable in values),
  );
  const canSave = Object.keys(values).length > 0 && Object.keys(variableErrors).length === 0;

  const doUpdate = () => {
    setLoading(true);
    updateServerVariables(
      server.uuid,
      Object.entries(values).map(([envVariable, value]) => ({ envVariable, value })),
    )
      .then(() => {
        addToast(t('pages.admin.servers.tabs.variables.page.toast.updated', {}), 'success');
        setValues({});
        invalidate();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  useKeyboardShortcut(
    's',
    () => {
      if (canSave && !loading) {
        doUpdate();
      }
    },
    {
      modifiers: ['ctrlOrMeta'],
      allowWhenInputFocused: true,
      deps: [values, loading, canSave],
    },
  );

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.variables.page.title', {})}
      titleOrder={2}
      contentRight={
        <Button onClick={doUpdate} disabled={!canSave} loading={loading} color='blue'>
          {t('common.button.save', {})}
        </Button>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.variables.subContainer}
      registryProps={{ server }}
    >
      <ConfirmationModal
        title={t('common.modal.unsavedChanges.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirmed={() => blocker.proceed()}
        confirm={t('common.button.leavePage', {})}
      >
        {t('common.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4'>
        {serverVariables
          .filter((variable) => !excludedVariables.has(variable.envVariable))
          .map((variable) => (
            <VariableContainer
              key={variable.envVariable}
              variable={variable}
              loading={loading}
              overrideReadonly
              value={values[variable.envVariable] ?? variable.value ?? variable.defaultValue ?? ''}
              error={variableErrors[variable.envVariable]}
              setValue={(value) => setValues((prev) => ({ ...prev, [variable.envVariable]: value }))}
            />
          ))}
      </div>
    </AdminSubContentContainer>
  );
}
