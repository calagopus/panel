import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/pages/auth/AuthWrapper.tsx';

export class VerifyEmailRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);

    return this;
  }

  /** @since 1.2.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();

  /** @since 1.2.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }
}
