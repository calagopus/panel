import { faGear, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { useState } from 'react';
import z from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteScheduleStep from '@/api/server/schedules/steps/deleteScheduleStep.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Card from '@/elements/Card.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { scheduleStepIconMapping, scheduleStepLabelMapping } from '@/lib/enums.ts';
import { serverScheduleSchema, serverScheduleStepSchema } from '@/lib/schemas/server/schedules.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import StepCreateOrUpdateModal from './modals/StepCreateOrUpdateModal.tsx';
import ActionRenderer from './renderers/ActionRenderer.tsx';

interface Props {
  schedule: z.infer<typeof serverScheduleSchema>;
  step: z.infer<typeof serverScheduleStepSchema>;
  onStepUpdate: (step: z.infer<typeof serverScheduleStepSchema>) => void;
  onStepDelete: (stepUuid: string) => void;
  onStepToggle?: (open: boolean) => void;
}

export default function StepCard({ schedule, step, onStepUpdate, onStepDelete, onStepToggle }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const [openModal, setOpenModal] = useState<'update' | 'delete' | null>(null);
  const handleOpenModal = (modal: 'update' | 'delete' | null) => {
    setOpenModal(modal);
    onStepToggle?.(modal !== null);
  };

  const doDelete = async () => {
    await deleteScheduleStep(server.uuid, schedule.uuid, step.uuid)
      .then(() => {
        addToast(t('pages.server.schedules.toast.step.deleted', {}), 'success');
        onStepDelete(step.uuid);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <Card>
      <StepCreateOrUpdateModal
        opened={openModal === 'update'}
        onClose={() => handleOpenModal(null)}
        schedule={schedule}
        propStep={step}
        onStepUpdate={onStepUpdate}
      />

      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => handleOpenModal(null)}
        title={t('pages.server.schedules.modal.deleteStep.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.server.schedules.modal.deleteStep.content', {})}
      </ConfirmationModal>

      <Group justify='space-between' align='flex-start'>
        <Group gap='md' align='flex-start'>
          <ThemeIcon size='lg' color='gray'>
            <FontAwesomeIcon icon={scheduleStepIconMapping[step.action.type] || faGear} />
          </ThemeIcon>
          <Stack gap={4}>
            <Text fw={600}>{scheduleStepLabelMapping[step.action.type]()}</Text>
            <Text size='sm' c='dimmed'>
              <ActionRenderer action={step.action} mode='compact' />
            </Text>
          </Stack>
        </Group>

        <Group gap='xs'>
          <ActionIcon color='blue' onClick={() => handleOpenModal('update')}>
            <FontAwesomeIcon icon={faPencil} />
          </ActionIcon>
          <ActionIcon color='red' onClick={() => handleOpenModal('delete')}>
            <FontAwesomeIcon icon={faTrash} />
          </ActionIcon>
        </Group>
      </Group>
    </Card>
  );
}
