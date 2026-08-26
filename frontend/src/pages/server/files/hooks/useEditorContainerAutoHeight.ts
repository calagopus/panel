import { RefObject, useEffect } from 'react';
import { visualViewportBottomInset } from '@/plugins/useVisualViewport.ts';

interface UseEditorContainerAutoHeightOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  loading: boolean;
  getParent: () => HTMLElement | null | undefined;
  layout: () => void;
  extraObserveRef?: RefObject<HTMLDivElement | null>;
  useVisualViewportInset?: boolean;
  deps: unknown[];
}

export function useEditorContainerAutoHeight({
  containerRef,
  loading,
  getParent,
  layout,
  extraObserveRef,
  useVisualViewportInset = false,
  deps,
}: UseEditorContainerAutoHeightOptions) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || loading) return;

    const updateHeight = () => {
      const virtualWindowEl = getParent();
      const elRect = el.getBoundingClientRect();

      let bottomEdge: number;
      if (useVisualViewportInset) {
        const visibleBottom = window.innerHeight - visualViewportBottomInset();
        bottomEdge = virtualWindowEl
          ? Math.min(virtualWindowEl.getBoundingClientRect().bottom, visibleBottom)
          : visibleBottom;
      } else {
        bottomEdge = virtualWindowEl ? virtualWindowEl.getBoundingClientRect().bottom : window.innerHeight;
      }

      const newHeight = Math.max(0, bottomEdge - elRect.top);
      el.style.height = `${newHeight}px`;

      layout();
    };

    const observer = new ResizeObserver(() => updateHeight());

    const viewport = useVisualViewportInset ? window.visualViewport : null;
    viewport?.addEventListener('resize', updateHeight);
    viewport?.addEventListener('scroll', updateHeight);

    const virtualWindowEl = getParent();
    if (virtualWindowEl) {
      observer.observe(virtualWindowEl);
    } else {
      observer.observe(document.body);
    }

    if (extraObserveRef?.current) {
      observer.observe(extraObserveRef.current);
    }

    updateHeight();

    return () => {
      observer.disconnect();
      viewport?.removeEventListener('resize', updateHeight);
      viewport?.removeEventListener('scroll', updateHeight);
    };
  }, deps);
}
