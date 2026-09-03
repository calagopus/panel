import {
  faChevronDown,
  faClone,
  faCodeBranch,
  faEllipsisVertical,
  faExclamationTriangle,
  faGear,
  faGripVertical,
  faPencil,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ComponentProps, useState } from 'react';
import z from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createScheduleStep from '@/api/server/schedules/steps/createScheduleStep.ts';
import deleteScheduleStep from '@/api/server/schedules/steps/deleteScheduleStep.ts';
import duplicateScheduleStep from '@/api/server/schedules/steps/duplicateScheduleStep.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import AnimatedHourglass from '@/elements/feedback/AnimatedHourglass.tsx';
import Collapse from '@/elements/layout/Collapse.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import { scheduleStepIconMapping, scheduleStepLabelMapping } from '@/lib/enums.ts';
import { serverScheduleSchema, serverScheduleStepSchema } from '@/lib/schemas/server/schedules.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import StepCreateOrUpdateModal from './modals/StepCreateOrUpdateModal.tsx';
import ActionRenderer from './renderers/ActionRenderer.tsx';

interface StepCardBodyProps {
  step: z.infer<typeof serverScheduleStepSchema>;
  label: string;
  isActive: boolean;
  editable?: boolean;
  dragHandleProps?: ComponentProps<'button'>;
  openMenu?: (x: number, y: number) => void;
}

export function StepCardBody({ step, label, isActive, editable, dragHandleProps, openMenu }: StepCardBodyProps) {
  const { t } = useTranslations();

  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      onContextMenu={
        openMenu &&
        ((e) => {
          e.preventDefault();
          openMenu(e.clientX, e.clientY);
        })
      }
    >
      <Group justify='space-between' align='flex-start' wrap='nowrap' gap='xs'>
        <Group gap='sm' align='flex-start' wrap='nowrap' className='flex-1 min-w-0'>
          {editable && (
            <ActionIcon
              size='lg'
              variant='subtle'
              color='gray'
              aria-label={t('pages.server.schedules.step.aria.reorder', { step: label })}
              className='shrink-0'
              {...dragHandleProps}
            >
              <FontAwesomeIcon icon={faGripVertical} />
            </ActionIcon>
          )}

          <ThemeIcon size='lg' color={isActive ? 'blue' : 'gray'} className='shrink-0'>
            {isActive ? (
              <AnimatedHourglass />
            ) : (
              <FontAwesomeIcon icon={scheduleStepIconMapping[step.action.type] || faGear} />
            )}
          </ThemeIcon>

          <Stack gap={4} className='flex-1 min-w-0'>
            <Group gap='xs' wrap='nowrap'>
              <Text fw={600}>{label}</Text>
              {isActive && <Badge>{t('pages.server.schedules.view.badge.running', {})}</Badge>}
              {step.error && (
                <Tooltip label={step.error}>
                  <ThemeIcon size='sm' color='red' className='cursor-help'>
                    <FontAwesomeIcon icon={faExclamationTriangle} size='xs' />
                  </ThemeIcon>
                </Tooltip>
              )}
            </Group>
            <Text size='sm' c='dimmed'>
              <ActionRenderer action={step.action} mode='compact' />
            </Text>
          </Stack>
        </Group>

        <Group gap='xs' wrap='nowrap' className='shrink-0'>
          <ActionIcon
            size='input-sm'
            variant='subtle'
            color='gray'
            aria-expanded={expanded}
            aria-label={t(
              expanded ? 'pages.server.schedules.step.aria.collapse' : 'pages.server.schedules.step.aria.expand',
              { step: label },
            )}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((current) => !current);
            }}
          >
            <FontAwesomeIcon
              icon={faChevronDown}
              className={classNames(expanded ? 'rotate-0' : '-rotate-90', 'transition duration-200')}
            />
          </ActionIcon>

          {editable && (
            <ActionIcon
              size='input-sm'
              variant='light'
              color='gray'
              aria-label={t('pages.server.schedules.step.aria.actions', { step: label })}
              onClick={
                openMenu &&
                ((e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMenu(rect.left, rect.bottom);
                })
              }
            >
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      <Collapse expanded={expanded}>
        <Card p='sm' mt='sm'>
          <ActionRenderer action={step.action} mode='detailed' />
        </Card>
      </Collapse>
    </Card>
  );
}

interface Props {
  schedule: z.infer<typeof serverScheduleSchema>;
  step: z.infer<typeof serverScheduleStepSchema>;
  editable?: boolean;
  isActive?: boolean;
  dragHandleProps?: ComponentProps<'button'>;
  onStepUpdate?: (step: z.infer<typeof serverScheduleStepSchema>) => void;
  onStepDelete?: (stepUuid: string) => void;
  onStepDuplicate?: (step: z.infer<typeof serverScheduleStepSchema>) => void;
  onStepAddBranch?: (step: z.infer<typeof serverScheduleStepSchema>, type: 'else_if' | 'else') => void;
  canAddElse?: boolean;
  onStepToggle?: (open: boolean) => void;
}

export default function StepCard({
  schedule,
  step,
  editable = false,
  isActive = false,
  dragHandleProps,
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
        handleOpenModal(null);
        addToast(t('pages.server.schedules.toast.step.deleted', {}), 'success');
        onStepDelete?.(step.uuid);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doDuplicate = async () => {
    try {
      const duplicated = await duplicateScheduleStep(server.uuid, schedule.uuid, step.uuid);
      addToast(t('pages.server.schedules.toast.step.duplicated', {}), 'success');
      onStepDuplicate?.(duplicated);

      if (duplicated.action.type === 'if') {
        onStepDuplicate?.(
          await createScheduleStep(server.uuid, schedule.uuid, {
            order: duplicated.order + 1,
            action: { type: 'end_if' },
          }),
        );
      }
    } catch (msg) {
      addToast(httpErrorToHuman(msg), 'error');
    }
  };

  const isBranchStart = step.action.type === 'if' || step.action.type === 'else_if';
  const label = scheduleStepLabelMapping[step.action.type]();

  if (!editable) {
    return <StepCardBody step={step} label={label} isActive={isActive} />;
  }

  return (
    <>
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
        {t('pages.server.schedules.modal.deleteStep.content', { step: label })}
      </ConfirmationModal>

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
          <StepCardBody
            step={step}
            label={label}
            isActive={isActive}
            editable
            dragHandleProps={dragHandleProps}
            openMenu={openMenu}
          />
        )}
      </ContextMenu>
    </>
  );
}
