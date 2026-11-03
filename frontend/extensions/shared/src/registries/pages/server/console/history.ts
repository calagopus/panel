import type { FC } from 'react';
import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import type {
  ResourceHistoryRange,
  ResourceHistoryRow,
  ResourceHistorySummary,
  ResourceHistoryTimeframe,
} from '@/lib/resourceHistory.ts';
import { serverResourceHistorySchema } from '@/lib/schemas/server/server.ts';
import { ComponentListRegistry } from '../../../slices/componentList.ts';

export interface ResourceHistoryProps {
  /** The range currently shown, `start`/`end`/`points` are what was requested from the node. */
  timeframe: ResourceHistoryTimeframe;
  /** Raw node response, `undefined` until the first load. */
  history: z.infer<typeof serverResourceHistorySchema> | undefined;
  /** One row per point, with limits resolved and network converted to bits per second. */
  rows: ResourceHistoryRow[];
  summary: ResourceHistorySummary;
  loading: boolean;
}

export interface ResourceHistoryItem {
  id: string;
  component: FC<ResourceHistoryProps>;
  /** Spans the whole grid row instead of one column. */
  fullWidth?: boolean;
}

type RangeInterceptor = (ranges: ResourceHistoryRange[]) => void;
type ItemInterceptor = (items: ResourceHistoryItem[], props: ResourceHistoryProps) => void;

export class ResourceHistoryRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.headerComponents.mergeFrom(other.headerComponents);

    this.rangeInterceptors.push(...other.rangeInterceptors);
    this.summaryCards.push(...other.summaryCards);
    this.summaryCardInterceptors.push(...other.summaryCardInterceptors);
    this.blocks.push(...other.blocks);
    this.blockInterceptors.push(...other.blockInterceptors);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** Rendered next to the range controls. */
  public headerComponents: ComponentListRegistry<ResourceHistoryProps> = new ComponentListRegistry();

  public rangeInterceptors: RangeInterceptor[] = [];
  public summaryCards: ResourceHistoryItem[] = [];
  public summaryCardInterceptors: ItemInterceptor[] = [];
  public blocks: ResourceHistoryItem[] = [];
  public blockInterceptors: ItemInterceptor[] = [];

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterHeaderComponents(callback: (registry: ComponentListRegistry<ResourceHistoryProps>) => unknown): this {
    callback(this.headerComponents);
    return this;
  }

  /** Adds a selectable range after the stock ones (1h, 6h, 24h, 7d, 30d, 1y). */
  public addRange(range: ResourceHistoryRange): this {
    this.rangeInterceptors.push((ranges) => {
      ranges.push(range);
    });
    return this;
  }

  /** Mutates the selectable ranges in place, e.g. to remove, reorder or retune the stock ones. */
  public addRangeInterceptor(interceptor: RangeInterceptor): this {
    this.rangeInterceptors.push(interceptor);
    return this;
  }

  /** Adds a card after the stock summary cards (uptime, cpu, memory, network, disk). */
  public addSummaryCard(card: ResourceHistoryItem): this {
    this.summaryCards.push(card);
    return this;
  }

  /** Mutates the summary cards in place before rendering, stock and extension cards alike. */
  public addSummaryCardInterceptor(interceptor: ItemInterceptor): this {
    this.summaryCardInterceptors.push(interceptor);
    return this;
  }

  /** Adds a chart block after the stock ones (states, cpu, memory, network, disk). */
  public addBlock(block: ResourceHistoryItem): this {
    this.blocks.push(block);
    return this;
  }

  /** Mutates the chart blocks in place before rendering, stock and extension blocks alike. */
  public addBlockInterceptor(interceptor: ItemInterceptor): this {
    this.blockInterceptors.push(interceptor);
    return this;
  }
}
