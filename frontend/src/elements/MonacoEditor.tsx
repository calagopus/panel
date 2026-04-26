import { Editor, loader } from '@monaco-editor/react';
import { ComponentProps } from 'react';

loader.config({
  paths: {
    vs: '/monaco',
  },
});

export default function MonacoEditor(props: ComponentProps<typeof Editor>) {
  return (
    <Editor
      {...props}
      onMount={(e, m) => {
        for (const handler of window.extensionContext.extensionRegistry.elements.monacoEditor.onMountHandlers) {
          handler(e, m);
        }

        props.onMount?.(e, m);
      }}
    />
  );
}
