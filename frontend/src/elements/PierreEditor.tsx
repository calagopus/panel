import { useComputedColorScheme } from '@mantine/core';
import { DEFAULT_THEMES, type FileContents, type FileDiffOptions, type FileOptions } from '@pierre/diffs';
import { Editor, type EditorOptions } from '@pierre/diffs/edit';
import { File as DiffsFile, EditProvider, MultiFileDiff, Virtualizer } from '@pierre/diffs/react';
import { CSSProperties, useEffect, useMemo, useRef } from 'react';

export interface PierreEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
}

function createPierreEditor<LAnnotation>(options: EditorOptions<LAnnotation>) {
  return new Editor(options);
}

function replaceEditorText(editor: Editor<undefined>, text: string): void {
  const lines = editor.getText().split('\n');
  const endLine = lines.length - 1;

  editor.applyEdits([
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: endLine, character: lines[endLine].length },
      },
      newText: text,
    },
  ]);
}

// Keeps the returned EditorOptions object identity stable across renders
// (see EditProvider docs: editor instances are cached by options identity),
// while always calling the latest onMount/onChange passed in by the caller.
function useEditorHandleOptions(onMount?: (handle: PierreEditorHandle) => void, onChange?: (value: string) => void) {
  const callbacksRef = useRef({ onMount, onChange });
  useEffect(() => {
    callbacksRef.current = { onMount, onChange };
  });

  return useMemo<EditorOptions<undefined>>(
    () => ({
      onAttach: (editor) => {
        callbacksRef.current.onMount?.({
          getValue: () => editor.getFile()?.contents ?? '',
          setValue: (value) => replaceEditorText(editor, value),
          focus: () => editor.focus(),
        });
      },
      onChange: (file) => callbacksRef.current.onChange?.(file.contents),
    }),
    [],
  );
}

interface PierreEditorProps {
  path: string;
  defaultValue: string;
  readOnly?: boolean;
  wordWrap?: boolean;
  fontSize?: number;
  height?: CSSProperties['height'];
  width?: CSSProperties['width'];
  onChange?: (value: string) => void;
  onMount?: (handle: PierreEditorHandle) => void;
}

export default function PierreEditor({
  path,
  defaultValue,
  readOnly,
  wordWrap,
  fontSize,
  height,
  width,
  onChange,
  onMount,
}: PierreEditorProps) {
  const computedColorScheme = useComputedColorScheme('dark');

  // Intentionally keyed only on `path`: this mirrors Monaco's `defaultValue`
  // semantics, seeding the document once rather than re-controlling it on
  // every render (the live document lives inside the attached Editor).
  const file: FileContents = useMemo(() => ({ name: path, contents: defaultValue, cacheKey: path }), [path]);

  const options = useMemo<FileOptions<undefined>>(
    () => ({
      theme: DEFAULT_THEMES,
      themeType: computedColorScheme,
      overflow: wordWrap ? 'wrap' : 'scroll',
    }),
    [computedColorScheme, wordWrap],
  );

  const editorOptions = useEditorHandleOptions(onMount, onChange);

  return (
    <EditProvider createEditor={createPierreEditor}>
      <Virtualizer style={{ height, width, overflow: 'auto', fontSize }}>
        <DiffsFile file={file} options={options} edit={!readOnly} editorOptions={editorOptions} />
      </Virtualizer>
    </EditProvider>
  );
}

interface PierreDiffEditorProps {
  originalPath: string;
  originalValue: string;
  modifiedPath: string;
  modifiedValue: string;
  readOnly?: boolean;
  wordWrap?: boolean;
  fontSize?: number;
  height?: CSSProperties['height'];
  width?: CSSProperties['width'];
  onMount?: (handle: PierreEditorHandle) => void;
}

export function PierreDiffEditor({
  originalPath,
  originalValue,
  modifiedPath,
  modifiedValue,
  readOnly,
  wordWrap,
  fontSize,
  height,
  width,
  onMount,
}: PierreDiffEditorProps) {
  const computedColorScheme = useComputedColorScheme('dark');

  // See PierreEditor above: seeded once per path, not re-controlled on render.
  const oldFile: FileContents = useMemo(
    () => ({ name: originalPath, contents: originalValue, cacheKey: `original:${originalPath}` }),
    [originalPath],
  );
  const newFile: FileContents = useMemo(
    () => ({ name: modifiedPath, contents: modifiedValue, cacheKey: `modified:${modifiedPath}` }),
    [modifiedPath],
  );

  const options = useMemo<FileDiffOptions<undefined>>(
    () => ({
      theme: DEFAULT_THEMES,
      themeType: computedColorScheme,
      diffStyle: 'split',
      overflow: wordWrap ? 'wrap' : 'scroll',
    }),
    [computedColorScheme, wordWrap],
  );

  const editorOptions = useEditorHandleOptions(onMount);

  return (
    <EditProvider createEditor={createPierreEditor}>
      <Virtualizer style={{ height, width, overflow: 'auto', fontSize }}>
        <MultiFileDiff
          oldFile={oldFile}
          newFile={newFile}
          options={options}
          edit={!readOnly}
          editorOptions={editorOptions}
        />
      </Virtualizer>
    </EditProvider>
  );
}
