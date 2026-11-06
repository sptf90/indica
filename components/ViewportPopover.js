"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Lista ancorada que acompanha rolagem, redimensionamento e teclado virtual. */
export default function ViewportPopover({ anchorRef, children, className, ...props }) {
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    let frame;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchor = anchorRef.current;
        const panel = panelRef.current;
        if (!anchor || !panel) return;
        const rect = anchor.getBoundingClientRect();
        const viewport = window.visualViewport;
        const leftEdge = (viewport?.offsetLeft || 0) + 8;
        const topEdge = (viewport?.offsetTop || 0) + 8;
        const rightEdge = leftEdge + (viewport?.width || innerWidth) - 16;
        const bottomEdge = topEdge + (viewport?.height || innerHeight) - 16;
        if (rect.bottom < topEdge || rect.top > bottomEdge) {
          setPosition({ position: "fixed", visibility: "hidden" });
          return;
        }
        const below = Math.max(0, bottomEdge - rect.bottom - 5);
        const above = Math.max(0, rect.top - topEdge - 5);
        const up = below < Math.min(panel.scrollHeight, 240) && above > below;
        const maxHeight = Math.min(240, up ? above : below);
        const height = Math.min(panel.scrollHeight, maxHeight);
        const width = Math.min(rect.width, rightEdge - leftEdge);
        setPosition({
          position: "fixed", right: "auto", width,
          left: Math.max(leftEdge, Math.min(rect.left, rightEdge - width)),
          top: up ? rect.top - height - 5 : Math.max(topEdge, rect.bottom + 5),
          maxHeight, visibility: "visible",
        });
      });
    }
    update();
    const observer = new ResizeObserver(update);
    if (anchorRef.current) observer.observe(anchorRef.current);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [anchorRef]);

  return createPortal(<div {...props} ref={panelRef} className={className}
    style={position || { position: "fixed", visibility: "hidden" }}>{children}</div>, document.body);
}
