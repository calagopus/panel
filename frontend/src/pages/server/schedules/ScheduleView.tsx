import {
  faChevronDown,
  faClock,
  faClockRotateLeft,
  faExclamationTriangle,
  faGear,
  faPencil,
  faPlay,
  faPlayCircle,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getSchedule from '@/api/server/schedules/getSchedule.ts';
import getScheduleSteps from '@/api/server/schedules/steps/getScheduleSteps.ts';
import triggerSchedule from '@/api/server/schedules/triggerSchedule.ts';
import updateSchedule from '@/api/server/schedules/updateSchedule.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Tabs from '@/elements/layout/Tabs.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Title from '@/elements/typography/Title.tsx';
import { serverScheduleConditionSchema } from '@/lib/schemas/server/schedules.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { trackActivity } from '@/stores/activity.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import ScheduleConditionBuilder from './forms/ScheduleConditionBuilder.tsx';
import ScheduleCreateOrUpdateModal from './modals/ScheduleCreateOrUpdateModal.tsx';
import DetailCard from './renderers/DetailCard.tsx';
import TriggerCard from './renderers/TriggerCard.tsx';
import StepCard from './StepCard.tsx';
import StepsEditor, { stepIndentStyle, stepIndents } from './StepsEditor.tsx';
import { analyzeScheduleVariables } from './variableAnalysis.ts';
import VariableIssueList from './VariableIssueList.tsx';

export default function ScheduleView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, schedule, setSchedule, runningScheduleSteps, scheduleSteps, setScheduleSteps } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      schedule: state.schedule,
      setSchedule: state.setSchedule,
      runningScheduleSteps: state.runningScheduleSteps,
      scheduleSteps: state.scheduleSteps,
      setScheduleSteps: state.setScheduleSteps,
    })),
  );

  const serverStoreApi = useServerStoreApi();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [conditionDraft, setConditionDraft] = useState<z.infer<typeof serverScheduleConditionSchema> | null>(null);
  const conditionsDirty = conditionDraft !== null;
  const canUpdate = useServerCan('schedules.update');
  const blocker = useBlocker(conditionsDirty);

  useEffect(() => {
    const interval = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const requestedId = useRef<string | null>(null);

  const load = () => {
    const id = params.id;
    if (!id) return;

    requestedId.current = id;
    setLoadError(null);

    trackActivity(Promise.all([getSchedule(server.uuid, id), getScheduleSteps(server.uuid, id)]))
      .then(([schedule, steps]) => {
        if (requestedId.current !== id) return;
        setSchedule(schedule);
        setScheduleSteps(steps);
        setLoadedId(id);
      })
      .catch((error) => {
        if (requestedId.current === id) setLoadError(error);
      });
  };

  useEffect(load, [params.id]);
  useEffect(() => setConditionDraft(null), [params.id]);

  const doTriggerSchedule = (skipCondition: boolean) => {
    if (params.id) {
      setLoading(true);

      triggerSchedule(server.uuid, params.id, skipCondition)
        .then(() => {
          addToast(t('pages.server.schedules.toast.triggered', {}), 'success');
        })
        .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
        .finally(() => setLoading(false));
    }
  };

  const doUpdate = () => {
    if (params.id) {
      setLoading(true);

      const condition = conditionDraft ?? schedule!.condition;
      const scheduleUuid = params.id;

      updateSchedule(server.uuid, scheduleUuid, { condition })
        .then(() => {
          addToast(t('pages.server.schedules.toast.updated', {}), 'success');
          const current = serverStoreApi.getState().schedule;
          if (current?.uuid === scheduleUuid) setSchedule({ ...current, condition });
          setConditionDraft(null);
        })
        .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
        .finally(() => setLoading(false));
    }
  };

  if (!schedule || loadedId !== params.id) {
    return (
      <div className='w-full'>
        <ResourceView resource={{ data: undefined, loading: !loadError, error: loadError, refetch: load }}>
          {() => null}
        </ResourceView>
      </div>
    );
  }

  const indents = stepIndents(scheduleSteps);
  const condition = conditionDraft ?? schedule.condition;
  const variableIssues = analyzeScheduleVariables({ ...schedule, condition }, scheduleSteps);

  return (
    <ServerContentContainer title={t('pages.server.schedules.title', {})} hideTitleComponent>
      <ScheduleCreateOrUpdateModal
        propSchedule={schedule}
        onScheduleUpdate={(s) => setSchedule({ ...schedule, ...s })}
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ConfirmationModal
        title={t('pages.server.schedules.modal.unsavedChanges.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirmed={() => blocker.proceed()}
        confirm={t('common.button.leavePage', {})}
      >
        {t('pages.server.schedules.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>

      <Stack gap='lg'>
        <Group justify='space-between'>
          <Group gap='md'>
            <Title order={1}>{schedule.name}</Title>
            <Badge color={schedule.enabled ? 'green' : 'red'} size='lg'>
              {schedule.enabled ? t('common.badge.active', {}) : t('common.badge.inactive', {})}
            </Badge>
          </Group>

          <ServerCan action='schedules.update'>
            <Group>
              {scheduleSteps.length > 0 && (
                <ContextMenu
                  items={[
                    {
                      type: 'action',
                      icon: faPlayCircle,
                      label: t('pages.server.schedules.button.runNowWithConditions', {}),
                      onClick: () => doTriggerSchedule(false),
                      color: 'gray',
                    },
                    {
                      type: 'action',
                      icon: faPlay,
                      label: t('pages.server.schedules.button.runNowIgnoreConditions', {}),
                      onClick: () => doTriggerSchedule(true),
                      color: 'gray',
                    },
                  ]}
                >
                  {({ openMenu }) =>
                    schedule.enabled ? (
                      <Button
                        loading={loading}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          openMenu(rect.left, rect.bottom);
                        }}
                        color='green'
                        rightSection={<FontAwesomeIcon icon={faChevronDown} />}
                      >
                        {t('pages.server.schedules.button.runNow', {})}
                      </Button>
                    ) : (
                      <Tooltip label={t('pages.server.schedules.view.tooltip.cannotRun', {})}>
                        <Button
                          disabled
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            openMenu(rect.left, rect.bottom);
                          }}
                          color='green'
                          rightSection={<FontAwesomeIcon icon={faChevronDown} />}
                        >
                          {t('pages.server.schedules.button.runNow', {})}
                        </Button>
                      </Tooltip>
                    )
                  }
                </ContextMenu>
              )}
              <Button
                onClick={() => setSettingsOpen(true)}
                color='blue'
                leftSection={<FontAwesomeIcon icon={faPencil} />}
              >
                {t('common.button.edit', {})}
              </Button>
            </Group>
          </ServerCan>
        </Group>

        <div className='flex flex-col md:flex-row gap-2'>
          <DetailCard
            icon={<FontAwesomeIcon icon={faClockRotateLeft} />}
            label={t('pages.server.schedules.table.columns.lastRun', {})}
            value={schedule.lastRun ? <FormattedTimestamp timestamp={schedule.lastRun} /> : t('common.never', {})}
            color='blue'
          />
          <DetailCard
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            label={t('pages.server.schedules.table.columns.lastFailure', {})}
            value={
              schedule.lastFailure ? <FormattedTimestamp timestamp={schedule.lastFailure} /> : t('common.never', {})
            }
            color={schedule.lastFailure ? 'red' : 'green'}
          />
        </div>

        <Tabs defaultValue='actions'>
          <Tabs.List>
            <Tabs.Tab value='actions'>{t('pages.server.schedules.view.tabs.actions', {})}</Tabs.Tab>
            <Tabs.Tab value='conditions'>{t('pages.server.schedules.view.tabs.conditions', {})}</Tabs.Tab>
            <Tabs.Tab value='triggers'>{t('pages.server.schedules.view.tabs.triggers', {})}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value='actions' pt='md'>
            <Title order={2} mb='md'>
              {t('pages.server.schedules.view.sections.actions', {})}
            </Title>

            {canUpdate ? (
              <StepsEditor schedule={schedule} />
            ) : scheduleSteps.length === 0 ? (
              <EmptyState
                icon={faGear}
                title={t('pages.server.schedules.steps.empty.title', {})}
                description={t('pages.server.schedules.steps.empty.descriptionReadOnly', {})}
              />
            ) : (
              <Stack gap='md'>
                {scheduleSteps.map((step, index) => (
                  <div key={step.uuid} style={stepIndentStyle(indents[index])}>
                    <StepCard
                      schedule={schedule}
                      step={step}
                      isActive={step.uuid === runningScheduleSteps.get(schedule.uuid)}
                      variableIssues={variableIssues.steps.get(step.uuid)}
                    />
                  </div>
                ))}
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value='conditions' pt='md'>
            <Title order={2} mb='md'>
              {t('pages.server.schedules.view.sections.preConditions', {})}
            </Title>

            <ScheduleConditionBuilder condition={condition} onChange={setConditionDraft} />

            {variableIssues.condition.length > 0 && (
              <Alert icon={<FontAwesomeIcon icon={faExclamationTriangle} />} color='yellow' mt='md'>
                <VariableIssueList issues={variableIssues.condition} />
              </Alert>
            )}

            <ServerCan action='schedules.update'>
              <div className='flex flex-row mt-4'>
                <Button
                  loading={loading}
                  disabled={!conditionsDirty || !serverScheduleConditionSchema.safeParse(condition).success}
                  onClick={doUpdate}
                >
                  {t('common.button.update', {})}
                </Button>
              </div>
            </ServerCan>
          </Tabs.Panel>

          <Tabs.Panel value='triggers' pt='md'>
            <Title order={2} mb='md'>
              {t('pages.server.schedules.view.sections.triggers', {})}
            </Title>

            {schedule.triggers.length === 0 ? (
              <EmptyState
                icon={faClock}
                title={t('pages.server.schedules.view.empty.triggers.title', {})}
                description={
                  canUpdate
                    ? t('pages.server.schedules.view.empty.triggers.description', {})
                    : t('pages.server.schedules.view.empty.triggers.descriptionReadOnly', {})
                }
              >
                {canUpdate && (
                  <Button onClick={() => setSettingsOpen(true)} leftSection={<FontAwesomeIcon icon={faPencil} />}>
                    {t('common.button.edit', {})}
                  </Button>
                )}
              </EmptyState>
            ) : (
              <Stack gap='md'>
                {schedule.triggers.map((trigger, index) => (
                  <TriggerCard key={index} date={date} timezone={server.timezone || 'UTC'} trigger={trigger} />
                ))}
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </ServerContentContainer>
  );
}
