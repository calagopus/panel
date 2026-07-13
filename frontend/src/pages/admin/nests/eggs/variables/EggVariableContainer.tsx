import { useEffect, useState } from 'react';
import { z } from 'zod';
import createEggVariable from '@/api/admin/nests/eggs/variables/createEggVariable.ts';
import deleteEggVariable from '@/api/admin/nests/eggs/variables/deleteEggVariable.ts';
import updateEggVariable from '@/api/admin/nests/eggs/variables/updateEggVariable.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminEggSchema, adminEggVariableSchema, adminEggVariableUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type VariableFormValues = z.infer<typeof adminEggVariableUpdateSchema>;

export default function EggVariableContainer({
  contextNest,
  contextEgg,
  contextVariable,
  eggVariables,
  setEggVariables,
  removeEggVariable,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
  contextVariable?: z.infer<typeof adminEggVariableSchema>;
  eggVariables: z.infer<typeof adminEggVariableSchema>[];
  setEggVariables: (variables: z.infer<typeof adminEggVariableSchema>[]) => void;
  removeEggVariable: (variable: z.infer<typeof adminEggVariableSchema>) => void;
}) {
  const { addToast } = useToast();
  const { languages } = useGlobalStore();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useFormEngine<VariableFormValues>('admin.nests.eggs.variables', {
    schema: adminEggVariableUpdateSchema.unwrap(),
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

  const fields: FieldDef<VariableFormValues>[] = [
    {
      type: 'localizedtext',
      name: 'name',
      label: t('common.form.name', {}),
      required: true,
      colSpan: 'full',
      translationsName: 'nameTranslations',
      languages,
    },
    {
      type: 'localizedtextarea',
      name: 'description',
      label: t('common.form.description', {}),
      description: t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.supportsMarkdown', {}),
      colSpan: 'full',
      translationsName: 'descriptionTranslations',
      languages,
    },
    {
      type: 'custom',
      name: 'envVariable',
      render: (f) => (
        <TextInput
          withAsterisk
          label={t('common.form.envVariable', {})}
          {...f.getInputProps('envVariable')}
          onChange={(e) => f.setFieldValue('envVariable', e.target.value.toUpperCase().replace(/-| /g, '_'))}
        />
      ),
    },
    {
      type: 'text',
      name: 'defaultValue',
      label: t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.defaultValue', {}),
      props: {
        placeholder: t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.defaultValuePlaceholder', {}),
      },
    },
    {
      type: 'switch',
      name: 'userViewable',
      label: t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.userViewable', {}),
    },
    {
      type: 'switch',
      name: 'userEditable',
      label: t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.userEditable', {}),
    },
    {
      type: 'switch',
      name: 'secret',
      label: t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.secret', {}),
    },
    {
      type: 'tags',
      name: 'rules',
      label: t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.rules', {}),
      description: t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.form.rulesDescription', {}),
      colSpan: 'full',
    },
  ];

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
          <FormEngine form={form} fields={fields} />

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
