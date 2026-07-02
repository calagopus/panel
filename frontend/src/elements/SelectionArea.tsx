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
}

interface SelectionAreaState {
  isSelecting: boolean;
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
  item: T;
}

interface SimpleBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

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

class SelectionArea<T> extends Component<SelectionAreaProps<T>, SelectionAreaState> {
  static Selectable = Selectable;

  private containerRef = createRef<HTMLDivElement>();
  private selectionBoxRef = createRef<HTMLDivElement>();
  private selectablesMap = new Map<string, { element: HTMLElement; item: T }>();

  private cachedItems: CachedRect<T>[] = [];

  private currentlySelected: T[] = [];
  private startPoint = { x: 0, y: 0 };
  private endPoint = { x: 0, y: 0 };
  private mouseDown = false;
  private readonly SELECTION_THRESHOLD = 5;

  private lastClientX = 0;
  private lastClientY = 0;
  private lastMouseEvent: MouseEvent | ReactMouseEvent | null = null;

  private rAFId: number | null = null;

  constructor(props: SelectionAreaProps<T>) {
    super(props);
    this.state = {
      isSelecting: false,
    };
  }

  componentWillUnmount(): void {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('scroll', this.handleScroll, { capture: true });
    if (this.rAFId !== null) cancelAnimationFrame(this.rAFId);
  }

  render(): ReactNode {
    const { children, className = '', style = {} } = this.props;
    const contextValue: SelectionContextType<unknown> = {
      registerSelectable: this.registerSelectable as never,
      unregisterSelectable: this.unregisterSelectable,
    };

    return (
      <SelectionContext.Provider value={contextValue}>
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
              backgroundColor: 'rgba(0, 123, 255, 0.2)',
              border: '1px solid rgba(0, 123, 255, 0.5)',
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
  };

  private readonly unregisterSelectable = (id: string): void => {
    this.selectablesMap.delete(id);
  };

  private readonly handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>): void => {
    if (this.props.disabled || e.button !== 0) return;

    const container = this.containerRef.current!;
    const containerRect = container.getBoundingClientRect();

    this.cachedItems = [];
    this.selectablesMap.forEach(({ element, item }) => {
      const rect = element.getBoundingClientRect();
      this.cachedItems.push({
        left: rect.left - containerRect.left + container.scrollLeft,
        right: rect.right - containerRect.left + container.scrollLeft,
        top: rect.top - containerRect.top + container.scrollTop,
        bottom: rect.bottom - containerRect.top + container.scrollTop,
        item,
      });
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
    this.updateSelection(this.lastClientX, this.lastClientY, this.lastMouseEvent);
  };

  private updateSelection(clientX: number, clientY: number, originalEvent: MouseEvent | ReactMouseEvent | null) {
    const container = this.containerRef.current!;
    const containerRect = container.getBoundingClientRect();

    const x = clientX - containerRect.left + container.scrollLeft;
    const y = clientY - containerRect.top + container.scrollTop;

    const dx = Math.abs(x - this.startPoint.x);
    const dy = Math.abs(y - this.startPoint.y);

    if (!this.state.isSelecting && (dx > this.SELECTION_THRESHOLD || dy > this.SELECTION_THRESHOLD)) {
      this.setState({ isSelecting: true });
      if (originalEvent) {
        this.props.onSelectedStart?.(originalEvent);
      }
    }

    if (this.state.isSelecting || dx > this.SELECTION_THRESHOLD || dy > this.SELECTION_THRESHOLD) {
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

      const newlySelectedItems = this.getSelectedItems(selectionBounds);

      if (hasSelectionChanged(this.currentlySelected, newlySelectedItems)) {
        this.currentlySelected = newlySelectedItems;
        this.props.onSelected?.(newlySelectedItems);
      }
    }
  }

  private readonly handleMouseUp = (e: MouseEvent): void => {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('scroll', this.handleScroll, { capture: true });

    if (this.rAFId !== null) {
      cancelAnimationFrame(this.rAFId);
      this.rAFId = null;
    }

    if (!this.props.disabled && !this.state.isSelecting && this.mouseDown && this.props.fireEvents) {
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

    this.cachedItems = [];

    this.setState({ isSelecting: false });
    this.mouseDown = false;
    this.lastMouseEvent = null;
    this.props.onSelectedEnd?.();
  };

  private getSelectedItems(selectionBounds: SimpleBounds): T[] {
    const selectedItems: T[] = [];

    for (let i = 0; i < this.cachedItems.length; i++) {
      const cached = this.cachedItems[i];
      if (
        !(
          selectionBounds.right < cached.left ||
          selectionBounds.left > cached.right ||
          selectionBounds.bottom < cached.top ||
          selectionBounds.top > cached.bottom
        )
      ) {
        selectedItems.push(cached.item);
      }
    }

    return selectedItems;
  }
}

export default SelectionArea;
