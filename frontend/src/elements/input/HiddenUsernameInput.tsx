import { makeComponentHookable } from 'shared';

function HiddenUsernameInput({ username }: { username: string }) {
  return <input type='text' name='username' autoComplete='username' value={username} hidden readOnly />;
}

export default makeComponentHookable(HiddenUsernameInput);
