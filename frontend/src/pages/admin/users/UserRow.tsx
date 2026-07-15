import { faCrown, faLock, faLockOpen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import Avatar from '@/elements/Avatar.tsx';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { isAdmin } from '@/lib/permissions.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function UserRow({ user }: { user: z.infer<typeof fullUserSchema> }) {
  const { t } = useTranslations();

  return (
    <TableRow>
      <TableData>
        <Avatar size={20} className='select-none' src={user.avatar} name={user.username} />
      </TableData>

      <TableData>
        <TableLink to={`/admin/users/${user.uuid}`}>
          <Code>{user.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>
        <span className='flex gap-2 items-center'>
          {user.username}&nbsp;
          {isAdmin(user) && (
            <Tooltip label={t('pages.admin.users.tooltip.admin', {})}>
              <FontAwesomeIcon icon={faCrown} className='text-yellow-400' />
            </Tooltip>
          )}
          {user.totpEnabled ? (
            <Tooltip label={t('pages.admin.users.tooltip.twoFactorEnabled', {})}>
              <FontAwesomeIcon icon={faLock} className='text-green-500' />
            </Tooltip>
          ) : (
            <Tooltip label={t('pages.admin.users.tooltip.twoFactorDisabled', {})}>
              <FontAwesomeIcon icon={faLockOpen} className='text-red-500' />
            </Tooltip>
          )}
        </span>
      </TableData>

      <TableData>
        <Code>
          {user.role ? (
            <TableLink to={`/admin/roles/${user.role.uuid}`}>{user.role.name}</TableLink>
          ) : (
            t('common.na', {})
          )}
        </Code>
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={user.created} />
      </TableData>
    </TableRow>
  );
}
