import { StateCreator } from 'zustand';
import { SocketError, Websocket } from '@/plugins/Websocket.ts';
import { ServerStore } from '@/stores/server.ts';

export interface WebsocketSlice {
  socketInstance: Websocket | null;
  socketError: SocketError | null;
  socketConnected: boolean;

  setSocketInstance: (instance: Websocket | null) => void;
  setSocketError: (error: SocketError | null) => void;
  setSocketConnectionState: (connected: boolean) => void;
}

export const createWebsocketSlice: StateCreator<ServerStore, [], [], WebsocketSlice> = (set): WebsocketSlice => ({
  socketInstance: null as Websocket | null,
  socketError: null,
  socketConnected: false,

  setSocketInstance: (value) => set((state) => (state.socketInstance === value ? state : { socketInstance: value })),
  setSocketError: (value) => set((state) => (state.socketError === value ? state : { socketError: value })),
  setSocketConnectionState: (value) =>
    set((state) => (state.socketConnected === value ? state : { socketConnected: value })),
});
