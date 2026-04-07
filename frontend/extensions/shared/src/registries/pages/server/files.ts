import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import React from 'react';
import { NavigateFunction, SetURLSearchParams } from 'react-router';
import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { FileManagerContextType } from '@/providers/contexts/fileManagerContext.ts';
import { ComponentListRegistry } from '../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

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

type FileEditorActionContent =
  | {
      contentType: 'string';

      content: React.FC<{
        content: string;
        setContent: (content: string) => void;
        dirty: boolean;
        setDirty: (dirty: boolean) => void;
      }>;
    }
  | {
      contentType: 'blob';

      content: React.FC<{
        content: Blob;
        setContent: (content: Blob) => void;
        dirty: boolean;
        setDirty: (dirty: boolean) => void;
      }>;
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

export class FilesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.editorContainer.mergeFrom(other.editorContainer);
    this.fileToolbar.mergeFrom(other.fileToolbar);
    this.fileActionBar.mergeFrom(other.fileActionBar);
    this.fileOperationsProgress.mergeFrom(other.fileOperationsProgress);
    this.fileSettings.mergeFrom(other.fileSettings);
    this.fileEditorSettings.mergeFrom(other.fileEditorSettings);
    this.fileImageViewerSettings.mergeFrom(other.fileImageViewerSettings);
    this.newFileContextMenu.mergeFrom(other.newFileContextMenu);
    this.fileContextMenu.mergeFrom(other.fileContextMenu);

    this.fileIconHandlers.push(...other.fileIconHandlers);
    this.fileOpenableHandlers.push(...other.fileOpenableHandlers);
    this.fileEditorActions.push(...other.fileEditorActions);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public editorContainer: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public fileToolbar: ComponentListRegistry = new ComponentListRegistry();
  public fileActionBar: ComponentListRegistry = new ComponentListRegistry();
  public fileOperationsProgress: ComponentListRegistry = new ComponentListRegistry();
  public fileSettings: ComponentListRegistry = new ComponentListRegistry();
  public fileEditorSettings: ComponentListRegistry = new ComponentListRegistry();
  public fileImageViewerSettings: ComponentListRegistry = new ComponentListRegistry();
  public newFileContextMenu: ContextMenuRegistry = new ContextMenuRegistry();
  public fileContextMenu: ContextMenuRegistry<{ file: z.infer<typeof serverDirectoryEntrySchema> }> =
    new ContextMenuRegistry();
  public fileMassContextMenu: ContextMenuRegistry = new ContextMenuRegistry();

  public fileIconHandlers: FileIconHandler[] = [];
  public fileOpenableHandlers: FileOpenableHandler[] = [];
  public fileEditorActions: FileEditorAction[] = [];

  public addFileIconHandler(handler: FileIconHandler): this {
    this.fileIconHandlers.push(handler);
    return this;
  }

  public addFileOpenableHandler(handler: FileOpenableHandler): this {
    this.fileOpenableHandlers.push(handler);
    return this;
  }

  public addFileEditorAction(action: FileEditorAction): this {
    this.fileEditorActions.push(action);
    return this;
  }

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterEditorContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.editorContainer);
    return this;
  }

  public enterFileToolbar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileToolbar);
    return this;
  }

  public enterFileActionBar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileActionBar);
    return this;
  }

  public enterFileOperationsProgress(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileOperationsProgress);
    return this;
  }

  public enterFileSettings(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileSettings);
    return this;
  }

  public enterFileEditorSettings(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileEditorSettings);
    return this;
  }

  public enterFileImageViewerSettings(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.fileImageViewerSettings);
    return this;
  }

  public enterNewFileContextMenu(callback: (registry: ContextMenuRegistry) => unknown): this {
    callback(this.newFileContextMenu);
    return this;
  }

  public enterFileContextMenu(
    callback: (registry: ContextMenuRegistry<{ file: z.infer<typeof serverDirectoryEntrySchema> }>) => unknown,
  ): this {
    callback(this.fileContextMenu);
    return this;
  }
}
