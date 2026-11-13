import { faDocker } from '@fortawesome/free-brands-svg-icons';
import { faPlay, faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import debounce from 'debounce';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getVariables from '@/api/server/startup/getVariables.ts';
import updateCommand from '@/api/server/startup/updateCommand.ts';
import updateDockerImage from '@/api/server/startup/updateDockerImage.ts';
import updateVariables from '@/api/server/startup/updateVariables.ts';
import Button from '@/elements/buttons/Button.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Title from '@/elements/typography/Title.tsx';
import VariableContainer from '@/elements/VariableContainer.tsx';
import { useKeyboardShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { trackActivity } from '@/stores/activity.ts';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';

const CUSTOM_COMMAND = '__custom__';

export default function ServerStartup() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const settings = useGlobalStore((state) => state.settings);
  const { server, updateServer, variables, setVariables, updateVariable } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      updateServer: state.updateServer,
      variables: state.variables,
      setVariables: state.setVariables,
      updateVariable: state.updateVariable,
    })),
  );
  const serverStoreApi = useServerStoreApi();
  const canModifyVariables = useServerCan('startup.update');
  const canModifyStartupCommand = useServerCan('startup.command');
  const canModifyDockerImage = useServerCan('startup.docker-image');

  const [command, setCommand] = useState(server.startup);
  const [customCommandSelected, setCustomCommandSelected] = useState(false);
  const [dockerImage, setDockerImage] = useState(server.image);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [variablesLoading, setVariablesLoading] = useState(true);
  const [variablesError, setVariablesError] = useState<unknown>(null);
  const [variableErrors, setVariableErrors] = useState<Record<string, string>>({});
  const blocker = useBlocker(Object.keys(values).length > 0);

  const setDebouncedCommand = useMemo(
    () =>
      debounce((command: string, revertOnError: boolean) => {
        updateCommand(server.uuid, command)
          .then(() => {
            addToast(t('pages.server.startup.toast.startupCommandUpdated', {}), 'success');
            updateServer({ startup: command });
          })
          .catch((msg) => {
            addToast(httpErrorToHuman(msg), 'error');
            if (revertOnError) {
              setCommand(serverStoreApi.getState().server.startup);
            }
          });
      }, 500),
    [server.uuid, t, addToast, updateServer],
  );

  const loadVariables = () => {
    setVariablesLoading(true);
    setVariablesError(null);

    trackActivity(getVariables(server.uuid))
      .then(setVariables)
      .catch(setVariablesError)
      .finally(() => setVariablesLoading(false));
  };

  useEffect(loadVariables, []);

  const isPredefinedCommand = (value: string) => Object.values(server.egg.startupCommands).includes(value);

  useEffect(() => {
    if (command !== server.startup) {
      setDebouncedCommand(command, isPredefinedCommand(command));
    }
  }, [command]);

  useEffect(() => {
    if (dockerImage !== server.image) {
      updateDockerImage(server.uuid, dockerImage)
        .then(() => {
          addToast(t('pages.server.startup.toast.dockerImageUpdated', {}), 'success');
          updateServer({ image: dockerImage });
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
          setDockerImage(server.image);
        });
    }
  }, [dockerImage]);

  const doUpdate = () => {
    const missing: Record<string, string> = {};
    for (const variable of variables) {
      if (
        variable.envVariable in values &&
        variable.rules.includes('required') &&
        values[variable.envVariable].trim() === ''
      ) {
        missing[variable.envVariable] = t('pages.server.startup.validation.required', {});
      }
    }

    setVariableErrors(missing);
    if (Object.keys(missing).length > 0) {
      return;
    }

    setLoading(true);
    updateVariables(
      server.uuid,
      Object.entries(values).map(([envVariable, value]) => ({
        envVariable,
        value,
      })),
    )
      .then(() => {
        addToast(t('pages.server.startup.toast.variablesUpdated', {}), 'success');
        for (const [envVariable, value] of Object.entries(values)) {
          updateVariable(envVariable, { value });
        }

        setValues({});
      })
      .catch((msg) => {
        const message = httpErrorToHuman(msg);
        const separator = message.indexOf(': ');
        const envVariable = separator > 0 ? message.slice(0, separator) : '';

        if (variables.some((variable) => variable.envVariable === envVariable)) {
          setVariableErrors({ [envVariable]: message.slice(separator + 2) });
        }
        addToast(message, 'error');
      })
      .finally(() => setLoading(false));
  };

  useKeyboardShortcut(
    's',
    () => {
      if (Object.keys(values).length > 0 && !loading) {
        doUpdate();
      }
    },
    {
      modifiers: ['ctrlOrMeta'],
      allowWhenInputFocused: true,
      deps: [values, loading],
    },
  );

  return (
    <ServerContentContainer
      title={t('pages.server.startup.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.server.startup.container}
    >
      <ConfirmationModal
        title={t('pages.server.startup.modal.unsavedChanges.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirmed={() => blocker.proceed()}
        confirm={t('common.button.leavePage', {})}
      >
        {t('pages.server.startup.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>

      <div className='flex flex-col md:grid md:grid-cols-3 gap-4 mt-2.5'>
        <TitleCard
          title={t('common.form.startupCommand', {})}
          icon={<FontAwesomeIcon icon={faPlay} />}
          className='col-span-2'
        >
          {Object.keys(server.egg.startupCommands).length > 0 && (
            <Select
              label={t('pages.server.startup.predefinedStartupCommands', {})}
              data={[
                ...((!server.eggConfiguration?.startupAllowCustomCommand &&
                  Object.values(server.egg.startupCommands).every((value) => value !== command)) ||
                server.eggConfiguration?.startupAllowCustomCommand
                  ? [{ label: t('common.custom', {}), value: CUSTOM_COMMAND }]
                  : []),
                ...Object.entries(server.egg.startupCommands).map(([key, value]) => ({
                  value,
                  label: key,
                })),
              ]}
              disabled={
                !canModifyStartupCommand ||
                (!server.eggConfiguration?.startupAllowCustomCommand &&
                  Object.values(server.egg.startupCommands).every((value) => value !== command))
              }
              value={customCommandSelected || !isPredefinedCommand(command) ? CUSTOM_COMMAND : command}
              onChange={(value) => {
                if (!value || value === CUSTOM_COMMAND) {
                  setCustomCommandSelected(true);
                  return;
                }

                setCustomCommandSelected(false);
                setCommand(value);
              }}
              mb='sm'
            />
          )}
          <TextArea
            withAsterisk
            placeholder={t('common.form.startupCommand', {})}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            readOnly={!canModifyStartupCommand || !server.eggConfiguration?.startupAllowCustomCommand}
            description={
              !canModifyStartupCommand
                ? t('pages.server.startup.startupCommandNoPermission', {})
                : !server.eggConfiguration?.startupAllowCustomCommand
                  ? t('pages.server.startup.startupCommandLocked', {})
                  : undefined
            }
            autosize
          />
        </TitleCard>
        <TitleCard title={t('common.form.dockerImage', {})} icon={<FontAwesomeIcon icon={faDocker} />}>
          <Select
            withAsterisk
            value={dockerImage}
            onChange={(value) => setDockerImage(value ?? '')}
            data={Object.entries(server.egg.dockerImages).map(([key, value]) => ({
              value,
              label: key,
            }))}
            searchable
            disabled={
              !canModifyDockerImage ||
              (!settings.server.allowOverwritingCustomDockerImage &&
                !Object.values(server.egg.dockerImages).includes(server.image))
            }
          />
          <p className='text-(--mantine-color-dimmed) text-sm mt-4'>
            {Object.values(server.egg.dockerImages).includes(server.image) ||
            settings.server.allowOverwritingCustomDockerImage
              ? t('pages.server.startup.dockerImageDescription', {})
              : t('pages.server.startup.dockerImageDescriptionCustom', {})}
          </p>
        </TitleCard>
      </div>

      <Group justify='space-between' my='md'>
        <Title order={2}>{t('pages.server.startup.variables', {})}</Title>
        <Group>
          <Button onClick={doUpdate} disabled={Object.keys(values).length === 0} loading={loading} color='blue'>
            {t('common.button.save', {})}
          </Button>
        </Group>
      </Group>

      <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4'>
        {variablesLoading ? (
          <Spinner.Centered className='col-span-full' />
        ) : variablesError ? (
          <div className='col-span-full'>
            <ErrorState error={httpErrorToHuman(variablesError)} onRetry={loadVariables} />
          </div>
        ) : variables.length === 0 ? (
          <div className='col-span-full'>
            <EmptyState
              icon={faSliders}
              title={t('pages.server.startup.empty.title', {})}
              description={t('pages.server.startup.empty.description', {})}
            />
          </div>
        ) : null}
        {!variablesLoading &&
          !variablesError &&
          variables.map((variable) => (
            <VariableContainer
              key={variable.envVariable}
              variable={variable}
              loading={loading}
              disabled={!canModifyVariables}
              value={values[variable.envVariable] ?? variable.value ?? variable.defaultValue ?? ''}
              error={variableErrors[variable.envVariable]}
              setValue={(value) => {
                setValues((prev) => ({ ...prev, [variable.envVariable]: value }));
                setVariableErrors((prev) => {
                  const next = { ...prev };
                  delete next[variable.envVariable];
                  return next;
                });
              }}
            />
          ))}
      </div>
    </ServerContentContainer>
  );
}
