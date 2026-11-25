import { faTrash, faTriangleExclamation, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteTeamMember from '@/api/me/teams/members/deleteTeamMember.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { canRemoveTeamMember } from '@/lib/domain/teams.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamMemberSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TeamMemberActionBar({
  team,
  selectedMembers,
  clearSelection,
  onFinished,
}: {
  team: z.infer<typeof userTeamSchema>;
  selectedMembers: ObjectSet<z.infer<typeof userTeamMemberSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const removable = selectedMembers.values().filter((member) => canRemoveTeamMember(team, member, user?.uuid));
  const skipped = selectedMembers.size - removable.length;

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doRemove = async () => {
    setConfirming(false);

    const { successful } = await run({
      action: 'remove',
      items: removable,
      itemKey: 'teamMember',
      verb: t('common.bulkActions.verb.removed', {}),
      skipped,
      request: (member) => deleteTeamMember(team.uuid, member.user.uuid),
      onFinished: finish,
    });

    if (successful > 0) {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
    }
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.account.teams.tabs.members.modal.removeMembers.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        <Stack>
          {t('pages.account.teams.tabs.members.modal.removeMembers.content', {
            members: tItem('teamMember', removable.length),
          }).md()}

          <ItemPreviewList
            items={removable}
            getKey={(member) => member.user.uuid}
            renderItem={(member) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={faUser} />}
                name={member.user.username}
                description={member.preset.name}
              />
            )}
          />

          {skipped > 0 && (
            <Alert color='yellow' icon={faTriangleExclamation}>
              {t('pages.account.teams.tabs.members.modal.removeMembers.alert.skipped', {
                members: tItem('teamMember', skipped),
              })}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedMembers.size > 0}>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.teams.view.members.actionBar.prependedComponents
          }
          name='teamMembers-actionBar-prepended'
        />

        <Button color='red' onClick={() => setConfirming(true)} loading={loading === 'remove'}>
          <FontAwesomeIcon icon={faTrash} className='mr-2' />
          {t('common.button.remove', {})} ({removable.length})
        </Button>

        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.teams.view.members.actionBar.appendedComponents
          }
          name='teamMembers-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
