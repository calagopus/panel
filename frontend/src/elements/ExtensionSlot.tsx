import type { ComponentType } from 'react';

interface ExtensionSlotProps<P extends object> {
  components: ComponentType<P>[];
  name: string;
  props?: P;
}

export default function ExtensionSlot<P extends object = Record<string, never>>({
  components,
  name,
  props,
}: ExtensionSlotProps<P>) {
  return (
    <>
      {components.map((Component, index) => (
        <Component key={`${name}-${index}`} {...(props ?? ({} as P))} />
      ))}
    </>
  );
}
