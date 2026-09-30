import { useEffect } from 'react';
import { useRelativePageStore } from '@/stores/relativePage.ts';
import { PageHeader } from '@/stores/slices/relativePage/document.ts';

export function useNavbarPageHeader(header: PageHeader, enabled = true): boolean {
  const hasMobileNavbar = useRelativePageStore((state) => state.hasMobileNavbar);
  const setPageHeader = useRelativePageStore((state) => state.setPageHeader);

  const hoisted = enabled && hasMobileNavbar;

  useEffect(() => {
    if (!hoisted) return;

    setPageHeader({ title: header.title, subtitle: header.subtitle });
    return () => setPageHeader(null);
  }, [hoisted, header.title, header.subtitle]);

  return hoisted;
}
