import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import Alert from '@/elements/feedback/Alert.tsx';
import { NodeAllowedSourceKind, useNodeAllowedSource } from '@/plugins/nodes/useNodeAllowedSource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeAllowedSourceAlert({
  nodeUuid,
  kind,
  uuid,
}: {
  nodeUuid: string;
  kind: NodeAllowedSourceKind;
  uuid: string | null;
}) {
  const { t } = useTranslations();
  const { allowed } = useNodeAllowedSource(nodeUuid, kind, uuid);

  if (allowed !== false) {
    return null;
  }

  return (
    <Alert color='red' icon={faExclamationTriangle}>
      {kind === 'mount'
        ? t('common.node.allowedSources.mountNotAllowed', {}).md()
        : t('common.node.allowedSources.deviceNotAllowed', {}).md()}
    </Alert>
  );
}
