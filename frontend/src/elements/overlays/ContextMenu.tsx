import { faEllipsis, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Menu, MenuProps } from '@mantine/core';
import {
  createContext,
  type MouseEvent,
  memo,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import Spinner from '@/elements/feedback/Spinner.tsx';

export interface ContextMenuActionItem {
  type: 'action';
  icon?: IconDefinition;
  label: string;
  rightSection?: ReactNode;
  hidden?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: MouseEvent) => void | Promise<unknown>;
  color?: 'gray' | 'red';
  items?: (Omit<ContextMenuActionItem, 'items'> | ContextMenuDividerItem)[];
  canAccess?: boolean;
}

export interface ContextMenuDividerItem {
  type: 'divider';
  hidden?: boolean;
  canAccess?: boolean;
}

export type ContextMenuItem = ContextMenuActionItem | ContextMenuDividerItem;

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  menuProps?: MenuProps;
  owner?: string;
}

interface ContextMenuContextType {
  showMenu: (x: number, y: number, items: ContextMenuItem[], menuProps?: MenuProps, owner?: string) => void;
  updateMenuItems: (owner: string, items: ContextMenuItem[]) => void;
  releaseMenu: (owner: string) => void;
  hideMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);
const ContextMenuLoadingContext = createContext(false);

const itemIcon = (item: Omit<ContextMenuActionItem, 'items'>) =>
  item.loading ? <Spinner size={14} /> : item.icon ? <FontAwesomeIcon icon={item.icon} /> : undefined;

export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  });

  const showMenu = useCallback(
    (x: number, y: number, items: ContextMenuItem[], menuProps?: MenuProps, owner?: string) => {
      setState({ visible: true, x, y, items, menuProps, owner });
    },
    [],
  );

  const updateMenuItems = useCallback((owner: string, items: ContextMenuItem[]) => {
    setState((prev) => (prev.visible && prev.owner === owner && prev.items !== items ? { ...prev, items } : prev));
  }, []);

  const releaseMenu = useCallback((owner: string) => {
    setState((prev) => (prev.visible && prev.owner === owner ? { ...prev, visible: false } : prev));
  }, []);

  const hideMenu = useCallback(() => {
    setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      hideMenu();
    };

    if (state.visible) {
      document.addEventListener('scroll', handleScroll, { capture: true });
    }

    return () => document.removeEventListener('scroll', handleScroll, { capture: true });
  }, [state.visible, hideMenu]);

  const contextValue = useMemo(
    () => ({ showMenu, updateMenuItems, releaseMenu, hideMenu }),
    [showMenu, updateMenuItems, releaseMenu, hideMenu],
  );

  return (
    <ContextMenuContext.Provider value={contextValue}>
      <Menu
        disabled={!state.items.some((item) => item.type === 'action' && !item.hidden && item.canAccess !== false)}
        opened={state.visible}
        onClose={hideMenu}
        styles={{ dropdown: { minWidth: 200 } }}
        withinPortal
        closeOnClickOutside
        transitionProps={{ transition: 'scale-y', duration: 200 }}
        {...state.menuProps}
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
              item.type === 'divider' ? (
                <Menu.Divider key={idx} />
              ) : (item.items || []).length > 0 ? (
                <Menu.Sub
                  key={idx}
                  position={state.x + 300 > window.innerWidth ? 'left-start' : 'right-start'}
                  opened={item.disabled ? false : undefined}
                >
                  <Menu.Sub.Target>
                    <Menu.Sub.Item
                      key={idx}
                      leftSection={itemIcon(item)}
                      color={item.color === 'red' ? 'red' : undefined}
                      disabled={item.disabled || item.loading}
                      onClick={(e) => {
                        if (!e.isTrusted) return;

                        if (item.onClick) {
                          item.onClick(e);
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
                      .map((subItem, subIdx) =>
                        subItem.type === 'divider' ? (
                          <Menu.Divider key={idx.toString() + subIdx.toString()} />
                        ) : (
                          <Menu.Item
                            key={idx.toString() + subIdx.toString()}
                            leftSection={itemIcon(subItem)}
                            rightSection={subItem.rightSection}
                            color={subItem.color === 'red' ? 'red' : undefined}
                            disabled={subItem.disabled || subItem.loading}
                            onClick={(e) => {
                              if (!e.isTrusted) return;

                              if (subItem.onClick) {
                                subItem.onClick(e);
                                hideMenu();
                              }
                            }}
                          >
                            {subItem.label}
                          </Menu.Item>
                        ),
                      )}
                  </Menu.Sub.Dropdown>
                </Menu.Sub>
              ) : (
                <Menu.Item
                  key={idx}
                  leftSection={itemIcon(item)}
                  rightSection={item.rightSection}
                  color={item.color === 'red' ? 'red' : undefined}
                  disabled={item.disabled || item.loading}
                  onClick={(e) => {
                    if (!e.isTrusted) return;

                    if (item.onClick) {
                      item.onClick(e);
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

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error('ContextMenu must be used within a ContextMenuProvider');
  return context;
};

export const useHideContextMenu = () => {
  const context = useContext(ContextMenuContext);

  return useCallback(() => context?.hideMenu(), [context]);
};

export type ContextMenuChildrenProps = {
  items: ContextMenuItem[];
  loading: boolean;
  openMenu: (x: number, y: number) => void;
  hideMenu: () => void;
};

type ContextMenuProps<P = unknown> = {
  items: ContextMenuItem[];
  enabled?: boolean;
  loading?: boolean;
  menuProps?: MenuProps;
  children: (ctx: ContextMenuChildrenProps) => ReactNode;
} & ({ registry: ContextMenuRegistry<P>; registryProps: P } | { registry?: never; registryProps?: never });

function ContextMenuBase<P>({
  items: rawItems = [],
  registry,
  registryProps,
  enabled = true,
  loading: loadingProp = false,
  menuProps,
  children,
}: ContextMenuProps<P>) {
  const context = useContext(ContextMenuContext);

  if (enabled && !context) {
    throw new Error('ContextMenu must be used within a ContextMenuProvider');
  }

  const interceptedItems = useMemo(() => {
    const combinedItems = [...rawItems];

    if (enabled && registry && registryProps) {
      for (const interceptor of registry.itemInterceptors) {
        interceptor(combinedItems, registryProps);
      }
    }

    return combinedItems.filter((item) => item);
  }, [rawItems, registry, registryProps, enabled]);

  const owner = useId();
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const loading = loadingProp || pendingKeys.length > 0;

  const items = useMemo(() => {
    const track = <T extends ContextMenuActionItem | Omit<ContextMenuActionItem, 'items'>>(
      item: T,
      key: string,
    ): T => ({
      ...item,
      disabled: item.disabled || loading,
      loading: item.loading || pendingKeys.some((pendingKey) => pendingKey === key || pendingKey.startsWith(`${key}.`)),
      onClick:
        item.onClick &&
        ((e: MouseEvent) => {
          const result = item.onClick!(e);

          if (result instanceof Promise) {
            setPendingKeys((keys) => [...keys, key]);
            result.finally(() =>
              setPendingKeys((keys) => {
                const index = keys.indexOf(key);
                return index === -1 ? keys : keys.toSpliced(index, 1);
              }),
            );
          }

          return result;
        }),
    });

    return interceptedItems.map((item, idx) =>
      item.type === 'divider'
        ? item
        : {
            ...track(item, `${idx}`),
            items: item.items?.map((subItem, subIdx) =>
              subItem.type === 'divider' ? subItem : track(subItem, `${idx}.${subIdx}`),
            ),
          },
    );
  }, [interceptedItems, loading, pendingKeys]);

  const showMenu = context?.showMenu;
  const updateMenuItems = context?.updateMenuItems;
  const releaseMenu = context?.releaseMenu;
  const contextHideMenu = context?.hideMenu;

  useEffect(() => {
    updateMenuItems?.(owner, items);
  }, [updateMenuItems, owner, items]);

  useEffect(() => () => releaseMenu?.(owner), [releaseMenu, owner]);

  const openMenu = useCallback(
    (x: number, y: number) => {
      if (!enabled) return;
      showMenu?.(x, y, items, menuProps, owner);
    },
    [items, showMenu, enabled, menuProps, owner],
  );

  const hideMenu = useCallback(() => {
    contextHideMenu?.();
  }, [contextHideMenu]);

  return (
    <>
      {enabled &&
        registry &&
        registryProps &&
        registry.componentItemInterceptors.map((Interceptor, idx) => (
          <Interceptor key={`context-menu-interceptor-${idx}`} items={items} {...registryProps} />
        ))}

      <ContextMenuLoadingContext.Provider value={loading}>
        {children({ items, loading, openMenu, hideMenu })}
      </ContextMenuLoadingContext.Provider>
    </>
  );
}

const ContextMenu = memo(ContextMenuBase) as typeof ContextMenuBase;

const ContextMenuToggle = memo(
  ({ openMenu, items }: { openMenu: (x: number, y: number) => void; items: ContextMenuItem[] }) => {
    const loading = useContext(ContextMenuLoadingContext);

    if (!items.some((item) => item.type === 'action' && !item.hidden && item.canAccess !== false)) {
      return <td></td>;
    }

    return (
      <td
        className='relative cursor-pointer min-w-10 text-center'
        onClick={(e) => {
          e.stopPropagation();
          openMenu(e.clientX, e.clientY);
        }}
      >
        {loading ? <Spinner size={14} /> : <FontAwesomeIcon icon={faEllipsis} />}
      </td>
    );
  },
);

ContextMenuToggle.displayName = 'ContextMenuToggle';

export default ContextMenu;
export { ContextMenuToggle };
