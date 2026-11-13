import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import React from 'react';
import { NavigateFunction, SetURLSearchParams } from 'react-router';
import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { FileManagerContextType } from '@/providers/contexts/fileManagerContext.ts';
import { ComponentListRegistry } from '../../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../../slices/contextMenu.ts';
import { DiskUsageBarRegistry } from './diskUsageBar.ts';
import { TrashRegistry } from './trash.ts';

type HandleOpenProps = {
  server: z.infer<typeof serverSchema>;
  fileManagerContext: FileManagerContextType;
  navigate: NavigateFunction;
  setSearchParams: SetURLSearchParams;

  handleDirectoryOpen: (path: string) => void;
  handleFileOpen: (file: string, action: string, params: Record<string, string>) => void;
};

export type FileOpenMode =
  | {
      openable: false;
      reason?: 'tooLarge';
    }
  | {
      openable: true;
      handleOpen: (props: HandleOpenProps) => void;
    };

interface FileEditorActionBase {
  name: string;
  title: (file: string) => string;
  header: {
    settings?: React.FC;
    rightSection?: React.FC;
  };
}

export interface FileEditorActionContext {
  surface: 'page' | 'inline';
  directory: string;
  file: string;
  path: string;
  params: Readonly<Record<string, string>>;
  workspace?: {
    paneId: string;
    paneIndex: number;
    paneCount: number;
    active: boolean;
  };
}

export interface FileEditorStringContentProps {
  content: string;
  setContent: (content: string) => void;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  readOnly?: boolean;
  context?: FileEditorActionContext;
}

export interface FileEditorBlobContentProps {
  content: Blob;
  setContent: (content: Blob) => void;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  readOnly?: boolean;
  context?: FileEditorActionContext;
}

type FileEditorActionContent =
  | {
      contentType: 'string';

      content: React.FC<FileEditorStringContentProps>;
    }
  | {
      contentType: 'blob';

      content: React.FC<FileEditorBlobContentProps>;
    };

type FileIconHandler = (
  file: z.infer<typeof serverDirectoryEntrySchema>,
  fileManagerContext: FileManagerContextType,
) => IconDefinition | undefined;
type FileOpenableHandler = (
  file: z.infer<typeof serverDirectoryEntrySchema>,
  fileManagerContext: FileManagerContextType,
) => FileOpenMode;
type FileEditorAction = FileEditorActionBase & FileEditorActionContent;

export interface FileContextMenuProps {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  directory: string;
  surface: 'table' | 'tree';
}

export class FilesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.editorContainer.mergeFrom(other.editorContainer);
    this.fileToolbar.mergeFrom(other.fileToolbar);
    this.fileTreeToolbar.mergeFrom(other.fileTreeToolbar);
    this.fileActionBar.mergeFrom(other.fileActionBar);
    this.fileOperationsProgress.mergeFrom(other.fileOperationsProgress);
    this.fileSettings.mergeFrom(other.fileSettings);
    this.fileEditorSettings.mergeFrom(other.fileEditorSettings);
    this.fileImageViewerSettings.mergeFrom(other.fileImageViewerSettings);
    this.newFileContextMenu.mergeFrom(other.newFileContextMenu);
    this.fileContextMenu.mergeFrom(other.fileContextMenu);
    this.fileMassContextMenu.mergeFrom(other.fileMassContextMenu);
    this.trash.mergeFrom(other.trash);
    this.diskUsageBar.mergeFrom(other.diskUsageBar);

    this.fileIconHandlers.push(...other.fileIconHandlers);
    this.fileOpenableHandlers.push(...other.fileOpenableHandlers);
    this.fileEditorActions.push(...other.fileEditorActions);

    return this;
  }

  /**
   * Container of the file list.
   * @since 1.0.0
   */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /**
   * Container of the full page file editor.
   * @since 1.0.0
   */
  public editorContainer: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /**
   * Rendered around the new and upload buttons above the file list.
   * @since 1.0.0
   */
  public fileToolbar: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Rendered in the toolbar of the sidebar file tree.
   * @since 1.2.0
   */
  public fileTreeToolbar: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Rendered in the floating bar shown while files are selected.
   * @since 1.0.0
   */
  public fileActionBar: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Rendered inside the file operations and uploads progress popover.
   * @since 1.0.0
   */
  public fileOperationsProgress: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Rendered in the file manager settings popover.
   * @since 1.0.0
   */
  public fileSettings: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Rendered in the editor settings popover, unless the editor action replaces it.
   * @since 1.0.0
   */
  public fileEditorSettings: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Rendered in the image viewer settings popover, unless the editor action replaces it.
   * @since 1.0.0
   */
  public fileImageViewerSettings: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Items of the "New" dropdown in the toolbar and the file tree.
   * @since 1.0.0
   */
  public newFileContextMenu: ContextMenuRegistry = new ContextMenuRegistry();
  /**
   * Context menu of a single file.
   * @since 1.0.0
   */
  public fileContextMenu: ContextMenuRegistry<FileContextMenuProps> = new ContextMenuRegistry();
  /**
   * Context menu shown when multiple files are selected.
   * @since 1.0.0
   */
  public fileMassContextMenu: ContextMenuRegistry = new ContextMenuRegistry();
  /** @since 1.2.6 */
  public trash: TrashRegistry = new TrashRegistry();
  /** @since 1.2.8 */
  public diskUsageBar: DiskUsageBarRegistry = new DiskUsageBarRegistry();

  /** @since 1.0.0 */
  public fileIconHandlers: FileIconHandler[] = [];
  /** @since 1.0.2 */
  public fileOpenableHandlers: FileOpenableHandler[] = [];
  /** @since 1.0.2 */
  public fileEditorActions: FileEditorAction[] = [];

  /**
   * Handlers run in order before the stock icons, the first truthy return wins.
   * @since 1.0.0
   */
  public addFileIconHandler(handler: FileIconHandler): this {
    this.fileIconHandlers.push(handler);
    return this;
  }

  /**
   * Handlers run in order before the stock checks, the first `openable: true` wins, `openable: false` falls through.
   * @since 1.0.2
   */
  public addFileOpenableHandler(handler: FileOpenableHandler): this {
    this.fileOpenableHandlers.push(handler);
    return this;
  }

  /**
   * Picked when its `name` matches the editor action, e.g. from `handleFileOpen(file, action)`.
   * @since 1.0.2
   */
  public addFileEditorAction(action: FileEditorAction): this {
    this.fileEditorActions.push(action);
    return this;
  }

  /** @since 1.0.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.0.0 */
  public enterEditorContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.editorContainer);
    return this;
  }

  /** @since 1.0.0 */
  public enterFileToolbar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileToolbar);
    return this;
  }

  /** @since 1.2.0 */
  public enterFileTreeToolbar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileTreeToolbar);
    return this;
  }

  /** @since 1.0.0 */
  public enterFileActionBar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileActionBar);
    return this;
  }

  /** @since 1.0.0 */
  public enterFileOperationsProgress(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileOperationsProgress);
    return this;
  }

  /** @since 1.0.0 */
  public enterFileSettings(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileSettings);
    return this;
  }

  /** @since 1.0.0 */
  public enterFileEditorSettings(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileEditorSettings);
    return this;
  }

  /** @since 1.0.0 */
  public enterFileImageViewerSettings(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileImageViewerSettings);
    return this;
  }

  /** @since 1.0.0 */
  public enterNewFileContextMenu(callback: (registry: ContextMenuRegistry) => unknown): this {
    callback(this.newFileContextMenu);
    return this;
  }

  /** @since 1.0.0 */
  public enterFileContextMenu(callback: (registry: ContextMenuRegistry<FileContextMenuProps>) => unknown): this {
    callback(this.fileContextMenu);
    return this;
  }

  /** @since 1.2.3 */
  public enterFileMassContextMenu(callback: (registry: ContextMenuRegistry) => unknown): this {
    callback(this.fileMassContextMenu);
    return this;
  }

  /** @since 1.2.6 */
  public enterTrash(callback: (registry: TrashRegistry) => unknown): this {
    callback(this.trash);
    return this;
  }

  /** @since 1.2.8 */
  public enterDiskUsageBar(callback: (registry: DiskUsageBarRegistry) => unknown): this {
    callback(this.diskUsageBar);
    return this;
  }
}
