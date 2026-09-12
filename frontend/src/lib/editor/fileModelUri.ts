import { join } from 'pathe';

export function fileModelUri(serverUuid: string, filePath: string, instanceId: string): string {
  const path = join('/', filePath).split('/').map(encodeURIComponent).join('/');
  return `calagopus://${encodeURIComponent(serverUuid)}/${encodeURIComponent(instanceId)}${path}`;
}
