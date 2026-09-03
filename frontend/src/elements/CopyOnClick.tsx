import classNames from 'classnames';
import { handleCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function CopyOnClick({
  enabled = true,
  content,
  className,
  children,
}: {
  enabled?: boolean;
  content: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { addToast } = useToast();

  return enabled ? (
    <button onClick={handleCopyToClipboard(content, addToast)} className={classNames('cursor-pointer', className)}>
      {children}
    </button>
  ) : (
    children
  );
}
