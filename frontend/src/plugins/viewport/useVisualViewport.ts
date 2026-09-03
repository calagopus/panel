import { useEffect, useState } from 'react';

export function visualViewportBottomInset(): number {
  const viewport = window.visualViewport;
  if (!viewport || viewport.scale > 1.001) return 0;

  const inset = window.innerHeight - viewport.height - viewport.offsetTop;
  return inset < 24 ? 0 : inset;
}

export function useVisualViewportBottomInset(): number {
  const [inset, setInset] = useState(visualViewportBottomInset);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => setInset(visualViewportBottomInset());

    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
