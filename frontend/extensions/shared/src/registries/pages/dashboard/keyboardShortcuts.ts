import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { ComponentListRegistry } from '../../slices/componentList.ts';

export class KeyboardShortcutsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.shortcutSections.mergeFrom(other.shortcutSections);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public shortcutSections: ComponentListRegistry = new ComponentListRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterShortcutSections(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.shortcutSections);
    return this;
  }
}
