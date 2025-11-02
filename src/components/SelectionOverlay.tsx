import { useEffect, useRef } from "react";

interface SelectionBounds {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
}

interface Selection {
  width: number;
  height: number;
  mask: boolean[];
  bounds: SelectionBounds | null;
}

interface SelectionOverlayProps {
  selection: Selection | null;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
}

export const SelectionOverlay = ({
  selection,
  canvasWidth,
  canvasHeight,
  zoom,
}: SelectionOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const offsetRef = useRef<number>(0);
  const edgePointsRef = useRef<Array<{x: number; y: number; dir: 'h' | 'v'}>>([]);

  useEffect(() => {
    // Pre-compute edge points when selection changes
    if (selection && selection.bounds) {
      const edges: Array<{x: number; y: number; dir: 'h' | 'v'}> = [];

      // Only scan the bounding box region for efficiency
      const { min_x, max_x, min_y, max_y } = selection.bounds;

      for (let y = min_y; y <= max_y; y++) {
        for (let x = min_x; x <= max_x; x++) {
          const idx = y * selection.width + x;
          if (!selection.mask[idx]) continue;

          // Check edges more efficiently
          const leftEmpty = x === 0 || !selection.mask[idx - 1];
          const rightEmpty = x === selection.width - 1 || !selection.mask[idx + 1];
          const topEmpty = y === 0 || !selection.mask[idx - selection.width];
          const bottomEmpty = y === selection.height - 1 || !selection.mask[idx + selection.width];

          if (leftEmpty) edges.push({x, y, dir: 'v'});
          if (rightEmpty) edges.push({x: x + 1, y, dir: 'v'});
          if (topEmpty) edges.push({x, y, dir: 'h'});
          if (bottomEmpty) edges.push({x, y: y + 1, dir: 'h'});
        }
      }

      edgePointsRef.current = edges;
    } else {
      edgePointsRef.current = [];
    }
  }, [selection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Disable image smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;

    // Animation function for marching ants
    const animate = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      if (!selection || !selection.bounds || edgePointsRef.current.length === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Update offset for marching ants animation (slower for better visibility)
      offsetRef.current = (offsetRef.current + 0.3) % 8;

      // Draw black dashed line
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -offsetRef.current;

      drawEdges(ctx, edgePointsRef.current);

      // Draw white dashed line on top for visibility
      ctx.strokeStyle = "#ffffff";
      ctx.lineDashOffset = -offsetRef.current - 4;

      drawEdges(ctx, edgePointsRef.current);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [selection, canvasWidth, canvasHeight]);

  const drawEdges = (ctx: CanvasRenderingContext2D, edges: Array<{x: number; y: number; dir: 'h' | 'v'}>) => {
    ctx.beginPath();

    for (const edge of edges) {
      if (edge.dir === 'h') {
        // Horizontal edge
        ctx.moveTo(edge.x, edge.y);
        ctx.lineTo(edge.x + 1, edge.y);
      } else {
        // Vertical edge
        ctx.moveTo(edge.x, edge.y);
        ctx.lineTo(edge.x, edge.y + 1);
      }
    }

    ctx.stroke();
  };

  if (!selection || !selection.bounds) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${(canvasWidth * zoom) / 100}px`,
        height: `${(canvasHeight * zoom) / 100}px`,
        pointerEvents: "none",
        imageRendering: "pixelated",
      }}
    />
  );
};
