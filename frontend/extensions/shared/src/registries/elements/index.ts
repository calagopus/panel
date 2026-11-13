import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';
import { MonacoEditorRegistry } from './monacoEditor.ts';
import { PierreEditorRegistry } from './pierreEditor.ts';

export class ElementsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.monacoEditor.mergeFrom(other.monacoEditor);
    this.pierreEditor.mergeFrom(other.pierreEditor);
    this.copyright.mergeFrom(other.copyright);

    return this;
  }

  /** @since 1.0.0 */
  public monacoEditor: MonacoEditorRegistry = new MonacoEditorRegistry();
  /** @since 1.2.3 */
  public pierreEditor: PierreEditorRegistry = new PierreEditorRegistry();
  /** @since 1.0.3 */
  public copyright: ComponentListRegistry<{}> = new ComponentListRegistry();

  /** @since 1.0.0 */
  public enterMonacoEditor(callback: (registry: MonacoEditorRegistry) => unknown): this {
    callback(this.monacoEditor);
    return this;
  }

  /** @since 1.2.3 */
  public enterPierreEditor(callback: (registry: PierreEditorRegistry) => unknown): this {
    callback(this.pierreEditor);
    return this;
  }

  /** @since 1.0.3 */
  public enterCopyright(callback: (registry: ComponentListRegistry<{}>) => unknown): this {
    callback(this.copyright);
    return this;
  }
}
