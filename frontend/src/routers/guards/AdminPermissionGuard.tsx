import { Outlet } from 'react-router';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ScreenBlock from '@/elements/feedback/ScreenBlock.tsx';
import { useAdminPermissions, useCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface Props {
  permission: string | string[];
  matchAny?: boolean;
}

export default function AdminPermissionGuard({ permission, matchAny = false }: Props) {
  const { t } = useTranslations();
  const canMatrix = useAdminPermissions(permission);
  const can = useCan(canMatrix, matchAny);

  if (!can) {
    return (
      <AdminContentContainer title={t('elements.screenBlock.permissionDenied.title', {})} hideTitleComponent>
        <ScreenBlock
          title={t('elements.screenBlock.permissionDenied.title', {})}
          content={t('elements.screenBlock.permissionDenied.content', {})}
        />
      </AdminContentContainer>
    );
  }

  return <Outlet />;
}
