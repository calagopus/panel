import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { serverScheduleStepActionSchema } from '@/lib/schemas/server/schedules.ts';
import { formatMilliseconds } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterRenderer from '../ScheduleDynamicParameterRenderer.tsx';

type ActionRendererMode = 'compact' | 'detailed';
type Action = z.infer<typeof serverScheduleStepActionSchema>;
type Translations = ReturnType<typeof useTranslations>;

function renderCompact(action: Action, { t, tReact, tItem }: Translations): React.ReactNode {
  switch (action.type) {
    case 'sleep':
      return <span>{t('pages.server.schedules.steps.sleep.renderer.compact', { duration: action.duration })}</span>;
    case 'ensure':
      return <span>{t('pages.server.schedules.steps.ensure.renderer.compact', {})}</span>;
    case 'if':
      return <span>{t('pages.server.schedules.steps.if.renderer.compact', {})}</span>;
    case 'else_if':
      return <span>{t('pages.server.schedules.steps.elseIf.renderer.compact', {})}</span>;
    case 'else':
      return <span>{t('pages.server.schedules.steps.else.renderer.compact', {})}</span>;
    case 'end_if':
      return <span>{t('pages.server.schedules.steps.endIf.renderer.compact', {})}</span>;
    case 'exit':
      return (
        <span>
          {t('pages.server.schedules.steps.exit.renderer.compact', {
            successful: t(action.successful ? 'common.badge.successful' : 'common.badge.failed', {}),
          })}
        </span>
      );
    case 'wait_for_state':
      return (
        <span>
          {t('pages.server.schedules.steps.waitForState.renderer.compact', {
            timeout: formatMilliseconds(action.timeout),
            state: t(`common.enum.serverState.${action.state}`, {}),
          })}
        </span>
      );
    case 'format':
      return (
        <span>
          {tReact('pages.server.schedules.steps.format.renderer.compact', {
            outputInto: <ScheduleDynamicParameterRenderer value={action.outputInto} />,
          })}
        </span>
      );
    case 'match_regex':
      return (
        <span>
          {tReact('pages.server.schedules.steps.matchRegex.renderer.compact', {
            input: <ScheduleDynamicParameterRenderer value={action.input} />,
            regex: <Code>{action.regex}</Code>,
          })}
        </span>
      );
    case 'wait_for_console_line':
      return (
        <span>
          {tReact('pages.server.schedules.steps.waitForConsoleLine.renderer.compact', {
            timeout: formatMilliseconds(action.timeout),
            contains: <ScheduleDynamicParameterRenderer value={action.contains} />,
          })}
        </span>
      );
    case 'send_power':
      return <span>{t('pages.server.schedules.steps.sendPower.renderer.compact', { action: action.action })}</span>;
    case 'send_command':
      return (
        <span>
          {tReact('pages.server.schedules.steps.sendCommand.renderer.compact', {
            command: <ScheduleDynamicParameterRenderer value={action.command} />,
          })}
        </span>
      );
    case 'create_backup':
      return !action.name ? (
        <span>{t('pages.server.schedules.steps.createBackup.renderer.compactAuto', {})}</span>
      ) : (
        <span>
          {tReact('pages.server.schedules.steps.createBackup.renderer.compact', {
            name: <ScheduleDynamicParameterRenderer value={action.name} />,
          })}
        </span>
      );
    case 'restore_backup':
      return action.backup.mode === 'latest' ? (
        <span>{t('pages.server.schedules.steps.restoreBackup.renderer.compactLatest', {})}</span>
      ) : (
        <span>
          {tReact('pages.server.schedules.steps.restoreBackup.renderer.compact', {
            backup: (
              <ScheduleDynamicParameterRenderer
                value={action.backup.mode === 'uuid' ? action.backup.uuid : action.backup.name}
              />
            ),
          })}
        </span>
      );
    case 'create_directory':
      return (
        <span>
          {tReact('pages.server.schedules.steps.createDirectory.renderer.compact', {
            name: <ScheduleDynamicParameterRenderer value={action.name} />,
            root: <ScheduleDynamicParameterRenderer value={action.root} />,
          })}
        </span>
      );
    case 'write_file':
      return (
        <span>
          {tReact('pages.server.schedules.steps.writeFile.renderer.compact', {
            file: <ScheduleDynamicParameterRenderer value={action.file} />,
          })}
        </span>
      );
    case 'copy_file':
      return (
        <span>
          {tReact('pages.server.schedules.steps.copyFile.renderer.compact', {
            file: <ScheduleDynamicParameterRenderer value={action.file} />,
            destination: <ScheduleDynamicParameterRenderer value={action.destination} />,
          })}
        </span>
      );
    case 'delete_files':
      return (
        <span>
          {tReact('pages.server.schedules.steps.deleteFiles.renderer.compact', {
            files: <Code>{action.files.join(', ')}</Code>,
          })}
        </span>
      );
    case 'rename_files':
      return (
        <span>
          {t('pages.server.schedules.steps.renameFiles.renderer.compact', {
            files: tItem('file', action.files.length),
          })}
        </span>
      );
    case 'compress_files':
      return (
        <span>
          {tReact('pages.server.schedules.steps.compressFiles.renderer.compact', {
            files: tItem('file', action.files.length),
            root: <ScheduleDynamicParameterRenderer value={action.root} />,
            name: <ScheduleDynamicParameterRenderer value={action.name} />,
          })}
        </span>
      );
    case 'decompress_file':
      return (
        <span>
          {tReact('pages.server.schedules.steps.decompressFile.renderer.compact', {
            file: <ScheduleDynamicParameterRenderer value={action.file} />,
            root: <ScheduleDynamicParameterRenderer value={action.root} />,
          })}
        </span>
      );
    case 'update_startup_variable':
      return (
        <span>
          {tReact('pages.server.schedules.steps.updateStartupVariable.renderer.compact', {
            variable: <ScheduleDynamicParameterRenderer value={action.envVariable} />,
            value: <ScheduleDynamicParameterRenderer value={action.value} />,
          })}
        </span>
      );
    case 'update_startup_command':
      return (
        <span>
          {tReact('pages.server.schedules.steps.updateStartupCommand.renderer.compact', {
            command: <ScheduleDynamicParameterRenderer value={action.command} />,
          })}
        </span>
      );
    case 'update_startup_docker_image':
      return (
        <span>
          {tReact('pages.server.schedules.steps.updateStartupDockerImage.renderer.compact', {
            image: <ScheduleDynamicParameterRenderer value={action.image} />,
          })}
        </span>
      );
    default:
      return <span>{t('pages.server.schedules.renderer.noActionSelected', {})}</span>;
  }
}

function renderDetailed(action: Action, { t, tReact, tItem }: Translations): React.ReactNode {
  const yesNo = (val: boolean) => t(val ? 'common.yes' : 'common.no', {});

  switch (action.type) {
    case 'sleep':
      return (
        <Text size='sm'>{t('pages.server.schedules.steps.sleep.renderer.compact', { duration: action.duration })}</Text>
      );
    case 'ensure':
      return <Text size='sm'>{t('pages.server.schedules.steps.ensure.renderer.compact', {})}</Text>;
    case 'if':
      return <Text size='sm'>{t('pages.server.schedules.steps.if.renderer.compact', {})}</Text>;
    case 'else_if':
      return <Text size='sm'>{t('pages.server.schedules.steps.elseIf.renderer.compact', {})}</Text>;
    case 'else':
      return <Text size='sm'>{t('pages.server.schedules.steps.else.renderer.compact', {})}</Text>;
    case 'end_if':
      return <Text size='sm'>{t('pages.server.schedules.steps.endIf.renderer.compact', {})}</Text>;
    case 'exit':
      return (
        <Text size='sm'>
          {t('pages.server.schedules.steps.exit.renderer.compact', {
            successful: t(action.successful ? 'common.badge.successful' : 'common.badge.failed', {}),
          })}
        </Text>
      );
    case 'wait_for_state':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {t('pages.server.schedules.steps.waitForState.renderer.compact', {
              timeout: formatMilliseconds(action.timeout),
              state: t(`common.enum.serverState.${action.state}`, {}),
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'format':
      return (
        <Text size='sm'>
          {tReact('pages.server.schedules.steps.format.renderer.compact', {
            outputInto: <ScheduleDynamicParameterRenderer value={action.outputInto} />,
          })}
        </Text>
      );
    case 'match_regex':
      return (
        <Text size='sm'>
          {tReact('pages.server.schedules.steps.matchRegex.renderer.compact', {
            input: <ScheduleDynamicParameterRenderer value={action.input} />,
            regex: <Code>{action.regex}</Code>,
          })}
        </Text>
      );
    case 'wait_for_console_line':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.waitForConsoleLine.renderer.detail.lineContains', {
              contains: <ScheduleDynamicParameterRenderer value={action.contains} />,
            })}
          </Text>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.waitForConsoleLine.renderer.detail.timeout', {
              timeout: <Code>{action.timeout}ms</Code>,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.waitForConsoleLine.renderer.detail.caseInsensitive', {
              value: yesNo(action.caseInsensitive),
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'send_power':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.sendPower.renderer.detail.powerAction', {
              action: <Code>{action.action}</Code>,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'send_command':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.sendCommand.renderer.detail.command', {
              command: <ScheduleDynamicParameterRenderer value={action.command} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'create_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {!action.name
              ? t('pages.server.schedules.steps.createBackup.renderer.detail.backupNameAuto', {})
              : tReact('pages.server.schedules.steps.createBackup.renderer.detail.backupName', {
                  name: <ScheduleDynamicParameterRenderer value={action.name} />,
                })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.foreground', { value: yesNo(action.foreground) })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
          {action.ignoredFiles.length > 0 && (
            <Text size='xs' c='dimmed'>
              {t('pages.server.schedules.steps.createBackup.renderer.detail.ignoredFiles', {
                files: action.ignoredFiles.join(', '),
              })}
            </Text>
          )}
        </Stack>
      );
    case 'restore_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {action.backup.mode === 'latest'
              ? t('pages.server.schedules.steps.restoreBackup.renderer.detail.backupLatest', {})
              : action.backup.mode === 'uuid'
                ? tReact('pages.server.schedules.steps.restoreBackup.renderer.detail.backupUuid', {
                    uuid: <ScheduleDynamicParameterRenderer value={action.backup.uuid} />,
                  })
                : tReact('pages.server.schedules.steps.restoreBackup.renderer.detail.backupName', {
                    name: <ScheduleDynamicParameterRenderer value={action.backup.name} />,
                  })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.restoreBackup.renderer.detail.truncateDirectory', {
              value: yesNo(action.truncateDirectory),
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.restoreBackup.renderer.detail.restoreStartup', {
              value: yesNo(action.restoreStartup),
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'create_directory':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.createDirectory.renderer.detail.directory', {
              name: <ScheduleDynamicParameterRenderer value={action.name} />,
            })}
          </Text>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.createDirectory.renderer.detail.root', {
              root: <ScheduleDynamicParameterRenderer value={action.root} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'write_file':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.writeFile.renderer.detail.file', {
              file: <ScheduleDynamicParameterRenderer value={action.file} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {tReact('pages.server.schedules.steps.writeFile.renderer.detail.append', {
              value: <Code>{yesNo(action.append)}</Code>,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'copy_file':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.copyFile.renderer.detail.from', {
              file: <ScheduleDynamicParameterRenderer value={action.file} />,
            })}
          </Text>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.copyFile.renderer.detail.to', {
              destination: <ScheduleDynamicParameterRenderer value={action.destination} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.foreground', { value: yesNo(action.foreground) })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'delete_files':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.deleteFiles.renderer.detail.root', {
              root: <ScheduleDynamicParameterRenderer value={action.root} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.deleteFiles.renderer.detail.files', { files: action.files.join(', ') })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'rename_files':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.renameFiles.renderer.detail.root', {
              root: <ScheduleDynamicParameterRenderer value={action.root} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.renameFiles.renderer.detail.files', {
              files: tItem('file', action.files.length),
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'compress_files':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.compressFiles.renderer.detail.output', {
              name: <ScheduleDynamicParameterRenderer value={action.name} />,
            })}
          </Text>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.compressFiles.renderer.detail.root', {
              root: <ScheduleDynamicParameterRenderer value={action.root} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.compressFiles.renderer.detail.files', {
              files: tItem('file', action.files.length),
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.compressFiles.renderer.detail.format', {
              format: action.format,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.foreground', { value: yesNo(action.foreground) })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'decompress_file':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.decompressFile.renderer.detail.file', {
              file: <ScheduleDynamicParameterRenderer value={action.file} />,
            })}
          </Text>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.decompressFile.renderer.detail.root', {
              root: <ScheduleDynamicParameterRenderer value={action.root} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.foreground', { value: yesNo(action.foreground) })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'update_startup_variable':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.updateStartupVariable.renderer.detail.variable', {
              variable: <ScheduleDynamicParameterRenderer value={action.envVariable} />,
            })}
          </Text>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.updateStartupVariable.renderer.detail.value', {
              value: <ScheduleDynamicParameterRenderer value={action.value} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'update_startup_command':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.updateStartupCommand.renderer.detail.command', {
              command: <ScheduleDynamicParameterRenderer value={action.command} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    case 'update_startup_docker_image':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.updateStartupDockerImage.renderer.detail.image', {
              image: <ScheduleDynamicParameterRenderer value={action.image} />,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.renderer.ignoreFailure', { value: yesNo(action.ignoreFailure) })}
          </Text>
        </Stack>
      );
    default:
      return (
        <Text size='sm' c='dimmed'>
          {t('pages.server.schedules.renderer.noActionDetails', {})}
        </Text>
      );
  }
}

interface ActionRendererProps {
  action: Action;
  mode?: ActionRendererMode;
}

export default function ActionRenderer({ action, mode = 'compact' }: ActionRendererProps) {
  const translations = useTranslations();

  return <>{mode === 'compact' ? renderCompact(action, translations) : renderDetailed(action, translations)}</>;
}
