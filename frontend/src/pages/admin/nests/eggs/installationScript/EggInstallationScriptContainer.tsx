import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import updateEggScript from '@/api/admin/nests/eggs/updateEggScript.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import MonacoEditor from '@/elements/editors/MonacoEditor.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggConfigScriptSchema, adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { eggScriptEmptyFormValues, eggToScriptFormValues } from './eggScriptFormValues.ts';

type ScriptFormValues = z.infer<typeof adminEggConfigScriptSchema>;

export default function EggInstallationScriptContainer({
  contextNest,
  contextEgg,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);

  const form = useFormEngine<ScriptFormValues>('admin.nests.eggs.installationScript', {
    schema: adminEggConfigScriptSchema,
    initialValues: eggScriptEmptyFormValues,
    validateInputOnBlur: true,
  });

  useHydrateForm(form, contextEgg, eggToScriptFormValues);

  const doUpdate = () => {
    setLoading(true);

    updateEggScript(contextNest.uuid, contextEgg.uuid, adminEggConfigScriptSchema.parse(form.values))
      .then(() => {
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.page.toast.updated', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.eggs.detail(contextEgg.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const fields: FieldDef<ScriptFormValues>[] = [
    {
      type: 'text',
      name: 'container',
      label: t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.page.form.container', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'entrypoint',
      label: t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.page.form.entrypoint', {}),
      required: true,
    },
  ];

  return (
    <>
      <AdminSubContentContainer
        title={t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.page.title', {})}
        titleOrder={2}
      >
        <form onSubmit={form.onSubmit(doUpdate)}>
          <Stack>
            <FormEngine form={form} fields={fields} />

            <div className='rounded-md overflow-hidden'>
              <MonacoEditor
                height='53vh'
                theme='vs-dark'
                value={form.values.content || ''}
                options={{
                  stickyScroll: { enabled: false },
                  minimap: { enabled: false },
                  codeLens: false,
                  scrollBeyondLastLine: false,
                  smoothScrolling: false,
                  inertialScroll: true,
                }}
                onChange={(value) => form.setFieldValue('content', value || '')}
                defaultLanguage='shell'
              />
            </div>
          </Stack>

          <Group pt='md' mt='auto'>
            <AdminCan action='eggs.update' cantSave>
              <Button type='submit' disabled={!form.isValid()} loading={loading}>
                {t('common.button.save', {})}
              </Button>
            </AdminCan>
          </Group>
        </form>
      </AdminSubContentContainer>
    </>
  );
}
