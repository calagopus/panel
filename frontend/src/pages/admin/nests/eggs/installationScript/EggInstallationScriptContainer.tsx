import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateEggScript from '@/api/admin/nests/eggs/updateEggScript.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import { adminEggConfigScriptSchema, adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

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

  const form = useForm<z.infer<typeof adminEggConfigScriptSchema>>({
    initialValues: {
      container: '',
      entrypoint: '',
      content: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminEggConfigScriptSchema),
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

  return (
    <>
      <AdminSubContentContainer
        title={t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.page.title', {})}
        titleOrder={2}
      >
        <form onSubmit={form.onSubmit(doUpdate)}>
          <Stack>
            <Group grow>
              <TextInput
                withAsterisk
                label={t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.page.form.container', {})}
                {...form.getInputProps('container')}
              />
              <TextInput
                withAsterisk
                label={t('pages.admin.nests.tabs.eggs.page.tabs.installationScript.page.form.entrypoint', {})}
                {...form.getInputProps('entrypoint')}
              />
            </Group>

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
