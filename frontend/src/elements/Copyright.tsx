import classNames from 'classnames';
import Anchor from '@/elements/Anchor.tsx';

export default function Copyright({ className }: { className?: string }) {
  return (
    <div className={classNames('flex flex-col text-xs transition-all text-(--mantine-color-dimmed)', className)}>
      {window.extensionContext.extensionRegistry.elements.copyright.prependedComponents.map((Component, index) => (
        <Component key={`global-copyright-prepended-${index}`} />
      ))}

      <span className='flex flex-row gap-2'>
        <Anchor size='xs' href='https://calagopus.com' target='_blank' className='underline'>
          Calagopus
        </Anchor>
        &copy; 2025 - {new Date().getFullYear()}
      </span>

      {window.extensionContext.extensionRegistry.elements.copyright.appendedComponents.map((Component, index) => (
        <Component key={`global-copyright-appended-${index}`} />
      ))}
    </div>
  );
}
