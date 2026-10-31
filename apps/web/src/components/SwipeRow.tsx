import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

export interface SwipeAction {
  label: string;
  onClick(): void;
  tone?: 'danger';
}

const ACTION_WIDTH = 72;

/**
 * Swipe left on a touch screen to reveal quick actions (docs/DESIGN.md §5.3).
 * Touch only: mouse and keyboard users get the same actions on the item's own
 * page, so the swipe is never the only way (WCAG 2.5.1).
 */
export function SwipeRow({ children, actions }: { children: ReactNode; actions: SwipeAction[] }) {
  const width = actions.length * ACTION_WIDTH;
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const dragging = useRef(false);
  // While a finger holds the row it follows exactly; on release it eases into place.
  const [held, setHeld] = useState(false);
  const open = offset <= -width;

  const close = () => setOffset(0);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    start.current = { x: e.clientX, y: e.clientY, base: open ? -width : 0 };
    dragging.current = false;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!dragging.current) {
      if (Math.abs(dx) < 10) return;
      // A mostly vertical move is a scroll: let the page have it.
      if (Math.abs(dy) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      dragging.current = true;
      setHeld(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-released pointers can't be captured; the drag still works.
      }
    }
    setOffset(Math.min(0, Math.max(-width - 24, s.base + dx)));
  };

  const onPointerEnd = () => {
    if (!start.current) return;
    start.current = null;
    setHeld(false);
    if (dragging.current) setOffset((o) => (o < -width / 2 ? -width : 0));
  };

  return (
    <div className="swipe">
      <div className="swipe__actions" aria-hidden={!open} style={{ width }}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            tabIndex={open ? 0 : -1}
            className={`swipe__action ${a.tone === 'danger' ? 'swipe__action--danger' : ''}`}
            onClick={() => {
              close();
              a.onClick();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      {/* The gesture surface: taps pass through to the link inside. */}
      <div
        className={`swipe__content ${held ? '' : 'is-settling'}`}
        style={{ transform: offset ? `translateX(${offset}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          // A drag isn't a tap; and a tap on an open row just closes it.
          if (dragging.current || open) {
            e.preventDefault();
            e.stopPropagation();
            dragging.current = false;
            if (open) close();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
