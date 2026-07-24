import { useCallback, useEffect, useRef, useState } from "react";

interface UseResizableOptions {
  minWidth: number;
  getMaxWidth: () => number;
  // In RTL the panel is mirrored to the right, so the resizable edge is the
  // panel's left side and width must be measured from its right edge instead.
  isRtl?: boolean;
}

interface UseResizableReturn {
  width: number | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
  handleMouseDown: (e: React.MouseEvent) => void;
}

export function useResizable({
  minWidth,
  getMaxWidth,
  isRtl = false,
}: UseResizableOptions): UseResizableReturn {
  const [width, setWidth] = useState<number | null>(null); // null = use CSS default
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Initialize with current computed width if not already set
      if (width === null && panelRef.current) {
        setWidth(panelRef.current.offsetWidth);
      }
      setIsResizing(true);
    },
    [width],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      const panelRect = panelRef.current.getBoundingClientRect();
      // LTR: drag the right edge → width grows from the fixed left edge.
      // RTL: drag the left edge → width grows from the fixed right edge.
      const newWidth = isRtl
        ? panelRect.right - e.clientX
        : e.clientX - panelRect.left;
      const maxWidth = getMaxWidth();
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minWidth, getMaxWidth, isRtl]);

  return {
    width,
    panelRef,
    handleMouseDown,
  };
}
