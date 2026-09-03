import classNames from 'classnames';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Anchor from '@/elements/typography/Anchor.tsx';

export default function Copyright({ className }: { className?: string }) {
  return (
    <div className={classNames('flex flex-col text-xs transition-all text-(--mantine-color-dimmed)', className)}>
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.elements.copyright.prependedComponents}
        name='global-copyright-prepended'
      />

      <span className='flex flex-row gap-2'>
        <Anchor size='xs' href='https://calagopus.com' target='_blank'>
          Calagopus
        </Anchor>
        &copy; 2025 - {new Date().getFullYear()}
      </span>

      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.elements.copyright.appendedComponents}
        name='global-copyright-appended'
      />
    </div>
  );
}
