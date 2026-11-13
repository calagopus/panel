import { Registry } from 'shared';
import type { PierreDiffOnMount, PierreOnMount } from '@/elements/editors/PierreEditor.tsx';

export class PierreEditorRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.onMountHandlers.push(...other.onMountHandlers);
    this.diffOnMountHandlers.push(...other.diffOnMountHandlers);

    return this;
  }

  /**
   * Run when the editor attaches, which can happen again after a reattach.
   * @since 1.2.3
   */
  public onMountHandlers: PierreOnMount[] = [];
  /**
   * Run when the read-only diff view mounts.
   * @since 1.2.3
   */
  public diffOnMountHandlers: PierreDiffOnMount[] = [];

  /** @since 1.2.3 */
  public addOnMountHandler(handler: PierreOnMount): this {
    this.onMountHandlers.push(handler);
    return this;
  }

  /** @since 1.2.3 */
  public addDiffOnMountHandler(handler: PierreDiffOnMount): this {
    this.diffOnMountHandlers.push(handler);
    return this;
  }
}
