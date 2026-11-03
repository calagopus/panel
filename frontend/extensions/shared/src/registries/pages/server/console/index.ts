import type { FC } from 'react';
import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { ComponentListRegistry } from '../../../slices/componentList.ts';
import { XTermRegistry } from '../../../slices/xterm.ts';
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

    this.features.push(...other.features);
    this.statCards.push(...other.statCards);
    this.statBlocks.push(...other.statBlocks);
    this.terminalInputRowComponents.push(...other.terminalInputRowComponents);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public powerButtonComponents: ComponentListRegistry = new ComponentListRegistry();
  public terminalHeaderLeftComponents: ComponentListRegistry = new ComponentListRegistry();
  public terminalHeaderRightComponents: ComponentListRegistry = new ComponentListRegistry();
  public xterm: XTermRegistry = new XTermRegistry();
  public history: ResourceHistoryRegistry = new ResourceHistoryRegistry();

  public features: ConsoleFeatureDefinition[] = [];
  public statCards: FC[] = [];
  public statBlocks: FC[] = [];
  public terminalInputRowComponents: FC[] = [];

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterPowerButtonComponents(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.powerButtonComponents);
    return this;
  }

  public enterTerminalHeaderLeftComponents(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.terminalHeaderLeftComponents);
    return this;
  }

  public enterTerminalHeaderRightComponents(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.terminalHeaderRightComponents);
    return this;
  }

  public enterXTerm(callback: (registry: XTermRegistry) => unknown): this {
    callback(this.xterm);
    return this;
  }

  public enterHistory(callback: (registry: ResourceHistoryRegistry) => unknown): this {
    callback(this.history);
    return this;
  }

  public addFeature(feature: ConsoleFeatureDefinition): this {
    this.features.push(feature);

    return this;
  }

  public addStatCard(card: FC): this {
    this.statCards.push(card);

    return this;
  }

  public addStatBlock(block: FC): this {
    this.statBlocks.push(block);

    return this;
  }

  public addTerminalInputRowComponent(component: FC): this {
    this.terminalInputRowComponents.push(component);

    return this;
  }
}
