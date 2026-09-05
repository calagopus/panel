import { z } from 'zod';
import Stack from '@/elements/layout/Stack.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import { formatMilliseconds } from '@/lib/format/time.ts';
import { serverScheduleStepActionSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterRenderer from '../renderers/ScheduleDynamicParameterRenderer.tsx';
import ConditionRenderer from './ConditionRenderer.tsx';

type Action = z.infer<typeof serverScheduleStepActionSchema>;
type Translations = ReturnType<typeof useTranslations>;

export function IgnoreFailureText({ ignoreFailure }: { ignoreFailure: boolean }) {
  const { t } = useTranslations();
  return (
    <Text size='xs' c='dimmed'>
      {t('pages.server.schedules.renderer.ignoreFailure', {
        value: t(ignoreFailure ? 'common.yes' : 'common.no', {}),
      })}
    </Text>
  );
}

export function ForegroundText({ foreground }: { foreground: boolean }) {
  const { t } = useTranslations();
  return (
    <Text size='xs' c='dimmed'>
      {t('pages.server.schedules.renderer.foreground', { value: t(foreground ? 'common.yes' : 'common.no', {}) })}
    </Text>
  );
}

export function renderDetailed(action: Action, { t, tReact, tItem }: Translations): React.ReactNode {
  const yesNo = (val: boolean) => t(val ? 'common.yes' : 'common.no', {});

  const renderBackupSelector = (backup: Extract<Action, { type: 'restore_backup' }>['backup']): React.ReactNode => {
    switch (backup.mode) {
      case 'latest':
        return t('pages.server.schedules.steps.restoreBackup.renderer.detail.backupLatest', {});
      case 'oldest':
        return t('pages.server.schedules.steps.restoreBackup.renderer.detail.backupOldest', {});
      case 'uuid':
        return tReact('pages.server.schedules.steps.restoreBackup.renderer.detail.backupUuid', {
          uuid: <ScheduleDynamicParameterRenderer value={backup.uuid} />,
        });
      case 'name':
        return tReact('pages.server.schedules.steps.restoreBackup.renderer.detail.backupName', {
          name: <ScheduleDynamicParameterRenderer value={backup.name} />,
        });
    }
  };

  switch (action.type) {
    case 'sleep':
      return (
        <Text size='sm'>
          {t('pages.server.schedules.steps.sleep.renderer.compact', { duration: formatMilliseconds(action.duration) })}
        </Text>
      );
    case 'ensure':
    case 'if':
    case 'else_if':
      return <ConditionRenderer condition={action.condition} />;
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
              timeout: <Code>{formatMilliseconds(action.timeout)}</Code>,
            })}
          </Text>
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.waitForConsoleLine.renderer.detail.caseInsensitive', {
              value: yesNo(action.caseInsensitive),
            })}
          </Text>
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <ForegroundText foreground={action.foreground} />
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
          {action.outputInto && (
            <Text size='sm'>
              {tReact('pages.server.schedules.steps.createBackup.renderer.detail.outputInto', {
                variable: <ScheduleDynamicParameterRenderer value={action.outputInto} />,
              })}
            </Text>
          )}
          {action.ignoredFiles.length > 0 && (
            <Text size='xs' c='dimmed'>
              {t('pages.server.schedules.steps.createBackup.renderer.detail.ignoredFiles', {
                files: action.ignoredFiles.join(', '),
              })}
            </Text>
          )}
          {action.backupGroupUuid && (
            <Text size='xs' c='dimmed'>
              {t('pages.server.schedules.steps.createBackup.renderer.detail.backupGroup', {
                uuid: action.backupGroupUuid,
              })}
            </Text>
          )}
        </Stack>
      );
    case 'create_database_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {!action.name
              ? t('pages.server.schedules.steps.createBackup.renderer.detail.backupNameAuto', {})
              : tReact('pages.server.schedules.steps.createBackup.renderer.detail.backupName', {
                  name: <ScheduleDynamicParameterRenderer value={action.name} />,
                })}
          </Text>
          <Text size='sm'>
            {t('pages.server.schedules.steps.createDatabaseBackup.renderer.detail.databaseInstance', {
              uuid: action.databaseInstanceUuid,
            })}
          </Text>
          <ForegroundText foreground={action.foreground} />
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
          {action.outputInto && (
            <Text size='sm'>
              {tReact('pages.server.schedules.steps.createBackup.renderer.detail.outputInto', {
                variable: <ScheduleDynamicParameterRenderer value={action.outputInto} />,
              })}
            </Text>
          )}
          {action.backupGroupUuid && (
            <Text size='xs' c='dimmed'>
              {t('pages.server.schedules.steps.createBackup.renderer.detail.backupGroup', {
                uuid: action.backupGroupUuid,
              })}
            </Text>
          )}
        </Stack>
      );
    case 'restore_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>{renderBackupSelector(action.backup)}</Text>
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
        </Stack>
      );
    case 'delete_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>{renderBackupSelector(action.backup)}</Text>
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
        </Stack>
      );
    case 'move_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>{renderBackupSelector(action.backup)}</Text>
          <Text size='xs' c='dimmed'>
            {action.backupGroupUuid
              ? t('pages.server.schedules.steps.moveBackup.renderer.detail.targetGroup', {
                  uuid: action.backupGroupUuid,
                })
              : t('pages.server.schedules.steps.moveBackup.renderer.detail.targetGroupNone', {})}
          </Text>
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
        </Stack>
      );
    case 'restore_database_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>{renderBackupSelector(action.backup)}</Text>
          <Text size='xs' c='dimmed'>
            {action.sourceDatabaseInstanceUuid
              ? t('pages.server.schedules.renderer.sourceDatabaseInstance', {
                  uuid: action.sourceDatabaseInstanceUuid,
                })
              : t('pages.server.schedules.renderer.sourceDatabaseInstanceAny', {})}
          </Text>
          <Text size='sm'>
            {action.databaseInstanceUuid
              ? t('pages.server.schedules.steps.restoreDatabaseBackup.renderer.detail.targetDatabaseInstance', {
                  uuid: action.databaseInstanceUuid,
                })
              : t(
                  'pages.server.schedules.steps.restoreDatabaseBackup.renderer.detail.targetDatabaseInstanceSource',
                  {},
                )}
          </Text>
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
        </Stack>
      );
    case 'delete_database_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>{renderBackupSelector(action.backup)}</Text>
          <Text size='xs' c='dimmed'>
            {action.databaseInstanceUuid
              ? t('pages.server.schedules.renderer.sourceDatabaseInstance', { uuid: action.databaseInstanceUuid })
              : t('pages.server.schedules.renderer.sourceDatabaseInstanceAny', {})}
          </Text>
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
        </Stack>
      );
    case 'move_database_backup':
      return (
        <Stack gap='xs'>
          <Text size='sm'>{renderBackupSelector(action.backup)}</Text>
          <Text size='xs' c='dimmed'>
            {action.databaseInstanceUuid
              ? t('pages.server.schedules.renderer.sourceDatabaseInstance', { uuid: action.databaseInstanceUuid })
              : t('pages.server.schedules.renderer.sourceDatabaseInstanceAny', {})}
          </Text>
          <Text size='xs' c='dimmed'>
            {action.backupGroupUuid
              ? t('pages.server.schedules.steps.moveBackup.renderer.detail.targetGroup', {
                  uuid: action.backupGroupUuid,
                })
              : t('pages.server.schedules.steps.moveBackup.renderer.detail.targetGroupNone', {})}
          </Text>
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <ForegroundText foreground={action.foreground} />
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <ForegroundText foreground={action.foreground} />
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <ForegroundText foreground={action.foreground} />
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
        </Stack>
      );
    case 'pull_file':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.pullFile.renderer.detail.url', {
              url: <ScheduleDynamicParameterRenderer value={action.url} />,
            })}
          </Text>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.pullFile.renderer.detail.root', {
              root: <ScheduleDynamicParameterRenderer value={action.root} />,
            })}
          </Text>
          {action.fileName ? (
            <Text size='sm'>
              {tReact('pages.server.schedules.steps.pullFile.renderer.detail.fileName', {
                fileName: <ScheduleDynamicParameterRenderer value={action.fileName} />,
              })}
            </Text>
          ) : (
            <Text size='xs' c='dimmed'>
              {t('pages.server.schedules.steps.pullFile.renderer.detail.useHeader', {
                value: yesNo(action.useHeader),
              })}
            </Text>
          )}
          <ForegroundText foreground={action.foreground} />
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
        </Stack>
      );
    case 'http_request':
      return (
        <Stack gap='xs'>
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.httpRequest.renderer.detail.request', {
              method: <Code>{action.method.toUpperCase()}</Code>,
              url: <Code>{action.url}</Code>,
            })}
          </Text>
          {action.headers.length > 0 && (
            <Text size='sm'>
              {t('pages.server.schedules.steps.httpRequest.renderer.detail.headers', {
                headers: tItem('header', action.headers.length),
              })}
            </Text>
          )}
          {action.body && (
            <Text size='sm'>
              {tReact('pages.server.schedules.steps.httpRequest.renderer.detail.body', {
                body: <ScheduleDynamicParameterRenderer value={action.body} />,
              })}
            </Text>
          )}
          <Text size='sm'>
            {tReact('pages.server.schedules.steps.httpRequest.renderer.detail.timeout', {
              timeout: <Code>{formatMilliseconds(action.timeout)}</Code>,
            })}
          </Text>
          {action.outputStatusInto && (
            <Text size='sm'>
              {tReact('pages.server.schedules.steps.httpRequest.renderer.detail.outputStatusInto', {
                variable: <ScheduleDynamicParameterRenderer value={action.outputStatusInto} />,
              })}
            </Text>
          )}
          {action.outputBodyInto && (
            <Text size='sm'>
              {tReact('pages.server.schedules.steps.httpRequest.renderer.detail.outputBodyInto', {
                variable: <ScheduleDynamicParameterRenderer value={action.outputBodyInto} />,
              })}
            </Text>
          )}
          <Text size='xs' c='dimmed'>
            {t('pages.server.schedules.steps.httpRequest.renderer.detail.ignoreErrorStatus', {
              value: yesNo(action.ignoreErrorStatus),
            })}
          </Text>
          <IgnoreFailureText ignoreFailure={action.ignoreFailure} />
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
