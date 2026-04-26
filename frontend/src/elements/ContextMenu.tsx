import { faEllipsis, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Menu, MenuProps } from '@mantine/core';
import { createContext, memo, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';

export interface ContextMenuItem {
  icon: IconDefinition;
  label: string;
  hidden?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  color?: 'gray' | 'red';
  items?: Omit<ContextMenuItem, 'items'>[];
  canAccess?: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuContextType {
  state: ContextMenuState;
  showMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  hideMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export const ContextMenuProvider = ({ children, menuProps }: { children: ReactNode; menuProps?: MenuProps }) => {
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  });

  const showMenu = (x: number, y: number, items: ContextMenuItem[]) => {
    setState({ visible: true, x, y, items });
  };

  const hideMenu = () => {
    setState((prev) => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    const handleScroll = () => {
      hideMenu();
    };

    if (state.visible) {
      document.addEventListener('scroll', handleScroll);
    }

    return () => document.removeEventListener('scroll', handleScroll);
  }, [state.visible]);

  return (
    <ContextMenuContext.Provider value={{ state, showMenu, hideMenu }}>
      <Menu
        disabled={!state.items.some((item) => !item.hidden && item.canAccess !== false)}
        opened={state.visible}
        onClose={hideMenu}
        width={200}
        withinPortal
        closeOnClickOutside
        transitionProps={{ transition: 'scale-y', duration: 200 }}
        {...menuProps}
      >
        <Menu.Target>
          <div
            style={{
              position: 'fixed',
              top: state.y,
              left: state.x,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        </Menu.Target>

        {children}

        <Menu.Dropdown>
          {state.items
            .filter((item) => !item.hidden && item.canAccess !== false)
            .map((item, idx) =>
              (item.items || []).length > 0 ? (
                <Menu.Sub key={idx} position={state.x + 300 > window.innerWidth ? 'left-start' : 'right-start'}>
                  <Menu.Sub.Target>
                    <Menu.Sub.Item
                      key={idx}
                      leftSection={<FontAwesomeIcon icon={item.icon} />}
                      color={item.color === 'red' ? 'red' : undefined}
                      disabled={item.disabled}
                      onClick={(e) => {
                        if (!e.isTrusted) return;

                        if (item.onClick) {
                          item.onClick();
                          hideMenu();
                        }
                      }}
                    >
                      {item.label}
                    </Menu.Sub.Item>
                  </Menu.Sub.Target>

                  <Menu.Sub.Dropdown>
                    {item
                      .items!.filter((subItem) => !subItem.hidden && subItem.canAccess !== false)
                      .map((subItem, subIdx) => (
                        <Menu.Item
                          key={idx.toString() + subIdx.toString()}
                          leftSection={<FontAwesomeIcon icon={subItem.icon} />}
                          color={subItem.color === 'red' ? 'red' : undefined}
                          disabled={subItem.disabled}
                          onClick={(e) => {
                            if (!e.isTrusted) return;

                            if (subItem.onClick) {
                              subItem.onClick();
                              hideMenu();
                            }
                          }}
                        >
                          {subItem.label}
                        </Menu.Item>
                      ))}
                  </Menu.Sub.Dropdown>
                </Menu.Sub>
              ) : (
                <Menu.Item
                  key={idx}
                  leftSection={<FontAwesomeIcon icon={item.icon} />}
                  color={item.color === 'red' ? 'red' : undefined}
                  disabled={item.disabled}
                  onClick={(e) => {
                    if (!e.isTrusted) return;

                    if (item.onClick) {
                      item.onClick();
                      hideMenu();
                    }
                  }}
                >
                  {item.label}
                </Menu.Item>
              ),
            )}
        </Menu.Dropdown>
      </Menu>
    </ContextMenuContext.Provider>
  );
};

export type ContextMenuChildrenProps = {
  items: ContextMenuItem[];
  openMenu: (x: number, y: number) => void;
  hideMenu: () => void;
};

type ContextMenuProps<P = unknown> = {
  items: ContextMenuItem[];
  children: (ctx: ContextMenuChildrenProps) => ReactNode;
} & ({ registry: ContextMenuRegistry<P>; registryProps: P } | { registry?: never; registryProps?: never });

function ContextMenuBase<P>({ items: rawItems = [], registry, registryProps, children }: ContextMenuProps<P>) {
  const context = useContext(ContextMenuContext);

  if (!context) {
    throw new Error('ContextMenu must be used within a ContextMenuProvider');
  }

  const items = useMemo(() => {
    const combinedItems = [...rawItems];

    if (registry && registryProps) {
      for (const interceptor of registry.itemInterceptors) {
        interceptor(combinedItems, registryProps);
      }
    }

    return combinedItems.filter((item) => item);
  }, [rawItems, registry, registryProps]);

  const { showMenu, hideMenu } = context;

  const openMenu = useCallback(
    (x: number, y: number) => {
      showMenu(x, y, items);
    },
    [items, showMenu],
  );

  return (
    <>
      {registry &&
        registryProps &&
        registry.componentItemInterceptors.map((Interceptor, idx) => (
          <Interceptor key={`context-menu-interceptor-${idx}`} items={items} {...registryProps} />
        ))}

      {children({ items, openMenu, hideMenu })}
    </>
  );
}

const ContextMenu = memo(ContextMenuBase) as typeof ContextMenuBase;

const ContextMenuToggle = memo(
  ({ openMenu, items }: { openMenu: (x: number, y: number) => void; items: ContextMenuItem[] }) => {
    if (!items.some((item) => !item.hidden && item.canAccess !== false)) {
      return <td></td>;
    }

    return (
      <td
        className='relative cursor-pointer min-w-10 text-center'
        onClick={(e) => {
          e.stopPropagation();

          const rect = e.currentTarget.getBoundingClientRect();
          openMenu(rect.left, rect.bottom);
        }}
      >
        <FontAwesomeIcon icon={faEllipsis} />
      </td>
    );
  },
);

ContextMenuToggle.displayName = 'ContextMenuToggle';

export default ContextMenu;
export { ContextMenuToggle };
