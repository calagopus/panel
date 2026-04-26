import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class ApiKeysRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.apiKeyContextMenu.mergeFrom(other.apiKeyContextMenu);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public apiKeyContextMenu: ContextMenuRegistry<{ apiKey: z.infer<typeof userApiKeySchema> }> =
    new ContextMenuRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterApiKeyContextMenu(
    callback: (registry: ContextMenuRegistry<{ apiKey: z.infer<typeof userApiKeySchema> }>) => unknown,
  ): this {
    callback(this.apiKeyContextMenu);
    return this;
  }
}
