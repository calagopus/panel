import { Registry } from 'shared';
import type { DiffOnMount, OnMount } from '@/lib/editor/monacoLoader.ts';

export class MonacoEditorRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.onMountHandlers.push(...other.onMountHandlers);
    this.diffOnMountHandlers.push(...other.diffOnMountHandlers);

    return this;
  }

  /**
   * Run when a single file editor mounts, before the editor's own `onMount`.
   * @since 1.0.0
   */
  public onMountHandlers: OnMount[] = [];
  /**
   * Run when a side by side diff editor mounts.
   * @since 1.0.6
   */
  public diffOnMountHandlers: DiffOnMount[] = [];

  /** @since 1.0.0 */
  public addOnMountHandler(handler: OnMount): this {
    this.onMountHandlers.push(handler);
    return this;
  }

  /** @since 1.0.6 */
  public addDiffOnMountHandler(handler: DiffOnMount): this {
    this.diffOnMountHandlers.push(handler);
    return this;
  }
}
