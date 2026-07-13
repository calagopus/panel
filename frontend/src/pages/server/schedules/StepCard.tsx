import {
  faClone,
  faCodeBranch,
  faEllipsisVertical,
  faGear,
  faPencil,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import z from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteScheduleStep from '@/api/server/schedules/steps/deleteScheduleStep.ts';
import duplicateScheduleStep from '@/api/server/schedules/steps/duplicateScheduleStep.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Card from '@/elements/Card.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import ThemeIcon from '@/elements/ThemeIcon.tsx';
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
  onStepDuplicate?: (step: z.infer<typeof serverScheduleStepSchema>) => void;
  onStepAddBranch?: (step: z.infer<typeof serverScheduleStepSchema>, type: 'else_if' | 'else') => void;
  canAddElse?: boolean;
  onStepToggle?: (open: boolean) => void;
}

export default function StepCard({
  schedule,
  step,
  onStepUpdate,
  onStepDelete,
  onStepDuplicate,
  onStepAddBranch,
  canAddElse,
  onStepToggle,
}: Props) {
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

  const doDuplicate = async () => {
    await duplicateScheduleStep(server.uuid, schedule.uuid, step.uuid)
      .then((duplicated) => {
        addToast(t('pages.server.schedules.toast.step.duplicated', {}), 'success');
        onStepDuplicate?.(duplicated);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const isBranchStart = step.action.type === 'if' || step.action.type === 'else_if';

  return (
    <ContextMenu
      items={[
        {
          type: 'action',
          icon: faPencil,
          label: t('common.button.edit', {}),
          onClick: () => handleOpenModal('update'),
          color: 'gray',
        },
        {
          type: 'action',
          icon: faCodeBranch,
          label: t('pages.server.schedules.button.addElseIf', {}),
          hidden: !onStepAddBranch || !isBranchStart,
          onClick: () => onStepAddBranch?.(step, 'else_if'),
          color: 'gray',
        },
        {
          type: 'action',
          icon: faCodeBranch,
          label: t('pages.server.schedules.button.addElse', {}),
          hidden: !onStepAddBranch || !isBranchStart || !canAddElse,
          onClick: () => onStepAddBranch?.(step, 'else'),
          color: 'gray',
        },
        {
          type: 'action',
          icon: faClone,
          label: t('common.button.duplicate', {}),
          onClick: doDuplicate,
          color: 'gray',
        },
        {
          type: 'action',
          icon: faTrash,
          label: t('common.button.delete', {}),
          onClick: () => handleOpenModal('delete'),
          color: 'red',
        },
      ]}
    >
      {({ openMenu }) => (
        <Card
          onContextMenu={(e) => {
            e.preventDefault();
            openMenu(e.clientX, e.clientY);
          }}
        >
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

            <ActionIcon
              size='input-sm'
              variant='light'
              color='gray'
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                openMenu(rect.left, rect.bottom);
              }}
            >
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </ActionIcon>
          </Group>
        </Card>
      )}
    </ContextMenu>
  );
}
