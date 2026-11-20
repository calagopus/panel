import {
  faArrowRightFromBracket,
  faBars,
  faCheck,
  faCircleHalfStroke,
  faEllipsisVertical,
  faEyeSlash,
  faGraduationCap,
  faMoon,
  faPalette,
  faRotateLeft,
  faSun,
  faUserCog,
  faWindowRestore,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Text, Title, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { MemoryRouter, matchPath, NavLink, useLocation, useNavigate } from 'react-router';
import { makeComponentHookable } from 'shared';
import type { IconLike } from '@/elements/data-display/Icon.tsx';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import CloseButton from '@/elements/buttons/CloseButton.tsx';
import Avatar from '@/elements/data-display/Avatar.tsx';
import Card from '@/elements/data-display/Card.tsx';
import Icon from '@/elements/data-display/Icon.tsx';
import MantineDivider from '@/elements/layout/Divider.tsx';
import ContextMenu, { ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import Drawer from '@/elements/overlays/Drawer.tsx';
import { useLogoutConfirmation } from '@/elements/useLogoutConfirmation.tsx';
import { isAdmin } from '@/lib/auth/permissions.ts';
import { useCustomIcon } from '@/lib/icons.ts';
import { resolveString } from '@/lib/lazy.ts';
import { openUrl } from '@/lib/network/url.ts';
import { isNamedRoutePathAccessible } from '@/lib/routes.ts';
import {
  DEFAULT_THEME_VARIANT,
  getThemeVariant,
  getThemeVariantCategories,
  getThemeVariants,
  ThemeVariantDefinition,
} from '@/lib/themeVariants.ts';
import { resetAllDeviceOverrides, useDeviceOverrideCount } from '@/lib/userSettings.ts';
import { useRedactAddresses } from '@/plugins/privacy/useRedactAddresses.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { usePendingPathname } from '@/providers/contexts/pendingNavigationContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useWindows } from '@/providers/WindowProvider.tsx';
import RouterRoutes from '@/RouterRoutes.tsx';
import { preloadRouterForPath } from '@/routers/routerImports.ts';
import { useGlobalStore } from '@/stores/global.ts';
import { useQuickActionsStore } from '@/stores/quickActions.ts';
import { useRelativePageStore } from '@/stores/relativePage.ts';
import { setAutoScheme, setThemeVariant, useThemeVariantStore } from '@/stores/themeVariant.ts';

const CloseMobileMenuContext = createContext<(() => void) | null>(null);

type SidebarProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
};

function Sidebar({ children, header, footer }: SidebarProps) {
  const { pathname } = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const quickActionsOpen = useQuickActionsStore((state) => state.open);
  const pageHeader = useRelativePageStore((state) => state.pageHeader);
  const setHasMobileNavbar = useRelativePageStore((state) => state.setHasMobileNavbar);

  useEffect(() => {
    setHasMobileNavbar(true);
    return () => setHasMobileNavbar(false);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (quickActionsOpen) setIsMobileMenuOpen(false);
  }, [quickActionsOpen]);

  return (
    <>
      <Card
        className='lg:hidden! sticky! top-5 z-50 flex-row! items-center justify-end -ml-1 mt-5 h-12 w-16 rounded-l-none!'
        p='xs'
      >
        <ActionIcon onClick={() => setIsMobileMenuOpen(true)} variant='subtle'>
          <FontAwesomeIcon size='lg' icon={faBars} />
        </ActionIcon>
      </Card>

      <div className='lg:hidden -mt-12 mb-4 ml-20 mr-4 h-12 flex flex-col justify-center min-w-0'>
        {pageHeader && (
          <>
            <Title order={3} lineClamp={1}>
              {pageHeader.title}
            </Title>
            {pageHeader.subtitle && (
              <Text size='xs' c='dimmed' truncate>
                {pageHeader.subtitle}
              </Text>
            )}
          </>
        )}
      </div>

      <Drawer
        opened={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        withCloseButton={false}
        size='100%'
        styles={{ body: { height: '100%' } }}
      >
        <CloseButton size='xl' className='absolute! right-4 z-10' onClick={() => setIsMobileMenuOpen(false)} />

        <CloseMobileMenuContext.Provider value={() => setIsMobileMenuOpen(false)}>
          <div id='sidebar-content' className='h-full flex flex-col'>
            {header && <div className='shrink-0'>{header}</div>}
            <div className='flex flex-col flex-1 overflow-y-auto min-h-0'>{children}</div>
            {footer && <div className='shrink-0 pt-2'>{footer}</div>}
          </div>
        </CloseMobileMenuContext.Provider>
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
  icon?: IconLike;
  customIcon?: string | null;
  name?: string;
  title?: string;
  className?: string;
  activeMatches?: string[];
};

function Link({ to, end, icon, customIcon, name, title = name, className, activeMatches }: LinkProps) {
  const { t } = useTranslations();
  const { addWindow } = useWindows();
  const closeMobileMenu = useContext(CloseMobileMenuContext);
  const { pathname } = useLocation();
  const pendingPathname = usePendingPathname();
  const isLight = useComputedColorScheme('dark') === 'light';
  const resolvedIcon = useCustomIcon(customIcon, icon);
  const extraActive =
    activeMatches?.some((pattern) => matchPath({ path: pattern, end: false }, pendingPathname ?? pathname)) ?? false;

  if (to.endsWith('/*')) to = to.slice(0, to.length - 2);

  const items: ContextMenuItem[] = useMemo(
    () => [
      {
        type: 'action' as const,
        icon: faWindowRestore,
        label: t('elements.sidebar.button.openInVirtualWindow', {}),
        onClick: () => {
          closeMobileMenu?.();
          addWindow(
            title || 'Window',
            <MemoryRouter initialEntries={[to]}>
              <RouterRoutes isNormal={false} />
            </MemoryRouter>,
          );
        },
        color: 'gray',
      },
      {
        type: 'action' as const,
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
        type: 'action' as const,
        icon: faWindowRestore,
        label: t('elements.sidebar.button.openInNewTab', {}),
        onClick: () => openUrl(to),
        color: 'gray',
      },
    ],
    [t, addWindow, closeMobileMenu, title, to],
  );

  return (
    <ContextMenu items={items}>
      {({ openMenu }) => (
        <NavLink
          to={to}
          end={end}
          onContextMenu={(e) => {
            e.preventDefault();
            openMenu(e.clientX, e.clientY);
          }}
          onPointerEnter={() => preloadRouterForPath(to)}
          onFocus={() => preloadRouterForPath(to)}
          className='w-full'
        >
          {({ isActive: navActive }) => {
            const isActive =
              (pendingPathname !== null ? !!matchPath({ path: to, end: !!end }, pendingPathname) : navActive) ||
              extraActive;

            return (
              <Button
                color={isActive ? 'blue' : 'gray'}
                className={classNames(isActive && 'cursor-default! active', className)}
                variant={isLight && isActive ? 'outline' : 'subtle'}
                fullWidth
                styles={{ label: { width: '100%' } }}
              >
                {resolvedIcon && <Icon icon={resolvedIcon} className='mr-2' />} {name}
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
  const { impersonating, user } = useAuth();
  const navigate = useNavigate();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');
  const deviceOverrideCount = useDeviceOverrideCount();
  const [redactAddresses, setRedactAddresses] = useRedactAddresses();
  const themeVariant = useThemeVariantStore((state) => state.variant);
  const autoScheme = useThemeVariantStore((state) => state.autoScheme);
  const routeOrder = useGlobalStore((state) => state.settings.user?.routeOrder);

  const { confirmLogout, logoutModal } = useLogoutConfirmation();

  const accountRouteDisabled = !isNamedRoutePathAccessible(routeOrder, '/');

  const suspended = Boolean(user?.suspended);
  const accountHidden = suspended || accountRouteDisabled;
  const adminHidden = suspended || !user || !isAdmin(user);

  const themeVariants = getThemeVariants();
  const themeVariantCategories = getThemeVariantCategories();
  const allowedSchemes = getThemeVariant(DEFAULT_THEME_VARIANT)!.schemes;
  const activeSchemes = (getThemeVariant(themeVariant) ?? getThemeVariant(DEFAULT_THEME_VARIANT)!).schemes;
  const prefersAuto = colorScheme === 'auto' || autoScheme;

  const changeTheme = async (event: React.MouseEvent, nextTheme: 'auto' | 'dark' | 'light') => {
    if (nextTheme === 'auto' ? prefersAuto : nextTheme === colorScheme && !autoScheme) {
      return;
    }

    if (nextTheme === 'auto' && activeSchemes.length < 2) {
      setAutoScheme(true);
      return;
    }

    setAutoScheme(false);

    const nextComputed =
      nextTheme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : nextTheme;

    if (nextComputed === computedColorScheme) {
      setColorScheme(nextTheme);
      return;
    }

    animateThemeChange(event, () => setColorScheme(nextTheme));
  };

  const changeThemeVariant = (event: React.MouseEvent, variant: ThemeVariantDefinition) => {
    if (variant.id === themeVariant) {
      return;
    }

    const bothSchemes = variant.schemes.length > 1;
    const nextScheme = prefersAuto
      ? bothSchemes
        ? 'auto'
        : variant.schemes[0]
      : variant.schemes.includes(computedColorScheme)
        ? computedColorScheme
        : variant.schemes[0];

    animateThemeChange(event, () => {
      setThemeVariant(variant.id);
      setAutoScheme(prefersAuto && !bothSchemes);
      if (nextScheme !== colorScheme) {
        setColorScheme(nextScheme);
      }
    });
  };

  const animateThemeChange = (event: React.MouseEvent, apply: () => void) => {
    if (!document.startViewTransition) {
      apply();
      return;
    }

    const x = event.clientX;
    const y = event.clientY;

    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(() => {
      flushSync(apply);
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

  const themeVariantItems = (parent?: string): ContextMenuItem[] => {
    const isChild = (category?: string) =>
      (category && themeVariantCategories.some((c) => c.id === category) ? category : undefined) === parent;

    return [
      ...themeVariants
        .filter((variant) => isChild(variant.category))
        .map((variant) => ({
          type: 'action' as const,
          icon: variant.icon ?? faPalette,
          label: resolveString(variant.label),
          rightSection: variant.id === themeVariant && <FontAwesomeIcon icon={faCheck} size='sm' />,
          hidden: themeVariants.length < 2,
          onClick: (e: React.MouseEvent) => changeThemeVariant(e, variant),
        })),
      ...themeVariantCategories
        .filter((category) => isChild(category.category))
        .map((category) => {
          const items = themeVariantItems(category.id);

          return {
            type: 'action' as const,
            icon: category.icon ?? faPalette,
            label: resolveString(category.label),
            hidden: themeVariants.length < 2 || !items.some((item) => item.type === 'action' && !item.hidden),
            items,
          };
        }),
    ];
  };

  const items: ContextMenuItem[] = useMemo(
    () => [
      {
        type: 'action' as const,
        icon: faUserCog,
        label: t('pages.account.account.title', {}),
        hidden: accountHidden,
        onClick: () => navigate('/account'),
      },
      {
        type: 'divider' as const,
        hidden: accountHidden || adminHidden,
      },
      {
        type: 'action' as const,
        icon: faGraduationCap,
        label: t('pages.account.admin.title', {}),
        hidden: adminHidden,
        onClick: () => navigate('/admin'),
      },
      {
        type: 'divider' as const,
        hidden: accountHidden && adminHidden,
      },
      {
        type: 'action' as const,
        icon: faCircleHalfStroke,
        label: t('elements.sidebar.button.theme', {}),
        hidden: themeVariants.length < 2 && activeSchemes.length < 2,
        items: [
          ...themeVariantItems(),
          {
            type: 'divider' as const,
            hidden: themeVariants.length < 2,
          },
          {
            type: 'action' as const,
            icon: faCircleHalfStroke,
            label: t('elements.sidebar.button.themeAuto', {}),
            hidden: allowedSchemes.length < 2,
            rightSection: prefersAuto && <FontAwesomeIcon icon={faCheck} size='sm' />,
            onClick: (e: React.MouseEvent) => changeTheme(e, 'auto'),
          },
          {
            type: 'action' as const,
            icon: faMoon,
            label: t('elements.sidebar.button.themeDark', {}),
            hidden: !activeSchemes.includes('dark'),
            rightSection: colorScheme === 'dark' && !autoScheme && <FontAwesomeIcon icon={faCheck} size='sm' />,
            onClick: (e: React.MouseEvent) => changeTheme(e, 'dark'),
          },
          {
            type: 'action' as const,
            icon: faSun,
            label: t('elements.sidebar.button.themeLight', {}),
            hidden: !activeSchemes.includes('light'),
            rightSection: colorScheme === 'light' && !autoScheme && <FontAwesomeIcon icon={faCheck} size='sm' />,
            onClick: (e: React.MouseEvent) => changeTheme(e, 'light'),
          },
        ],
      },
      {
        type: 'action' as const,
        icon: faEyeSlash,
        label: t('elements.sidebar.button.redactAddresses', {}),
        rightSection: redactAddresses && <FontAwesomeIcon icon={faCheck} size='sm' />,
        onClick: () => setRedactAddresses(!redactAddresses),
      },
      {
        type: 'action' as const,
        icon: faRotateLeft,
        label: t('elements.sidebar.button.resetDeviceOverrides', { count: deviceOverrideCount }),
        hidden: deviceOverrideCount === 0,
        onClick: () => resetAllDeviceOverrides(),
      },
      {
        type: 'divider' as const,
      },
      {
        type: 'action' as const,
        icon: faArrowRightFromBracket,
        label: impersonating
          ? t('elements.sidebar.button.stopImpersonating', {})
          : t('elements.sidebar.button.logout', {}),
        color: 'red',
        onClick: confirmLogout,
      },
    ],
    [
      t,
      navigate,
      changeTheme,
      confirmLogout,
      accountHidden,
      adminHidden,
      colorScheme,
      computedColorScheme,
      themeVariant,
      autoScheme,
      deviceOverrideCount,
      redactAddresses,
      setRedactAddresses,
      impersonating,
    ],
  );

  if (!user) {
    return null;
  }

  return (
    <>
      <ContextMenu items={items}>
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
                  {user.nameFirst && user.nameLast ? `${user.nameFirst} ${user.nameLast}` : user.username}
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
                  {user.nameFirst && user.nameLast ? `${user.nameFirst} ${user.nameLast}` : user.username}
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

      {logoutModal}
    </>
  );
}

export default makeComponentHookable(Sidebar, {
  Link: makeComponentHookable(Link),
  Divider: makeComponentHookable(Divider),
  Footer: makeComponentHookable(Footer),
});
