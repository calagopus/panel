import { faFingerprint, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteOAuthLink from '@/api/me/oauth-links/deleteOAuthLink.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ItemPreviewList, { ItemPreviewRow } from '@/elements/data-display/ItemPreviewList.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { useCustomIcon } from '@/lib/icons.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';
import { useBulkAction } from '@/plugins/selection/useBulkAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useOAuthLinkRemoval } from './useOAuthLinkRemoval.ts';

function OAuthLinkListItem({ oauthLink }: { oauthLink: z.infer<typeof userOAuthLinkSchema> }) {
  const icon = useCustomIcon(oauthLink.oauthProvider.icon, faFingerprint);

  return (
    <ItemPreviewRow
      icon={<FontAwesomeIcon icon={icon} />}
      name={oauthLink.oauthProvider.name}
      description={oauthLink.identifier}
    />
  );
}

export default function OAuthLinkActionBar({
  selectedOAuthLinks,
  totalOAuthLinks,
  clearSelection,
  onFinished,
}: {
  selectedOAuthLinks: ObjectSet<z.infer<typeof userOAuthLinkSchema>, 'uuid'>;
  totalOAuthLinks: number;
  clearSelection: () => void;
  onFinished: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { run, loading } = useBulkAction();

  const [confirming, setConfirming] = useState(false);

  const { removableCount } = useOAuthLinkRemoval(totalOAuthLinks);

  const manageable = selectedOAuthLinks.values().filter((oauthLink) => oauthLink.oauthProvider.userManageable);
  const removable = manageable.slice(0, removableCount);
  const keptLast = removable.length < manageable.length;
  const skipped = selectedOAuthLinks.size - manageable.length;

  const finish = () => {
    clearSelection();
    onFinished();
  };

  const doDelete = () => {
    setConfirming(false);

    run({
      action: 'delete',
      items: removable,
      itemKey: 'oauthLink',
      verb: t('common.bulkActions.verb.removed', {}),
      request: (oauthLink) => deleteOAuthLink(oauthLink.uuid),
      onFinished: finish,
    });
  };

  return (
    <>
      <ConfirmationModal
        opened={confirming}
        onClose={() => setConfirming(false)}
        title={t('pages.account.oauthLinks.modal.deleteOAuthLinks.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('common.modal.deleteFromAccount.content', {
            name: tItem('oauthLink', removable.length),
          }).md()}

          <ItemPreviewList
            items={removable}
            getKey={(oauthLink) => oauthLink.uuid}
            renderItem={(oauthLink) => <OAuthLinkListItem oauthLink={oauthLink} />}
          />

          {skipped > 0 && (
            <Alert color='yellow' icon={faTriangleExclamation}>
              {t('pages.account.oauthLinks.modal.deleteOAuthLinks.alert.skipped', {
                oauthLinks: tItem('oauthLink', skipped),
              })}
            </Alert>
          )}

          {keptLast && (
            <Alert color='yellow' icon={faTriangleExclamation}>
              {t('pages.account.oauthLinks.modal.deleteOAuthLinks.alert.keptLast', {})}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={selectedOAuthLinks.size > 0}>
        <ExtensionSlot
          components={
            window.extensionContext.extensionRegistry.pages.dashboard.oauthLinks.actionBar.prependedComponents
          }
          name='oauthLinks-actionBar-prepended'
        />

        <Button
          color='red'
          onClick={() => setConfirming(true)}
          loading={loading === 'delete'}
          disabled={removable.length === 0}
        >
          <FontAwesomeIcon icon={faTrash} className='mr-2' />
          {t('common.button.remove', {})} ({removable.length})
        </Button>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.dashboard.oauthLinks.actionBar.appendedComponents}
          name='oauthLinks-actionBar-appended'
        />
      </ActionBar>
    </>
  );
}
