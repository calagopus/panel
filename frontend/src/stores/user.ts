import { create } from 'zustand';
import { ApiKeySlice, createApiKeysSlice } from '@/stores/slices/user/apiKeys.ts';
import { CommandSnippetsSlice, createCommandSnippetsSlice } from '@/stores/slices/user/commandSnippets.ts';
import { createOAuthLinksSlice, OAuthLinksSlice } from '@/stores/slices/user/oauthLinks.ts';
import { createSecurityKeysSlice, SecurityKeySlice } from '@/stores/slices/user/securityKeys.ts';
import { createServersSlice, ServerSlice } from '@/stores/slices/user/servers.ts';
import { createSessionsSlice, SessionSlice } from '@/stores/slices/user/sessions.ts';
import { createSshKeysSlice, SshKeySlice } from '@/stores/slices/user/sshKeys.ts';

export interface UserStore
  extends ServerSlice,
    ApiKeySlice,
    SessionSlice,
    SshKeySlice,
    CommandSnippetsSlice,
    SecurityKeySlice,
    OAuthLinksSlice {
  reset: () => void;
}

export const useUserStore = create<UserStore>()((...a) => {
  const initialState = {} as UserStore;
  Object.assign(initialState, {
    ...createServersSlice(...a),
    ...createApiKeysSlice(...a),
    ...createSessionsSlice(...a),
    ...createSshKeysSlice(...a),
    ...createCommandSnippetsSlice(...a),
    ...createSecurityKeysSlice(...a),
    ...createOAuthLinksSlice(...a),
  });
  initialState.reset = () => a[0]((state) => ({ ...initialState, reset: state.reset }), true);
  return initialState;
});

export function getUserStore() {
  return useUserStore.getState();
}
