import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverCrashSchema } from '@/lib/schemas/server/server.ts';
import { ComponentListRegistry } from '../../../slices/componentList.ts';
import { XTermRegistry } from '../../../slices/xterm.ts';

export interface CrashHistoryItemProps {
  crash: z.infer<typeof serverCrashSchema>;
}

export interface CrashDetailProps extends CrashHistoryItemProps {
  /** Console output stored with the crash, untouched by log interceptors, `undefined` while loading. */
  log: string | undefined;
  /** The lines shown in the terminal, after log interceptors ran. */
  lines: string[];
}

type LogInterceptor = (lines: string[], props: CrashHistoryItemProps) => void;

export class CrashHistoryRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionComponents.mergeFrom(other.actionComponents);
    this.detailComponents.mergeFrom(other.detailComponents);
    this.listItemComponents.mergeFrom(other.listItemComponents);
    this.xterm.mergeFrom(other.xterm);

    this.logInterceptors.push(...other.logInterceptors);

    return this;
  }

  /** @since 1.2.10 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /**
   * Rendered next to the download and delete buttons of the selected crash.
   * @since 1.2.10
   */
  public actionComponents: ComponentListRegistry<CrashDetailProps> = new ComponentListRegistry();
  /**
   * Prepended components render between the crash header and the terminal, appended ones below the terminal.
   * @since 1.2.10
   */
  public detailComponents: ComponentListRegistry<CrashDetailProps> = new ComponentListRegistry();
  /**
   * Rendered on the right of each entry in the crash list, around the stock out of memory badge.
   * @since 1.2.10
   */
  public listItemComponents: ComponentListRegistry<CrashHistoryItemProps> = new ComponentListRegistry();
  /**
   * Runs against the read-only terminal, which is created again for every selected crash.
   * @since 1.2.10
   */
  public xterm: XTermRegistry<CrashHistoryItemProps> = new XTermRegistry();

  /** @since 1.2.10 */
  public logInterceptors: LogInterceptor[] = [];

  /** @since 1.2.10 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.2.10 */
  public enterActionComponents(callback: (registry: ComponentListRegistry<CrashDetailProps>) => unknown): this {
    callback(this.actionComponents);
    return this;
  }

  /** @since 1.2.10 */
  public enterDetailComponents(callback: (registry: ComponentListRegistry<CrashDetailProps>) => unknown): this {
    callback(this.detailComponents);
    return this;
  }

  /** @since 1.2.10 */
  public enterListItemComponents(callback: (registry: ComponentListRegistry<CrashHistoryItemProps>) => unknown): this {
    callback(this.listItemComponents);
    return this;
  }

  /** @since 1.2.10 */
  public enterXTerm(callback: (registry: XTermRegistry<CrashHistoryItemProps>) => unknown): this {
    callback(this.xterm);
    return this;
  }

  /**
   * Mutates the lines shown in the terminal in place, e.g. to filter or highlight them. Downloads and the
   * `log` prop keep the stored output.
   * @since 1.2.10
   */
  public addLogInterceptor(interceptor: LogInterceptor): this {
    this.logInterceptors.push(interceptor);
    return this;
  }
}
