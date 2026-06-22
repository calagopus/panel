import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateEggScript from '@/api/admin/nests/eggs/updateEggScript.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminEggConfigScriptSchema, adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

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

  const [loading, setLoading] = useState(false);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<ScriptFormValues>('admin.nests.eggs.installationScript');
  const mergedSchema = adminEggConfigScriptSchema.extend(zodShape);

  const form = useForm<ScriptFormValues>({
    initialValues: {
      container: '',
      entrypoint: '',
      content: '',
      ...(extInitialValues as Partial<ScriptFormValues>),
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
  });

  useEffect(() => {
    if (contextEgg) {
      form.setValues({
        container: contextEgg.configScript.container,
        entrypoint: contextEgg.configScript.entrypoint,
        content: contextEgg.configScript.content,
      });
    }
  }, [contextEgg]);

  const doUpdate = () => {
    setLoading(true);

    updateEggScript(contextNest.uuid, contextEgg.uuid, adminEggConfigScriptSchema.parse(form.values))
      .then(() => {
        addToast(t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.page.toast.updated', {}), 'success');
        contextEgg.configScript = form.values;
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
            <FormEngine form={form} fields={fields} extensions={[formExtension]} />

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
                  smoothScrolling: true,
                  // @ts-expect-error this is valid
                  touchScrollEnabled: true,
                }}
                onChange={(value) => form.setFieldValue('content', value || '')}
                defaultLanguage='shell'
              />
            </div>
          </Stack>

          <Group pt='md' mt='auto'>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </Group>
        </form>
      </AdminSubContentContainer>
    </>
  );
}
