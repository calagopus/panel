import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon as BaseFontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { cloneElement, type ComponentType, isValidElement, type ReactElement, type Ref } from 'react';
import { useIconReplacement } from '@/lib/iconReplacements.ts';

export * from '@fortawesome/react-fontawesome';

export type IconLike = IconDefinition | ReactElement | ComponentType<{ className?: string }>;

export type IconProps = Omit<FontAwesomeIconProps, 'icon'> & { icon: IconLike };

export function isIconDefinition(icon: unknown): icon is IconDefinition {
  return typeof icon === 'object' && icon !== null && !('$$typeof' in icon) && 'prefix' in icon && 'iconName' in icon;
}

function IconRenderer({ icon, ...props }: IconProps) {
  // extension-provided icons can be missing at runtime even tho not allowed by type
  if (!icon) {
    return null;
  }

  if (isIconDefinition(icon)) {
    return <BaseFontAwesomeIcon icon={icon} {...props} />;
  }

  if (
    isValidElement<FontAwesomeIconProps>(icon) &&
    (icon.type === FontAwesomeIcon || icon.type === BaseFontAwesomeIcon || icon.type === Icon)
  ) {
    return cloneElement(icon, { ...props, className: classNames(icon.props.className, props.className) });
  }

  const Component = icon as ComponentType<{ className?: string }>;
  const attributes = Object.fromEntries(
    Object.entries(props).filter(([key]) => key.startsWith('data-') || key.startsWith('aria-')),
  );

  // the span keeps FontAwesome's 1em box, size classes and the ref tooltips anchor to
  return (
    <span
      {...attributes}
      ref={props.ref as Ref<HTMLSpanElement>}
      className={classNames(
        'svg-inline--fa',
        !isValidElement(icon) && '*:size-full',
        props.size && `fa-${props.size}`,
        props.className,
      )}
      style={{ color: props.color, ...props.style }}
      title={props.title}
    >
      {isValidElement(icon) ? icon : <Component />}
    </span>
  );
}

export function FontAwesomeIcon(props: FontAwesomeIconProps) {
  const replacement = useIconReplacement(isIconDefinition(props.icon) ? props.icon : undefined);

  if (!replacement) {
    return <BaseFontAwesomeIcon {...props} />;
  }

  return <IconRenderer {...props} icon={replacement} />;
}

export default function Icon(props: IconProps) {
  const replacement = useIconReplacement(isIconDefinition(props.icon) ? props.icon : undefined);

  return <IconRenderer {...props} icon={replacement ?? props.icon} />;
}
