import Alert from '@/elements/feedback/Alert.tsx';
import { isOutdated } from '@/lib/version.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export const usePanelUpdateAvailable = (): boolean =>
  useAdminStore(
    (state) =>
      !!state.updateInformation &&
      isOutdated(state.updateInformation.latestPanelVersion, state.updateInformation.panelVersion),
  );

export default function PanelUpdateAlert({ className = 'mb-4' }: { className?: string }) {
  const { t } = useTranslations();
  const updateInformation = useAdminStore((state) => state.updateInformation);

  if (!updateInformation || !isOutdated(updateInformation.latestPanelVersion, updateInformation.panelVersion)) {
    return null;
  }

  return (
    <Alert className={className} color='yellow'>
      {t('pages.admin.home.alert.newPanelVersion', {
        current: updateInformation.panelVersion,
        latest: updateInformation.latestPanelVersion,
        upgradeUrl: 'https://calagopus.com/docs/panel/updating',
      }).md()}
    </Alert>
  );
}
