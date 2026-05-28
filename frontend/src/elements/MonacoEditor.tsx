import { useComputedColorScheme } from '@mantine/core';
import { DiffEditor, Editor, loader } from '@monaco-editor/react';
import { ComponentProps } from 'react';

loader.config({
  paths: {
    vs: '/monaco',
  },
});

export default function MonacoEditor(props: ComponentProps<typeof Editor>) {
  const computedColorScheme = useComputedColorScheme('dark');

  return (
    <Editor
      {...props}
      theme={computedColorScheme === 'dark' ? 'vs-dark' : 'light'}
      onMount={(e, m) => {
        for (const handler of window.extensionContext.extensionRegistry.elements.monacoEditor.onMountHandlers) {
          handler(e, m);
        }

        props.onMount?.(e, m);
      }}
    />
  );
}

export function MonacoDiffEditor(props: ComponentProps<typeof DiffEditor>) {
  const computedColorScheme = useComputedColorScheme('dark');

  return (
    <DiffEditor
      {...props}
      theme={computedColorScheme === 'dark' ? 'vs-dark' : 'light'}
      onMount={(e, m) => {
        for (const handler of window.extensionContext.extensionRegistry.elements.monacoEditor.diffOnMountHandlers) {
          handler(e, m);
        }

        props.onMount?.(e, m);
      }}
    />
  );
}
