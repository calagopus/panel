import { createRoot } from 'react-dom/client';
import { Extension, ExtensionContext } from 'shared';
import App from '@/App.tsx';
import getSettings from '@/api/getSettings.ts';
import { useGlobalStore } from '@/stores/global.ts';

import.meta.glob('../extensions/*/src/app.css', { eager: true });

import '@/app.css';

const extensionModulesTs = import.meta.glob('../extensions/*/src/index.ts', { eager: true });
const extensionModulesTsx = import.meta.glob('../extensions/*/src/index.tsx', { eager: true });
const extensions: Extension[] = [];

for (const [path, module] of Object.entries({ ...extensionModulesTs, ...extensionModulesTsx })) {
  const identifier = path.split('/')[2];
  if (identifier === 'shared') continue;

  if (module && typeof module === 'object' && 'default' in module && module.default instanceof Extension) {
    module.default.packageName = identifier.replaceAll('_', '.');
    extensions.push(module.default);
  } else {
    console.error('Invalid frontend module', identifier, module);
  }
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();

  const lastReload = localStorage.getItem('lastReload') || '0';
  const now = Date.now();

  if (now - parseInt(lastReload) < 5000) {
    document.body.innerHTML =
      'Failed to load application: Preload error occurred multiple times. Please check the console for more details.';
    throw new Error('Preload error occurred multiple times');
  }

  localStorage.setItem('lastReload', now.toString());
  window.location.reload();
});

const root = document.getElementById('root');

if (!root) {
  document.body.innerHTML = 'Failed to load application: Root element not found (???)';
  throw new Error('Root element not found');
}

function setExtensionStylesEnabled(isEnabled: (identifier: string) => boolean) {
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    const identifier = link.href.match(/\/extension-([^./]+)\.[^./]+\.css$/)?.[1];

    if (identifier) {
      link.disabled = !isEnabled(identifier);
    }
  }

  for (const style of document.querySelectorAll<HTMLStyleElement>('style[data-vite-dev-id]')) {
    const identifier = style.dataset.viteDevId?.match(/(?:frontend\/extensions|backend-extensions)\/([^/]+)\//)?.[1];

    if (identifier && style.sheet) {
      style.sheet.disabled = !isEnabled(identifier);
    }
  }
}

setExtensionStylesEnabled(() => false);

(async () => {
  let disabled: string[] = [];

  try {
    const settings = await getSettings();

    disabled = settings.disabledExtensions;
    useGlobalStore.getState().setSettings(settings);
    useGlobalStore.getState().setTimeOffset(Date.now() - new Date(settings.time).getTime());
  } catch (err) {
    console.error('Failed to load settings, assuming no extensions are disabled:', err);
  }

  const disabledIdentifiers = disabled.map((packageName) => packageName.replaceAll('.', '_'));
  const isEnabled = (identifier: string) => !disabledIdentifiers.includes(identifier);

  setExtensionStylesEnabled(isEnabled);
  import.meta.hot?.on('vite:afterUpdate', () => setExtensionStylesEnabled(isEnabled));

  window.extensionContext = new ExtensionContext(
    extensions.filter((extension) => !disabled.includes(extension.packageName)),
  );

  createRoot(root!).render(
    <App
      theme={window.extensionContext.getMantineTheme()}
      cssVariablesResolver={window.extensionContext.getMantineCssResolver()}
    />,
  );
})();
