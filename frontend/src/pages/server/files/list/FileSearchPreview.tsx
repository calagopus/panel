import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type OnMount } from '@monaco-editor/react';
import { type File as PierreFile, type PostRenderPhase } from '@pierre/diffs';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import getFileLines from '@/api/server/files/getFileLines.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import MonacoEditor from '@/elements/editors/MonacoEditor.tsx';
import PierreEditor from '@/elements/editors/PierreEditor.tsx';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/editor/monaco.ts';
import { isArchiveType } from '@/lib/files/files.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDirectoryEntrySchema, serverFilesContentMatchesSchema } from '@/lib/schemas/server/files.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

const FILE_SEARCH_PREVIEW_LINES = 3;
const MAX_VISIBLE_LINES = 6;
const LINE_HEIGHT = 20;
const EDITOR_CHROME = 16;
const HEADER_HEIGHT = 24;
const STATUS_HEIGHT = 34;

type ContentMatches = z.infer<typeof serverFilesContentMatchesSchema>;
type MonacoEditorInstance = Parameters<OnMount>[0];

interface PreviewSelection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

const stripTrailingNewline = (content: string) => content.replace(/\r?\n$/, '');
const countLines = (content: string) => content.split('\n').length;
const editorHeight = (lines: number) => Math.min(Math.max(lines, 1), MAX_VISIBLE_LINES) * LINE_HEIGHT + EDITOR_CHROME;

export function canPreviewFile(file: z.infer<typeof serverDirectoryEntrySchema>) {
  return file.file && !file.directory && !isArchiveType(file);
}

export function estimateFileSearchPreviewHeight(matches?: ContentMatches) {
  const block = matches?.blocks[0];
  if (matches && !block) return STATUS_HEIGHT;

  return (
    HEADER_HEIGHT +
    editorHeight(block ? countLines(stripTrailingNewline(block.content)) : FILE_SEARCH_PREVIEW_LINES) +
    2
  );
}

function rangeAtColumn(line: Element, column: number): Range | null {
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let remaining = column - 1;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      return range;
    }
    remaining -= length;
  }

  return null;
}

function revealMonacoSelection(editor: MonacoEditorInstance, selection: PreviewSelection | undefined) {
  if (!selection) return;

  editor.setSelection(selection);
  editor.revealRangeInCenterIfOutsideViewport(selection);
  const subscription = editor.onDidLayoutChange(() => {
    editor.revealRangeInCenterIfOutsideViewport(selection);
    subscription.dispose();
  });
}

export function FileSearchPreviewToggle({ path, compact = false }: { path: string; compact?: boolean }) {
  const { t } = useTranslations();
  const store = useFileManagerApi();
  const expanded = useFileManagerStore((state) => !state.collapsedSearchPreviews.has(path));
  const handlers = {
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      store.getState().toggleSearchPreview(path);
    },
    onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
    onDoubleClick: (event: React.MouseEvent) => event.stopPropagation(),
    onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation(),
  };
  const label = t(expanded ? 'pages.server.files.searchPreview.collapse' : 'pages.server.files.searchPreview.expand', {
    file: path,
  });

  if (compact) {
    return (
      <button
        type='button'
        aria-expanded={expanded}
        aria-label={label}
        className='w-2.5 shrink-0 cursor-pointer text-xs text-(--mantine-color-dimmed)'
        {...handlers}
      >
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className='w-2.5 [--fa-width:0.625rem]' />
      </button>
    );
  }

  return (
    <ActionIcon size='xs' variant='subtle' color='gray' aria-expanded={expanded} aria-label={label} {...handlers}>
      <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
    </ActionIcon>
  );
}

export default function FileSearchPreview({
  file,
  path,
  matches,
}: {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  path: string;
  matches?: ContentMatches;
}) {
  const { t } = useTranslations();
  const serverUuid = useServerStore((state) => state.server.uuid);
  const canRead = useServerCan('files.read-content');
  const { editorEngine, editorFontSize, editorLineOverflow } = useFileManagerStore(
    useShallow((state) => ({
      editorEngine: state.editorEngine,
      editorFontSize: state.editorFontSize,
      editorLineOverflow: state.editorLineOverflow,
    })),
  );
  const id = useId();
  const modelPath = `file-search-preview://${serverUuid}/${encodeURIComponent(id)}${path.split('/').map(encodeURIComponent).join('/')}`;
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const revealedContentRef = useRef<string | null>(null);
  const matchBlock = canRead ? matches?.blocks[0] : undefined;
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys
      .server(serverUuid)
      .files.fileLines(path, 1, FILE_SEARCH_PREVIEW_LINES, file.modified.toISOString(), file.size),
    queryFn: canRead && !matches ? () => getFileLines(serverUuid, path, 1, FILE_SEARCH_PREVIEW_LINES) : skipToken,
    staleTime: Infinity,
    retry: false,
  });
  const block = canRead ? (matchBlock ?? (!matches && !isError ? data : undefined)) : undefined;
  const content = stripTrailingNewline(block?.content ?? '');
  const startLine = block?.startLine ?? 1;
  const endLine = block?.endLine ?? startLine;
  const selection = useMemo<PreviewSelection | undefined>(() => {
    const match = matchBlock?.matches[0];
    if (!match || !matchBlock) return undefined;
    const bytes = new TextEncoder().encode(matchBlock.content);
    const decoder = new TextDecoder();
    const start = decoder.decode(bytes.subarray(0, match.startByte)).split('\n');
    const end = decoder.decode(bytes.subarray(0, match.endByte)).split('\n');
    return {
      startLineNumber: start.length,
      startColumn: (start.at(-1)?.length ?? 0) + 1,
      endLineNumber: end.length,
      endColumn: (end.at(-1)?.length ?? 0) + 1,
    };
  }, [matchBlock]);
  useEffect(() => {
    if (editorRef.current) revealMonacoSelection(editorRef.current, selection);
  }, [selection]);

  const pierreCSS = useMemo(
    () => `
      [data-gutter] { counter-reset: preview-line ${startLine - 1}; }
      [data-gutter] [data-column-number] { counter-increment: preview-line; }
      [data-gutter] [data-line-number-content] { visibility: hidden; }
      [data-gutter] [data-line-number-content]::before {
        content: counter(preview-line);
        visibility: visible;
        position: absolute;
        inset: 0;
      }
    `,
    [startLine],
  );

  const handlePierreRender = (node: HTMLElement, instance: PierreFile<undefined>, phase: PostRenderPhase) => {
    const root = node.shadowRoot;
    if (phase === 'unmount' || !root || !selection || revealedContentRef.current === content) return;

    const code = root.querySelector('code[data-code]');
    const line = root.querySelector(`[data-content] [data-line="${selection.startLineNumber}"]`);
    if (!(code instanceof HTMLElement) || !line || code.clientWidth === 0) return;
    const range = rangeAtColumn(line, selection.startColumn);
    if (!range) return;

    const gutterWidth = root.querySelector('[data-gutter]')?.getBoundingClientRect().width ?? 0;
    const matchX = range.getBoundingClientRect().left - code.getBoundingClientRect().left;
    if (matchX > code.clientWidth - 24) {
      instance.setCodeScrollLeft(
        instance.getCodeScrollLeft() + matchX - gutterWidth - (code.clientWidth - gutterWidth) / 3,
      );
    }
    revealedContentRef.current = content;
  };

  const status = !canRead
    ? t('pages.server.files.searchPreview.restricted', {})
    : matches && !matchBlock
      ? t('pages.server.files.searchPreview.noContext', {})
      : isError
        ? t('pages.server.files.searchPreview.unavailable', {})
        : isPending
          ? t('pages.server.files.searchPreview.loading', {})
          : t('pages.server.files.searchPreview.empty', {});

  return (
    <div
      data-file-search-preview
      data-preview-editor={editorEngine}
      className='flex min-w-0 flex-col overflow-hidden rounded border border-(--mantine-color-default-border) select-text'
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {block && content ? (
        <>
          <div
            className='flex shrink-0 items-center gap-2 bg-(--mantine-color-default-hover) px-3 text-xs text-(--mantine-color-dimmed)'
            style={{ height: HEADER_HEIGHT }}
          >
            <span>
              {t('pages.server.files.searchPreview.lines', { start: String(startLine), end: String(endLine) })}
            </span>
            {matches?.truncated && <span>· {t('pages.server.files.searchPreview.moreMatches', {})}</span>}
          </div>
          <div
            className='min-w-0'
            style={{
              height: editorHeight(countLines(content)),
              ['--diffs-min-number-column-width' as string]: `${String(endLine).length}ch`,
            }}
          >
            {editorEngine === 'pierre' ? (
              <PierreEditor
                height='100%'
                width='100%'
                path={modelPath}
                defaultValue={content}
                readOnly
                wordWrap={editorLineOverflow}
                fontSize={editorFontSize}
                selectedLines={
                  selection
                    ? {
                        start: selection.startLineNumber,
                        end: selection.endLineNumber - (selection.endColumn === 1 ? 1 : 0),
                      }
                    : undefined
                }
                unsafeCSS={pierreCSS}
                onPostRender={handlePierreRender}
              />
            ) : (
              <MonacoEditor
                height='100%'
                width='100%'
                path={modelPath}
                value={content}
                saveViewState={false}
                keepCurrentModel={false}
                options={{
                  readOnly: true,
                  domReadOnly: true,
                  automaticLayout: true,
                  stickyScroll: { enabled: false },
                  minimap: { enabled: false },
                  wordWrap: editorLineOverflow ? 'on' : 'off',
                  fontSize: editorFontSize,
                  lineHeight: LINE_HEIGHT,
                  lineNumbers: (lineNumber) => String(lineNumber + startLine - 1),
                  lineNumbersMinChars: String(endLine).length + 1,
                  lineDecorationsWidth: 8,
                  glyphMargin: false,
                  padding: { top: 5, bottom: 5 },
                  scrollbar: { horizontalScrollbarSize: 6, vertical: 'hidden', alwaysConsumeMouseWheel: false },
                  overviewRulerLanes: 0,
                  overviewRulerBorder: false,
                  hideCursorInOverviewRuler: true,
                  renderLineHighlight: 'none',
                  codeLens: false,
                  scrollBeyondLastLine: false,
                  smoothScrolling: false,
                  fixedOverflowWidgets: true,
                  folding: false,
                }}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  registerTomlLanguage(monaco);
                  registerHoconLanguage(monaco);
                  revealMonacoSelection(editor, selection);
                }}
              />
            )}
          </div>
        </>
      ) : (
        <span
          className='px-3 text-xs leading-none text-(--mantine-color-dimmed)'
          style={{ lineHeight: `${STATUS_HEIGHT - 2}px` }}
        >
          {status}
        </span>
      )}
    </div>
  );
}
