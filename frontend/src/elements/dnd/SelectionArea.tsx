import {
  Component,
  ContextType,
  CSSProperties,
  createContext,
  createRef,
  PureComponent,
  ReactElement,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  Ref,
} from 'react';

interface SelectionContextType<T> {
  registerSelectable: (id: string, element: HTMLElement, item: T) => void;
  unregisterSelectable: (id: string) => void;
}

const SelectionContext = createContext<SelectionContextType<unknown> | null>(null);

interface SelectionAreaProps<T> {
  children: ReactNode;
  onSelectedStart?: (event: ReactMouseEvent | MouseEvent) => void;
  onSelected?: (items: T[]) => void;
  onSelectedEnd?: () => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  fireEvents?: boolean;
  deferSelection?: boolean;
}

interface SelectableProps<T> {
  item: T;
  children: (ref: Ref<HTMLElement>) => ReactElement;
}

interface CachedRect<T> {
  left: number;
  right: number;
  top: number;
  bottom: number;
  checkbox: HTMLInputElement | null;
  initiallySelected: boolean;
  element: HTMLElement;
  item: T;
}

interface SimpleBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

type SelectionMode = 'replace' | 'add' | 'toggle';

let selectableIdCounter = 0;

function hasSelectionChanged<T>(oldSelection: T[], newSelection: T[]): boolean {
  if (oldSelection.length !== newSelection.length) return true;
  for (let i = 0; i < oldSelection.length; i++) {
    if (oldSelection[i] !== newSelection[i]) return true;
  }
  return false;
}

class Selectable<T> extends PureComponent<SelectableProps<T>> {
  static contextType = SelectionContext;
  declare context: ContextType<typeof SelectionContext>;

  private elementRef: HTMLElement | null = null;
  private readonly id = `selectable-${++selectableIdCounter}`;

  componentDidMount(): void {
    if (this.elementRef && this.context) {
      this.context.registerSelectable(this.id, this.elementRef, this.props.item);
    }
  }

  componentWillUnmount(): void {
    if (this.context) {
      this.context.unregisterSelectable(this.id);
    }
  }

  componentDidUpdate(prevProps: SelectableProps<T>): void {
    if (prevProps.item !== this.props.item && this.elementRef && this.context) {
      this.context.registerSelectable(this.id, this.elementRef, this.props.item);
    }
  }

  render(): ReactElement {
    return this.props.children(this.setRef);
  }

  private readonly setRef = (element: HTMLElement | null): void => {
    this.elementRef = element;
    if (element && this.context) {
      this.context.registerSelectable(this.id, element, this.props.item);
    }
  };
}

class SelectionArea<T> extends Component<SelectionAreaProps<T>> {
  static Selectable = Selectable;

  private containerRef = createRef<HTMLDivElement>();
  private selectionBoxRef = createRef<HTMLDivElement>();
  private selectablesMap = new Map<string, { element: HTMLElement; item: T }>();

  private cachedItems = new Map<T, CachedRect<T>>();
  private pendingSelectables = new Set<string>();

  private currentlySelected: T[] = [];
  private previewedElements = new Set<HTMLElement>();
  private startPoint = { x: 0, y: 0 };
  private endPoint = { x: 0, y: 0 };
  private mouseDown = false;
  private selectionStarted = false;
  private selectionMode: SelectionMode = 'replace';
  private readonly SELECTION_THRESHOLD = 5;

  private lastClientX = 0;
  private lastClientY = 0;
  private lastMouseEvent: MouseEvent | ReactMouseEvent | null = null;

  private rAFId: number | null = null;
  private contextValue: SelectionContextType<unknown> | null = null;

  componentWillUnmount(): void {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('scroll', this.handleScroll, { capture: true });
    if (this.rAFId !== null) cancelAnimationFrame(this.rAFId);
    this.clearSelectionPreview();
  }

  render(): ReactNode {
    const { children, className = '', style = {} } = this.props;
    this.contextValue ??= {
      registerSelectable: this.registerSelectable as never,
      unregisterSelectable: this.unregisterSelectable,
    };

    return (
      <SelectionContext.Provider value={this.contextValue}>
        <div
          ref={this.containerRef}
          className={`selection-area ${className}`}
          style={{ position: 'relative', ...style }}
          onMouseDown={this.handleMouseDown}
        >
          {children}
          <div
            ref={this.selectionBoxRef}
            className='selection-box'
            style={{
              display: 'none',
              position: 'absolute',
              backgroundColor: 'var(--mantine-color-blue-light)',
              border: '1px solid var(--mantine-color-blue-5)',
              pointerEvents: 'none',
              zIndex: 1000,
              willChange: 'top, left, width, height',
            }}
          />
        </div>
      </SelectionContext.Provider>
    );
  }

  private readonly registerSelectable = (id: string, element: HTMLElement, item: T): void => {
    this.selectablesMap.set(id, { element, item });

    if (this.mouseDown && !this.props.disabled) {
      this.pendingSelectables.add(id);
      this.queueUpdate();
    }
  };

  private readonly unregisterSelectable = (id: string): void => {
    this.selectablesMap.delete(id);
    this.pendingSelectables.delete(id);
  };

  private cacheSelectable(container: HTMLDivElement, containerRect: DOMRect, element: HTMLElement, item: T): void {
    if (!element.isConnected) return;

    const rect = element.getBoundingClientRect();
    const checkbox = element.matches('input[type="checkbox"]')
      ? (element as HTMLInputElement)
      : element.querySelector<HTMLInputElement>('input[type="checkbox"]');
    this.cachedItems.set(item, {
      left: rect.left - containerRect.left + container.scrollLeft,
      right: rect.right - containerRect.left + container.scrollLeft,
      top: rect.top - containerRect.top + container.scrollTop,
      bottom: rect.bottom - containerRect.top + container.scrollTop,
      checkbox,
      initiallySelected:
        checkbox?.checked ??
        (element.matches('[aria-selected="true"]') || !!element.querySelector('[aria-selected="true"]')),
      element,
      item,
    });
  }

  private measurePendingSelectables(): void {
    if (this.pendingSelectables.size === 0) return;

    const container = this.containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    for (const id of this.pendingSelectables) {
      const selectable = this.selectablesMap.get(id);
      if (selectable) this.cacheSelectable(container, containerRect, selectable.element, selectable.item);
    }

    this.pendingSelectables.clear();
  }

  private readonly handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if (this.props.disabled || e.button !== 0) return;

    const container = this.containerRef.current!;
    const containerRect = container.getBoundingClientRect();

    this.clearSelectionPreview();
    this.cachedItems.clear();
    this.pendingSelectables.clear();
    this.currentlySelected = [];
    this.selectionStarted = false;
    this.selectionMode = e.ctrlKey || e.metaKey ? 'toggle' : e.shiftKey ? 'add' : 'replace';
    this.selectablesMap.forEach(({ element, item }) => {
      this.cacheSelectable(container, containerRect, element, item);
    });

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    this.lastMouseEvent = e;

    const x = e.clientX - containerRect.left + container.scrollLeft;
    const y = e.clientY - containerRect.top + container.scrollTop;

    this.startPoint = { x, y };
    this.endPoint = { x, y };
    this.mouseDown = true;

    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('scroll', this.handleScroll, {
      capture: true,
      passive: true,
    });
  };

  private readonly handleMouseMove = (e: MouseEvent): void => {
    if (!this.mouseDown || this.props.disabled) return;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
    this.lastMouseEvent = e;
    this.queueUpdate();
  };

  private readonly handleScroll = (): void => {
    if (!this.mouseDown || this.props.disabled) return;
    this.queueUpdate();
  };

  private queueUpdate = () => {
    if (this.rAFId === null) {
      this.rAFId = requestAnimationFrame(this.processSelectionUpdate);
    }
  };

  private processSelectionUpdate = () => {
    this.rAFId = null;
    if (!this.mouseDown) return;
    this.measurePendingSelectables();
    this.updateSelection(this.lastClientX, this.lastClientY, this.lastMouseEvent);
  };

  private updateSelection(clientX: number, clientY: number, originalEvent: MouseEvent | ReactMouseEvent | null) {
    const container = this.containerRef.current!;
    const containerRect = container.getBoundingClientRect();

    const x = clientX - containerRect.left + container.scrollLeft;
    const y = clientY - containerRect.top + container.scrollTop;

    const dx = Math.abs(x - this.startPoint.x);
    const dy = Math.abs(y - this.startPoint.y);

    if (!this.selectionStarted && (dx > this.SELECTION_THRESHOLD || dy > this.SELECTION_THRESHOLD)) {
      this.selectionStarted = true;
      if (originalEvent) {
        this.props.onSelectedStart?.(originalEvent);
      }
    }

    if (this.selectionStarted) {
      this.endPoint = { x, y };

      const left = Math.min(this.startPoint.x, this.endPoint.x);
      const top = Math.min(this.startPoint.y, this.endPoint.y);
      const width = Math.abs(this.endPoint.x - this.startPoint.x);
      const height = Math.abs(this.endPoint.y - this.startPoint.y);

      if (this.selectionBoxRef.current) {
        const style = this.selectionBoxRef.current.style;
        style.display = 'block';
        style.left = `${left}px`;
        style.top = `${top}px`;
        style.width = `${width}px`;
        style.height = `${height}px`;
      }

      const selectionBounds = {
        left,
        top,
        right: left + width,
        bottom: top + height,
      };

      const previewedElements = this.props.deferSelection ? new Set<HTMLElement>() : undefined;
      const newlySelectedItems = this.getSelectedItems(selectionBounds, previewedElements);

      if (previewedElements) this.updateSelectionPreview(previewedElements);

      if (hasSelectionChanged(this.currentlySelected, newlySelectedItems)) {
        this.currentlySelected = newlySelectedItems;
        if (!this.props.deferSelection) this.props.onSelected?.(newlySelectedItems);
      }
    }
  }

  private readonly handleMouseUp = (e: MouseEvent): void => {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('scroll', this.handleScroll, { capture: true });

    if (this.rAFId !== null) cancelAnimationFrame(this.rAFId);
    this.rAFId = null;
    this.measurePendingSelectables();
    if (this.mouseDown) this.updateSelection(e.clientX, e.clientY, e);

    if (!this.props.disabled && !this.selectionStarted && this.mouseDown && this.props.fireEvents) {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (target && !(target instanceof HTMLInputElement)) {
        const newEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          button: e.button,
        });

        target.dispatchEvent(newEvent);
      }
    }

    if (this.selectionBoxRef.current) {
      this.selectionBoxRef.current.style.display = 'none';
    }

    const committed = !this.props.disabled && this.selectionStarted && this.props.deferSelection;
    if (committed) {
      this.props.onSelected?.(this.currentlySelected);
    }

    this.clearSelectionPreview(!committed);
    this.cachedItems.clear();
    this.pendingSelectables.clear();

    this.mouseDown = false;
    this.selectionStarted = false;
    this.lastMouseEvent = null;
    this.props.onSelectedEnd?.();
  };

  private getSelectedItems(selectionBounds: SimpleBounds, previewedElements?: Set<HTMLElement>): T[] {
    const selected: CachedRect<T>[] = [];

    this.cachedItems.forEach((cached) => {
      if (
        !(
          selectionBounds.right < cached.left ||
          selectionBounds.left > cached.right ||
          selectionBounds.bottom < cached.top ||
          selectionBounds.top > cached.bottom
        )
      ) {
        selected.push(cached);
        previewedElements?.add(cached.element);
      }
    });

    selected.sort((a, b) => a.top - b.top || a.left - b.left);

    return selected.map((cached) => cached.item);
  }

  private updateSelectionPreview(elements: Set<HTMLElement>): void {
    const next = new Set<HTMLElement>();

    for (const cached of this.cachedItems.values()) {
      const hit = elements.has(cached.element);
      const selected =
        this.selectionMode === 'add'
          ? cached.initiallySelected || hit
          : this.selectionMode === 'toggle'
            ? cached.initiallySelected !== hit
            : hit;

      if (selected) next.add(cached.element);
      if (cached.checkbox && cached.checkbox.checked !== selected) cached.checkbox.checked = selected;
    }

    for (const element of this.previewedElements) {
      if (!next.has(element)) element.classList.remove('selection-area-preview');
    }
    for (const element of next) {
      if (!this.previewedElements.has(element)) element.classList.add('selection-area-preview');
    }
    this.previewedElements = next;
  }

  private clearSelectionPreview(restoreCheckboxes = true): void {
    for (const element of this.previewedElements) element.classList.remove('selection-area-preview');
    if (restoreCheckboxes) {
      for (const cached of this.cachedItems.values()) {
        if (cached.checkbox) cached.checkbox.checked = cached.initiallySelected;
      }
    }
    this.previewedElements.clear();
  }
}

export default SelectionArea;
