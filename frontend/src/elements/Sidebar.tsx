import {
  faArrowRightFromBracket,
  faBars,
  faEllipsisVertical,
  faGraduationCap,
  faMoon,
  faSun,
  faUserCog,
  faWindowRestore,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Menu, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { ReactNode, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { MemoryRouter, matchPath, NavLink, useLocation, useNavigate } from 'react-router';
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
import ContextMenu from './ContextMenu.tsx';

type SidebarProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
};

function Sidebar({ children, header, footer }: SidebarProps) {
  const { pathname } = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <Card className='lg:hidden! sticky! top-5 z-50 flex-row! justify-end -ml-1 my-4 w-16 rounded-l-none!' p='xs'>
        <ActionIcon onClick={() => setIsMobileMenuOpen(true)} variant='subtle'>
          <FontAwesomeIcon size='lg' icon={faBars} />
        </ActionIcon>
      </Card>

      <Drawer
        opened={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        withCloseButton={false}
        maw='16rem'
        styles={{ body: { height: '100%' } }}
      >
        <CloseButton size='xl' className='absolute! right-4 z-10' onClick={() => setIsMobileMenuOpen(false)} />

        <div id='sidebar-content' className='h-full flex flex-col'>
          {header && <div className='shrink-0'>{header}</div>}
          <div className='flex flex-col flex-1 overflow-y-auto min-h-0'>{children}</div>
          {footer && <div className='shrink-0 pt-2'>{footer}</div>}
        </div>
      </Drawer>

      <Card
        className='my-2 ml-2 top-2 sticky! hidden! lg:block! h-[calc(100vh-16px)] w-64! overflow-hidden transition-[width] duration-200 ease-in-out'
        p='sm'
        id='sidebar-desktop'
      >
        <div id='sidebar-content' className='h-full flex flex-col'>
          {header && <div className='shrink-0'>{header}</div>}
          <div className='flex flex-col flex-1 overflow-y-auto min-h-0'>{children}</div>
          {footer && <div className='shrink-0 pt-2'>{footer}</div>}
        </div>
      </Card>
    </>
  );
}

type LinkProps = {
  to: string;
  end?: boolean;
  icon?: IconDefinition;
  name?: string;
  title?: string;
  className?: string;
  activeMatches?: string[];
};

function Link({ to, end, icon, name, title = name, className, activeMatches }: LinkProps) {
  const { t } = useTranslations();
  const { addWindow } = useWindows();
  const { pathname } = useLocation();
  const isLight = useComputedColorScheme('dark') === 'light';
  const extraActive = activeMatches?.some((pattern) => matchPath({ path: pattern, end: false }, pathname)) ?? false;

  if (to.endsWith('/*')) to = to.slice(0, to.length - 2);

  return (
    <ContextMenu
      menuProps={{ width: 250 }}
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
          {({ isActive: navActive }) => {
            const isActive = navActive || extraActive;
            return (
              <Button
                color={isActive ? 'blue' : 'gray'}
                className={classNames(isActive && 'cursor-default! active', className)}
                variant={isLight && isActive ? 'outline' : 'subtle'}
                fullWidth
                styles={{ label: { width: '100%' } }}
              >
                {icon && <FontAwesomeIcon icon={icon} className='mr-2' />} {name}
              </Button>
            );
          }}
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
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');

  if (!user) {
    return null;
  }

  const isDark = computedColorScheme === 'dark';
  const suspended = Boolean(user.suspended);

  const toggleTheme = async (event: React.MouseEvent) => {
    const nextTheme = isDark ? 'light' : 'dark';

    if (!document.startViewTransition) {
      setColorScheme(nextTheme);
      return;
    }

    const x = event.clientX;
    const y = event.clientY;

    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setColorScheme(nextTheme);
      });
    });

    transition.ready.then(() => {
      const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];

      document.documentElement.animate(
        { clipPath },
        {
          duration: 500,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    });
  };

  return (
    <>
      <Card
        className='flex flex-row! justify-between items-center min-h-fit'
        p='xs'
        hoverable
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
          <span className='font-sans font-normal text-sm whitespace-nowrap leading-tight ml-3 overflow-hidden text-ellipsis'>
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
            {!suspended && (
              <>
                <Menu.Item leftSection={<FontAwesomeIcon icon={faUserCog} />} onClick={() => navigate('/account')}>
                  {t('pages.account.account.title', {})}
                </Menu.Item>
                {isAdmin(user) && (
                  <>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<FontAwesomeIcon icon={faGraduationCap} />}
                      onClick={() => navigate('/admin')}
                    >
                      {t('pages.account.admin.title', {})}
                    </Menu.Item>
                  </>
                )}
                <Menu.Divider />
              </>
            )}
            <Menu.Item leftSection={<FontAwesomeIcon icon={isDark ? faSun : faMoon} />} onClick={toggleTheme}>
              {isDark ? t('elements.sidebar.button.switchToLight', {}) : t('elements.sidebar.button.switchToDark', {})}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item leftSection={<FontAwesomeIcon icon={faArrowRightFromBracket} />} color='red' onClick={doLogout}>
              {impersonating
                ? t('elements.sidebar.button.stopImpersonating', {})
                : t('elements.sidebar.button.logout', {})}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Card>
    </>
  );
}

export default makeComponentHookable(Sidebar, {
  Link: makeComponentHookable(Link),
  Divider: makeComponentHookable(Divider),
  Footer: makeComponentHookable(Footer),
});
