import { createRoot } from 'react-dom/client';
import { Extension, ExtensionContext } from 'shared';
import App from '@/App.tsx';
import {
  applyShadcnMinimalTheme,
  applyShadcnTheme,
  isShadcnMinimalThemeEnabled,
  isShadcnThemeEnabled,
} from '@/themes/shadcn/index.ts';

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

window.extensionContext = new ExtensionContext(extensions);

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

let theme = window.extensionContext.getMantineTheme();
let cssVariablesResolver = window.extensionContext.getMantineCssResolver();

if (isShadcnThemeEnabled()) {
  ({ theme, cssVariablesResolver } = applyShadcnTheme(theme, cssVariablesResolver));
} else if (isShadcnMinimalThemeEnabled()) {
  ({ theme, cssVariablesResolver } = applyShadcnMinimalTheme(theme, cssVariablesResolver));
}

createRoot(root).render(<App theme={theme} cssVariablesResolver={cssVariablesResolver} />);
