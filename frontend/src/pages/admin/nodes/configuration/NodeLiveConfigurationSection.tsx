import LiveYamlConfigSection from '@/elements/admin/LiveYamlConfigSection.tsx';
import { WINGS_DEFAULT_PORT } from '@/lib/domain/node.ts';
import { urlIsMissingPort } from '@/lib/network/url.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface NodeLiveConfigState {
  yaml: string | null;
  setYaml: (value: string) => void;
  liveConfigError: string | null;
  saving: boolean;
  doSave: () => void;
}

export default function NodeLiveConfigurationSection({
  nodeUrl,
  connectPort,
  liveConfig,
}: {
  nodeUrl: string;
  connectPort: number | null;
  liveConfig: NodeLiveConfigState;
}) {
  const { t } = useTranslations();
  const { yaml, setYaml, liveConfigError, saving, doSave } = liveConfig;

  return (
    <LiveYamlConfigSection
      title={t('pages.admin.nodes.tabs.configuration.page.section.liveConfiguration', {})}
      saveLabel={t('pages.admin.nodes.tabs.configuration.page.button.save', {})}
      updateAction='nodes.update'
      yaml={yaml}
      onYamlChange={setYaml}
      onSave={doSave}
      saving={saving}
      error={liveConfigError}
      errorText={
        liveConfigError
          ? t('pages.admin.nodes.tabs.configuration.page.alert.couldNotReach', { error: liveConfigError })
          : null
      }
      errorExtra={
        urlIsMissingPort(nodeUrl) &&
        t('pages.admin.nodes.tabs.general.page.alert.urlMissingPort', {
          port: String(connectPort ?? 443),
          wingsPort: String(WINGS_DEFAULT_PORT),
        }).md()
      }
    />
  );
}
