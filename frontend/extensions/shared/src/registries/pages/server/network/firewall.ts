import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverFirewallRuleSchema } from '@/lib/schemas/server/firewall.ts';
import { ContextMenuRegistry } from '../../../slices/contextMenu.ts';

export class FirewallRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.ruleContextMenu.mergeFrom(other.ruleContextMenu);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public ruleContextMenu: ContextMenuRegistry<{ rule: z.infer<typeof serverFirewallRuleSchema>; position: number }> =
    new ContextMenuRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterRuleContextMenu(
    callback: (
      registry: ContextMenuRegistry<{ rule: z.infer<typeof serverFirewallRuleSchema>; position: number }>,
    ) => unknown,
  ): this {
    callback(this.ruleContextMenu);
    return this;
  }
}
