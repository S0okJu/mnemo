"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

const DRAG_THRESHOLD = 3;
const STEP = 16;
const LARGE_STEP = 48;

export interface ResizeOptions {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  /** Persist a final width after a drag, key press, or reset. */
  onCommit: (value: number) => void;
  /** Apply an intermediate width while dragging without re-rendering. */
  onLive?: (value: number) => void;
  /** Called on a press that did not move far enough to count as a drag. */
  onPress?: () => void;
  /** Called when a drag ends below the minimum width. */
  onCollapse?: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

/** Pointer and keyboard handlers for a vertical splitter. */
export function useResize({
  value,
  min,
  max,
  defaultValue,
  onCommit,
  onLive,
  onPress,
  onCollapse,
}: ResizeOptions) {
  const drag = useRef<{ x: number; width: number; moved: boolean } | null>(
    null,
  );
  function finish(event: PointerEvent<HTMLElement>) {
    const state = drag.current;
    drag.current = null;
    document.documentElement.removeAttribute("data-resizing");
    if (!state) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (!state.moved) return onPress?.();
    const raw = state.width + event.clientX - state.x;
    if (onCollapse && raw < min - 40) {
      onLive?.(value);
      return onCollapse();
    }
    onCommit(clamp(raw, min, max));
  }
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, width: value, moved: false };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const state = drag.current;
      if (!state) return;
      const delta = event.clientX - state.x;
      if (!state.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
      if (!state.moved) {
        state.moved = true;
        document.documentElement.setAttribute("data-resizing", "");
      }
      onLive?.(clamp(state.width + delta, min, max));
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onDoubleClick() {
      onLive?.(defaultValue);
      onCommit(defaultValue);
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const step = event.shiftKey ? LARGE_STEP : STEP;
      const next =
        event.key === "ArrowRight"
          ? value + step
          : event.key === "ArrowLeft"
            ? value - step
            : event.key === "Home"
              ? min
              : event.key === "End"
                ? max
                : event.key === "Enter" && onPress
                  ? undefined
                  : null;
      if (next === null) return;
      event.preventDefault();
      if (next === undefined) return onPress?.();
      const width = clamp(next, min, max);
      onLive?.(width);
      onCommit(width);
    },
  };
}

export function ResizeHandle({
  label,
  controls,
  className,
  ...options
}: ResizeOptions & {
  label: string;
  controls?: string;
  className?: string;
}) {
  const handlers = useResize(options);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={options.value}
      aria-valuemin={options.min}
      aria-valuemax={options.max}
      tabIndex={0}
      title="Drag to resize · Double-click to reset"
      {...handlers}
      className={cn(
        "group/resize absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none outline-none",
        "after:bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors",
        "hover:after:bg-primary/60 focus-visible:after:bg-primary active:after:bg-primary focus-visible:after:w-0.5",
        className,
      )}
    />
  );
}
