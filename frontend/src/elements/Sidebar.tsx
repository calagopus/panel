import {
  faArrowRightFromBracket,
  faBars,
  faCheck,
  faCircleHalfStroke,
  faEllipsisVertical,
  faGraduationCap,
  faMoon,
  faSun,
  faUserCog,
  faWindowRestore,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { MemoryRouter, matchPath, NavLink, useLocation, useNavigate } from 'react-router';
import { makeComponentHookable } from 'shared';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Avatar from '@/elements/Avatar.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import CloseButton from '@/elements/CloseButton.tsx';
import MantineDivider from '@/elements/Divider.tsx';
import Drawer from '@/elements/Drawer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { isAdmin } from '@/lib/permissions.ts';
import { getAccessibleRoutePaths } from '@/lib/routes.ts';
import { openUrl } from '@/lib/url.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useWindows } from '@/providers/WindowProvider.tsx';
import RouterRoutes from '@/RouterRoutes.tsx';
import accountRoutes from '@/routers/routes/accountRoutes.ts';
import { useGlobalStore } from '@/stores/global.ts';
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
          type: 'action',
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
          type: 'action',
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
          type: 'action',
          icon: faWindowRestore,
          label: t('elements.sidebar.button.openInNewTab', {}),
          onClick: () => openUrl(to),
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
            openMenu(e.clientX, e.clientY);
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
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');
  const routeOrder = useGlobalStore((state) => state.settings.user?.routeOrder);

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const accountRouteDisabled = useMemo(() => {
    const routes = [...accountRoutes, ...window.extensionContext.extensionRegistry.routes.accountRoutes];

    for (const interceptor of window.extensionContext.extensionRegistry.routes.accountRouteInterceptors) {
      interceptor(routes);
    }

    const accessible = getAccessibleRoutePaths(routes, routeOrder);

    return !!accessible && !accessible.has('/');
  }, [routeOrder]);

  if (!user) {
    return null;
  }

  const suspended = Boolean(user.suspended);
  const accountHidden = suspended || accountRouteDisabled;
  const adminHidden = suspended || !isAdmin(user);

  const changeTheme = async (event: React.MouseEvent, nextTheme: 'auto' | 'dark' | 'light') => {
    if (nextTheme === colorScheme) {
      return;
    }

    const nextComputed =
      nextTheme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : nextTheme;

    if (nextComputed === computedColorScheme || !document.startViewTransition) {
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
      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faUserCog,
            label: t('pages.account.account.title', {}),
            hidden: accountHidden,
            onClick: () => navigate('/account'),
          },
          {
            type: 'divider',
            hidden: accountHidden || adminHidden,
          },
          {
            type: 'action',
            icon: faGraduationCap,
            label: t('pages.account.admin.title', {}),
            hidden: adminHidden,
            onClick: () => navigate('/admin'),
          },
          {
            type: 'divider',
            hidden: accountHidden && adminHidden,
          },
          {
            type: 'action',
            icon: faCircleHalfStroke,
            label: t('elements.sidebar.button.theme', {}),
            items: [
              {
                type: 'action',
                icon: faCircleHalfStroke,
                label: t('elements.sidebar.button.themeAuto', {}),
                rightSection: colorScheme === 'auto' && <FontAwesomeIcon icon={faCheck} size='sm' />,
                onClick: (e) => changeTheme(e, 'auto'),
              },
              {
                type: 'action',
                icon: faMoon,
                label: t('elements.sidebar.button.themeDark', {}),
                rightSection: colorScheme === 'dark' && <FontAwesomeIcon icon={faCheck} size='sm' />,
                onClick: (e) => changeTheme(e, 'dark'),
              },
              {
                type: 'action',
                icon: faSun,
                label: t('elements.sidebar.button.themeLight', {}),
                rightSection: colorScheme === 'light' && <FontAwesomeIcon icon={faCheck} size='sm' />,
                onClick: (e) => changeTheme(e, 'light'),
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'action',
            icon: faArrowRightFromBracket,
            label: impersonating
              ? t('elements.sidebar.button.stopImpersonating', {})
              : t('elements.sidebar.button.logout', {}),
            color: 'red',
            onClick: () => (impersonating ? doLogout() : setLogoutConfirmOpen(true)),
          },
        ]}
      >
        {({ openMenu }) => (
          <Card
            className='flex flex-row! justify-between items-center min-h-fit'
            p='xs'
            hoverable={!accountHidden}
            id='sidebar-account-card'
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {accountHidden ? (
              <div className='flex items-center flex-1 min-w-0'>
                <Avatar size={40} className='select-none shrink-0' src={user.avatar} name={user.username} />
                <span className='font-sans font-normal text-sm whitespace-nowrap leading-tight ml-3 overflow-hidden text-ellipsis'>
                  {user.username}
                </span>
              </div>
            ) : (
              <NavLink
                to='/account'
                className='flex items-center flex-1 min-w-0'
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/account');
                }}
              >
                <Avatar size={40} className='select-none shrink-0' src={user.avatar} name={user.username} />
                <span className='font-sans font-normal text-sm whitespace-nowrap leading-tight ml-3 overflow-hidden text-ellipsis'>
                  {user.username}
                </span>
              </NavLink>
            )}

            <ActionIcon
              variant='subtle'
              className='shrink-0'
              onClick={(e) => {
                e.preventDefault();
                openMenu(e.clientX, e.clientY);
              }}
            >
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </ActionIcon>
          </Card>
        )}
      </ContextMenu>

      <ConfirmationModal
        opened={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title={t('elements.sidebar.modal.logout.title', {})}
        confirm={t('elements.sidebar.button.logout', {})}
        onConfirmed={() => {
          setLogoutConfirmOpen(false);
          doLogout();
        }}
      >
        {t('elements.sidebar.modal.logout.content', {})}
      </ConfirmationModal>
    </>
  );
}

export default makeComponentHookable(Sidebar, {
  Link: makeComponentHookable(Link),
  Divider: makeComponentHookable(Divider),
  Footer: makeComponentHookable(Footer),
});
