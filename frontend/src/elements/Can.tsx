import { Tooltip } from '@mantine/core';
import { ReactNode } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import { useAdminPermissions, useCan, useServerPermissions } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface Props {
  action: string | string[];
  matchAny?: boolean;
  renderOnCant?: ReactNode | null;
  cantSave?: boolean;
  cantDelete?: boolean;
  children: ReactNode;
}

export const CantSaveTooltip = () => {
  const { t } = useTranslations();

  return (
    <Tooltip label={t('elements.can.tooltip.cantSave', {})}>
      <Button disabled>{t('common.button.save', {})}</Button>
    </Tooltip>
  );
};

export const CantDeleteTooltip = () => {
  const { t } = useTranslations();

  return (
    <Tooltip label={t('elements.can.tooltip.cantDelete', {})}>
      <Button color='red' disabled>
        {t('common.button.delete', {})}
      </Button>
    </Tooltip>
  );
};

export const AdminCan = ({ action, matchAny = false, renderOnCant, cantSave, cantDelete, children }: Props) => {
  const canMatrix = useAdminPermissions(action);
  const can = useCan(canMatrix, matchAny);

  return can ? children : cantSave ? <CantSaveTooltip /> : cantDelete ? <CantDeleteTooltip /> : renderOnCant;
};

export const ServerCan = ({ action, matchAny = false, renderOnCant, children }: Props) => {
  const canMatrix = useServerPermissions(action);
  const can = useCan(canMatrix, matchAny);

  return can ? children : renderOnCant;
};
