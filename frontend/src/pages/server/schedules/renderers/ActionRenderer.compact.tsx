import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { serverScheduleStepActionSchema } from '@/lib/schemas/server/schedules.ts';
import { formatMilliseconds } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterRenderer from '../renderers/ScheduleDynamicParameterRenderer.tsx';

type Action = z.infer<typeof serverScheduleStepActionSchema>;
type Translations = ReturnType<typeof useTranslations>;

export function renderCompact(action: Action, { t, tReact, tItem }: Translations): React.ReactNode {
  switch (action.type) {
    case 'sleep':
      return (
        <span>
          {t('pages.server.schedules.steps.sleep.renderer.compact', { duration: formatMilliseconds(action.duration) })}
        </span>
      );
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
    case 'delete_backup':
    case 'move_backup':
      return action.backup.mode === 'latest' || action.backup.mode === 'oldest' ? (
        <span>
          {t(
            `pages.server.schedules.steps.restoreBackup.renderer.compact${action.backup.mode === 'oldest' ? 'Oldest' : 'Latest'}`,
            {},
          )}
        </span>
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
    case 'http_request':
      return (
        <span>
          {tReact('pages.server.schedules.steps.httpRequest.renderer.compact', {
            method: <Code>{action.method.toUpperCase()}</Code>,
            url: <Code>{action.url}</Code>,
          })}
        </span>
      );
    default:
      return <span>{t('pages.server.schedules.renderer.noActionSelected', {})}</span>;
  }
}
