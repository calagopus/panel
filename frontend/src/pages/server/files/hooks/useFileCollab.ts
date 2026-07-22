import { type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MonacoBinding } from 'y-monaco';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
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

export default function useFileCollab({
  enabled,
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

  const [editor, setEditor] = useState<Parameters<OnMount>[0] | null>(null);

  const docRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const subscribedRef = useRef(false);

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

    const sendUpdate = (update: Uint8Array) => {
      const encoded = toBase64(update);
      for (let i = 0; i < encoded.length; i += UPDATE_CHUNK_SIZE) {
        const finished = i + UPDATE_CHUNK_SIZE >= encoded.length;
        socket.send(SocketRequest.FILE_COLLAB_UPDATE, [
          path,
          finished ? '1' : '0',
          encoded.slice(i, i + UPDATE_CHUNK_SIZE),
        ]);
      }
    };

    const onSync = (syncPath: string, state: string, meta?: string) => {
      if (normalizePath(syncPath) !== normalizePath(path)) return;

      const model = editor.getModel();
      if (!model) return;

      destroySession();

      const doc = new Y.Doc();
      Y.applyUpdate(doc, fromBase64(state), 'remote');

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
          socket.send(SocketRequest.FILE_COLLAB_AWARENESS, [path, toBase64(encodeAwarenessUpdate(awareness, changed))]);
        },
      );

      doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote') return;
        sendUpdate(update);
      });

      const text = doc.getText('content');
      bindingRef.current = new MonacoBinding(text, model, new Set([editor]), awareness);
      docRef.current = doc;
      awarenessRef.current = awareness;
      styleRef.current = styleEl;
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

      socket.send(SocketRequest.FILE_COLLAB_AWARENESS, [
        path,
        toBase64(encodeAwarenessUpdate(awareness, [doc.clientID])),
      ]);
    };

    const onUpdate = (updatePath: string, update: string) => {
      if (normalizePath(updatePath) !== normalizePath(path)) return;
      if (!docRef.current) return;

      Y.applyUpdate(docRef.current, fromBase64(update), 'remote');
    };

    const onAwareness = (awarenessPath: string, update: string) => {
      if (normalizePath(awarenessPath) !== normalizePath(path)) return;
      if (!awarenessRef.current) return;

      applyAwarenessUpdate(awarenessRef.current, fromBase64(update), 'remote');
    };

    const onParticipants = (participantsPath: string, data: string) => {
      if (normalizePath(participantsPath) !== normalizePath(path)) return;

      try {
        setParticipants(JSON.parse(data));
      } catch {
        // ignore malformed payloads
      }
    };

    const onSavedEvent = (savedPath: string, data: string) => {
      if (normalizePath(savedPath) !== normalizePath(path)) return;

      setConflict(null);
      try {
        const payload = JSON.parse(data);
        callbacksRef.current.onSaved({ user: payload.user, revisionId: payload.revision_id ?? null });
      } catch {
        // ignore
      }
    };

    const onConflictEvent = (conflictPath: string, data: string) => {
      if (normalizePath(conflictPath) !== normalizePath(path)) return;

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
      if (normalizePath(errorPath) !== normalizePath(path)) return;

      const wasActive = docRef.current !== null;
      destroySession();

      if (message === 'resync' || wasActive) {
        socket.send(SocketRequest.FILE_COLLAB_SUBSCRIBE, path);
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
    socket.send(SocketRequest.FILE_COLLAB_SUBSCRIBE, path);

    return () => {
      socket.removeListener(SocketEvent.FILE_COLLAB_SYNC, onSync);
      socket.removeListener(SocketEvent.FILE_COLLAB_UPDATE, onUpdate);
      socket.removeListener(SocketEvent.FILE_COLLAB_AWARENESS, onAwareness);
      socket.removeListener(SocketEvent.FILE_COLLAB_PARTICIPANTS, onParticipants);
      socket.removeListener(SocketEvent.FILE_COLLAB_SAVED, onSavedEvent);
      socket.removeListener(SocketEvent.FILE_COLLAB_CONFLICT, onConflictEvent);
      socket.removeListener(SocketEvent.FILE_COLLAB_ERROR, onErrorEvent);

      if (subscribedRef.current) {
        socket.send(SocketRequest.FILE_COLLAB_UNSUBSCRIBE, path);
        subscribedRef.current = false;
      }
      destroySession();
    };
  }, [enabled, socketConnected, socketInstance, editor, filePath]);

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

  return { active, participants, conflict, save, reload, attachEditor: setEditor };
}
