import { type OnMount } from '@monaco-editor/react';
import { type EditorChangeEvent } from '@pierre/diffs/edit';
import { MonacoBinding } from 'y-monaco';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { type PierreEditorHandle } from '@/elements/editors/PierreEditor.tsx';

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

export function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

export function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function normalizePath(path: string): string {
  return path.replace(/^\/+/, '');
}

export function cursorColor(seed: number): string {
  return CURSOR_COLORS[Math.abs(seed) % CURSOR_COLORS.length];
}

export function updateCursorStyles(styleEl: HTMLStyleElement, awareness: Awareness): void {
  const rules: string[] = [];

  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID) return;

    const user = state.user as { name?: string; color?: string } | undefined;
    const color = user?.color ?? cursorColor(clientId);
    const name = (user?.name ?? '').replace(/["\\]/g, '');

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

// Pierre has no equivalent of y-monaco's MonacoBinding, so remote Y.Text deltas are
// translated into Pierre TextEdits by hand. There is no styled cursor overlay here
// (Pierre does not support remote cursor decorations like Monaco does), just content sync.
export function bindPierreEditor(
  pierreEditor: PierreEditorHandle,
  ytext: Y.Text,
  doc: Y.Doc,
  changeHandlerRef: { current: ((event: EditorChangeEvent<undefined>) => void) | null },
): { destroy: () => void } {
  let applyingRemote = false;

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
  };

  let destroyed = false;
  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      ytext.unobserve(observer);
      changeHandlerRef.current = null;
    },
  };
}
