import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Editor } from '@monaco-editor/react';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateEggScript from '@/api/admin/nests/eggs/updateEggScript.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminEggScriptSchema } from '@/lib/schemas/admin/eggs.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function EggInstallationScriptContainer({
  contextNest,
  contextEgg,
}: {
  contextNest: AdminNest;
  contextEgg: AdminNestEgg;
}) {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminEggScriptSchema>>({
    initialValues: {
      container: '',
      entrypoint: '',
      content: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminEggScriptSchema),
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

    updateEggScript(contextNest.uuid, contextEgg.uuid, form.values)
      .then(() => {
        addToast('Egg script updated.', 'success');
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
      <AdminContentContainer title='Egg Installation Script' titleOrder={2}>
        <form onSubmit={form.onSubmit(doUpdate)}>
          <Stack>
            <Group grow>
              <TextInput
                withAsterisk
                label='Installation Container'
                placeholder='Installation Container'
                {...form.getInputProps('container')}
              />
              <TextInput
                withAsterisk
                label='Container Entrypoint'
                placeholder='Container Entrypoint'
                {...form.getInputProps('entrypoint')}
              />
            </Group>

            <div className='rounded-md overflow-hidden'>
              <Editor
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
              Save
            </Button>
          </Group>
        </form>
      </AdminContentContainer>
    </>
  );
}
