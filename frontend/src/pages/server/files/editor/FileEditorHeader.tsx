import { faArrowsRotate, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AvatarGroup } from '@mantine/core';
import { join } from 'pathe';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Avatar from '@/elements/Avatar.tsx';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import Group from '@/elements/Group.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import FileConnectButton from '../FileConnectButton.tsx';
import { CollabParticipant } from '../hooks/useFileCollab.ts';
import FileEditorSettings from './FileEditorSettings.tsx';
import FileImageViewerSettings from './FileImageViewerSettings.tsx';

type FileEditorAction = (typeof window.extensionContext.extensionRegistry.pages.server.files.fileEditorActions)[number];

interface FileEditorHeaderProps {
  title: string;
  matchedFileEditorAction: FileEditorAction | null;
  action: string;
  collabActive: boolean;
  collabParticipants: CollabParticipant[];
  showRevertAction: boolean;
  showHistoryAction: boolean;
  onRevertClick: () => void;
  onHistoryClick: () => void;
  fileName: string;
  saving: boolean;
  onSave: () => void;
  onCreateClick: () => void;
}

export default function FileEditorHeader({
  title,
  matchedFileEditorAction,
  action,
  collabActive,
  collabParticipants,
  showRevertAction,
  showHistoryAction,
  onRevertClick,
  onHistoryClick,
  fileName,
  saving,
  onSave,
  onCreateClick,
}: FileEditorHeaderProps) {
  const { t } = useTranslations();
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const browsingWritableDirectory = useFileManager((state) => state.browsingWritableDirectory);

  return (
    <div className='flex justify-between items-center gap-2 lg:pt-6 px-4 lg:px-6 lg:pb-0'>
      <Group wrap='nowrap' gap='xs' className='min-w-0 flex-1'>
        <Title className='truncate! min-w-0 text-lg! sm:text-[2.125rem]!'>{title}</Title>

        {matchedFileEditorAction?.header.settings ? (
          <matchedFileEditorAction.header.settings />
        ) : action === 'new' || action === 'edit' ? (
          <FileEditorSettings />
        ) : action === 'image' ? (
          <FileImageViewerSettings />
        ) : null}
      </Group>
      {matchedFileEditorAction?.header.rightSection ? (
        <matchedFileEditorAction.header.rightSection />
      ) : (
        <Group wrap='nowrap' gap='xs' className='shrink-0'>
          {collabActive && collabParticipants.length > 1 && (
            <AvatarGroup>
              {collabParticipants.map((participant) => (
                <Tooltip
                  key={participant.user}
                  label={t('pages.server.files.tooltip.collabEditing', {
                    user: participant.name,
                  })}
                >
                  <Avatar size='sm' src={participant.avatar} name={participant.name} />
                </Tooltip>
              ))}
            </AvatarGroup>
          )}

          {showRevertAction && (
            <div className='hidden sm:block'>
              <Tooltip label={t('pages.server.files.tooltip.revertToDisk', {})}>
                <ActionIcon size='md' variant='subtle' color='gray' onClick={onRevertClick}>
                  <FontAwesomeIcon icon={faArrowsRotate} />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
          {showHistoryAction && (
            <div className='hidden sm:block'>
              <Tooltip label={t('pages.server.files.tooltip.fileHistory', {})}>
                <ActionIcon size='md' variant='subtle' color='gray' onClick={onHistoryClick}>
                  <FontAwesomeIcon icon={faClockRotateLeft} />
                </ActionIcon>
              </Tooltip>
            </div>
          )}

          <div className='hidden sm:block'>
            <FileConnectButton file={fileName ? join(browsingDirectory, fileName) : undefined} />
          </div>
          <div hidden={!browsingWritableDirectory || action === 'image' || action === 'audio'}>
            {action === 'edit' ? (
              <ServerCan action={collabActive ? 'files.update' : 'files.create'}>
                <Button loading={saving} onClick={onSave}>
                  {t('common.button.save', {})}
                </Button>
              </ServerCan>
            ) : (
              <ServerCan action='files.create'>
                <Button loading={saving} onClick={onCreateClick}>
                  {t('common.button.create', {})}
                </Button>
              </ServerCan>
            )}
          </div>
        </Group>
      )}
    </div>
  );
}
