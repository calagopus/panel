import { faGear, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { memo, startTransition, useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateScheduleStepsOrder from '@/api/server/schedules/steps/updateScheduleStepsOrder.ts';
import Button from '@/elements/Button.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { serverScheduleSchema, serverScheduleStepSchema } from '@/lib/schemas/server/schedules.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import StepCreateOrUpdateModal from './modals/StepCreateOrUpdateModal.tsx';
import StepCard from './StepCard.tsx';

interface DndScheduleStep extends z.infer<typeof serverScheduleStepSchema>, DndItem {
  id: string;
}

const MemoizedStepCard = memo(StepCard);

export default function StepsEditor({ schedule }: { schedule: z.infer<typeof serverScheduleSchema> }) {
  const { t } = useTranslations();
  const { server, scheduleSteps, setScheduleSteps } = useServerStore();
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'edit' | 'create' | null>(null);
  const [childModalOpen, setChildModalOpen] = useState(false);

  const nextStepOrder = useMemo(
    () =>
      Number.isFinite(Math.max(...scheduleSteps.map((s) => s.order)))
        ? Math.max(...scheduleSteps.map((s) => s.order))
        : 1,
    [scheduleSteps],
  );

  const handleStepUpdate = useCallback(
    (updatedStep: z.infer<typeof serverScheduleStepSchema>) => {
      setScheduleSteps(scheduleSteps.map((s) => (s.uuid === updatedStep.uuid ? updatedStep : s)));
    },
    [scheduleSteps, setScheduleSteps],
  );

  const handleStepDelete = useCallback(
    (stepUuid: string) => {
      setScheduleSteps(scheduleSteps.filter((step) => step.uuid !== stepUuid));
    },
    [scheduleSteps, setScheduleSteps],
  );

  const handleStepCreate = useCallback(
    (step: z.infer<typeof serverScheduleStepSchema>) => {
      setScheduleSteps([...scheduleSteps, step]);
    },
    [scheduleSteps, setScheduleSteps],
  );

  const handleDragEnd = useCallback(
    async (reorderedSteps: DndScheduleStep[]) => {
      const stepsWithNewOrder = reorderedSteps.map((step, index) => ({
        ...step,
        order: index + 1,
      }));

      startTransition(() => {
        setScheduleSteps(stepsWithNewOrder);
      });

      await updateScheduleStepsOrder(
        server.uuid,
        schedule.uuid,
        reorderedSteps.map((s) => s.uuid),
      ).catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
        setScheduleSteps(scheduleSteps);
      });
    },
    [server.uuid, schedule.uuid, scheduleSteps, setScheduleSteps, addToast],
  );

  const sortedSteps = useMemo(() => [...scheduleSteps].sort((a, b) => a.order - b.order), [scheduleSteps]);

  const dndSteps: DndScheduleStep[] = useMemo(
    () =>
      sortedSteps.map((step) => ({
        ...step,
        id: step.uuid,
      })),
    [sortedSteps],
  );

  const renderOverlay = useCallback(
    (activeStep: DndScheduleStep | null) =>
      activeStep ? (
        <div style={{ cursor: 'grabbing' }}>
          <MemoizedStepCard
            schedule={schedule}
            step={activeStep}
            onStepUpdate={handleStepUpdate}
            onStepDelete={handleStepDelete}
          />
        </div>
      ) : null,
    [schedule, handleStepUpdate, handleStepDelete],
  );

  if (!schedule || !scheduleSteps) {
    return (
      <div className='w-full'>
        <Spinner.Centered />
      </div>
    );
  }

  return (
    <>
      <StepCreateOrUpdateModal
        opened={openModal === 'create'}
        onClose={() => setOpenModal(null)}
        schedule={schedule}
        nextStepOrder={nextStepOrder}
        onStepCreate={handleStepCreate}
      />

      <Stack>
        {sortedSteps.length === 0 ? (
          <Paper withBorder p='xl' radius='md' style={{ textAlign: 'center' }}>
            <ThemeIcon size='xl' mb='md' color='gray'>
              <FontAwesomeIcon icon={faGear} />
            </ThemeIcon>
            <Title order={3} c='dimmed' mb='sm'>
              {t('pages.server.schedules.steps.empty.title', {})}
            </Title>
            <Text c='dimmed' mb='md'>
              {t('pages.server.schedules.steps.empty.description', {})}
            </Text>
            <Button onClick={() => setOpenModal('create')} leftSection={<FontAwesomeIcon icon={faPlus} />}>
              {t('pages.server.schedules.button.createFirstStep', {})}
            </Button>
          </Paper>
        ) : (
          <DndContainer items={dndSteps} callbacks={{ onDragEnd: handleDragEnd }} renderOverlay={renderOverlay}>
            {(items) => (
              <Stack gap='md'>
                {items.map((step) => (
                  <SortableItem
                    key={step.id}
                    id={step.id}
                    disabled={openModal !== null || childModalOpen}
                    renderItem={({ dragHandleProps }) => (
                      <div {...dragHandleProps}>
                        <MemoizedStepCard
                          onStepToggle={setChildModalOpen}
                          schedule={schedule}
                          step={step}
                          onStepUpdate={handleStepUpdate}
                          onStepDelete={handleStepDelete}
                        />
                      </div>
                    )}
                  />
                ))}
              </Stack>
            )}
          </DndContainer>
        )}

        {sortedSteps.length > 0 && (
          <Group justify='center'>
            <Button onClick={() => setOpenModal('create')} leftSection={<FontAwesomeIcon icon={faPlus} />}>
              {t('pages.server.schedules.button.addStep', {})}
            </Button>
          </Group>
        )}
      </Stack>
    </>
  );
}
