import { faIdBadge, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteTeamPreset from '@/api/me/teams/presets/deleteTeamPreset.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { canGrantTeamPreset } from '@/lib/domain/teams.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamPresetSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TeamPresetActionBar({
  team,
  selectedPresets,
  clearSelection,
  onFinished,
}: {
  team: z.infer<typeof userTeamSchema>;
  selectedPresets: ObjectSet<z.infer<typeof userTeamPresetSchema>, 'uuid'>;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const queryClient = useQueryClient();
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const deletable = selectedPresets.values().filter((preset) => canGrantTeamPreset(team, preset));
  const skipped = selectedPresets.size - deletable.length;

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doDelete = async () => {
    setConfirming(false);

    const { successful } = await run({
      action: 'delete',
      items: deletable,
      itemKey: 'teamPreset',
      verb: t('common.bulkActions.verb.deleted', {}),
      skipped,
      request: (preset) => deleteTeamPreset(team.uuid, preset.uuid, null),
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
        title={t('pages.account.teams.tabs.presets.modal.deletePresets.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('pages.account.teams.tabs.presets.modal.deletePresets.content', {
            presets: tItem('teamPreset', deletable.length),
          }).md()}

          <ItemPreviewList
            items={deletable}
            getKey={(preset) => preset.uuid}
            renderItem={(preset) => (
              <ItemPreviewRow
                icon={<FontAwesomeIcon icon={faIdBadge} />}
                name={preset.name}
                description={preset.description}
              />
            )}
          />

          {skipped > 0 && (
            <Alert color='yellow' icon={faTriangleExclamation}>
              {t('pages.account.teams.tabs.presets.modal.deletePresets.alert.skipped', {
                presets: tItem('teamPreset', skipped),
              })}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedPresets.size > 0}>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.teams.view.presets.actionBar.prependedComponents
          }
          name='teamPresets-actionBar-prepended'
        />

        <Button color='red' onClick={() => setConfirming(true)} loading={loading === 'delete'}>
          <FontAwesomeIcon icon={faTrash} className='mr-2' />
          {t('common.button.delete', {})} ({deletable.length})
        </Button>

        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.teams.view.presets.actionBar.appendedComponents
          }
          name='teamPresets-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
