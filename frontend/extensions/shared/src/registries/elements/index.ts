import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';
import { MonacoEditorRegistry } from './monacoEditor.ts';

export class ElementsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.monacoEditor.mergeFrom(other.monacoEditor);
    this.copyright.mergeFrom(other.copyright);

    return this;
  }

  public monacoEditor: MonacoEditorRegistry = new MonacoEditorRegistry();
  public copyright: ComponentListRegistry<{}> = new ComponentListRegistry();

  public enterMonacoEditor(callback: (registry: MonacoEditorRegistry) => unknown): this {
    callback(this.monacoEditor);
    return this;
  }

  public enterCopyright(callback: (registry: ComponentListRegistry<{}>) => unknown): this {
    callback(this.copyright);
    return this;
  }
}
