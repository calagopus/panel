import { UseFormReturnType } from '@mantine/form';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import { adminSettingsSchema } from '@/lib/schemas/admin/settings.ts';
import { publicSettingsSchema } from '@/lib/schemas/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type AdminSettings = z.infer<typeof adminSettingsSchema>;
type PublicSettings = z.infer<typeof publicSettingsSchema>;

/** Keys of the admin settings store that back a single settings section form. */
type SettingsStoreKey =
  | 'app'
  | 'webauthn'
  | 'server'
  | 'user'
  | 'activity'
  | 'ratelimits'
  | 'storageDriver'
  | 'mailMode'
  | 'captchaProvider';

/** Admin store keys whose public projection lives under the same-named global settings key. */
type GlobalSyncKey = 'app' | 'webauthn' | 'server' | 'user';

interface UseSettingsSectionOptions<T extends Record<string, unknown>> {
  form: UseFormReturnType<T>;
  schema: z.ZodType<T>;
  /** Admin store slice the parsed values are written back to on success. */
  storeKey: SettingsStoreKey;
  update: (values: T) => Promise<void>;
  /** Already-translated success toast message. */
  successMessage: string;
  /** When set, the saved values are also mirrored into the public (global) settings store. */
  syncGlobalKey?: GlobalSyncKey;
  /**
   * When it returns true, {@link UseSettingsSectionReturn.submit} opens the confirmation modal
   * instead of saving immediately. Wire {@link UseSettingsSectionReturn.confirmSave} to the modal.
   */
  confirmBeforeSave?: (values: T) => boolean;
}

interface UseSettingsSectionReturn {
  loading: boolean;
  submit: () => void;
  confirmOpened: boolean;
  closeConfirm: () => void;
  confirmSave: () => void;
}

export function useSettingsSection<T extends Record<string, unknown>>({
  form,
  schema,
  storeKey,
  update,
  successMessage,
  syncGlobalKey,
  confirmBeforeSave,
}: UseSettingsSectionOptions<T>): UseSettingsSectionReturn {
  const { addToast } = useToast();
  const updateAdminSettings = useAdminStore((state) => state.updateSettings);
  const updateGlobalSettings = useGlobalStore((state) => state.updateSettings);
  const globalSettings = useGlobalStore((state) => state.settings);

  const [loading, setLoading] = useState(false);
  const [confirmOpened, setConfirmOpened] = useState(false);

  const persist = (values: T) => {
    setLoading(true);
    update(values)
      .then(() => {
        addToast(successMessage, 'success');
        updateAdminSettings({ [storeKey]: values } as Partial<AdminSettings>);
        if (syncGlobalKey) {
          updateGlobalSettings({
            [syncGlobalKey]: { ...globalSettings[syncGlobalKey], ...values },
          } as Partial<PublicSettings>);
        }
      })
      .catch((error) => addToast(httpErrorToHuman(error), 'error'))
      .finally(() => setLoading(false));
  };

  const submit = () => {
    const values = schema.parse(form.getValues());
    if (confirmBeforeSave?.(values)) {
      setConfirmOpened(true);
      return;
    }
    persist(values);
  };

  const confirmSave = () => {
    setConfirmOpened(false);
    persist(schema.parse(form.getValues()));
  };

  return {
    loading,
    submit,
    confirmOpened,
    closeConfirm: () => setConfirmOpened(false),
    confirmSave,
  };
}
