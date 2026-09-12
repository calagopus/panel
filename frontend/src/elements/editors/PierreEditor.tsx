import { useComputedColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  type BaseCodeOptions,
  DEFAULT_VIRTUAL_FILE_METRICS,
  type FileContents,
  type FileDiffMetadata,
  type FileDiffOptions,
  type File as FileInstance,
  type FileOptions,
  type PostRenderPhase,
  parseDiffFromFile,
  type SelectedLineRange,
} from '@pierre/diffs';
import {
  Editor,
  type EditorCaret,
  type EditorChangeEvent,
  type EditorFactory,
  type EditorOptions,
  type TextEdit,
} from '@pierre/diffs/edit';
import { EditProvider, File, FileDiff, Virtualizer } from '@pierre/diffs/react';
import { type CSSProperties, forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

export interface PierreCaretMetadata {
  name: string;
  color: string;
}

export type PierreCaret = EditorCaret<PierreCaretMetadata>;

export type PierreFileChangeEvent = EditorChangeEvent<'file', undefined, PierreCaretMetadata>;

export interface PierreLocalSelection {
  anchorOffset: number;
  headOffset: number;
}

type PierreFileEditor = Editor<'file', undefined, PierreCaretMetadata>;
type PierreFileEditorOptions = EditorOptions<'file', undefined, PierreCaretMetadata>;

export interface PierreEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  applyEdits: (edits: TextEdit[], updateHistory?: boolean) => void;
  setCarets: (carets: PierreCaret[]) => void;
  focus: () => void;
}

interface CommonPierreProps {
  wordWrap?: boolean;
  fontSize?: number;
  height?: CSSProperties['height'];
  width?: CSSProperties['width'];
}

export interface PierreEditorProps extends CommonPierreProps {
  path: string;
  defaultValue: string;
  readOnly?: boolean;
  selectedLines?: SelectedLineRange;
  unsafeCSS?: string;
  onChange?: (value: string) => void;
  onChangeEvent?: (event: PierreFileChangeEvent) => void;
  /** Fires while the editor is focused whenever the local selection moves; `null` when it clears. */
  onSelectionChange?: (selection: PierreLocalSelection | null) => void;
  onMount?: (handle: PierreEditorHandle) => void;
  onPostRender?: (node: HTMLElement, instance: FileInstance<undefined>, phase: PostRenderPhase) => void;
}

export interface PierreDiffEditorProps extends CommonPierreProps {
  originalPath: string;
  originalValue: string;
  modifiedPath: string;
  modifiedValue: string;
  readOnly?: true;
  onMount?: (handle: PierreEditorHandle) => void;
}

const createEditor: EditorFactory<undefined, PierreCaretMetadata> = (editorType, options, editStateKey) =>
  new Editor(editorType, options, editStateKey);

const renderRemoteCaret = ({ metadata }: PierreCaret): HTMLElement => {
  const caret = document.createElement('span');
  caret.setAttribute('aria-hidden', 'true');
  caret.style.cssText = `position:relative;display:block;width:2px;height:var(--diffs-line-height,1.2em);background-color:${metadata.color};pointer-events:none;`;

  const label = document.createElement('span');
  label.textContent = metadata.name;
  label.style.cssText = `position:absolute;left:0;bottom:100%;padding:0 3px;border-radius:3px 3px 3px 0;background-color:${metadata.color};color:#fff;font:500 10px/1.4 ui-sans-serif,system-ui,sans-serif;white-space:nowrap;`;

  caret.append(label);
  return caret;
};

const positionToOffset = (text: string, position: { line: number; character: number }): number => {
  let offset = 0;
  let line = 0;
  for (let i = 0; i < text.length && line < position.line; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      offset = i + 1;
    }
  }
  return offset + position.character;
};

const toFile = (path: string, contents: string, cacheKey?: string): FileContents => {
  const name = path.trim() || 'untitled';
  return { name, contents, cacheKey: cacheKey ?? name };
};

const replaceBuffer = (editor: PierreFileEditor, text: string): void => {
  const current = editor.getText();
  if (current === text) return;
  const lines = current.split('\n');
  const last = lines.length - 1;
  editor.applyEdits(
    [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: last, character: lines[last]?.length ?? 0 },
        },
        newText: text,
      },
    ],
    false,
  );
};

function usePierreStyle(
  height: CSSProperties['height'] | undefined,
  width: CSSProperties['width'] | undefined,
  fontSize: number,
  isDark: boolean,
): CSSProperties {
  return useMemo<CSSProperties>(
    () => ({
      height: height ?? '100%',
      width: width ?? '100%',
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'auto',
      backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
      fontSize,
      ['--diffs-font-size' as string]: `${fontSize}px`,
      ['--diffs-line-height' as string]: `${Math.ceil(fontSize * 1.5)}px`,
      ['--diffs-tab-size' as string]: '2',
      ['--diffs-font-family' as string]:
        'ui-monospace, SFMono-Regular, "JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      ['--diffs-editor-selection-bg' as string]: isDark ? '#264f78' : '#add6ff',
      ['--diffs-editor-cursor-fg' as string]: isDark ? '#aeafad' : '#000000',
    }),
    [height, width, fontSize, isDark],
  );
}

function useBaseOptions(colorScheme: 'dark' | 'light', wordWrap: boolean): BaseCodeOptions {
  return useMemo<BaseCodeOptions>(
    () => ({
      theme: { dark: 'dark-plus', light: 'light-plus' },
      themeType: colorScheme,
      overflow: wordWrap ? 'wrap' : 'scroll',
      disableFileHeader: true,
    }),
    [colorScheme, wordWrap],
  );
}

export const PierreEditor = memo(
  forwardRef<PierreEditorHandle, PierreEditorProps>(function PierreEditor(
    {
      path,
      defaultValue,
      readOnly = false,
      selectedLines,
      unsafeCSS,
      wordWrap = false,
      fontSize = 13,
      height,
      width,
      onChange,
      onChangeEvent,
      onSelectionChange,
      onMount,
      onPostRender,
    },
    ref,
  ) {
    const colorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: false });
    const isDark = colorScheme === 'dark';
    const style = usePierreStyle(height, width, fontSize, isDark);
    const metrics = useMemo(
      () => ({ ...DEFAULT_VIRTUAL_FILE_METRICS, lineHeight: Math.ceil(fontSize * 1.5) }),
      [fontSize],
    );
    const baseOptions = useBaseOptions(colorScheme, wordWrap);

    const callbacks = useRef({ onMount, onChange, onChangeEvent, onPostRender, onSelectionChange });

    useEffect(() => {
      callbacks.current = { onMount, onChange, onChangeEvent, onPostRender, onSelectionChange };
    });

    const fileOptions = useMemo<FileOptions<undefined, PierreCaretMetadata>>(
      () => ({
        ...baseOptions,
        unsafeCSS,
        onPostRender: (node, instance, phase) => callbacks.current.onPostRender?.(node, instance, phase),
      }),
      [baseOptions, unsafeCSS],
    );

    const instanceRef = useRef<PierreFileEditor | null>(null);
    const focusedRef = useRef(false);
    const defaultValueRef = useRef(defaultValue);

    const file = useMemo(
      () => (readOnly ? { name: path.trim() || 'untitled', contents: defaultValue } : toFile(path, defaultValue)),
      [path, defaultValue, readOnly],
    );

    const handle = useMemo<PierreEditorHandle>(
      () => ({
        getValue: () => instanceRef.current?.getText() ?? defaultValueRef.current,
        setValue: (val) => {
          if (instanceRef.current) replaceBuffer(instanceRef.current, val);
        },
        applyEdits: (edits, updateHistory) => {
          instanceRef.current?.applyEdits(edits, updateHistory);
        },
        setCarets: (carets) => {
          instanceRef.current?.setCarets(carets);
        },
        focus: () => instanceRef.current?.focus(),
      }),
      [],
    );

    useImperativeHandle(ref, () => handle, [handle]);

    useEffect(() => {
      defaultValueRef.current = defaultValue;
      const editor = instanceRef.current;
      if (editor) replaceBuffer(editor, defaultValue);
    }, [defaultValue, path]);

    useEffect(() => {
      if (readOnly) return;

      let lastKey: string | null = null;

      const publishSelection = () => {
        const editor = instanceRef.current;
        const notify = callbacks.current.onSelectionChange;
        if (!editor || !notify || !focusedRef.current) return;

        const selection = editor.getViewState().selections?.at(-1);
        if (!selection) {
          if (lastKey === null) return;
          lastKey = null;
          notify(null);
          return;
        }

        const text = editor.getText();
        const backward = selection.direction === -1;
        const anchor = backward ? selection.end : selection.start;
        const head = backward ? selection.start : selection.end;
        const anchorOffset = positionToOffset(text, anchor);
        const headOffset = positionToOffset(text, head);

        const key = `${anchorOffset}:${headOffset}`;
        if (key === lastKey) return;
        lastKey = key;
        notify({ anchorOffset, headOffset });
      };

      document.addEventListener('selectionchange', publishSelection);
      return () => document.removeEventListener('selectionchange', publishSelection);
    }, [readOnly]);

    const editorOptions = useMemo<PierreFileEditorOptions>(
      () => ({
        matchBrackets: true,
        autoSurround: 'default',
        roundedSelection: true,
        historyMaxEntries: 1000,
        renderCaret: renderRemoteCaret,
        onAttach: (editor) => {
          instanceRef.current = editor;
          replaceBuffer(editor, defaultValueRef.current);
          callbacks.current.onMount?.(handle);
        },
        onChange: (event) => {
          callbacks.current.onChange?.(event.file.contents);
          callbacks.current.onChangeEvent?.(event);
        },
        onFocus: () => {
          focusedRef.current = true;
        },
        onBlur: () => {
          focusedRef.current = false;
        },
      }),
      [handle],
    );

    return (
      <EditProvider<undefined, PierreCaretMetadata> key={colorScheme} createEditor={createEditor}>
        <Virtualizer style={style}>
          <File<undefined, PierreCaretMetadata>
            key={`${colorScheme}:${fontSize}`}
            file={file}
            metrics={metrics}
            options={fileOptions}
            edit={!readOnly}
            selectedLines={selectedLines}
            editorOptions={editorOptions}
            editStateKey={file.cacheKey}
            style={style}
          />
        </Virtualizer>
      </EditProvider>
    );
  }),
);

export default PierreEditor;

export const PierreDiffEditor = memo(
  forwardRef<PierreEditorHandle, PierreDiffEditorProps>(function PierreDiffEditor(
    {
      originalPath,
      originalValue,
      modifiedPath,
      modifiedValue,
      wordWrap = false,
      fontSize = 13,
      height,
      width,
      onMount,
    },
    ref,
  ) {
    const colorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: false });
    const isDark = colorScheme === 'dark';
    const isMobile = useMediaQuery('(max-width: 768px)', false, { getInitialValueInEffect: false });
    const style = usePierreStyle(height, width, fontSize, isDark);
    const metrics = useMemo(
      () => ({ ...DEFAULT_VIRTUAL_FILE_METRICS, lineHeight: Math.ceil(fontSize * 1.5) }),
      [fontSize],
    );
    const baseOptions = useBaseOptions(colorScheme, wordWrap);

    const modifiedRef = useRef(modifiedValue);

    useEffect(() => {
      modifiedRef.current = modifiedValue;
    });

    const handle = useMemo<PierreEditorHandle>(
      () => ({
        getValue: () => modifiedRef.current,
        setValue: (val) => {
          modifiedRef.current = val;
        },
        applyEdits: () => undefined,
        setCarets: () => undefined,
        focus: () => undefined,
      }),
      [],
    );

    useImperativeHandle(ref, () => handle, [handle]);
    useEffect(() => {
      onMount?.(handle);
    }, [onMount, handle]);

    const oldFile = useMemo(
      () => toFile(originalPath, originalValue, `old:${originalPath}:${originalValue.length}`),
      [originalPath, originalValue],
    );
    const newFile = useMemo(
      () => toFile(modifiedPath, modifiedValue, `new:${modifiedPath}:${modifiedValue.length}`),
      [modifiedPath, modifiedValue],
    );

    const diffOptions = useMemo<FileDiffOptions<undefined, undefined>>(
      () => ({
        ...baseOptions,
        diffStyle: isMobile ? 'unified' : 'split',
        diffIndicators: 'bars',
        expandUnchanged: true,
      }),
      [baseOptions, isMobile],
    );

    const fileDiff = useMemo<FileDiffMetadata>(() => parseDiffFromFile(oldFile, newFile), [oldFile, newFile]);

    return (
      <Virtualizer style={style}>
        {originalValue === modifiedValue ? (
          <File
            key={`${colorScheme}:${fontSize}`}
            file={newFile}
            options={baseOptions as FileOptions<undefined, undefined>}
            metrics={metrics}
            style={style}
          />
        ) : (
          <FileDiff
            key={`${colorScheme}:${fontSize}`}
            fileDiff={fileDiff}
            options={diffOptions}
            metrics={metrics}
            style={style}
          />
        )}
      </Virtualizer>
    );
  }),
);
