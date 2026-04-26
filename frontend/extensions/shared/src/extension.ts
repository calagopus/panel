import { createTheme, type MantineThemeOverride } from '@mantine/core';
import { merge } from 'object-deep-merge';
import { ExtensionRegistry } from 'shared';

class ExtensionSkip {
  protected static readonly __skip = 0xdeadbeeeeef;

  public static isSkip(other: unknown): other is ExtensionSkip {
    return typeof other === 'object' && other !== null && '__skip' in other && other.__skip === this.__skip;
  }
}

export class ExtensionContext {
  public readonly extensions: Extension[];
  public extensionRegistry: ExtensionRegistry = new ExtensionRegistry();

  constructor(extensions: Extension[]) {
    this.extensions = extensions;

    for (const extension of this.extensions) {
      try {
        extension.initialize(this);
      } catch (err) {
        console.error('Error while running extension initialize()', extension.packageName, err);
      }
    }
  }

  public getMantineTheme(): MantineThemeOverride {
    let mantineTheme: MantineThemeOverride = {};

    for (const extension of this.extensions) {
      try {
        mantineTheme = merge(mantineTheme, extension.initializeMantineTheme(this));
      } catch (err) {
        console.error('Error while running extension initializeMantineTheme()', extension.packageName, err);
      }
    }

    return createTheme(mantineTheme);
  }

  public call(name: string, args: object): unknown {
    for (const extension of this.extensions) {
      const result = extension.processCall(this, name, args);

      if (!ExtensionSkip.isSkip(result)) {
        return result;
      }
    }

    return null;
  }

  // Skips the current call process iteration
  public skip() {
    return new ExtensionSkip();
  }
}

export class Extension {
  public packageName: string = '';
  // This is the component used in the configuration page for this extension (/admin/extensions/<packageName>)
  public cardConfigurationPage: React.FC | null = null;
  // This is the component added in your extension card in the admin extensions page
  public cardComponent: React.FC | null = null;

  // Your extension entrypoint, this runs when the page is loaded
  public initialize(ctx: ExtensionContext): void {
    // to be implemented
  }

  // Your extension mantine theme entrypoint, this runs when the page is loaded
  public initializeMantineTheme(ctx: ExtensionContext): MantineThemeOverride {
    return {};
  }

  /**
   * Your extension call processor, this can be called by other extensions to interact with yours,
   * if the call does not apply to your extension, simply return `ctx.skip()` to continue the matching process.
   *
   * Optimally (if applies) make sure your calls are globally unique, for example by prepending them with `yourauthorname_yourextensioname_`
   */
  public processCall(ctx: ExtensionContext, name: string, args: object): unknown {
    return ctx.skip();
  }
}
