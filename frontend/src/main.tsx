import { createRoot } from 'react-dom/client';
import { Extension, ExtensionContext } from 'shared';
import App from '@/App.tsx';

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
  window.location.reload();
});

const root = document.getElementById('root');

if (!root) {
  document.body.innerHTML = 'Failed to load application: Root element not found (???)';
  throw new Error('Root element not found');
}

createRoot(root).render(<App theme={window.extensionContext.getMantineTheme()} />);
