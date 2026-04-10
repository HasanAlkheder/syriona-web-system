import { useLayoutEffect, useState } from "react";

function measurePlacement(anchorEl, itemCount, defaultMaxHeight) {
  if (!anchorEl) {
    return { flip: false, maxHeight: defaultMaxHeight };
  }
  const rect = anchorEl.getBoundingClientRect();
  const viewportPad = 10;
  const gap = 6;
  const rows = Math.max(Number(itemCount) || 1, 1);
  const estContent = Math.min(defaultMaxHeight, rows * 42 + 20);
  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
  const spaceAbove = rect.top - gap - viewportPad;
  const flip =
    spaceBelow < Math.min(estContent, 96) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    120,
    Math.min(defaultMaxHeight, flip ? spaceAbove : spaceBelow)
  );
  return { flip, maxHeight };
}

/**
 * Flip a listbox above its anchor when there is not enough space below,
 * and clamp maxHeight so the menu fits in the viewport (avoids page scroll UX).
 */
export function useFlipListboxPlacement(
  open,
  anchorRef,
  itemCount,
  defaultMaxHeight = 260
) {
  const [placement, setPlacement] = useState({
    flip: false,
    maxHeight: defaultMaxHeight,
  });

  useLayoutEffect(() => {
    if (!open) {
      setPlacement({ flip: false, maxHeight: defaultMaxHeight });
      return;
    }

    const apply = () => {
      const el = anchorRef.current;
      setPlacement(measurePlacement(el, itemCount, defaultMaxHeight));
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("scroll", apply, true);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", apply, true);
    };
  }, [open, itemCount, defaultMaxHeight, anchorRef]);

  return placement;
}
