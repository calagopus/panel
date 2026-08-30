import { type OnMount } from '@monaco-editor/react';
import { type EditorChangeEvent } from '@pierre/diffs/edit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { type PierreEditorHandle } from '@/elements/PierreEditor.tsx';
import {
  bindPierreEditor,
  createMonacoBinding,
  cursorColor,
  fromBase64,
  normalizePath,
  toBase64,
  updateCursorStyles,
} from '@/lib/files/collab.ts';
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
  const authGappedRef = useRef(false);
  const pendingSaveRef = useRef<string[] | null>(null);
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
    let syncedEpoch: string | null = null;
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

    const onSync = (syncPath: string, state: string, meta?: string, rawPath?: string, stateVector?: string) => {
      if (!(rawPath !== undefined && normalizePath(rawPath) === normalizePath(path)) && !matchesSession(syncPath)) {
        return;
      }

      let dirty = false;
      let syncConflict: CollabConflict | null = null;
      let epoch: string | null = null;
      try {
        const parsed = JSON.parse(meta ?? '{}');
        dirty = Boolean(parsed.dirty);
        syncConflict = parsed.conflict ?? null;
        epoch = typeof parsed.epoch === 'string' ? parsed.epoch : null;
      } catch {
        // ignore
      }

      // a document from the same daemon-side lineage can absorb the sync instead of being
      // replaced by it, which keeps local edits the daemon never received. a rebuilt document
      // carries a new epoch and shares no history, so merging into it would duplicate content
      const existing = docRef.current;
      if (existing && stateVector && epoch !== null && epoch === syncedEpoch) {
        sessionKey = normalizePath(syncPath);
        Y.applyUpdate(existing, fromBase64(state), 'remote');

        // pushed unconditionally: deletions carry no new operations, so no comparison of
        // state vectors can tell whether this document holds edits wings is missing. an
        // update that turns out to be redundant only marks the session dirty, which the
        // daemon's reconciler clears within a second
        sendUpdate(Y.encodeStateAsUpdate(existing, fromBase64(stateVector)));

        // onActivated is deliberately not called here: the session was already active, and
        // it resets the editor's saved-content baseline, which would report unsaved edits
        // as saved
        setConflict(syncConflict);

        if (pendingSaveRef.current) {
          socket.send(SocketRequest.FILE_COLLAB_SAVE, pendingSaveRef.current);
        }

        return;
      }

      const monacoEditor = engine === 'monaco' ? (editor as Parameters<OnMount>[0]) : null;
      const model = monacoEditor?.getModel() ?? null;
      if (engine === 'monaco' && !model) return;

      destroySession();
      sessionKey = normalizePath(syncPath);
      syncedEpoch = epoch;

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

        bindingRef.current = createMonacoBinding(text, model, new Set([monacoEditor]), awareness);
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

      pendingSaveRef.current = null;
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
      pendingSaveRef.current = null;
      setConflict(parsed);
      callbacksRef.current.onConflict(parsed);
    };

    // updates sent while the jwt was stale were held back or discarded, so the subscription
    // is rebuilt to merge whatever wings is missing back into it
    const onAuthSuccess = () => {
      if (!authGappedRef.current) return;
      authGappedRef.current = false;

      socket.send(SocketRequest.FILE_COLLAB_SUBSCRIBE, [path, editorId]);
    };

    const onAuthGap = () => {
      authGappedRef.current = true;
    };

    const onErrorEvent = (errorPath: string, message: string) => {
      if (!matchesSession(errorPath)) return;

      const wasActive = docRef.current !== null;
      pendingUpdates = [];

      // a resync keeps the document so the sync it triggers can merge into it, preserving
      // edits the daemon never received. onSync still replaces it when the epoch changed,
      // and re-issues the save that the daemon refused while it was missing updates
      if (message === 'resync') {
        socket.send(SocketRequest.FILE_COLLAB_SUBSCRIBE, [path, editorId]);
        return;
      }

      pendingSaveRef.current = null;
      destroySession();

      if (wasActive) {
        socket.send(SocketRequest.FILE_COLLAB_SUBSCRIBE, [path, editorId]);
      } else {
        subscribedRef.current = false;
      }
      callbacksRef.current.onError(message);
    };

    socket.addListener('auth success', onAuthSuccess);
    socket.addListener('jwt error', onAuthGap);
    socket.addListener('token expired', onAuthGap);
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
      socket.removeListener('auth success', onAuthSuccess);
      socket.removeListener('jwt error', onAuthGap);
      socket.removeListener('token expired', onAuthGap);
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

      // kept so a save wings refuses because it is missing updates can be re-issued once a
      // resync has pushed them back
      const args = force ? (expectedHash ? [filePath, '1', expectedHash] : [filePath, '1']) : [filePath];
      pendingSaveRef.current = args;
      socketInstance.send(SocketRequest.FILE_COLLAB_SAVE, args);

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
