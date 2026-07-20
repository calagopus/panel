import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import updateDatabaseAgentHostInstance from '@/api/admin/database-agent-hosts/updateDatabaseAgentHostInstance.ts';
import Button from '@/elements/Button.tsx';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentBaseSchema } from '@/lib/schemas/admin/servers.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  hostUuid: string;
  serverUuid: string;
  instance: z.infer<typeof adminDatabaseAgentBaseSchema>;
};

type FormValues = {
  image: string;
  env: Record<string, string>;
  memory: number | null;
  swap: number | null;
  disk: number | null;
  ioWeight: number | null;
  cpu: number | null;
};

export default function DatabaseAgentHostInstanceEditModal({ hostUuid, serverUuid, instance, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<FormValues>({
    initialValues: {
      image: instance.imageOverride ?? '',
      env: instance.envOverrides ?? {},
      memory: instance.memoryOverride,
      swap: instance.swapOverride,
      disk: instance.diskOverride,
      ioWeight: instance.ioWeightOverride,
      cpu: instance.cpuOverride,
    },
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateDatabaseAgentHostInstance(hostUuid, instance.uuid, {
        image: values.image.trim() || null,
        env: Object.keys(values.env).length > 0 ? values.env : null,
        memory: values.memory,
        swap: values.swap,
        disk: values.disk,
        ioWeight: values.ioWeight,
        cpu: values.cpu,
      });
      addToast(t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.editInstance.toast.updated', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.databaseAgentHosts.instances(hostUuid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.databaseInstances(serverUuid) });
    },
  });

  const values = form.getValues();

  const overrideField = (
    name: 'memory' | 'swap' | 'disk' | 'ioWeight' | 'cpu',
    label: string,
    input: (value: number) => React.ReactNode,
    fallback: number,
  ) => (
    <Stack gap='xs'>
      <Switch
        label={t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.editInstance.form.override', {
          field: label,
        })}
        checked={values[name] !== null}
        onChange={(e) => form.setFieldValue(name, e.currentTarget.checked ? fallback : null)}
      />
      {values[name] !== null && input(values[name]!)}
    </Stack>
  );

  return (
    <FormModal
      title={t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.editInstance.title', {
        name: instance.name,
      })}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          label={t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.editInstance.form.image', {})}
          description={t(
            'pages.admin.databaseAgentHosts.tabs.instances.page.modal.editInstance.form.imageDescription',
            {},
          )}
          placeholder={instance.image ?? undefined}
          {...form.getInputProps('image')}
        />

        <MultiKeyValueInput
          label={t('pages.admin.databaseAgentHosts.tabs.instances.page.modal.editInstance.form.env', {})}
          options={values.env}
          onChange={(e) => form.setFieldValue('env', e)}
        />

        {overrideField(
          'memory',
          t('common.form.memory', {}),
          (value) => (
            <SizeInput mode='mb' min={0} value={value} onChange={(v) => form.setFieldValue('memory', v)} />
          ),
          instance.memory,
        )}
        {overrideField(
          'swap',
          t('pages.admin.databaseAgentTemplates.tabs.general.page.form.swap', {}),
          (value) => (
            <SizeInput mode='mb' min={-1} value={value} onChange={(v) => form.setFieldValue('swap', v)} />
          ),
          instance.swap,
        )}
        {overrideField(
          'disk',
          t('common.form.disk', {}),
          (value) => (
            <SizeInput mode='mb' min={0} value={value} onChange={(v) => form.setFieldValue('disk', v)} />
          ),
          instance.disk,
        )}
        {overrideField(
          'cpu',
          t('pages.admin.databaseAgentTemplates.tabs.general.page.form.cpu', {}),
          (value) => (
            <NumberInput min={0} value={value} onChange={(v) => form.setFieldValue('cpu', Number(v) || 0)} />
          ),
          instance.cpu,
        )}
        {overrideField(
          'ioWeight',
          t('pages.admin.databaseAgentTemplates.tabs.general.page.form.ioWeight', {}),
          (value) => (
            <NumberInput
              min={0}
              max={1000}
              value={value}
              onChange={(v) => form.setFieldValue('ioWeight', Number(v) || 0)}
            />
          ),
          instance.ioWeight ?? 500,
        )}

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.save', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
