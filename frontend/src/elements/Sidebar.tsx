import {
  faArrowRightFromBracket,
  faBars,
  faEllipsisVertical,
  faGraduationCap,
  faUserCog,
  faWindowRestore,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Menu } from '@mantine/core';
import { ReactNode, useEffect, useState } from 'react';
import { MemoryRouter, NavLink, useNavigate } from 'react-router';
import { makeComponentHookable } from 'shared';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import CloseButton from '@/elements/CloseButton.tsx';
import MantineDivider from '@/elements/Divider.tsx';
import Drawer from '@/elements/Drawer.tsx';
import { isAdmin } from '@/lib/permissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useWindows } from '@/providers/WindowProvider.tsx';
import RouterRoutes from '@/RouterRoutes.tsx';
import ContextMenu, { ContextMenuProvider } from './ContextMenu.tsx';

type SidebarProps = {
  children: ReactNode;
};

function Sidebar({ children }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <>
      <Card className='lg:hidden! sticky! top-5 z-50 flex-row! justify-end -ml-1 my-4 w-16 rounded-l-none!' p='xs'>
        <ActionIcon onClick={() => setIsMobileMenuOpen(true)} variant='subtle'>
          <FontAwesomeIcon size='lg' icon={faBars} />
        </ActionIcon>
      </Card>

      <ContextMenuProvider menuProps={{ width: 250 }}>
        <Drawer
          opened={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          withCloseButton={false}
          maw='16rem'
          styles={{ body: { height: '100%' } }}
        >
          <CloseButton size='xl' className='absolute! right-4 z-10' onClick={() => setIsMobileMenuOpen(false)} />

          <div className='h-full flex flex-col overflow-y-auto'>{children}</div>
        </Drawer>

        <Card
          className='mt-2 top-2 ml-2 sticky! hidden! lg:block! h-[calc(100vh-1rem)] min-w-64!'
          p='sm'
          id='sidebar-desktop'
        >
          <div className='h-full flex flex-col overflow-y-auto'>{children}</div>
        </Card>
      </ContextMenuProvider>
    </>
  );
}

type LinkProps = {
  to: string;
  end?: boolean;
  icon?: IconDefinition;
  name?: string;
  title?: string;
};

function Link({ to, end, icon, name, title = name }: LinkProps) {
  const { t } = useTranslations();
  const { addWindow } = useWindows();

  return (
    <ContextMenu
      items={[
        {
          icon: faWindowRestore,
          label: t('elements.sidebar.button.openInVirtualWindow', {}),
          onClick: () =>
            addWindow(
              title || 'Window',
              <MemoryRouter initialEntries={[to]}>
                <RouterRoutes isNormal={false} />
              </MemoryRouter>,
            ),
          color: 'gray',
        },
        {
          icon: faWindowRestore,
          label: t('elements.sidebar.button.openInPopup', {}),
          onClick: () =>
            window.open(
              to,
              '_blank',
              'popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes',
            ),
          color: 'gray',
        },
        {
          icon: faWindowRestore,
          label: t('elements.sidebar.button.openInNewTab', {}),
          onClick: () => window.open(to, '_blank'),
          color: 'gray',
        },
      ]}
    >
      {({ openMenu }) => (
        <NavLink
          to={to}
          end={end}
          onContextMenu={(e) => {
            e.preventDefault();

            const rect = e.currentTarget.getBoundingClientRect();
            openMenu(rect.left, rect.bottom);
          }}
          className='w-full'
        >
          {({ isActive }) => (
            <Button
              color={isActive ? 'blue' : 'gray'}
              className={isActive ? 'cursor-default! active' : undefined}
              variant='subtle'
              fullWidth
              styles={{ label: { width: '100%' } }}
            >
              {icon && <FontAwesomeIcon icon={icon} className='mr-2' />} {name}
            </Button>
          )}
        </NavLink>
      )}
    </ContextMenu>
  );
}

function Divider({ label }: { label?: string }) {
  return <MantineDivider className='my-2' label={label} />;
}

function Footer() {
  const { t } = useTranslations();
  const { impersonating, user, doLogout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  return (
    <>
      <div
        className='border border-neutral-700 rounded-lg mt-auto p-2 flex flex-row justify-between items-center min-h-fit'
        id='sidebar-account-card'
      >
        <NavLink
          to='/account'
          className='flex items-center flex-1 min-w-0'
          onClick={(e) => {
            e.preventDefault();
            navigate('/account');
          }}
        >
          <img
            src={user.avatar ?? '/icon.svg'}
            alt={user.username}
            className='h-10 w-10 rounded-full select-none shrink-0'
          />
          <span className='font-sans font-normal text-sm text-neutral-50 whitespace-nowrap leading-tight ml-3 overflow-hidden text-ellipsis'>
            {user.username}
          </span>
        </NavLink>

        <Menu shadow='md' width={200} position='top-end'>
          <Menu.Target>
            <ActionIcon variant='subtle' className='shrink-0'>
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item leftSection={<FontAwesomeIcon icon={faUserCog} />} onClick={() => navigate('/account')}>
              {t('pages.account.account.title', {})}
            </Menu.Item>
            {isAdmin(user) && (
              <>
                <Menu.Divider />
                <Menu.Item leftSection={<FontAwesomeIcon icon={faGraduationCap} />} onClick={() => navigate('/admin')}>
                  {t('pages.account.admin.title', {})}
                </Menu.Item>
              </>
            )}
            <Menu.Divider />
            <Menu.Item leftSection={<FontAwesomeIcon icon={faArrowRightFromBracket} />} color='red' onClick={doLogout}>
              {impersonating
                ? t('elements.sidebar.button.stopImpersonating', {})
                : t('elements.sidebar.button.logout', {})}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </>
  );
}

export default makeComponentHookable(Sidebar, {
  Link: makeComponentHookable(Link),
  Divider: makeComponentHookable(Divider),
  Footer: makeComponentHookable(Footer),
});
