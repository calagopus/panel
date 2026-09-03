import classNames from 'classnames';
import Badge from '@/elements/data-display/Badge.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Group from '@/elements/layout/Group.tsx';
import Title from '@/elements/typography/Title.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type PermissionTone = 'added' | 'existing' | 'removed';

export interface RequestedPermission {
  permission: string;
  tone?: PermissionTone;
}

const toneColors: Record<PermissionTone, string> = {
  added: 'green',
  existing: 'gray',
  removed: 'red',
};

export default function RequestedPermissions({
  label,
  permissions,
}: {
  label: string;
  permissions: (string | RequestedPermission)[];
}) {
  const { t } = useTranslations();

  return (
    <Card>
      <Title order={5} className='pb-2'>
        {label}
      </Title>
      <div className='space-y-1'>
        {permissions
          .map((entry) => (typeof entry === 'string' ? { permission: entry } : entry))
          .map(({ permission, tone }) => (
            <Card key={permission} className='border border-(--mantine-color-default-border)' padding='xs'>
              <Group justify='space-between' wrap='nowrap'>
                <span className={classNames('text-sm font-mono', tone === 'removed' && 'line-through')}>
                  {permission}
                </span>
                {tone && (
                  <Badge color={toneColors[tone]} variant='light'>
                    {t(`pages.account.apiKeys.update.badge.${tone}`, {})}
                  </Badge>
                )}
              </Group>
            </Card>
          ))}
      </div>
    </Card>
  );
}
