import { faSave } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import createScheduleStep from '@/api/server/schedules/steps/createScheduleStep.ts';
import updateScheduleStep from '@/api/server/schedules/steps/updateScheduleStep.ts';
import Button from '@/elements/Button.tsx';
import Divider from '@/elements/Divider.tsx';
import Select from '@/elements/input/Select.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import {
  ScheduleStepGroup,
  scheduleStepDefaultMapping,
  scheduleStepDescriptionMapping,
  scheduleStepGroupLabelMapping,
  scheduleStepGroupMapping,
  scheduleStepLabelMapping,
} from '@/lib/enums.ts';
import {
  serverScheduleSchema,
  serverScheduleStepActionSchema,
  serverScheduleStepSchema,
  serverScheduleStepUpdateSchema,
} from '@/lib/schemas/server/schedules.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import StepCompressFiles from '../steps/StepCompressFiles.tsx';
import StepCopyFile from '../steps/StepCopyFile.tsx';
import StepCreateBackup from '../steps/StepCreateBackup.tsx';
import StepCreateDirectory from '../steps/StepCreateDirectory.tsx';
import StepDecompressFile from '../steps/StepDecompressFile.tsx';
import StepDeleteFiles from '../steps/StepDeleteFiles.tsx';
import StepEnsure from '../steps/StepEnsure.tsx';
import StepExit from '../steps/StepExit.tsx';
import StepFormat from '../steps/StepFormat.tsx';
import StepIf from '../steps/StepIf.tsx';
import StepMatchRegex from '../steps/StepMatchRegex.tsx';
import StepRenameFiles from '../steps/StepRenameFiles.tsx';
import StepRestoreBackup from '../steps/StepRestoreBackup.tsx';
import StepSendCommand from '../steps/StepSendCommand.tsx';
import StepSendPower from '../steps/StepSendPower.tsx';
import StepSleep from '../steps/StepSleep.tsx';
import StepUpdateStartupCommand from '../steps/StepUpdateStartupCommand.tsx';
import StepUpdateStartupDockerImage from '../steps/StepUpdateStartupDockerImage.tsx';
import StepUpdateStartupVariable from '../steps/StepUpdateStartupVariable.tsx';
import StepWaitForConsoleLine from '../steps/StepWaitForConsoleLine.tsx';
import StepWaitForState from '../steps/StepWaitForState.tsx';
import StepWriteFile from '../steps/StepWriteFile.tsx';

type Props = ModalProps & {
  schedule: z.infer<typeof serverScheduleSchema>;
  propStep?: z.infer<typeof serverScheduleStepSchema>;
  nextStepOrder?: number;
  onStepCreate?: (step: z.infer<typeof serverScheduleStepSchema>) => void;
  onStepUpdate?: (step: z.infer<typeof serverScheduleStepSchema>) => void;
};

export default function StepCreateOrUpdateModal({
  schedule,
  propStep,
  nextStepOrder,
  onStepCreate,
  onStepUpdate,
  ...props
}: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverScheduleStepUpdateSchema>
  >({
    initialValues: {
      order: nextStepOrder ?? 1,
      action: scheduleStepDefaultMapping.send_command,
    },
    validate: zod4Resolver(serverScheduleStepUpdateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      if (propStep) {
        await updateScheduleStep(server.uuid, schedule.uuid, propStep.uuid, values);
        addToast(t('pages.server.schedules.toast.step.updated', {}), 'success');
        onStepUpdate?.({ ...propStep, ...values });
      } else {
        const step = await createScheduleStep(server.uuid, schedule.uuid, values);
        addToast(t('pages.server.schedules.toast.step.created', {}), 'success');
        onStepCreate?.(step);

        if (values.action.type === 'if') {
          const endIfStep = await createScheduleStep(server.uuid, schedule.uuid, {
            order: values.order + 1,
            action: { type: 'end_if' },
          });
          onStepCreate?.(endIfStep);
        }
      }
    },
  });

  useEffect(() => {
    if (propStep && props.opened) {
      const values = {
        order: propStep.order,
        action:
          propStep.action.type === 'create_backup' && !propStep.action.name
            ? { ...propStep.action, name: null }
            : propStep.action,
      };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [propStep, props.opened]);

  return (
    <FormModal
      isDirty={isDirty}
      loading={loading}
      title={
        propStep
          ? t('pages.server.schedules.modal.editStep.title', {})
          : t('pages.server.schedules.modal.createStep.title', {})
      }
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack gap='md'>
        <Select
          label={t('pages.server.schedules.form.actionType', {})}
          data={(['server', 'files', 'startup', 'advanced'] as ScheduleStepGroup[]).map((group) => ({
            group: scheduleStepGroupLabelMapping[group](),
            items: Object.entries(scheduleStepLabelMapping)
              .filter(([value]) => scheduleStepGroupMapping[value as keyof typeof scheduleStepGroupMapping] === group)
              .map(([value, label]) => ({
                value,
                label: label(),
              })),
          }))}
          renderOption={({ option }) => (
            <Stack gap={0}>
              <Text size='sm'>{option.label}</Text>
              <Text size='xs' c='dimmed'>
                {scheduleStepDescriptionMapping[option.value as keyof typeof scheduleStepDescriptionMapping]()}
              </Text>
            </Stack>
          )}
          searchable
          value={form.getValues().action.type}
          onChange={(type) => {
            form.setFieldValue(
              'action',
              scheduleStepDefaultMapping[type as z.infer<typeof serverScheduleStepActionSchema>['type']],
            );
          }}
        />

        <Divider />

        {form.values.action.type === 'sleep' ? (
          <StepSleep form={form} />
        ) : form.values.action.type === 'ensure' ? (
          <StepEnsure form={form} />
        ) : form.values.action.type === 'if' || form.values.action.type === 'else_if' ? (
          <StepIf form={form} />
        ) : form.values.action.type === 'else' || form.values.action.type === 'end_if' ? (
          <Text c='dimmed'>{scheduleStepDescriptionMapping[form.values.action.type]()}</Text>
        ) : form.values.action.type === 'exit' ? (
          <StepExit form={form} />
        ) : form.values.action.type === 'wait_for_state' ? (
          <StepWaitForState form={form} />
        ) : form.values.action.type === 'format' ? (
          <StepFormat form={form} />
        ) : form.values.action.type === 'match_regex' ? (
          <StepMatchRegex form={form} />
        ) : form.values.action.type === 'wait_for_console_line' ? (
          <StepWaitForConsoleLine form={form} />
        ) : form.values.action.type === 'send_power' ? (
          <StepSendPower form={form} />
        ) : form.values.action.type === 'send_command' ? (
          <StepSendCommand form={form} />
        ) : form.values.action.type === 'create_backup' ? (
          <StepCreateBackup form={form} />
        ) : form.values.action.type === 'restore_backup' ? (
          <StepRestoreBackup form={form} />
        ) : form.values.action.type === 'create_directory' ? (
          <StepCreateDirectory form={form} />
        ) : form.values.action.type === 'write_file' ? (
          <StepWriteFile form={form} />
        ) : form.values.action.type === 'copy_file' ? (
          <StepCopyFile form={form} />
        ) : form.values.action.type === 'delete_files' ? (
          <StepDeleteFiles form={form} />
        ) : form.values.action.type === 'rename_files' ? (
          <StepRenameFiles form={form} />
        ) : form.values.action.type === 'compress_files' ? (
          <StepCompressFiles form={form} />
        ) : form.values.action.type === 'decompress_file' ? (
          <StepDecompressFile form={form} />
        ) : form.values.action.type === 'update_startup_variable' ? (
          <StepUpdateStartupVariable form={form} />
        ) : form.values.action.type === 'update_startup_command' ? (
          <StepUpdateStartupCommand form={form} />
        ) : form.values.action.type === 'update_startup_docker_image' ? (
          <StepUpdateStartupDockerImage form={form} />
        ) : (
          <Text c='dimmed'>{t('pages.server.schedules.form.actionType', {})}</Text>
        )}

        <ModalFooter>
          <Button type='submit' leftSection={<FontAwesomeIcon icon={faSave} />} loading={loading}>
            {propStep ? t('common.button.update', {}) : t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
