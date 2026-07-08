import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createEggVariable from '@/api/admin/nests/eggs/variables/createEggVariable.ts';
import deleteEggVariable from '@/api/admin/nests/eggs/variables/deleteEggVariable.ts';
import updateEggVariable from '@/api/admin/nests/eggs/variables/updateEggVariable.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Group from '@/elements/Group.tsx';
import LocalizedTextArea from '@/elements/input/LocalizedTextArea.tsx';
import LocalizedTextInput from '@/elements/input/LocalizedTextInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import { adminEggSchema, adminEggVariableSchema, adminEggVariableUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function EggVariableContainer({
  contextNest,
  contextEgg,
  contextVariable,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
  contextVariable?: z.infer<typeof adminEggVariableSchema>;
}) {
  const eggVariables = useAdminStore((state) => state.eggVariables);
  const setEggVariables = useAdminStore((state) => state.setEggVariables);
  const removeEggVariable = useAdminStore((state) => state.removeEggVariable);
  const { addToast } = useToast();
  const languages = useGlobalStore((state) => state.languages);
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminEggVariableUpdateSchema>>({
    initialValues: {
      name: '',
      nameTranslations: {},
      description: null,
      descriptionTranslations: {},
      order: 0,
      envVariable: '',
      defaultValue: null,
      userViewable: true,
      userEditable: false,
      secret: false,
      rules: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminEggVariableUpdateSchema),
  });

  useEffect(() => {
    if (contextVariable) {
      form.setValues({
        name: contextVariable.name,
        description: contextVariable.description,
        descriptionTranslations: contextVariable.descriptionTranslations,
        order: contextVariable.order,
        envVariable: contextVariable.envVariable,
        defaultValue: contextVariable.defaultValue,
        userViewable: contextVariable.userViewable,
        userEditable: contextVariable.userEditable,
        secret: contextVariable.isSecret,
        rules: contextVariable.rules,
      });
    }
  }, [contextVariable]);

  const doCreateOrUpdate = () => {
    setLoading(true);

    if (contextVariable?.uuid) {
      updateEggVariable(
        contextNest.uuid,
        contextEgg.uuid,
        contextVariable.uuid,
        adminEggVariableUpdateSchema.parse(form.values),
      )
        .then(() => {
          addToast(t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.toast.updated', {}), 'success');
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      createEggVariable(contextNest.uuid, contextEgg.uuid, adminEggVariableUpdateSchema.parse(form.values))
        .then((variable) => {
          setEggVariables([...eggVariables.filter((v) => v.uuid || v.order !== contextVariable!.order), variable]);
          addToast(t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.toast.created', {}), 'success');
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const doRemove = () => {
    if (contextVariable?.uuid) {
      deleteEggVariable(contextNest.uuid, contextEgg.uuid, contextVariable.uuid)
        .then(() => {
          removeEggVariable(contextVariable);
          addToast(t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.toast.deleted', {}), 'success');
          setOpenModal(null);
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        });
    } else {
      setEggVariables(eggVariables.filter((v) => v.uuid || v.order !== contextVariable!.order));
      addToast(t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.toast.deleted', {}), 'success');
      setOpenModal(null);
    }
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.modal.delete.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.modal.delete.content', {
          variable:
            form.values.name && form.values.envVariable
              ? `${form.values.name} (${form.values.envVariable})`
              : t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.modal.delete.emptyVariable', {}),
        }).md()}
      </ConfirmationModal>

      <Card className='flex flex-col justify-between h-full'>
        <form onSubmit={form.onSubmit(doCreateOrUpdate)}>
          <Stack>
            <LocalizedTextInput
              withAsterisk
              label={t('common.form.name', {})}
              value={form.values.name}
              setValue={(value) => form.setFieldValue('name', value ?? '')}
              valueTranslations={form.values.nameTranslations}
              setValueTranslations={(translations) => form.setFieldValue('nameTranslations', translations)}
              languages={languages}
              error={form.errors.name}
            />

            <LocalizedTextArea
              label={t('common.form.description', {})}
              description={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.supportsMarkdown', {})}
              value={form.values.description}
              setValue={(value) => form.setFieldValue('description', value)}
              valueTranslations={form.values.descriptionTranslations}
              setValueTranslations={(translations) => form.setFieldValue('descriptionTranslations', translations)}
              languages={languages}
              error={form.errors.description}
            />

            <Group grow>
              <TextInput
                withAsterisk
                label={t('common.form.envVariable', {})}
                {...form.getInputProps('envVariable')}
                onChange={(e) => form.setFieldValue('envVariable', e.target.value.toUpperCase().replace(/-| /g, '_'))}
              />

              <TextInput
                label={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.defaultValue', {})}
                placeholder={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.defaultValuePlaceholder', {})}
                {...form.getInputProps('defaultValue')}
              />
            </Group>

            <Group grow>
              <Switch
                label={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.userViewable', {})}
                name='user_viewable'
                {...form.getInputProps('userViewable', { type: 'checkbox' })}
              />

              <Switch
                label={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.userEditable', {})}
                name='user_editable'
                {...form.getInputProps('userEditable', { type: 'checkbox' })}
              />
            </Group>

            <Switch
              label={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.secret', {})}
              name='secret'
              {...form.getInputProps('secret', { type: 'checkbox' })}
            />

            <TagsInput
              label={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.rules', {})}
              description={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.rulesDescription', {})}
              {...form.getInputProps('rules')}
            />
          </Stack>

          <Group pt='md' mt='auto'>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            <Button color='red' variant='outline' onClick={() => setOpenModal('delete')}>
              {t('common.button.remove', {})}
            </Button>
          </Group>
        </form>
      </Card>
    </>
  );
}
