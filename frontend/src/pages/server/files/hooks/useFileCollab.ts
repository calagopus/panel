import { type OnMount } from '@monaco-editor/react';
import { type EditorChangeEvent } from '@pierre/diffs/edit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MonacoBinding } from 'y-monaco';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { type PierreEditorHandle } from '@/elements/PierreEditor.tsx';
import { SocketEvent, SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export interface CollabParticipant {
  user: string;
  name: string;
  avatar: string | null;
}

export interface CollabSavedPayload {
  user: string;
  revisionId: number | null;
}

export interface CollabConflict {
  hash: string | null;
  deleted: boolean;
}

interface UseFileCollabOptions {
  enabled: boolean;
  engine: 'monaco' | 'pierre';
  filePath: string;
  onActivated: (dirty: boolean) => void;
  onSaved: (payload: CollabSavedPayload) => void;
  onConflict: (conflict: CollabConflict | null) => void;
  onError: (message: string) => void;
}

const UPDATE_CHUNK_SIZE = 16 * 1024;

const CURSOR_COLORS = ['#e03131', '#c2255c', '#9c36b5', '#3b5bdb', '#1971c2', '#099268', '#e8590c', '#f08c00'];

function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '');
}

function cursorColor(seed: number): string {
  return CURSOR_COLORS[Math.abs(seed) % CURSOR_COLORS.length];
}

function updateCursorStyles(styleEl: HTMLStyleElement, awareness: Awareness): void {
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

function offsetToPosition(text: string, offset: number): { line: number; character: number } {
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
function bindPierreEditor(
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

  return {
    destroy: () => {
      ytext.unobserve(observer);
      changeHandlerRef.current = null;
    },
  };
}

let editorSequence = 0;

export default function useFileCollab({
  enabled,
  engine,
  filePath,
  onActivated,
  onSaved,
  onConflict,
  onError,
}: UseFileCollabOptions) {
  const { user } = useAuth();
  const socketInstance = useServerStore((state) => state.socketInstance);
  const socketConnected = useServerStore((state) => state.socketConnected);

  const [active, setActive] = useState(false);
  const [participants, setParticipants] = useState<CollabParticipant[]>([]);
  const [conflict, setConflict] = useState<CollabConflict | null>(null);

  const [monacoEditor, setMonacoEditor] = useState<Parameters<OnMount>[0] | null>(null);
  const [pierreEditor, setPierreEditor] = useState<PierreEditorHandle | null>(null);
  const editor = engine === 'monaco' ? monacoEditor : pierreEditor;

  const docRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const bindingRef = useRef<{ destroy: () => void } | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const subscribedRef = useRef(false);
  const pierreChangeHandlerRef = useRef<((event: EditorChangeEvent<undefined>) => void) | null>(null);

  const callbacksRef = useRef({ onActivated, onSaved, onConflict, onError });
  useEffect(() => {
    callbacksRef.current = { onActivated, onSaved, onConflict, onError };
  });

  const destroySession = useCallback(() => {
    bindingRef.current?.destroy();
    bindingRef.current = null;
    awarenessRef.current?.destroy();
    awarenessRef.current = null;
    docRef.current?.destroy();
    docRef.current = null;
    if (styleRef.current) {
      styleRef.current.remove();
      styleRef.current = null;
    }
    setActive(false);
    setParticipants([]);
    setConflict(null);
  }, []);

  useEffect(() => {
    if (!enabled || !socketConnected || !socketInstance || !editor || !filePath) {
      return;
    }

    const socket = socketInstance;
    const path = filePath;
    editorSequence += 1;
    const editorId = String(editorSequence);

    let sessionKey: string | null = null;
    const matchesSession = (eventPath: string) => {
      const normalized = normalizePath(eventPath);
      return normalized === normalizePath(path) || normalized === sessionKey;
    };

    let pendingUpdates: [string, string][] = [];

    const sendUpdate = (update: Uint8Array) => {
      const encoded = toBase64(update);
      for (let i = 0; i < encoded.length; i += UPDATE_CHUNK_SIZE) {
        const finished = i + UPDATE_CHUNK_SIZE >= encoded.length;
        socket.send(SocketRequest.FILE_COLLAB_UPDATE, [
          path,
          finished ? '1' : '0',
          encoded.slice(i, i + UPDATE_CHUNK_SIZE),
          editorId,
        ]);
      }
    };

    const onSync = (syncPath: string, state: string, meta?: string, rawPath?: string) => {
      if (!(rawPath !== undefined && normalizePath(rawPath) === normalizePath(path)) && !matchesSession(syncPath)) {
        return;
      }

      const monacoEditor = engine === 'monaco' ? (editor as Parameters<OnMount>[0]) : null;
      const model = monacoEditor?.getModel() ?? null;
      if (engine === 'monaco' && !model) return;

      destroySession();
      sessionKey = normalizePath(syncPath);

      const doc = new Y.Doc();
      Y.applyUpdate(doc, fromBase64(state), 'remote');
      const text = doc.getText('content');

      doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote') return;
        sendUpdate(update);
      });

      if (monacoEditor && model) {
        const awareness = new Awareness(doc);
        awareness.setLocalStateField('user', {
          name: user?.username ?? 'unknown',
          color: cursorColor(doc.clientID),
        });

        const styleEl = document.createElement('style');
        document.head.appendChild(styleEl);
        awareness.on('change', () => updateCursorStyles(styleEl, awareness));

        awareness.on(
          'update',
          ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
            if (origin === 'remote') return;
            const changed = added.concat(updated, removed);
            socket.send(SocketRequest.FILE_COLLAB_AWARENESS, [
              path,
              toBase64(encodeAwarenessUpdate(awareness, changed)),
            ]);
          },
        );

        bindingRef.current = new MonacoBinding(text, model, new Set([monacoEditor]), awareness);
        awarenessRef.current = awareness;
        styleRef.current = styleEl;

        socket.send(SocketRequest.FILE_COLLAB_AWARENESS, [
          path,
          toBase64(encodeAwarenessUpdate(awareness, [doc.clientID])),
        ]);
      } else {
        // Pierre has no styled remote cursors, so no awareness/decorations are set up here.
        bindingRef.current = bindPierreEditor(editor as PierreEditorHandle, text, doc, pierreChangeHandlerRef);
      }

      docRef.current = doc;
      for (const [updatePath, update] of pendingUpdates) {
        if (matchesSession(updatePath)) {
          Y.applyUpdate(doc, fromBase64(update), 'remote');
        }
      }
      pendingUpdates = [];
      setActive(true);

      let dirty = false;
      let syncConflict: CollabConflict | null = null;
      try {
        const parsed = JSON.parse(meta ?? '{}');
        dirty = Boolean(parsed.dirty);
        syncConflict = parsed.conflict ?? null;
      } catch {
        // ignore
      }
      setConflict(syncConflict);
      callbacksRef.current.onActivated(dirty);
    };

    const onUpdate = (updatePath: string, update: string) => {
      if (!docRef.current) {
        if (pendingUpdates.length < 64) {
          pendingUpdates.push([updatePath, update]);
        }
        return;
      }
      if (!matchesSession(updatePath)) return;

      Y.applyUpdate(docRef.current, fromBase64(update), 'remote');
    };

    const onAwareness = (awarenessPath: string, update: string) => {
      if (!matchesSession(awarenessPath)) return;
      if (!awarenessRef.current) return;

      applyAwarenessUpdate(awarenessRef.current, fromBase64(update), 'remote');
    };

    const onParticipants = (participantsPath: string, data: string) => {
      if (!matchesSession(participantsPath)) return;

      try {
        setParticipants(JSON.parse(data));
      } catch {
        // ignore malformed payloads
      }
    };

    const onSavedEvent = (savedPath: string, data: string) => {
      if (!matchesSession(savedPath)) return;

      setConflict(null);
      try {
        const payload = JSON.parse(data);
        callbacksRef.current.onSaved({ user: payload.user, revisionId: payload.revision_id ?? null });
      } catch {
        // ignore
      }
    };

    const onConflictEvent = (conflictPath: string, data: string) => {
      if (!matchesSession(conflictPath)) return;

      let parsed: CollabConflict | null = null;
      try {
        parsed = JSON.parse(data);
      } catch {
        // ignore malformed payloads
      }
      setConflict(parsed);
      callbacksRef.current.onConflict(parsed);
    };

    const onErrorEvent = (errorPath: string, message: string) => {
      if (!matchesSession(errorPath)) return;

      const wasActive = docRef.current !== null;
      pendingUpdates = [];
      destroySession();

      if (message === 'resync' || wasActive) {
        socket.send(SocketRequest.FILE_COLLAB_SUBSCRIBE, [path, editorId]);
        if (message !== 'resync') {
          callbacksRef.current.onError(message);
        }
      } else {
        subscribedRef.current = false;
        callbacksRef.current.onError(message);
      }
    };

    socket.addListener(SocketEvent.FILE_COLLAB_SYNC, onSync);
    socket.addListener(SocketEvent.FILE_COLLAB_UPDATE, onUpdate);
    socket.addListener(SocketEvent.FILE_COLLAB_AWARENESS, onAwareness);
    socket.addListener(SocketEvent.FILE_COLLAB_PARTICIPANTS, onParticipants);
    socket.addListener(SocketEvent.FILE_COLLAB_SAVED, onSavedEvent);
    socket.addListener(SocketEvent.FILE_COLLAB_CONFLICT, onConflictEvent);
    socket.addListener(SocketEvent.FILE_COLLAB_ERROR, onErrorEvent);

    subscribedRef.current = true;
    socket.send(SocketRequest.FILE_COLLAB_SUBSCRIBE, [path, editorId]);

    return () => {
      socket.removeListener(SocketEvent.FILE_COLLAB_SYNC, onSync);
      socket.removeListener(SocketEvent.FILE_COLLAB_UPDATE, onUpdate);
      socket.removeListener(SocketEvent.FILE_COLLAB_AWARENESS, onAwareness);
      socket.removeListener(SocketEvent.FILE_COLLAB_PARTICIPANTS, onParticipants);
      socket.removeListener(SocketEvent.FILE_COLLAB_SAVED, onSavedEvent);
      socket.removeListener(SocketEvent.FILE_COLLAB_CONFLICT, onConflictEvent);
      socket.removeListener(SocketEvent.FILE_COLLAB_ERROR, onErrorEvent);

      destroySession();

      if (subscribedRef.current) {
        socket.send(SocketRequest.FILE_COLLAB_UNSUBSCRIBE, [path, editorId]);
        subscribedRef.current = false;
      }
    };
  }, [enabled, engine, socketConnected, socketInstance, editor, filePath]);

  const save = useCallback(
    (force?: boolean, expectedHash?: string | null) => {
      if (!socketInstance || !subscribedRef.current) return false;

      if (force) {
        socketInstance.send(
          SocketRequest.FILE_COLLAB_SAVE,
          expectedHash ? [filePath, '1', expectedHash] : [filePath, '1'],
        );
      } else {
        socketInstance.send(SocketRequest.FILE_COLLAB_SAVE, filePath);
      }
      return true;
    },
    [socketInstance, filePath],
  );

  const reload = useCallback(() => {
    if (!socketInstance || !subscribedRef.current) return false;

    socketInstance.send(SocketRequest.FILE_COLLAB_RELOAD, filePath);
    return true;
  }, [socketInstance, filePath]);

  const handlePierreChangeEvent = useCallback((event: EditorChangeEvent<undefined>) => {
    pierreChangeHandlerRef.current?.(event);
  }, []);

  return {
    active,
    participants,
    conflict,
    save,
    reload,
    attachEditor: setMonacoEditor,
    attachPierreEditor: setPierreEditor,
    handlePierreChangeEvent,
  };
}
