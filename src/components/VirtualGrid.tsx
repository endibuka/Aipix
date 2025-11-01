import { useEffect, useRef, useState, useCallback, memo } from "react";

interface VirtualGridProps<T> {
  items: T[];
  itemHeight: number;
  itemsPerRow: number;
  gap: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

/**
 * Virtual Grid Component - Only renders visible items
 * Dramatically reduces DOM nodes for large lists
 */
export const VirtualGrid = memo(<T extends { id: string }>({
  items,
  itemHeight,
  itemsPerRow,
  gap,
  renderItem,
  overscan = 2,
}: VirtualGridProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate visible range
  const totalRows = Math.ceil(items.length / itemsPerRow);
  const totalHeight = totalRows * (itemHeight + gap);

  const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
  const endRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + containerHeight) / (itemHeight + gap)) + overscan
  );

  const visibleItems = items.slice(
    startRow * itemsPerRow,
    endRow * itemsPerRow
  );

  // Handle scroll with RAF throttling
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    });
  }, []);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-y-auto h-full"
      style={{ overflowAnchor: "none" }}
    >
      <div style={{ height: `${totalHeight}px`, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${startRow * (itemHeight + gap)}px)`,
            display: "grid",
            gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
            gap: `${gap}px`,
          }}
        >
          {visibleItems.map((item, index) =>
            renderItem(item, startRow * itemsPerRow + index)
          )}
        </div>
      </div>
    </div>
  );
});

VirtualGrid.displayName = "VirtualGrid";
