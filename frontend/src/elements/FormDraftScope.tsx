import { ReactNode, useState } from 'react';
import { StoreApi, useStore } from 'zustand';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  createFormDraftStore,
  FormDraftStore,
  FormDraftStoreContext,
  isWithinFormDraftScope,
} from '@/stores/formDrafts.ts';

const hasUnsavedDrafts = (state: FormDraftStore) =>
  Object.keys(state.drafts).length > 0 || Object.values(state.dirty).some(Boolean);

function FormDraftBlocker({ store }: { store: StoreApi<FormDraftStore> }) {
  const { t } = useTranslations();

  const hasUnsaved = useStore(store, hasUnsavedDrafts);

  const blocker = useBlocker(
    hasUnsaved,
    false,
    (transition) =>
      hasUnsavedDrafts(store.getState()) &&
      !isWithinFormDraftScope(store.getState().baseUrl, transition.location.pathname),
  );

  return (
    <ConfirmationModal
      title={t('common.modal.unsavedChanges.title', {})}
      opened={blocker.state === 'blocked'}
      onClose={() => blocker.reset()}
      onConfirmed={() => blocker.proceed()}
      confirm={t('common.button.leavePage', {})}
    >
      {t('common.modal.unsavedChanges.content', {}).md()}
    </ConfirmationModal>
  );
}

/**
 * Keeps `useFormDraft` drafts of every form below it while navigating within `baseUrl`, and asks for
 * confirmation before navigating outside of it with unsaved changes. Key it by the edited entity.
 */
export default function FormDraftScope({ baseUrl, children }: { baseUrl: string; children: ReactNode }) {
  const [store] = useState(() => createFormDraftStore(baseUrl));

  return (
    <FormDraftStoreContext.Provider value={store}>
      <FormDraftBlocker store={store} />
      {children}
    </FormDraftStoreContext.Provider>
  );
}
