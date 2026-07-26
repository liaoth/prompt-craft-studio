"use client";

import { CircleHelp } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ControlHelpProps {
  label: string;
  children: ReactNode;
}

export function ControlHelp({ label, children }: ControlHelpProps) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 300 });

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  const hide = useCallback(() => {
    cancelClose();
    setPinned(false);
    setOpen(false);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    if (pinned) return;
    closeTimer.current = window.setTimeout(() => setOpen(false), 250);
  }, [cancelClose, pinned]);

  const updatePosition = useCallback(() => {
    const anchor = trigger.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12),
    );
    const tooltipHeight = tooltip.current?.getBoundingClientRect().height ?? 0;
    const below = rect.bottom + 8;
    const top =
      tooltipHeight > 0 &&
      below + tooltipHeight > window.innerHeight - 12 &&
      rect.top - tooltipHeight - 8 >= 12
        ? rect.top - tooltipHeight - 8
        : Math.min(below, Math.max(12, window.innerHeight - tooltipHeight - 12));
    setPosition({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !root.current?.contains(target) &&
        !tooltip.current?.contains(target)
      ) {
        hide();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const reposition = () => updatePosition();
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [hide, open, updatePosition]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    const next = event.relatedTarget as Node | null;
    if (
      next &&
      (event.currentTarget.contains(next) || tooltip.current?.contains(next))
    ) {
      return;
    }
    scheduleClose();
  }

  return (
    <span
      ref={root}
      className="v2-control-help"
      onMouseEnter={show}
      onMouseLeave={scheduleClose}
      onFocus={show}
      onBlur={handleBlur}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`查看${label}说明`}
        aria-expanded={open}
        aria-describedby={id}
        onClick={() => {
          cancelClose();
          if (pinned) {
            hide();
          } else {
            setPinned(true);
            setOpen(true);
          }
        }}
      >
        <CircleHelp size={15} />
      </button>
      {open &&
        createPortal(
          <span
            ref={tooltip}
            id={id}
            role="tooltip"
            className={`v2-control-tooltip${pinned ? " is-pinned" : ""}`}
            style={position}
            onMouseEnter={show}
            onMouseLeave={scheduleClose}
            onFocus={show}
            onBlur={(event) => {
              const next = event.relatedTarget as Node | null;
              if (next && tooltip.current?.contains(next)) return;
              scheduleClose();
            }}
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}
