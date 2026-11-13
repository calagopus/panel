import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { ComponentListRegistry } from '../../slices/componentList.ts';

export class KeyboardShortcutsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.shortcutSections.mergeFrom(other.shortcutSections);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /**
   * Sections in the two column keyboard shortcuts layout.
   * @since 1.0.0
   */
  public shortcutSections: ComponentListRegistry = new ComponentListRegistry();

  /** @since 1.0.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.0.0 */
  public enterShortcutSections(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.shortcutSections);
    return this;
  }
}
