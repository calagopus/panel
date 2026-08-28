import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { RefObject } from 'react';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Group from '@/elements/Group.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import { WINGS_DEFAULT_PORT } from '@/lib/node.ts';
import { urlIsMissingPort } from '@/lib/url.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface NodeLiveConfigState {
  yaml: string | null;
  setYaml: (value: string) => void;
  liveConfigError: string | null;
  saving: boolean;
  doSave: () => void;
  doSaveRef: RefObject<() => void>;
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
  const { yaml, setYaml, liveConfigError, saving, doSave, doSaveRef } = liveConfig;

  return (
    <div>
      <Group justify='space-between' mb='md'>
        <Title order={4}>{t('pages.admin.nodes.tabs.configuration.page.section.liveConfiguration', {})}</Title>
        <AdminCan action='nodes.update' cantSave>
          <Button onClick={doSave} loading={saving} disabled={yaml === null || liveConfigError !== null}>
            {t('pages.admin.nodes.tabs.configuration.page.button.save', {})}
          </Button>
        </AdminCan>
      </Group>
      {liveConfigError ? (
        <Alert color='red' icon={<FontAwesomeIcon icon={faExclamationTriangle} />}>
          <Stack gap='xs'>
            {t('pages.admin.nodes.tabs.configuration.page.alert.couldNotReach', { error: liveConfigError })}
            {urlIsMissingPort(nodeUrl) &&
              t('pages.admin.nodes.tabs.general.page.alert.urlMissingPort', {
                port: String(connectPort ?? 443),
                wingsPort: String(WINGS_DEFAULT_PORT),
              }).md()}
          </Stack>
        </Alert>
      ) : yaml === null ? (
        <Spinner.Centered />
      ) : (
        <div className='rounded-md overflow-hidden'>
          <MonacoEditor
            height='65vh'
            theme='vs-dark'
            language='yaml'
            value={yaml}
            onChange={(value) => setYaml(value ?? '')}
            onMount={(editor, monaco) => {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                doSaveRef.current();
              });
            }}
            options={{
              stickyScroll: { enabled: false },
              minimap: { enabled: false },
              codeLens: false,
              scrollBeyondLastLine: false,
              smoothScrolling: false,
              inertialScroll: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
