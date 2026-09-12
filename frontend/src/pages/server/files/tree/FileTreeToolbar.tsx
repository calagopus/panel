import {
  faAnglesLeft,
  faAnglesRight,
  faFileUpload,
  faFolderOpen,
  faLink,
  faMagnifyingGlass,
  faMagnifyingGlassChart,
  faPlus,
  faRotate,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Collapse from '@/elements/layout/Collapse.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { useQuickActions } from '@/plugins/quick-actions/useQuickActions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileTreeToolbarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  allSelected: boolean;
  someSelected: boolean;
  hasVisibleItems: boolean;
  moving: boolean;
  canCreateFiles: boolean;
  createTargetWritable: boolean;
  searchOpen: boolean;
  searchQuery: string;
  searchLoading: boolean;
  searchError: string | null;
  treeLoading: boolean;
  analysisAvailable: boolean;
  onToggleAll: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSearchChange: (query: string) => void;
  onOpenCreateMenu: (x: number, y: number) => void;
  onUploadFiles: () => void;
  onUploadDirectory: () => void;
  onUploadUrl: () => void;
  onAnalysis: () => void;
  onReload: () => void;
}

export default function FileTreeToolbar({
  collapsed,
  onToggleCollapsed,
  allSelected,
  someSelected,
  hasVisibleItems,
  moving,
  canCreateFiles,
  createTargetWritable,
  searchOpen,
  searchQuery,
  searchLoading,
  searchError,
  treeLoading,
  analysisAvailable,
  onToggleAll,
  onOpenSearch,
  onCloseSearch,
  onSearchChange,
  onOpenCreateMenu,
  onUploadFiles,
  onUploadDirectory,
  onUploadUrl,
  onAnalysis,
  onReload,
}: FileTreeToolbarProps) {
  const { t } = useTranslations();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const registry = window.extensionContext.extensionRegistry.pages.server.files;

  useEffect(() => {
    if (!searchOpen || collapsed) return;

    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [searchOpen, collapsed]);

  useQuickActions([
    {
      id: 'files.tree.toggle',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t(collapsed ? 'pages.server.files.tree.show' : 'pages.server.files.tree.hide', {}),
      icon: <FontAwesomeIcon icon={collapsed ? faAnglesRight : faAnglesLeft} />,
      perform: onToggleCollapsed,
    },
    {
      id: 'files.tree.search',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.quickAction.searchTree', {}),
      icon: <FontAwesomeIcon icon={faMagnifyingGlass} />,
      keywords: ['find', 'filename', 'filter'],
      permission: 'files.read',
      perform: () => {
        if (collapsed) onToggleCollapsed();
        onOpenSearch();
        requestAnimationFrame(() => searchInputRef.current?.focus());
      },
    },
    {
      id: 'files.tree.refresh',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.quickAction.refreshTree', {}),
      icon: <FontAwesomeIcon icon={faRotate} />,
      keywords: ['reload', 'files'],
      permission: 'files.read',
      isVisible: () => !treeLoading && !searchLoading,
      perform: onReload,
    },
  ]);

  return (
    <div
      data-file-manager-tree-toolbar
      className={`shrink-0 ${collapsed ? 'h-[2.625rem]' : 'border-b border-(--mantine-color-default-border)'}`}
    >
      <div className={`flex items-center ${collapsed ? 'h-full' : 'h-11 justify-between px-2'}`}>
        <div
          className={`flex shrink-0 items-center ${collapsed ? 'h-full w-[2.625rem] justify-center max-[47.999rem]:w-full' : 'gap-1'}`}
        >
          <ActionIcon
            type='button'
            size={collapsed ? '100%' : 'sm'}
            variant='subtle'
            color='gray'
            aria-expanded={!collapsed}
            title={t(collapsed ? 'pages.server.files.tree.show' : 'pages.server.files.tree.hide', {})}
            aria-label={t(collapsed ? 'pages.server.files.tree.show' : 'pages.server.files.tree.hide', {})}
            onClick={onToggleCollapsed}
          >
            <FontAwesomeIcon icon={collapsed ? faAnglesRight : faAnglesLeft} />
          </ActionIcon>

          <div data-file-manager-tree-selection-control className={collapsed ? 'hidden' : undefined}>
            <Checkbox
              size='xs'
              checked={allSelected}
              indeterminate={!allSelected && someSelected}
              disabled={!hasVisibleItems || moving}
              aria-label={t(allSelected ? 'common.button.deselectAll' : 'common.button.selectAll', {})}
              title={t(allSelected ? 'common.button.deselectAll' : 'common.button.selectAll', {})}
              classNames={{ input: 'cursor-pointer!' }}
              onChange={onToggleAll}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            />
          </div>
        </div>

        <div data-file-manager-tree-actions className={collapsed ? 'hidden' : 'flex items-center gap-1'}>
          <ExtensionSlot
            components={registry.fileTreeToolbar.prependedComponents}
            name='files-fileTreeToolbar-prepended'
          />

          {canCreateFiles && (
            <ActionIcon
              type='button'
              size='sm'
              variant='subtle'
              color='gray'
              disabled={!createTargetWritable || moving}
              title={t('common.button.create', {})}
              aria-label={t('common.button.create', {})}
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onOpenCreateMenu(rect.left, rect.bottom);
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
            </ActionIcon>
          )}

          {canCreateFiles && (
            <ContextMenu
              enabled={createTargetWritable}
              menuProps={{ width: 240 }}
              items={[
                {
                  type: 'action',
                  icon: faFileUpload,
                  label: t('pages.server.files.tree.uploadFromComputer', {}),
                  color: 'gray',
                  items: [
                    {
                      type: 'action',
                      icon: faFileUpload,
                      label: t('pages.server.files.quickAction.uploadFiles', {}),
                      onClick: onUploadFiles,
                      color: 'gray',
                    },
                    {
                      type: 'action',
                      icon: faFolderOpen,
                      label: t('pages.server.files.quickAction.uploadDirectory', {}),
                      onClick: onUploadDirectory,
                      color: 'gray',
                    },
                  ],
                },
                {
                  type: 'action',
                  icon: faLink,
                  label: t('pages.server.files.tree.uploadFromUrl', {}),
                  onClick: onUploadUrl,
                  color: 'gray',
                },
              ]}
            >
              {({ openMenu }) => (
                <ActionIcon
                  type='button'
                  size='sm'
                  variant='subtle'
                  color='gray'
                  disabled={!createTargetWritable}
                  title={t('pages.server.files.tree.upload', {})}
                  aria-label={t('pages.server.files.tree.upload', {})}
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    openMenu(rect.left, rect.bottom);
                  }}
                >
                  <FontAwesomeIcon icon={faUpload} />
                </ActionIcon>
              )}
            </ContextMenu>
          )}

          <ActionIcon
            type='button'
            size='sm'
            variant={searchOpen ? 'light' : 'subtle'}
            color={searchOpen ? 'blue' : 'gray'}
            title={t('pages.server.files.quickAction.search', {})}
            aria-label={t('pages.server.files.quickAction.search', {})}
            onClick={searchOpen ? onCloseSearch : onOpenSearch}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </ActionIcon>

          <ActionIcon
            type='button'
            size='sm'
            variant='subtle'
            color='gray'
            disabled={!analysisAvailable}
            title={t('pages.server.files.tooltip.largestDirectories', {})}
            aria-label={t('pages.server.files.tooltip.largestDirectories', {})}
            onClick={onAnalysis}
          >
            <FontAwesomeIcon icon={faMagnifyingGlassChart} />
          </ActionIcon>

          <ActionIcon
            type='button'
            size='sm'
            variant='subtle'
            color='gray'
            loading={treeLoading || searchLoading}
            disabled={moving}
            title={t('pages.server.files.tree.reload', {})}
            aria-label={t('pages.server.files.tree.reload', {})}
            onClick={onReload}
          >
            <FontAwesomeIcon icon={faRotate} />
          </ActionIcon>

          <ExtensionSlot
            components={registry.fileTreeToolbar.appendedComponents}
            name='files-fileTreeToolbar-appended'
          />
        </div>
      </div>

      <Collapse expanded={searchOpen && !collapsed}>
        <div data-file-manager-tree-search className='px-2 pb-2'>
          <TextInput
            ref={searchInputRef}
            size='xs'
            value={searchQuery}
            error={searchError}
            placeholder={t('pages.server.files.tree.searchPlaceholder', {})}
            leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
            rightSection={
              searchQuery ? (
                <ActionIcon
                  type='button'
                  size='xs'
                  variant='subtle'
                  color='gray'
                  loading={searchLoading}
                  title={t('common.button.close', {})}
                  aria-label={t('common.button.close', {})}
                  onClick={() => {
                    onSearchChange('');
                    searchInputRef.current?.focus();
                  }}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </ActionIcon>
              ) : undefined
            }
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onCloseSearch();
            }}
          />
        </div>
      </Collapse>
    </div>
  );
}
