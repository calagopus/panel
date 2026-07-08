import { ReactNode, useEffect } from 'react';
import { useRelativePageStore } from '@/stores/relativePage.ts';

export default function ContentContainer({ title, children }: { title: string; children: ReactNode }) {
  const setTitle = useRelativePageStore((state) => state.setTitle);

  useEffect(() => {
    setTitle(title);
  }, [title]);

  return children;
}
