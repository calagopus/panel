import { faImage, faPlay, faReply } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Title } from '@mantine/core';
import debounce from 'debounce';
import { useCallback, useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import getVariables from '@/api/server/startup/getVariables.ts';
import updateCommand from '@/api/server/startup/updateCommand.ts';
import updateDockerImage from '@/api/server/startup/updateDockerImage.ts';
import updateVariables from '@/api/server/startup/updateVariables.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import VariableContainer from '@/elements/VariableContainer.tsx';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useKeyboardShortcut } from '@/plugins/useKeyboardShortcuts.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export default function ServerStartup() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { settings } = useGlobalStore();
  const { server, updateServer, variables, setVariables, updateVariable } = useServerStore();
  const canModifyVariables = useServerCan('startup.update');

  const [command, setCommand] = useState(server.startup);
  const [dockerImage, setDockerImage] = useState(server.image);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [variablesLoading, setVariablesLoading] = useState(true);
  const blocker = useBlocker(Object.keys(values).length > 0);

  const setDebouncedCommand = useCallback(
    debounce((command: string) => {
      updateCommand(server.uuid, command)
        .then(() => {
          addToast(t('pages.server.startup.toast.startupCommandUpdated', {}), 'success');
          updateServer({ startup: command });
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        });
    }, 500),
    [],
  );

  useEffect(() => {
    getVariables(server.uuid).then((data) => {
      setVariables(data);
      setVariablesLoading(false);
    });
  }, []);

  useEffect(() => {
    if (command !== server.startup) {
      setDebouncedCommand(command);
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
        });
    }
  }, [dockerImage]);

  const doUpdate = () => {
    setLoading(true);
    updateVariables(
      server.uuid,
      Object.entries(values).map(([envVariable, value]) => ({ envVariable, value })),
    )
      .then(() => {
        addToast(t('pages.server.startup.toast.variablesUpdated', {}), 'success');
        for (const [envVariable, value] of Object.entries(values)) {
          updateVariable(envVariable, { value });
        }

        setValues({});
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
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
        confirm={t('pages.server.startup.modal.unsavedChanges.button.leave', {})}
      >
        {t('pages.server.startup.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>

      <div className='flex flex-col md:grid md:grid-cols-3 gap-4 mt-2.5'>
        <TitleCard
          title={t('pages.server.startup.form.startupCommand', {})}
          icon={<FontAwesomeIcon icon={faPlay} />}
          className='col-span-2'
        >
          <TextArea
            withAsterisk
            placeholder={t('pages.server.startup.form.startupCommand', {})}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            readOnly={!useServerCan('startup.command') || !settings.server.allowEditingStartupCommand}
            autosize
            rightSection={
              <Tooltip label={t('common.tooltip.resetToDefault', {})}>
                <ActionIcon
                  variant='subtle'
                  hidden={!settings.server.allowEditingStartupCommand}
                  disabled={command === server.egg.startup}
                  onClick={() => setCommand(server.egg.startup)}
                >
                  <FontAwesomeIcon icon={faReply} />
                </ActionIcon>
              </Tooltip>
            }
          />
        </TitleCard>
        <TitleCard title={t('pages.server.startup.form.dockerImage', {})} icon={<FontAwesomeIcon icon={faImage} />}>
          <Select
            withAsterisk
            value={dockerImage}
            onChange={(value) => setDockerImage(value ?? '')}
            data={Object.entries(server.egg.dockerImages).map(([key, value]) => ({
              value,
              label: key,
            }))}
            searchable
            disabled={!useServerCan('startup.docker-image') || !settings.server.allowOverwritingCustomDockerImage}
          />
          <p className='text-gray-400 text-sm mt-4'>
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
        ) : variables.length === 0 ? (
          <p className='text-gray-400 col-span-full'>{t('pages.server.startup.noVariables', {})}</p>
        ) : null}
        {variables.map((variable) => (
          <VariableContainer
            key={variable.envVariable}
            variable={variable}
            loading={loading}
            disabled={!canModifyVariables}
            value={values[variable.envVariable] ?? variable.value ?? variable.defaultValue ?? ''}
            setValue={(value) => setValues((prev) => ({ ...prev, [variable.envVariable]: value }))}
          />
        ))}
      </div>
    </ServerContentContainer>
  );
}
