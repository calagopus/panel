import { arrayMove } from '@dnd-kit/sortable';
import { faExclamationTriangle, faGear, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { memo, startTransition, useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createScheduleStep from '@/api/server/schedules/steps/createScheduleStep.ts';
import updateScheduleStepsOrder from '@/api/server/schedules/steps/updateScheduleStepsOrder.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { DndContainer, DndItem, SortableItem } from '@/elements/DragAndDrop.tsx';
import Group from '@/elements/Group.tsx';
import Paper from '@/elements/Paper.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import ThemeIcon from '@/elements/ThemeIcon.tsx';
import Title from '@/elements/Title.tsx';
import { scheduleStepDefaultMapping } from '@/lib/enums.ts';
import { serverScheduleSchema, serverScheduleStepSchema } from '@/lib/schemas/server/schedules.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import StepCreateOrUpdateModal from './modals/StepCreateOrUpdateModal.tsx';
import StepCard from './StepCard.tsx';

interface DndScheduleStep extends z.infer<typeof serverScheduleStepSchema>, DndItem {
  id: string;
}

const MemoizedStepCard = memo(StepCard);

const maxStepIndent = 8;

export function stepIndents(steps: z.infer<typeof serverScheduleStepSchema>[]): number[] {
  let depth = 0;

  return steps.map((step) => {
    const type = step.action.type;
    const indent = type === 'else_if' || type === 'else' || type === 'end_if' ? Math.max(depth - 1, 0) : depth;

    if (type === 'if') depth = Math.min(depth + 1, maxStepIndent);
    else if (type === 'end_if') depth = Math.max(depth - 1, 0);

    return indent;
  });
}

function stepBlockIssues(steps: z.infer<typeof serverScheduleStepSchema>[]): {
  unclosedIf: boolean;
  orphanBranch: boolean;
} {
  let depth = 0;
  let orphanBranch = false;

  for (const step of steps) {
    const type = step.action.type;

    if (type === 'if') depth++;
    else if (type === 'end_if') {
      if (depth === 0) orphanBranch = true;
      else depth--;
    } else if ((type === 'else' || type === 'else_if') && depth === 0) orphanBranch = true;
  }

  return { unclosedIf: depth > 0, orphanBranch };
}

export default function StepsEditor({ schedule }: { schedule: z.infer<typeof serverScheduleSchema> }) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const scheduleSteps = useServerStore((state) => state.scheduleSteps);
  const setScheduleSteps = useServerStore((state) => state.setScheduleSteps);
  const storeApi = useServerStoreApi();
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'edit' | 'create' | null>(null);
  const [childModalOpen, setChildModalOpen] = useState(false);
  const [dragProjection, setDragProjection] = useState<{ activeId: string; overId: string } | null>(null);

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
      setScheduleSteps([...storeApi.getState().scheduleSteps, step]);
    },
    [storeApi, setScheduleSteps],
  );

  const handleStepAddBranch = useCallback(
    async (step: z.infer<typeof serverScheduleStepSchema>, type: 'else_if' | 'else') => {
      const steps = [...storeApi.getState().scheduleSteps].sort((a, b) => a.order - b.order);
      const startIndex = steps.findIndex((s) => s.uuid === step.uuid);
      if (startIndex === -1) return;

      let insertIndex = steps.length;
      let depth = 0;
      for (let i = startIndex + 1; i < steps.length; i++) {
        const actionType = steps[i].action.type;

        if (actionType === 'if') depth++;
        else if (actionType === 'end_if') {
          if (depth === 0) {
            insertIndex = i;
            break;
          }
          depth--;
        } else if (depth === 0 && type === 'else_if' && (actionType === 'else_if' || actionType === 'else')) {
          insertIndex = i;
          break;
        }
      }

      try {
        const created = await createScheduleStep(server.uuid, schedule.uuid, {
          order: insertIndex + 1,
          action: scheduleStepDefaultMapping[type],
        });

        const reordered = [...steps.slice(0, insertIndex), created, ...steps.slice(insertIndex)].map((s, index) => ({
          ...s,
          order: index + 1,
        }));
        setScheduleSteps(reordered);
        addToast(t('pages.server.schedules.toast.step.created', {}), 'success');

        await updateScheduleStepsOrder(
          server.uuid,
          schedule.uuid,
          reordered.map((s) => s.uuid),
        );
      } catch (err) {
        addToast(httpErrorToHuman(err), 'error');
      }
    },
    [server.uuid, schedule.uuid, storeApi, setScheduleSteps, addToast, t],
  );

  const handleDragOver = useCallback((activeId: string, overId: string | null) => {
    setDragProjection(overId && overId !== activeId ? { activeId, overId } : null);
  }, []);

  const handleDragCancel = useCallback(() => {
    setDragProjection(null);
  }, []);

  const handleDragEnd = useCallback(
    async (reorderedSteps: DndScheduleStep[]) => {
      setDragProjection(null);

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
  const blockIssues = useMemo(() => stepBlockIssues(sortedSteps), [sortedSteps]);

  const canAddElseMap = useMemo(() => {
    const map = new Map<string, boolean>();

    sortedSteps.forEach((step, index) => {
      if (step.action.type !== 'if' && step.action.type !== 'else_if') return;

      let depth = 0;
      let hasElse = false;
      for (let i = index + 1; i < sortedSteps.length; i++) {
        const type = sortedSteps[i].action.type;

        if (type === 'if') depth++;
        else if (type === 'end_if') {
          if (depth === 0) break;
          depth--;
        } else if (type === 'else' && depth === 0) {
          hasElse = true;
          break;
        }
      }

      map.set(step.uuid, !hasElse);
    });

    return map;
  }, [sortedSteps]);

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
          <DndContainer
            items={dndSteps}
            callbacks={{ onDragEnd: handleDragEnd, onDragOver: handleDragOver, onDragCancel: handleDragCancel }}
            renderOverlay={renderOverlay}
          >
            {(items) => {
              let projectedItems = items;
              if (dragProjection) {
                const fromIndex = items.findIndex((item) => item.id === dragProjection.activeId);
                const toIndex = items.findIndex((item) => item.id === dragProjection.overId);

                if (fromIndex !== -1 && toIndex !== -1) {
                  projectedItems = arrayMove(items, fromIndex, toIndex);
                }
              }

              const projectedIndents = stepIndents(projectedItems);
              const indents = new Map(projectedItems.map((item, index) => [item.id, projectedIndents[index]]));

              return (
                <Stack gap='md'>
                  {items.map((step) => (
                    <SortableItem
                      key={step.id}
                      id={step.id}
                      disabled={openModal !== null || childModalOpen}
                      renderItem={({ dragHandleProps }) => (
                        <div
                          {...dragHandleProps}
                          style={{
                            ...dragHandleProps.style,
                            marginLeft: (indents.get(step.id) ?? 0) * 28,
                            transition: 'margin-left 150ms ease',
                          }}
                        >
                          <MemoizedStepCard
                            onStepToggle={setChildModalOpen}
                            schedule={schedule}
                            step={step}
                            onStepUpdate={handleStepUpdate}
                            onStepDelete={handleStepDelete}
                            onStepDuplicate={handleStepCreate}
                            onStepAddBranch={handleStepAddBranch}
                            canAddElse={canAddElseMap.get(step.id) ?? false}
                          />
                        </div>
                      )}
                    />
                  ))}
                </Stack>
              );
            }}
          </DndContainer>
        )}

        {(blockIssues.unclosedIf || blockIssues.orphanBranch) && (
          <Alert icon={<FontAwesomeIcon icon={faExclamationTriangle} />} color='yellow'>
            <Stack gap={4}>
              {blockIssues.unclosedIf && <span>{t('pages.server.schedules.steps.warning.unclosedIf', {})}</span>}
              {blockIssues.orphanBranch && <span>{t('pages.server.schedules.steps.warning.orphanBranch', {})}</span>}
            </Stack>
          </Alert>
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
