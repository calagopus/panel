import {
  faChevronDown,
  faClockRotateLeft,
  faExclamationTriangle,
  faPencil,
  faPlay,
  faPlayCircle,
  faReply,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import getSchedule from '@/api/server/schedules/getSchedule.ts';
import getScheduleSteps from '@/api/server/schedules/steps/getScheduleSteps.ts';
import triggerSchedule from '@/api/server/schedules/triggerSchedule.ts';
import updateSchedule from '@/api/server/schedules/updateSchedule.ts';
import Alert from '@/elements/Alert.tsx';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Tabs from '@/elements/Tabs.tsx';
import Timeline from '@/elements/Timeline.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ScheduleCreateOrUpdateModal from './modals/ScheduleCreateOrUpdateModal.tsx';
import ActionStep from './renderers/ActionStep.tsx';
import DetailCard from './renderers/DetailCard.tsx';
import TriggerCard from './renderers/TriggerCard.tsx';
import SchedulePreConditionBuilder from './SchedulePreConditionBuilder.tsx';
import StepsEditor from './StepsEditor.tsx';

export default function ScheduleView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, schedule, setSchedule, runningScheduleSteps, scheduleSteps, setScheduleSteps } = useServerStore();

  const [openModal, setOpenModal] = useState<'actions' | 'update' | null>(null);
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [conditionsDirty, setConditionsDirty] = useState(false);
  const canUpdate = useServerCan('schedules.update');
  const blocker = useBlocker(conditionsDirty);

  useEffect(() => {
    const interval = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (params.id) {
      getSchedule(server.uuid, params.id).then(setSchedule);
      getScheduleSteps(server.uuid, params.id).then((steps) => {
        setScheduleSteps(steps);

        if (steps.length === 0 && canUpdate) {
          setOpenModal('actions');
        }
      });
    }
  }, [params.id]);

  const doTriggerSchedule = (skipCondition: boolean) => {
    if (params.id) {
      setLoading(true);

      triggerSchedule(server.uuid, params.id, skipCondition)
        .then(() => {
          addToast(t('pages.server.schedules.toast.triggered', {}), 'success');
        })
        .finally(() => setLoading(false));
    }
  };

  const doUpdate = () => {
    if (params.id) {
      setLoading(true);

      updateSchedule(server.uuid, params.id, { condition: schedule!.condition })
        .then(() => {
          addToast(t('pages.server.schedules.toast.updated', {}), 'success');
          setConditionsDirty(false);
        })
        .finally(() => setLoading(false));
    }
  };

  if (!schedule || !scheduleSteps) {
    return (
      <div className='w-full'>
        <Spinner.Centered />
      </div>
    );
  }

  return (
    <ServerContentContainer title={t('pages.server.schedules.title', {})} hideTitleComponent>
      <ScheduleCreateOrUpdateModal
        propSchedule={schedule}
        onScheduleUpdate={(s) => setSchedule({ ...schedule, ...s })}
        opened={openModal === 'update'}
        onClose={() => setOpenModal(null)}
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
                      icon: faPlayCircle,
                      label: t('pages.server.schedules.button.runNowWithConditions', {}),
                      onClick: () => doTriggerSchedule(false),
                      color: 'gray',
                    },
                    {
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
                onClick={() => setOpenModal('update')}
                color='blue'
                leftSection={<FontAwesomeIcon icon={faPencil} />}
              >
                {t('common.button.edit', {})}
              </Button>
            </Group>
          </ServerCan>
        </Group>

        <div className='flex flex-row space-x-2'>
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
            <Group justify='space-between' align='start'>
              <Title order={2} mb='md'>
                {t('pages.server.schedules.view.sections.actions', {})}
              </Title>
              <ServerCan action='schedules.update'>
                <Button
                  onClick={() => setOpenModal(openModal === 'actions' ? null : 'actions')}
                  variant='outline'
                  leftSection={<FontAwesomeIcon icon={openModal === 'actions' ? faReply : faPencil} />}
                >
                  {openModal === 'actions'
                    ? t('pages.server.schedules.button.exitEditor', {})
                    : t('common.button.edit', {})}
                </Button>
              </ServerCan>
            </Group>

            {openModal === 'actions' ? (
              <StepsEditor schedule={schedule} />
            ) : scheduleSteps.length === 0 ? (
              <Alert icon={<FontAwesomeIcon icon={faExclamationTriangle} />} color='yellow'>
                <Group justify='space-between'>
                  {t('pages.server.schedules.view.alert.noActions', {})}
                  <ServerCan action='schedules.update'>
                    <Button size='xs' variant='light' onClick={() => setOpenModal('actions')}>
                      {t('pages.server.schedules.button.addStep', {})}
                    </Button>
                  </ServerCan>
                </Group>
              </Alert>
            ) : (
              <Timeline
                active={scheduleSteps.findIndex((step) => step.uuid === runningScheduleSteps.get(schedule.uuid)) ?? -1}
                color='blue'
                bulletSize={40}
                lineWidth={2}
              >
                {scheduleSteps.map((step) => (
                  <ActionStep
                    key={step.uuid}
                    step={step}
                    isActive={step.uuid === runningScheduleSteps.get(schedule.uuid)}
                  />
                ))}
              </Timeline>
            )}
          </Tabs.Panel>

          <Tabs.Panel value='conditions' pt='md'>
            <Title order={2} mb='md'>
              {t('pages.server.schedules.view.sections.preConditions', {})}
            </Title>

            <SchedulePreConditionBuilder
              condition={schedule.condition}
              onChange={(condition) => {
                setSchedule({ ...schedule, condition });
                setConditionsDirty(true);
              }}
            />

            <ServerCan action='schedules.update'>
              <div className='flex flex-row mt-4'>
                <Button loading={loading} disabled={!conditionsDirty} onClick={doUpdate}>
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
              <Alert icon={<FontAwesomeIcon icon={faExclamationTriangle} />} color='yellow'>
                {t('pages.server.schedules.view.alert.noTriggers', {})}
              </Alert>
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
