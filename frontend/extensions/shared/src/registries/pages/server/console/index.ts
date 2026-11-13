import type { FC } from 'react';
import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { ComponentListRegistry } from '../../../slices/componentList.ts';
import { XTermRegistry } from '../../../slices/xterm.ts';
import { CrashHistoryRegistry } from './crashes.ts';
import { ResourceHistoryRegistry } from './history.ts';

interface ConsoleFeatureDefinition {
  filter?: (features: string[]) => boolean;
  component: FC;
}

export class ConsoleRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.powerButtonComponents.mergeFrom(other.powerButtonComponents);
    this.terminalHeaderLeftComponents.mergeFrom(other.terminalHeaderLeftComponents);
    this.terminalHeaderRightComponents.mergeFrom(other.terminalHeaderRightComponents);
    this.xterm.mergeFrom(other.xterm);
    this.history.mergeFrom(other.history);
    this.crashes.mergeFrom(other.crashes);

    this.features.push(...other.features);
    this.statCards.push(...other.statCards);
    this.statBlocks.push(...other.statBlocks);
    this.terminalInputRowComponents.push(...other.terminalInputRowComponents);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /**
   * Rendered around the start, restart and stop buttons.
   * @since 1.0.0
   */
  public powerButtonComponents: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Rendered around the connection status on the left of the bar above the terminal.
   * @since 1.0.0
   */
  public terminalHeaderLeftComponents: ComponentListRegistry = new ComponentListRegistry();
  /**
   * Rendered around the controls on the right of the bar above the terminal.
   * @since 1.0.0
   */
  public terminalHeaderRightComponents: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.0.0 */
  public xterm: XTermRegistry = new XTermRegistry();
  /** @since 1.2.9 */
  public history: ResourceHistoryRegistry = new ResourceHistoryRegistry();
  /** @since 1.2.10 */
  public crashes: CrashHistoryRegistry = new CrashHistoryRegistry();

  /**
   * Egg feature handlers, mounted next to the stock EULA and Java version modals.
   * @since 1.0.0
   */
  public features: ConsoleFeatureDefinition[] = [];
  /**
   * Small stat tiles after the stock cpu, memory, disk and network tiles.
   * @since 1.0.0
   */
  public statCards: FC[] = [];
  /**
   * Chart blocks after the stock live cpu, memory and network charts.
   * @since 1.0.0
   */
  public statBlocks: FC[] = [];
  /**
   * Rendered at the end of the command input row.
   * @since 1.0.0
   */
  public terminalInputRowComponents: FC[] = [];

  /** @since 1.0.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.0.0 */
  public enterPowerButtonComponents(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.powerButtonComponents);
    return this;
  }

  /** @since 1.0.0 */
  public enterTerminalHeaderLeftComponents(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.terminalHeaderLeftComponents);
    return this;
  }

  /** @since 1.0.0 */
  public enterTerminalHeaderRightComponents(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.terminalHeaderRightComponents);
    return this;
  }

  /** @since 1.0.0 */
  public enterXTerm(callback: (registry: XTermRegistry) => unknown): this {
    callback(this.xterm);
    return this;
  }

  /** @since 1.2.9 */
  public enterHistory(callback: (registry: ResourceHistoryRegistry) => unknown): this {
    callback(this.history);
    return this;
  }

  /** @since 1.2.10 */
  public enterCrashes(callback: (registry: CrashHistoryRegistry) => unknown): this {
    callback(this.crashes);
    return this;
  }

  /**
   * Mounted only when `filter` returns true for the egg features, or when it has no `filter`.
   * @since 1.0.0
   */
  public addFeature(feature: ConsoleFeatureDefinition): this {
    this.features.push(feature);

    return this;
  }

  /** @since 1.0.0 */
  public addStatCard(card: FC): this {
    this.statCards.push(card);

    return this;
  }

  /** @since 1.0.0 */
  public addStatBlock(block: FC): this {
    this.statBlocks.push(block);

    return this;
  }

  /** @since 1.0.0 */
  public addTerminalInputRowComponent(component: FC): this {
    this.terminalInputRowComponents.push(component);

    return this;
  }
}
