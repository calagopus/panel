import type { Plugin } from 'vite';

const VARIABLES_BLOCK = /<script type="application\/json" id="extension-variables">([^<]*)<\/script>/;

export async function fetchBackendExtensionVariables(): Promise<{
  block: string;
  variables: Record<string, Record<string, unknown>>;
} | null> {
  const match = await fetch(`http://localhost:${process.env.BACKEND_PORT ?? 8000}/`)
    .then((response) => response.text())
    .then((backendHtml) => backendHtml.match(VARIABLES_BLOCK))
    .catch(() => null);

  if (!match) {
    console.warn('[extension-variables] could not read extension variables from the backend index.html');
    return null;
  }

  return { block: match[0], variables: JSON.parse(match[1]) };
}

export function extensionVariables(): Plugin {
  return {
    name: 'extension-variables',
    apply: 'serve',

    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        const backend = await fetchBackendExtensionVariables();
        if (!backend) return html;

        return html.replace('</head>', `${backend.block}</head>`);
      },
    },
  };
}
