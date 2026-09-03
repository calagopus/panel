import { Outlet } from 'react-router';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ScreenBlock from '@/elements/feedback/ScreenBlock.tsx';
import { useCan, useServerPermissions } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface Props {
  permission: string | string[];
  matchAny?: boolean;
}

export default function ServerPermissionGuard({ permission, matchAny = false }: Props) {
  const { t } = useTranslations();
  const canMatrix = useServerPermissions(permission);
  const can = useCan(canMatrix, matchAny);

  if (!can) {
    return (
      <ServerContentContainer title={t('elements.screenBlock.permissionDenied.title', {})} hideTitleComponent>
        <ScreenBlock
          title={t('elements.screenBlock.permissionDenied.title', {})}
          content={t('elements.screenBlock.permissionDenied.content', {})}
        />
      </ServerContentContainer>
    );
  }

  return <Outlet />;
}
