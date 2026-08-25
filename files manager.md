# Files Manager extension points

This document covers the extension surfaces used by the reworked Files Manager editor/tree mode.

## Newly added registry

### `fileTreeToolbar`

`fileTreeToolbar` is a `ComponentListRegistry` rendered in the icon toolbar at the top of the file tree. It is the registry added specifically for the new tree mode.

- `prependComponent(Component)` renders before the built-in search, create, upload, and reload buttons.
- `appendComponent(Component)` renders after the built-in buttons.
- Registered components receive no props. They can read the current server and file-manager state from the normal Calagopus stores.
- Register components once from the extension's `initialize()` method.

Example toolbar button:

```tsx
// src/FileTreeToolbarButton.tsx
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router';
import ActionIcon from '@/elements/ActionIcon.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function FileTreeToolbarButton() {
  const navigate = useNavigate();
  const serverId = useServerStore((state) => state.server.uuidShort);

  return (
    <ActionIcon
      type='button'
      size='sm'
      variant='subtle'
      color='gray'
      title='Open my file tool'
      aria-label='Open my file tool'
      onClick={() => navigate(`/server/${serverId}/my-file-tool`)}
    >
      <FontAwesomeIcon icon={faWandMagicSparkles} fixedWidth />
    </ActionIcon>
  );
}
```

Register it:

```tsx
// src/index.ts
import { Extension, type ExtensionContext } from 'shared';
import FileTreeToolbarButton from './FileTreeToolbarButton.tsx';

class MyExtension extends Extension {
  public initialize(ctx: ExtensionContext): void {
    ctx.extensionRegistry.pages.server.files.enterFileTreeToolbar((toolbar) =>
      toolbar.appendComponent(FileTreeToolbarButton),
    );
  }
}

export default new MyExtension();
```

Use `prependComponent(FileTreeToolbarButton)` instead when the button should appear before the native buttons.

## Existing hooks honored by the new tree

These registries already existed, but the reworked tree deliberately uses them so extensions behave consistently in both Files Manager views.

### New-file context menu

`enterNewFileContextMenu()` adds actions to the New menu. The same registered action appears in the normal Files view and the tree's plus-button menu.

```tsx
import { faFileCirclePlus } from '@fortawesome/free-solid-svg-icons';

ctx.extensionRegistry.pages.server.files.enterNewFileContextMenu((menu) =>
  menu.addItemInterceptor((items) => {
    items.push({
      type: 'action',
      icon: faFileCirclePlus,
      label: 'Create extension file',
      color: 'gray',
      onClick: () => {
        // Open your extension UI or run your extension action.
      },
    });
  }),
);
```

### File row context menu

`enterFileContextMenu()` now applies to rows in both the normal table and the editor tree. The tree uses the complete native menu (open in a window, rename, copy, remote copy, move, archive/extract, download, details, fingerprint, permissions, and delete), then runs extension interceptors against that same item list.

The interceptor props include the file, its containing directory, and the surface that opened the menu:

```tsx
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

ctx.extensionRegistry.pages.server.files.enterFileContextMenu((menu) =>
  menu.addItemInterceptor((items, { file, directory, surface }) => {
    if (!file.name.endsWith('.myconfig')) return;

    items.push({
      type: 'action',
      icon: faWandMagicSparkles,
      label: `Inspect ${file.name}`,
      color: 'gray',
      onClick: () => {
        // surface is "table" or "tree"; directory is the file's parent path.
        openInspector({ file, directory, surface });
      },
    });
  }),
);
```

Right-clicking a tree row and pressing its ellipsis button open the same menu, so an extension only registers its action once.

### Custom file icons

`addFileIconHandler()` can replace the icon for matching files. The tree renders the native `FileRowIcon`, so custom handlers apply automatically.

Return `undefined` when the extension does not handle a file, allowing the next handler or the native icon to run.

```tsx
import { faGear } from '@fortawesome/free-solid-svg-icons';

ctx.extensionRegistry.pages.server.files.addFileIconHandler((file) =>
  file.name.endsWith('.myconfig') ? faGear : undefined,
);
```

### Normal Files toolbar

`enterFileToolbar()` still controls the page-level toolbar beside Connect and New. Use `enterFileTreeToolbar()` only for buttons inside the tree card.

```tsx
ctx.extensionRegistry.pages.server.files.enterFileToolbar((toolbar) =>
  toolbar.appendComponent(MyPageToolbarButton),
);
```

## Opening custom file types in the inline editor

Editor mode uses the existing typed file-opening API. Extensions register two pieces:

1. `addFileOpenableHandler()` matches a file and chooses an action name.
2. `addFileEditorAction()` connects that action name to a string or blob React component.

The component opens in the pane beside the file tree. It does not need a new route. Return `{ openable: false }` for files your handler does not claim so later handlers and native formats still work.

Example NBT opener:

```tsx
// src/NbtViewer.tsx
import type { FileEditorBlobContentProps } from 'shared/src/registries/pages/server/files';

export default function NbtViewer({ content, context }: FileEditorBlobContentProps) {
  // Parse the Blob with your NBT library.
  // context?.path is the complete server path.
  return (
    <div className='h-full overflow-auto p-4'>
      Reading {content.size} bytes from {context?.path}
    </div>
  );
}
```

```tsx
// src/index.ts
import { Extension, type ExtensionContext } from 'shared';
import NbtViewer from './NbtViewer.tsx';

class MyExtension extends Extension {
  public initialize(ctx: ExtensionContext): void {
    const files = ctx.extensionRegistry.pages.server.files;

    files.addFileOpenableHandler((file) =>
      file.name.endsWith('.nbt')
        ? {
            openable: true,
            handleOpen: ({ handleFileOpen }) => handleFileOpen(file.name, 'nbt', {}),
          }
        : { openable: false },
    );

    files.addFileEditorAction({
      name: 'nbt',
      title: (file) => `NBT: ${file}`,
      header: {},
      contentType: 'blob',
      content: NbtViewer,
    });
  }
}

export default new MyExtension();
```

Use `contentType: 'string'` for text-based formats. Its component receives `content`, `setContent`, `dirty`, `setDirty`, and the same optional `context`.

The inline context contains:

- `surface`: `'inline'`
- `directory`: the containing directory
- `file`: the file name
- `path`: the complete path
- `params`: values supplied to `handleFileOpen()`
- `workspace`: present in editor mode, with `paneId`, zero-based `paneIndex`, current `paneCount`, and whether the pane is active

Custom editors are mounted independently in every visible pane. Keep component state local to the supplied `context.path`, and do not assume only one instance of an editor action exists at a time. This lets an extension-backed editor such as an NBT or database viewer participate in split editing without a second registration API.

SQLite extensions normally do not need a custom action: `.db`, `.db3`, `.sqlite`, and `.sqlite3` already open the native SQLite explorer beside the tree.

## Tabs, split editing, and shortcuts

- Clicked files open in the active pane. Existing tabs are focused in the pane that owns them.
- Drag one or several selected files from the tree onto an editor pane. Each additional file opens in its own pane so the files remain visible together.
- Drag any tab onto its own editor body to split it into a new pane, or onto another pane to move it there. Unsaved drafts move with dirty tabs.
- Drag the separator between adjacent panes to resize them. Resize updates are animation-frame batched and persisted only after the pointer is released.
- The complete tab and pane layout is restored per server. Files that return HTTP 404 while restoring are removed silently.
- `Ctrl/Cmd+W` closes the active tab.
- `Ctrl/Cmd+Tab` and `Ctrl/Cmd+PageDown` select the next tab; add `Shift` or use `Ctrl/Cmd+PageUp` for the previous tab.
- `Ctrl/Cmd+1` through `Ctrl/Cmd+8` select a tab by position. `Ctrl/Cmd+9` selects the last tab.

Image and audio panes use the same native Calagopus viewers as the original file editor. Audio speed and pitch are linked: slower playback also lowers pitch.

## Implementation rules

- Use Calagopus elements such as `ActionIcon`, `Button`, `ContextMenu`, and `Tooltip`; these components remain hookable and inherit the active theme.
- Check permissions inside an injected component before exposing actions that read or mutate files.
- Keep toolbar components compact. An icon button with a title and `aria-label` matches the native tree toolbar.
- Do not register components from a React render or effect. Registry initialization belongs in the extension's `initialize()` method.

## Theme contract

Editor mode uses native Mantine components and exposes CSS variables for the remaining layout values. A theme extension can override these in its `src/app.css` without replacing the file-manager components:

```css
:root {
  --file-manager-workspace-height: calc(100dvh - 8rem);
  --file-manager-workspace-min-height: 42rem;
  --file-manager-workspace-gap: 0rem;
  --file-manager-workspace-divider-color: var(--mantine-color-default-border);
  --file-manager-tree-width: 20rem;
  --file-manager-tree-collapsed-width: 2.75rem;
  --file-manager-tree-transition-duration: 180ms;
  --file-manager-tree-fade-duration: 120ms;
  --file-manager-tree-min-content-width: 39rem;
  --file-manager-tree-columns: 20rem 6.5rem 8.5rem 2rem;
  --file-manager-editor-min-width: 38rem;
  --file-manager-editor-pane-min-width: 30rem;
  --file-manager-editor-resize-handle-width: 4px;
  --file-manager-editor-active-pane-border-color: transparent;
  --file-manager-audio-max-width: 42rem;
  --file-manager-tree-row-height: 32px; /* Keep this value in pixels for virtualization. */
  --file-manager-toolbar-height: 2.75rem;
  --file-manager-toolbar-padding-inline: 0.5rem;
  --file-manager-row-padding-inline: 0.625rem;
  --file-manager-row-gap: 0.5rem;
  --file-manager-column-gap: 0.5rem;
  --file-manager-tab-height: 2.625rem;
  --file-manager-tab-scrollbar-height: 0.75rem;
  --file-manager-tab-max-width: 14rem;
  --file-manager-tab-gap: 0.5rem;
  --file-manager-tab-padding-inline: 1rem;
  --file-manager-tab-close-margin: 0.375rem;
  --file-manager-active-tab-border-width: 2px;
  --file-manager-editor-header-height: 3rem;
  --file-manager-editor-header-gap: 0.75rem;
  --file-manager-editor-header-padding-inline: 0.75rem;
  --file-manager-folder-color: var(--mantine-color-yellow-5);
  --file-manager-file-color: var(--mantine-color-dimmed);
  --file-manager-selection-background: var(--mantine-color-blue-light);
  --file-manager-selection-border-color: var(--mantine-color-blue-5);
  --file-manager-selection-border-width: 3px;
}
```

Stable semantic selectors are also available when a variable is not enough:

- `[data-file-manager-workspace]` and `[data-file-manager-workspace-grid]`
- `[data-file-manager-tree]`, `[data-file-manager-tree-toolbar]`, `[data-file-manager-tree-search]`
- `[data-file-manager-tree-header]`, `[data-file-manager-tree-table]`, and `[data-file-manager-tree-row]`
- `[data-file-manager-tree-name]`, `[data-file-manager-tree-size]`, and `[data-file-manager-tree-modified]`
- `[data-file-manager-file-name]` (the final extension is kept visible while the base name truncates)
- `[data-file-manager-editor]`, `[data-file-manager-editor-tabs]`, `[data-file-manager-editor-tab]`
- `[data-file-manager-editor-split]`, `[data-file-manager-editor-pane]`, and `[data-file-manager-editor-resize-handle]`
- `[data-file-manager-editor-drop-overlay]`, `[data-file-manager-image-preview]`, and `[data-file-manager-audio-preview]`
- `[data-file-manager-editor-header]`, `[data-file-manager-editor-content]`, and `[data-file-manager-editor-empty]`
- `[data-file-manager-icon="folder"]` and `[data-file-manager-icon="file"]`
- `[data-file-manager-collaboration-participants]` and `[data-file-manager-collaboration-conflict]`

Prefer variables for dimensions and colors. Use the semantic selectors only for more structural theme changes. The workspace and tree both provide horizontal overflow when a theme increases their minimum widths.

## Tree drag-and-drop behavior

- A green outlined directory row is the exact destination for an upload or internal move.
- When the root directory is the destination, the complete tree card receives the green outline.
- Dropping on a file targets that file's parent directory.
- External file and nested-directory drops use the normal Calagopus uploader and preserve relative paths.
