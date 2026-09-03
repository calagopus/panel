import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ComponentProps, useState } from 'react';
import { z } from 'zod';
import createEggVariable from '@/api/admin/nests/eggs/variables/createEggVariable.ts';
import deleteEggVariable from '@/api/admin/nests/eggs/variables/deleteEggVariable.ts';
import updateEggVariable from '@/api/admin/nests/eggs/variables/updateEggVariable.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/data-display/Card.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminEggSchema, adminEggVariableSchema, adminEggVariableUpdateSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import {
  eggVariableEmptyFormValues,
  eggVariableToFormValues,
} from '@/pages/admin/nests/eggs/variables/eggVariableFormValues.ts';
import EggVariableDuplicateModal from '@/pages/admin/nests/eggs/variables/modals/EggVariableDuplicateModal.tsx';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
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
  dragHandleProps,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
  contextVariable?: z.infer<typeof adminEggVariableSchema>;
  eggVariables: z.infer<typeof adminEggVariableSchema>[];
  setEggVariables: (variables: z.infer<typeof adminEggVariableSchema>[]) => void;
  removeEggVariable: (variable: z.infer<typeof adminEggVariableSchema>) => void;
  dragHandleProps?: ComponentProps<'button'>;
}) {
  const { addToast } = useToast();
  const { languages } = useGlobalStore();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useFormEngine<VariableFormValues>('admin.nests.eggs.variables', {
    schema: adminEggVariableUpdateSchema.unwrap(),
    initialValues: eggVariableEmptyFormValues,
    validateInputOnBlur: true,
  });

  useHydrateForm(form, contextVariable, eggVariableToFormValues);

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
        placeholder: 'server.jar',
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

      {contextVariable?.uuid && (
        <EggVariableDuplicateModal
          contextNest={contextNest}
          contextEgg={contextEgg}
          variable={contextVariable}
          onDuplicated={(variable) => setEggVariables([...eggVariables, variable])}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <Card className='flex flex-col justify-between h-full'>
        {dragHandleProps && (
          <div className='flex justify-end -mt-1 -mr-1 mb-1'>
            <ActionIcon
              size='md'
              variant='subtle'
              color='gray'
              style={{ cursor: 'grab', flexShrink: 0 }}
              className='text-gray-400! light:text-gray-500!'
              aria-label={t('pages.admin.nests.tabs.eggs.page.tabs.variables.page.aria.reorder', {})}
              {...dragHandleProps}
            >
              <FontAwesomeIcon icon={faGripVertical} style={{ fontSize: 16 }} />
            </ActionIcon>
          </div>
        )}
        <form onSubmit={form.onSubmit(doCreateOrUpdate)} className='flex flex-col flex-1'>
          <FormEngine form={form} fields={fields} />

          <Group pt='md' mt='auto' justify='flex-end'>
            <AdminCan action='eggs.update' cantSave>
              <Button type='submit' disabled={!form.isValid()} loading={loading}>
                {t('common.button.save', {})}
              </Button>
            </AdminCan>
            <AdminCan action='eggs.update'>
              {contextVariable?.uuid && (
                <Button variant='default' onClick={() => setOpenModal('duplicate')}>
                  {t('common.button.duplicate', {})}
                </Button>
              )}
              <Button color='red' variant='outline' onClick={() => setOpenModal('delete')}>
                {t('common.button.remove', {})}
              </Button>
            </AdminCan>
          </Group>
        </form>
      </Card>
    </>
  );
}
