import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { serverPowerAction } from '@/lib/schemas/server/server.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type PowerAction = z.infer<typeof serverPowerAction>;

const BUTTONS: { action: Extract<PowerAction, 'start' | 'restart' | 'stop'>; color: string }[] = [
  { action: 'start', color: 'green' },
  { action: 'restart', color: 'gray' },
  { action: 'stop', color: 'red' },
];

interface ServerPowerButtonsProps {
  count: number;
  loading: PowerAction | null;
  onAction: (action: PowerAction) => void;
  disabled?: boolean;
}

export default function ServerPowerButtons({ count, loading, onAction, disabled }: ServerPowerButtonsProps) {
  const { t } = useTranslations();

  return (
    <AdminCan action='nodes.power'>
      {BUTTONS.map(({ action, color }) => (
        <Button
          key={action}
          color={color}
          onClick={() => onAction(action)}
          loading={loading === action}
          disabled={disabled || (loading !== null && loading !== action)}
        >
          {t(`common.enum.serverPowerAction.${action}`, {})} ({count})
        </Button>
      ))}
    </AdminCan>
  );
}
