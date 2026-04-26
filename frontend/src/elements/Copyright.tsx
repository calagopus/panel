import classNames from 'classnames';

export default function Copyright({ className }: { className?: string }) {
  return (
    <div className={classNames('flex flex-col text-xs transition-all text-gray-400', className)}>
      {window.extensionContext.extensionRegistry.elements.copyright.prependedComponents.map((Component, index) => (
        <Component key={`global-copyright-prepended-${index}`} />
      ))}

      <span className='flex flex-row gap-2'>
        <a href='https://calagopus.com' target='_blank' className='underline'>
          Calagopus
        </a>
        &copy; 2025 - {new Date().getFullYear()}
      </span>

      {window.extensionContext.extensionRegistry.elements.copyright.appendedComponents.map((Component, index) => (
        <Component key={`global-copyright-appended-${index}`} />
      ))}
    </div>
  );
}
