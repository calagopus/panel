import { MonacoBinding } from 'y-monaco';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import {
  type PierreCaret,
  type PierreEditorHandle,
  type PierreFileChangeEvent,
  type PierreLocalSelection,
} from '@/elements/editors/PierreEditor.tsx';
import { type OnMount } from '@/lib/editor/monacoLoader.ts';

type MonacoEditor = Parameters<OnMount>[0];
type MonacoModel = NonNullable<ReturnType<MonacoEditor['getModel']>>;

export function createMonacoBinding(
  ytext: Y.Text,
  monacoModel: MonacoModel,
  editors: Set<MonacoEditor>,
  awareness?: Awareness | null,
): { destroy: () => void } {
  const binding = new MonacoBinding(ytext, monacoModel, editors, awareness ?? undefined);
  let destroyed = false;
  const originalDestroy = binding.destroy.bind(binding);
  binding.destroy = () => {
    if (destroyed) return;
    destroyed = true;
    originalDestroy();
  };
  return binding;
}

const CURSOR_COLORS = ['#e03131', '#c2255c', '#9c36b5', '#3b5bdb', '#1971c2', '#099268', '#e8590c', '#f08c00'];

export function normalizePath(path: string): string {
  return path.replace(/^\/+/, '');
}

export function cursorColor(seed: number): string {
  return CURSOR_COLORS[Math.abs(seed) % CURSOR_COLORS.length];
}

function remoteCursorColor(color: unknown, clientId: number): string {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : cursorColor(clientId);
}

export function updateCursorStyles(styleEl: HTMLStyleElement, awareness: Awareness): void {
  const rules: string[] = [];

  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID) return;

    const user = state.user as { name?: unknown; color?: unknown } | undefined;
    const color = remoteCursorColor(user?.color, clientId);
    const name = CSS.escape(typeof user?.name === 'string' ? user.name : '');

    rules.push(
      `.yRemoteSelection-${clientId} { background-color: ${color}44; }`,
      `.yRemoteSelectionHead-${clientId} { position: absolute; border-left: 2px solid ${color}; height: 100%; }`,
      `.yRemoteSelectionHead-${clientId}::after { content: "${name}"; position: absolute; top: -1.2em; left: -2px;` +
        ` background-color: ${color}; color: white; font-size: 10px; line-height: 1.2; padding: 0 3px;` +
        ` border-radius: 2px; white-space: nowrap; pointer-events: none; }`,
    );
  });

  styleEl.textContent = rules.join('\n');
}

export function offsetToPosition(text: string, offset: number): { line: number; character: number } {
  let line = 0;
  let lineStart = 0;
  const max = Math.min(offset, text.length);
  for (let i = 0; i < max; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, character: offset - lineStart };
}

export interface RemoteAwarenessSelection {
  anchor: Y.RelativePosition;
  head: Y.RelativePosition;
}

export interface ResolvedRemoteCursor {
  clientId: number;
  anchor: number;
  head: number;
  name: string;
  color: string;
}

export function resolveRemoteCursors(awareness: Awareness, doc: Y.Doc, ytext: Y.Text): ResolvedRemoteCursor[] {
  const cursors: ResolvedRemoteCursor[] = [];

  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID) return;

    const selection = state.selection as Partial<RemoteAwarenessSelection> | null | undefined;
    if (!selection?.anchor || !selection?.head) return;

    try {
      const anchorAbs = Y.createAbsolutePositionFromRelativePosition(selection.anchor, doc);
      const headAbs = Y.createAbsolutePositionFromRelativePosition(selection.head, doc);
      if (!anchorAbs || !headAbs || anchorAbs.type !== ytext || headAbs.type !== ytext) return;

      const user = state.user as { name?: unknown; color?: unknown } | undefined;
      cursors.push({
        clientId,
        anchor: anchorAbs.index,
        head: headAbs.index,
        name: typeof user?.name === 'string' ? user.name : 'unknown',
        color: remoteCursorColor(user?.color, clientId),
      });
    } catch {
      // A peer published a selection this document can't resolve; skip it.
    }
  });

  return cursors;
}

export function publishAwarenessSelection(
  awareness: Awareness,
  ytext: Y.Text,
  selection: { anchorOffset: number; headOffset: number } | null,
): void {
  if (!selection) {
    awareness.setLocalStateField('selection', null);
    return;
  }

  awareness.setLocalStateField('selection', {
    anchor: Y.createRelativePositionFromTypeIndex(ytext, selection.anchorOffset),
    head: Y.createRelativePositionFromTypeIndex(ytext, selection.headOffset),
  });
}

export function bindPierreEditor(
  pierreEditor: PierreEditorHandle,
  ytext: Y.Text,
  doc: Y.Doc,
  changeHandlerRef: { current: ((event: PierreFileChangeEvent) => void) | null },
  selectionHandlerRef: { current: ((selection: PierreLocalSelection | null) => void) | null },
  awareness?: Awareness | null,
): { destroy: () => void } {
  let applyingRemote = false;

  const renderRemoteCarets = () => {
    if (!awareness) return;

    const text = pierreEditor.getValue();
    pierreEditor.setCarets(
      resolveRemoteCursors(awareness, doc, ytext).map<PierreCaret>((cursor) => ({
        anchor: offsetToPosition(text, cursor.anchor),
        focus: offsetToPosition(text, cursor.head),
        metadata: { name: cursor.name, color: cursor.color },
      })),
    );
  };

  if (awareness) {
    awareness.on('change', renderRemoteCarets);
  }

  selectionHandlerRef.current = (selection) => {
    if (awareness) publishAwarenessSelection(awareness, ytext, selection);
  };

  const initial = ytext.toString();
  if (pierreEditor.getValue() !== initial) {
    applyingRemote = true;
    pierreEditor.setValue(initial);
    applyingRemote = false;
  }

  const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
    if (transaction.origin !== 'remote') return;

    applyingRemote = true;
    try {
      let index = 0;
      for (const op of event.delta) {
        if (op.retain !== undefined) {
          index += op.retain;
        } else if (op.insert !== undefined) {
          const insertText = op.insert as string;
          const pos = offsetToPosition(pierreEditor.getValue(), index);
          pierreEditor.applyEdits([{ range: { start: pos, end: pos }, newText: insertText }], false);
          index += insertText.length;
        } else if (op.delete !== undefined) {
          const currentText = pierreEditor.getValue();
          const startPos = offsetToPosition(currentText, index);
          const endPos = offsetToPosition(currentText, index + op.delete);
          pierreEditor.applyEdits([{ range: { start: startPos, end: endPos }, newText: '' }], false);
        }
      }
    } finally {
      applyingRemote = false;
    }

    renderRemoteCarets();
  };
  ytext.observe(observer);

  changeHandlerRef.current = (event) => {
    if (applyingRemote || !event.changes.length) return;

    doc.transact(() => {
      [...event.changes]
        .sort((a, b) => b.start - a.start)
        .forEach((change) => {
          ytext.delete(change.start, change.end - change.start);
          ytext.insert(change.start, change.text);
        });
    }, 'pierre-local');

    renderRemoteCarets();
  };

  if (awareness) renderRemoteCarets();

  let destroyed = false;
  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      ytext.unobserve(observer);
      awareness?.off('change', renderRemoteCarets);
      changeHandlerRef.current = null;
      selectionHandlerRef.current = null;
      pierreEditor.setCarets([]);
    },
  };
}
