import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ColorPicker } from "./ColorPicker";
import { LayerPanel, Layer, BlendMode } from "./LayerPanel";
import { WebGLRenderer, RAFBatchProcessor } from "../utils/webglRenderer";

interface CanvasProps {
  projectId: string;
  projectName: string;
  width: number;
  height: number;
  onBack: () => void;
}

type Tool =
  | "pencil"
  | "eraser"
  | "fill"
  | "eyedropper"
  | "line"
  | "rectangle"
  | "circle"
  | "select";

export const Canvas = ({
  projectId,
  projectName,
  width,
  height,
  onBack,
}: CanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webglRendererRef = useRef<WebGLRenderer | null>(null);
  const rafProcessorRef = useRef<RAFBatchProcessor>(new RAFBatchProcessor());

  const [selectedColor, setSelectedColor] = useState("#000000");
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");

  // Layer management
  const [layers, setLayers] = useState<Layer[]>([
    {
      id: "layer-1",
      name: "Background",
      visible: true,
      opacity: 100,
      blendMode: "normal",
    },
  ]);
  const [activeLayerId, setActiveLayerId] = useState("layer-1");
  const layerCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Tool options
  const [brushSize, setBrushSize] = useState(1); // 1x1, 2x2, 3x3, 4x4
  const [shapeFilled, setShapeFilled] = useState(false); // For rectangle and circle
  const [symmetryMode, setSymmetryMode] = useState<{
    horizontal: boolean;
    vertical: boolean;
  }>({ horizontal: false, vertical: false });

  // Reference image overlay
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceOpacity, setReferenceOpacity] = useState(30); // 0-100
  const [showReference, setShowReference] = useState(true);

  // Keyboard shortcut cheatsheet
  const [showCheatsheet, setShowCheatsheet] = useState(false);

  // Calculate initial zoom based on canvas size
  const getInitialZoom = () => {
    // Target display size for comfortable viewing (in pixels)
    const targetSize = 400;

    // Calculate zoom percentage needed to reach target size
    // For a 32x32 canvas: (400 / 32) * 100 = 1250%
    // For a 64x64 canvas: (400 / 64) * 100 = 625%
    const calculatedZoom = Math.round((targetSize / Math.max(width, height)) * 100);

    // Clamp between 100% and 3200%
    return Math.min(Math.max(calculatedZoom, 100), 3200);
  };

  const [zoom, setZoom] = useState(getInitialZoom());
  const [isDrawing, setIsDrawing] = useState(false);

  // Alt key for temporary eyedropper
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [previousTool, setPreviousTool] = useState<Tool | null>(null);

  // Cursor position tracking
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Hover preview for pencil/eraser
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null);

  // For line and rectangle tools
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(
    null
  );

  // Batching for performance - now using RAF
  const drawBatchRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);

  // Default color palette (Aseprite-like) - now dynamic
  const [colorPalette, setColorPalette] = useState([
    "#000000",
    "#1D2B53",
    "#7E2553",
    "#008751",
    "#AB5236",
    "#5F574F",
    "#C2C3C7",
    "#FFF1E8",
    "#FF004D",
    "#FFA300",
    "#FFEC27",
    "#00E436",
    "#29ADFF",
    "#83769C",
    "#FF77A8",
    "#FFCCAA",
    "#FFFFFF",
    "#9D9D9D",
    "#697175",
    "#4B4B4B",
    "#2E2E2E",
    "#1A1A1A",
    "#8B4513",
    "#CD853F",
  ]);

  // Add color to palette handler
  const handleAddToPalette = (color: string) => {
    // Check if color already exists in palette
    if (!colorPalette.includes(color.toUpperCase()) && !colorPalette.includes(color.toLowerCase())) {
      setColorPalette((prev) => [...prev, color]);
    }
  };

  // Layer management functions
  const generateLayerId = () => `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const getActiveLayer = useCallback(() => {
    return layers.find((l) => l.id === activeLayerId);
  }, [layers, activeLayerId]);

  const handleLayerAdd = useCallback(() => {
    const newLayer: Layer = {
      id: generateLayerId(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 100,
      blendMode: "normal",
    };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);

    // Create canvas for new layer
    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = width;
    layerCanvas.height = height;
    layerCanvasesRef.current.set(newLayer.id, layerCanvas);
  }, [layers, width, height]);

  const handleLayerDelete = useCallback((layerId: string) => {
    if (layers.length <= 1) return;

    setLayers((prev) => {
      const filtered = prev.filter((l) => l.id !== layerId);
      // If deleting active layer, select another
      if (layerId === activeLayerId && filtered.length > 0) {
        setActiveLayerId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });

    // Clean up layer canvas
    layerCanvasesRef.current.delete(layerId);
    webglRendererRef.current?.clearTextureCache(layerId);
  }, [layers, activeLayerId]);

  const handleLayerDuplicate = useCallback((layerId: string) => {
    const layerToDuplicate = layers.find((l) => l.id === layerId);
    if (!layerToDuplicate) return;

    const newLayer: Layer = {
      ...layerToDuplicate,
      id: generateLayerId(),
      name: `${layerToDuplicate.name} Copy`,
    };

    // Duplicate canvas content
    const sourceCanvas = layerCanvasesRef.current.get(layerId);
    if (sourceCanvas) {
      const newCanvas = document.createElement("canvas");
      newCanvas.width = width;
      newCanvas.height = height;
      const ctx = newCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(sourceCanvas, 0, 0);
      }
      layerCanvasesRef.current.set(newLayer.id, newCanvas);
    }

    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  }, [layers, width, height]);

  const handleLayerReorder = useCallback((fromIndex: number, toIndex: number) => {
    setLayers((prev) => {
      const newLayers = [...prev];
      const [removed] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, removed);
      return newLayers;
    });
  }, []);

  const handleLayerToggleVisibility = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
    );
  }, []);

  const handleLayerOpacityChange = useCallback((layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
  }, []);

  const handleLayerBlendModeChange = useCallback((layerId: string, blendMode: BlendMode) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, blendMode } : l))
    );
  }, []);

  const handleLayerRename = useCallback((layerId: string, name: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, name } : l))
    );
  }, []);

  // Initialize canvas on mount
  useEffect(() => {
    const initCanvas = async () => {
      try {
        // Create canvas buffer in Rust
        await invoke("create_canvas", {
          projectId,
          width,
          height,
        });

        // Initialize WebGL renderer
        if (canvasRef.current && !webglRendererRef.current) {
          try {
            webglRendererRef.current = new WebGLRenderer(canvasRef.current);
          } catch (error) {
            console.warn("WebGL not available, falling back to 2D context:", error);
          }
        }

        // Create canvas for initial layer
        const initialCanvas = document.createElement("canvas");
        initialCanvas.width = width;
        initialCanvas.height = height;
        layerCanvasesRef.current.set("layer-1", initialCanvas);

        // Get canvas data and render
        await renderCanvas();
      } catch (error) {
        console.error("Failed to initialize canvas:", error);
      }
    };

    initCanvas();

    // Create preview canvas for line/rectangle tools
    const preview = document.createElement("canvas");
    preview.width = width;
    preview.height = height;
    setPreviewCanvas(preview);

    // Cleanup on unmount
    return () => {
      webglRendererRef.current?.dispose();
      rafProcessorRef.current?.clear();
    };
  }, [projectId, width, height]);

  // Render canvas from Rust buffer with layers support
  const renderCanvas = async () => {
    try {
      const data: number[] = await invoke("get_canvas_data", { projectId });
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Update active layer canvas
      const activeCanvas = layerCanvasesRef.current.get(activeLayerId);
      if (activeCanvas) {
        const ctx = activeCanvas.getContext("2d");
        if (ctx) {
          const imageData = ctx.createImageData(width, height);
          const uint8Data = new Uint8ClampedArray(data);
          imageData.data.set(uint8Data);
          ctx.putImageData(imageData, 0, 0);
        }
      }

      // Composite all layers
      await compositeLayersWebGL();
    } catch (error) {
      console.error("Failed to render canvas:", error);
    }
  };

  // Composite all visible layers using WebGL or fallback to 2D
  const compositeLayersWebGL = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = webglRendererRef.current;

    // Fallback to 2D if WebGL not available
    if (!renderer) {
      compositeLayers2D();
      return;
    }

    try {
      // Clear canvas
      renderer.clear(0, 0, 0, 0);

      let previousTexture: WebGLTexture | undefined;

      // Render layers from bottom to top
      for (const layer of layers) {
        if (!layer.visible) continue;

        const layerCanvas = layerCanvasesRef.current.get(layer.id);
        if (!layerCanvas) continue;

        const ctx = layerCanvas.getContext("2d");
        if (!ctx) continue;

        const imageData = ctx.getImageData(0, 0, width, height);
        const texture = renderer.uploadTexture(imageData.data, width, height, layer.id);

        renderer.renderLayer(
          texture,
          layer.opacity,
          layer.blendMode,
          previousTexture
        );

        previousTexture = texture;
      }

      // Generate thumbnails for visible layers
      updateLayerThumbnails();
    } catch (error) {
      console.error("WebGL composite failed, falling back to 2D:", error);
      compositeLayers2D();
    }
  };

  // Fallback 2D compositing
  const compositeLayers2D = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Render layers from bottom to top
    for (const layer of layers) {
      if (!layer.visible) continue;

      const layerCanvas = layerCanvasesRef.current.get(layer.id);
      if (!layerCanvas) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;

      // Map blend modes to canvas composite operations
      const blendModeMap: Record<BlendMode, GlobalCompositeOperation> = {
        normal: "source-over",
        multiply: "multiply",
        screen: "screen",
        overlay: "overlay",
        darken: "darken",
        lighten: "lighten",
      };
      ctx.globalCompositeOperation = blendModeMap[layer.blendMode] || "source-over";

      ctx.drawImage(layerCanvas, 0, 0);
      ctx.restore();
    }

    updateLayerThumbnails();
  };

  // Update layer thumbnails
  const updateLayerThumbnails = () => {
    setLayers((prev) =>
      prev.map((layer) => {
        const layerCanvas = layerCanvasesRef.current.get(layer.id);
        if (!layerCanvas) return layer;

        // Create thumbnail (32x32)
        const thumbCanvas = document.createElement("canvas");
        thumbCanvas.width = 32;
        thumbCanvas.height = 32;
        const thumbCtx = thumbCanvas.getContext("2d");
        if (!thumbCtx) return layer;

        thumbCtx.imageSmoothingEnabled = false;
        thumbCtx.drawImage(layerCanvas, 0, 0, width, height, 0, 0, 32, 32);

        return {
          ...layer,
          thumbnail: thumbCanvas.toDataURL(),
        };
      })
    );
  };

  // Re-composite when layers change
  useEffect(() => {
    if (canvasRef.current) {
      compositeLayersWebGL();
    }
  }, [layers]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    return { x, y };
  };

  const drawHoverPreview = (x: number, y: number) => {
    const hoverCanvas = hoverCanvasRef.current;
    if (!hoverCanvas) return;

    const ctx = hoverCanvas.getContext("2d");
    if (!ctx) return;

    // Clear previous preview
    ctx.clearRect(0, 0, width, height);

    // Helper function to draw preview brush
    const drawPreviewBrush = (centerX: number, centerY: number) => {
      const offset = Math.floor(brushSize / 2);
      for (let dy = 0; dy < brushSize; dy++) {
        for (let dx = 0; dx < brushSize; dx++) {
          const px = centerX - offset + dx;
          const py = centerY - offset + dy;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            if (selectedTool === "pencil") {
              // Semi-transparent version of selected color
              ctx.fillStyle = selectedColor;
              ctx.globalAlpha = 0.5;
              ctx.fillRect(px, py, 1, 1);
              ctx.globalAlpha = 1.0;
            } else if (selectedTool === "eraser") {
              // Show eraser preview as semi-transparent white
              ctx.fillStyle = "#ffffff";
              ctx.globalAlpha = 0.3;
              ctx.fillRect(px, py, 1, 1);
              ctx.globalAlpha = 1.0;
            }
          }
        }
      }
    };

    // Draw at primary position
    drawPreviewBrush(x, y);

    // Draw symmetry mirrors
    if (symmetryMode.horizontal) {
      const mirrorX = width - 1 - x;
      drawPreviewBrush(mirrorX, y);
    }

    if (symmetryMode.vertical) {
      const mirrorY = height - 1 - y;
      drawPreviewBrush(x, mirrorY);
    }

    if (symmetryMode.horizontal && symmetryMode.vertical) {
      const mirrorX = width - 1 - x;
      const mirrorY = height - 1 - y;
      drawPreviewBrush(mirrorX, mirrorY);
    }
  };

  const handleMouseDown = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const { x, y } = coords;

    // Clear hover preview when starting to draw
    setHoverPos(null);
    if (hoverCanvasRef.current) {
      const ctx = hoverCanvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
      }
    }

    if (selectedTool === "eyedropper") {
      try {
        const color: string = await invoke("pick_color", {
          projectId,
          x,
          y,
        });
        setSelectedColor(color);
      } catch (error) {
        console.error("Failed to pick color:", error);
      }
      return;
    }

    if (selectedTool === "fill") {
      try {
        await invoke("draw_fill", {
          projectId,
          x,
          y,
          color: selectedColor,
        });
        await renderCanvas();
      } catch (error) {
        console.error("Failed to fill:", error);
      }
      return;
    }

    if (selectedTool === "line" || selectedTool === "rectangle" || selectedTool === "circle") {
      setStartPos({ x, y });
      setIsDrawing(true);
      return;
    }

    // Reset last position to start fresh stroke (no interpolation from previous stroke)
    lastPosRef.current = null;

    // Save state before starting to draw (for undo)
    if (selectedTool === "pencil" || selectedTool === "eraser") {
      try {
        await invoke("save_history_state", { projectId });
      } catch (error) {
        console.error("Failed to save history:", error);
      }
    }

    setIsDrawing(true);
    isDrawingRef.current = true;
    await drawPixel(x, y);
  };

  const handleMouseMove = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const { x, y } = coords;

    // Update cursor position for display
    setCursorPos({ x, y });

    // Update hover preview for pencil/eraser when not drawing
    if (!isDrawing && (selectedTool === "pencil" || selectedTool === "eraser")) {
      setHoverPos({ x, y });
      drawHoverPreview(x, y);
    }

    if (!isDrawing) return;

    if (selectedTool === "line" || selectedTool === "rectangle" || selectedTool === "circle") {
      // Draw preview
      if (startPos && previewCanvas) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Restore original canvas
        await renderCanvas();

        // Draw preview on top
        const previewCtx = previewCanvas.getContext("2d");
        if (!previewCtx) return;

        previewCtx.clearRect(0, 0, width, height);
        previewCtx.fillStyle = selectedColor;

        if (selectedTool === "line") {
          // Draw line preview
          drawLinePreview(previewCtx, startPos.x, startPos.y, x, y);
        } else if (selectedTool === "rectangle") {
          // Draw rectangle preview
          drawRectanglePreview(previewCtx, startPos.x, startPos.y, x, y);
        } else if (selectedTool === "circle") {
          // Draw circle preview
          drawCirclePreview(previewCtx, startPos.x, startPos.y, x, y);
        }

        // Composite preview onto main canvas
        ctx.drawImage(previewCanvas, 0, 0);
      }
      return;
    }

    await drawPixel(x, y);
  };

  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    // Stop drawing immediately to prevent further batch additions
    setIsDrawing(false);
    isDrawingRef.current = false;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const { x, y } = coords;

    if (selectedTool === "line" && startPos) {
      try {
        await invoke("draw_line", {
          projectId,
          x0: startPos.x,
          y0: startPos.y,
          x1: x,
          y1: y,
          color: selectedColor,
          saveHistory: true,
        });
        await renderCanvas();
      } catch (error) {
        console.error("Failed to draw line:", error);
      }
      setStartPos(null);
    } else if (selectedTool === "rectangle" && startPos) {
      try {
        await invoke("draw_rectangle", {
          projectId,
          x0: startPos.x,
          y0: startPos.y,
          x1: x,
          y1: y,
          color: selectedColor,
          filled: shapeFilled,
          saveHistory: true,
        });
        await renderCanvas();
      } catch (error) {
        console.error("Failed to draw rectangle:", error);
      }
      setStartPos(null);
    } else if (selectedTool === "circle" && startPos) {
      try {
        await invoke("draw_circle", {
          projectId,
          centerX: startPos.x,
          centerY: startPos.y,
          endX: x,
          endY: y,
          color: selectedColor,
          filled: shapeFilled,
          saveHistory: true,
        });
        await renderCanvas();
      } catch (error) {
        console.error("Failed to draw circle:", error);
      }
      setStartPos(null);
    } else if (selectedTool === "pencil" || selectedTool === "eraser") {
      // Flush any remaining draw operations
      await flushDrawBatch();
    }

    // Reset last position
    lastPosRef.current = null;
  };

  const drawPixelImmediate = (x: number, y: number) => {
    // Draw on the active layer canvas
    const layerCanvas = layerCanvasesRef.current.get(activeLayerId);
    if (!layerCanvas) return;

    const ctx = layerCanvas.getContext("2d");
    if (!ctx) return;

    // Helper function to draw a single pixel or brush stroke
    const drawBrush = (centerX: number, centerY: number) => {
      // Draw brush size (centered on cursor)
      const offset = Math.floor(brushSize / 2);
      for (let dy = 0; dy < brushSize; dy++) {
        for (let dx = 0; dx < brushSize; dx++) {
          const px = centerX - offset + dx;
          const py = centerY - offset + dy;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            if (selectedTool === "pencil") {
              ctx.fillStyle = selectedColor;
              ctx.fillRect(px, py, 1, 1);
            } else if (selectedTool === "eraser") {
              ctx.clearRect(px, py, 1, 1);
            }
          }
        }
      }
    };

    // Draw at primary position
    drawBrush(x, y);

    // Draw symmetry mirrors
    if (symmetryMode.horizontal) {
      const mirrorX = width - 1 - x;
      drawBrush(mirrorX, y);
    }

    if (symmetryMode.vertical) {
      const mirrorY = height - 1 - y;
      drawBrush(x, mirrorY);
    }

    if (symmetryMode.horizontal && symmetryMode.vertical) {
      const mirrorX = width - 1 - x;
      const mirrorY = height - 1 - y;
      drawBrush(mirrorX, mirrorY);
    }
  };

  const flushDrawBatch = async () => {
    if (drawBatchRef.current.length === 0) return;

    const batch = [...drawBatchRef.current];
    drawBatchRef.current = [];

    try {
      // Apply brush size and symmetry to backend
      const pixelsToProcess: Array<{ x: number; y: number }> = [];
      const offset = Math.floor(brushSize / 2);

      for (const { x, y } of batch) {
        // Add brush size pixels
        for (let dy = 0; dy < brushSize; dy++) {
          for (let dx = 0; dx < brushSize; dx++) {
            const px = x - offset + dx;
            const py = y - offset + dy;

            if (px >= 0 && px < width && py >= 0 && py < height) {
              pixelsToProcess.push({ x: px, y: py });

              // Add symmetry pixels
              if (symmetryMode.horizontal) {
                const mirrorX = width - 1 - px;
                if (mirrorX >= 0 && mirrorX < width) {
                  pixelsToProcess.push({ x: mirrorX, y: py });
                }
              }

              if (symmetryMode.vertical) {
                const mirrorY = height - 1 - py;
                if (mirrorY >= 0 && mirrorY < height) {
                  pixelsToProcess.push({ x: px, y: mirrorY });
                }
              }

              if (symmetryMode.horizontal && symmetryMode.vertical) {
                const mirrorX = width - 1 - px;
                const mirrorY = height - 1 - py;
                if (mirrorX >= 0 && mirrorX < width && mirrorY >= 0 && mirrorY < height) {
                  pixelsToProcess.push({ x: mirrorX, y: mirrorY });
                }
              }
            }
          }
        }
      }

      // Send all pixels to Rust
      for (const { x, y } of pixelsToProcess) {
        if (selectedTool === "pencil") {
          await invoke("draw_pencil", {
            projectId,
            x,
            y,
            color: selectedColor,
          });
        } else if (selectedTool === "eraser") {
          await invoke("draw_eraser", {
            projectId,
            x,
            y,
          });
        }
      }
    } catch (error) {
      console.error("Failed to flush draw batch:", error);
      // Re-render from backend if batch fails
      await renderCanvas();
    }
  };

  const drawPixel = async (x: number, y: number) => {
    // Check bounds to prevent drawing outside canvas
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    // Interpolate between last position and current for smooth lines using Bresenham-like algorithm
    if (lastPosRef.current) {
      const last = lastPosRef.current;

      // Only interpolate if both points are within bounds
      if (last.x >= 0 && last.x < width && last.y >= 0 && last.y < height) {
        const dx = Math.abs(x - last.x);
        const dy = Math.abs(y - last.y);
        const sx = last.x < x ? 1 : -1;
        const sy = last.y < y ? 1 : -1;
        let err = dx - dy;

        let currentX = last.x;
        let currentY = last.y;

        // Bresenham's line algorithm for accurate pixel traversal
        while (true) {
          // Draw current pixel if in bounds
          if (currentX >= 0 && currentX < width && currentY >= 0 && currentY < height) {
            drawPixelImmediate(currentX, currentY);
            drawBatchRef.current.push({ x: currentX, y: currentY });
          }

          // Check if we've reached the end point
          if (currentX === x && currentY === y) break;

          const e2 = 2 * err;
          if (e2 > -dy) {
            err -= dy;
            currentX += sx;
          }
          if (e2 < dx) {
            err += dx;
            currentY += sy;
          }

          // Safety check to prevent infinite loops
          if (Math.abs(currentX - last.x) > width || Math.abs(currentY - last.y) > height) {
            break;
          }
        }
      } else {
        // Last position was out of bounds, just draw current pixel
        drawPixelImmediate(x, y);
        drawBatchRef.current.push({ x, y });
      }
    } else {
      // First pixel
      drawPixelImmediate(x, y);
      drawBatchRef.current.push({ x, y });
    }

    lastPosRef.current = { x, y };

    // Schedule batch flush using RAF for optimal performance
    rafProcessorRef.current.addToBatch(async () => {
      await flushDrawBatch();
      // Composite layers after drawing
      await compositeLayersWebGL();
    });
  };

  const drawLinePreview = (
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      ctx.fillRect(x, y, 1, 1);

      if (x === x1 && y === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  };

  const drawRectanglePreview = (
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) => {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    if (shapeFilled) {
      // Fill the rectangle
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else {
      // Draw outline
      for (let x = minX; x <= maxX; x++) {
        ctx.fillRect(x, minY, 1, 1);
        ctx.fillRect(x, maxY, 1, 1);
      }
      for (let y = minY; y <= maxY; y++) {
        ctx.fillRect(minX, y, 1, 1);
        ctx.fillRect(maxX, y, 1, 1);
      }
    }
  };

  const drawCirclePreview = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    endX: number,
    endY: number
  ) => {
    // Calculate radius from center to end point
    const dx = endX - centerX;
    const dy = endY - centerY;
    const radius = Math.round(Math.sqrt(dx * dx + dy * dy));

    if (radius === 0) return;

    if (shapeFilled) {
      // Filled circle - draw all pixels within radius
      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          if (x * x + y * y <= radius * radius) {
            const px = centerX + x;
            const py = centerY + y;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              ctx.fillRect(px, py, 1, 1);
            }
          }
        }
      }
    } else {
      // Bresenham's circle algorithm for outline
      let x = radius;
      let y = 0;
      let decisionOver2 = 1 - x;

      const drawCirclePoints = (cx: number, cy: number, px: number, py: number) => {
        // Draw 8-way symmetry points
        const points = [
          [cx + px, cy + py],
          [cx - px, cy + py],
          [cx + px, cy - py],
          [cx - px, cy - py],
          [cx + py, cy + px],
          [cx - py, cy + px],
          [cx + py, cy - px],
          [cx - py, cy - px],
        ];

        points.forEach(([x, y]) => {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            ctx.fillRect(x, y, 1, 1);
          }
        });
      };

      while (y <= x) {
        drawCirclePoints(centerX, centerY, x, y);
        y++;
        if (decisionOver2 <= 0) {
          decisionOver2 += 2 * y + 1;
        } else {
          x--;
          decisionOver2 += 2 * (y - x) + 1;
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (e.deltaY < 0) {
      // Scroll up - zoom in
      setZoom((prev) => Math.min(prev + 100, 3200));
    } else {
      // Scroll down - zoom out
      setZoom((prev) => Math.max(prev - 100, 100));
    }
  };

  const tools: { id: Tool; label: string; icon: JSX.Element; shortcut: string }[] = [
    {
      id: "pencil",
      label: "Pencil",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      ),
      shortcut: "B",
    },
    {
      id: "eraser",
      label: "Eraser",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
      ),
      shortcut: "E",
    },
    {
      id: "fill",
      label: "Fill",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      ),
      shortcut: "G",
    },
    {
      id: "eyedropper",
      label: "Eyedropper",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="m2 22 1-1h3l9-9" />
          <path d="M3 21v-3l9-9" />
          <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l-3-3Z" />
        </svg>
      ),
      shortcut: "I",
    },
    {
      id: "line",
      label: "Line",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M5 12h14" />
        </svg>
      ),
      shortcut: "L",
    },
    {
      id: "rectangle",
      label: "Rectangle",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      ),
      shortcut: "R",
    },
    {
      id: "circle",
      label: "Circle",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <circle cx="12" cy="12" r="9" />
        </svg>
      ),
      shortcut: "C",
    },
    {
      id: "select",
      label: "Select",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M5 3a2 2 0 0 0-2 2" />
          <path d="M19 3a2 2 0 0 1 2 2" />
          <path d="M21 19a2 2 0 0 1-2 2" />
          <path d="M5 21a2 2 0 0 1-2-2" />
          <path d="M9 3h1" />
          <path d="M9 21h1" />
          <path d="M14 3h1" />
          <path d="M14 21h1" />
          <path d="M3 9v1" />
          <path d="M21 9v1" />
          <path d="M3 14v1" />
          <path d="M21 14v1" />
        </svg>
      ),
      shortcut: "M",
    },
  ];

  // Undo/Redo handlers
  const handleUndo = async () => {
    try {
      await invoke("undo_canvas", { projectId });
      await renderCanvas();
    } catch (error) {
      console.error("Failed to undo:", error);
    }
  };

  const handleRedo = async () => {
    try {
      await invoke("redo_canvas", { projectId });
      await renderCanvas();
    } catch (error) {
      console.error("Failed to redo:", error);
    }
  };

  // Handle reference image upload
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReferenceImage(event.target?.result as string);
        setShowReference(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
    setShowReference(false);
  };

  // Global mouse up handler to catch releases outside canvas
  useEffect(() => {
    const handleGlobalMouseUp = async () => {
      if (isDrawing) {
        // Flush any pending draws using RAF
        rafProcessorRef.current.flush();
        await flushDrawBatch();

        // End drawing state
        setIsDrawing(false);
        isDrawingRef.current = false;
        lastPosRef.current = null;
        setStartPos(null);
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDrawing]);

  // Update hover preview when settings change
  useEffect(() => {
    if (hoverPos && (selectedTool === "pencil" || selectedTool === "eraser")) {
      drawHoverPreview(hoverPos.x, hoverPos.y);
    }
  }, [brushSize, symmetryMode, selectedColor, selectedTool, hoverPos]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Toggle cheatsheet with ? key
      if (e.shiftKey && key === "/") {
        e.preventDefault();
        setShowCheatsheet((prev) => !prev);
        return;
      }

      // Close cheatsheet with Escape key
      if (key === "escape" && showCheatsheet) {
        e.preventDefault();
        setShowCheatsheet(false);
        return;
      }

      // Alt key for temporary eyedropper
      if (e.altKey && !isAltPressed) {
        setIsAltPressed(true);
        if (selectedTool !== "eyedropper") {
          setPreviousTool(selectedTool);
          setSelectedTool("eyedropper");
        }
        return;
      }

      // Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
      if ((e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey) {
        e.preventDefault();
        console.log("Undo triggered");
        handleUndo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y (Windows/Linux) or Cmd+Shift+Z (Mac)
      if (
        ((e.ctrlKey || e.metaKey) && key === "z" && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && key === "y")
      ) {
        e.preventDefault();
        console.log("Redo triggered");
        handleRedo();
        return;
      }

      // Tool shortcuts (don't trigger if Ctrl/Cmd is pressed)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const upperKey = e.key.toUpperCase();
        const tool = tools.find((t) => t.shortcut === upperKey);
        if (tool) {
          setSelectedTool(tool.id);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Alt key released - restore previous tool
      if (!e.altKey && isAltPressed) {
        setIsAltPressed(false);
        if (previousTool) {
          setSelectedTool(previousTool);
          setPreviousTool(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [projectId, isAltPressed, selectedTool, previousTool]);

  return (
    <div className="h-screen flex flex-col bg-[#3e323b] font-mono text-[#d6d2ca]">
      {/* Top Menu Bar */}
      <div className="h-8 bg-[#c8b79e] text-[#1d1d1d] flex items-center px-2 text-xs border-b border-[#1a1a1a]">
        <button
          onClick={onBack}
          className="px-2 py-1 hover:bg-[#b0a68e] transition-colors"
        >
          ← Back
        </button>
        <div className="mx-2 w-px h-4 bg-[#1a1a1a]" />
        <button className="px-2 py-1 hover:bg-[#b0a68e] transition-colors">
          File
        </button>
        <button className="px-2 py-1 hover:bg-[#b0a68e] transition-colors">
          Edit
        </button>
        <button className="px-2 py-1 hover:bg-[#b0a68e] transition-colors">
          View
        </button>
        <label className="px-2 py-1 hover:bg-[#b0a68e] transition-colors cursor-pointer">
          Reference
          <input
            type="file"
            accept="image/*"
            onChange={handleReferenceUpload}
            className="hidden"
          />
        </label>
        <button className="px-2 py-1 hover:bg-[#b0a68e] transition-colors">
          Sprite
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowCheatsheet(!showCheatsheet)}
          className="px-2 py-1 hover:bg-[#b0a68e] transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          ?
        </button>
        <div className="mx-2 w-px h-4 bg-[#1a1a1a]" />
        <span className="px-2 text-[#5a5349]">{projectName}</span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Color Palette */}
        <div className="w-64 bg-[#2b2b2b] border-r border-[#1a1a1a] flex flex-col overflow-hidden">
          {/* Palette Section */}
          <div className="p-3 border-b border-[#1a1a1a]">
            <div className="text-[10px] text-[#9b978e] uppercase tracking-wider mb-2 font-mono">
              Palette
            </div>
            <div className="bg-[#1d1d1d] border border-[#1a1a1a] p-1.5">
              <div className="grid grid-cols-6 gap-0.5">
                {colorPalette.map((color, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 border transition-all ${
                      selectedColor === color
                        ? "border-[#8aa7ff] ring-2 ring-[#8aa7ff] ring-inset scale-95"
                        : "border-[#1a1a1a] hover:border-[#505050]"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Color Picker Section */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-[10px] text-[#9b978e] uppercase tracking-wider mb-2 font-mono">
              Color Picker
            </div>
            <ColorPicker
              color={selectedColor}
              onChange={setSelectedColor}
              onAddToPalette={handleAddToPalette}
            />
          </div>
        </div>

        {/* Center Canvas Area */}
        <div
          className="flex-1 flex flex-col items-center justify-center bg-[#4d404f] p-4 overflow-auto"
          onWheel={handleWheel}
        >
          <div className="relative">
            {/* Reference Image Overlay */}
            {referenceImage && showReference && (
              <img
                src={referenceImage}
                alt="Reference"
                className="absolute border border-[#1a1a1a] pointer-events-none"
                style={{
                  width: `${(width * zoom) / 100}px`,
                  height: `${(height * zoom) / 100}px`,
                  opacity: referenceOpacity / 100,
                  imageRendering: "pixelated",
                  objectFit: "contain",
                }}
              />
            )}

            {/* Hover Preview Canvas */}
            <canvas
              ref={hoverCanvasRef}
              width={width}
              height={height}
              className="absolute border border-[#1a1a1a] pointer-events-none"
              style={{
                width: `${(width * zoom) / 100}px`,
                height: `${(height * zoom) / 100}px`,
                imageRendering: "pixelated",
              }}
            />

            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                // Clear cursor position display
                setCursorPos(null);

                // Clear hover preview
                setHoverPos(null);
                if (hoverCanvasRef.current) {
                  const ctx = hoverCanvasRef.current.getContext("2d");
                  if (ctx) {
                    ctx.clearRect(0, 0, width, height);
                  }
                }

                // Keep drawing state active, only flush pending operations
                if (isDrawing && (selectedTool === "pencil" || selectedTool === "eraser")) {
                  rafProcessorRef.current.flush();
                  flushDrawBatch();
                }
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLCanvasElement>) => {
                // Resume drawing if mouse button is still held down
                if (e.buttons === 1 && isDrawing) {
                  const coords = getCanvasCoordinates(e);
                  if (coords) {
                    setCursorPos({ x: coords.x, y: coords.y });
                    // Reset last position to avoid connecting lines
                    lastPosRef.current = null;
                  }
                }
              }}
              className="border border-[#1a1a1a]"
              style={{
                width: `${(width * zoom) / 100}px`,
                height: `${(height * zoom) / 100}px`,
                imageRendering: "pixelated",
                background: `
                  repeating-conic-gradient(#808080 0% 25%, #606060 0% 50%)
                  50% / ${(zoom / 100) * 16}px ${(zoom / 100) * 16}px
                `,
                cursor:
                  isAltPressed || selectedTool === "eyedropper"
                    ? "crosshair"
                    : `url("data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='white' stroke-width='5' stroke-linecap='square'%3E%3Cline x1='16' y1='3' x2='16' y2='11'/%3E%3Cline x1='16' y1='21' x2='16' y2='29'/%3E%3Cline x1='3' y1='16' x2='11' y2='16'/%3E%3Cline x1='21' y1='16' x2='29' y2='16'/%3E%3C/g%3E%3Cg stroke='black' stroke-width='2' stroke-linecap='square'%3E%3Cline x1='16' y1='3' x2='16' y2='11'/%3E%3Cline x1='16' y1='21' x2='16' y2='29'/%3E%3Cline x1='3' y1='16' x2='11' y2='16'/%3E%3Cline x1='21' y1='16' x2='29' y2='16'/%3E%3C/g%3E%3C/svg%3E") 16 16, crosshair`,
              }}
            />
          </div>

          {/* Zoom Controls */}
          <div className="mt-4 bg-[#2b2b2b] border border-[#1a1a1a] px-3 py-2 rounded flex flex-col gap-2 w-64">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9b978e] w-16">
                Zoom: {zoom}%
              </span>
              <input
                type="range"
                min="100"
                max="3200"
                step="100"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-2 bg-[#1d1d1d] rounded-lg appearance-none cursor-pointer"
                style={{
                  accentColor: "#8aa7ff",
                }}
              />
            </div>
          </div>

          {/* Reference Image Controls */}
          {referenceImage && (
            <div className="mt-2 bg-[#2b2b2b] border border-[#1a1a1a] px-3 py-2 rounded flex flex-col gap-2 w-64">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9b978e]">Reference</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowReference(!showReference)}
                    className="px-2 py-0.5 text-[9px] bg-[#1d1d1d] border border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040] transition-all"
                  >
                    {showReference ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={clearReferenceImage}
                    className="px-2 py-0.5 text-[9px] bg-[#1d1d1d] border border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040] transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9b978e] w-16">
                  Opacity: {referenceOpacity}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={referenceOpacity}
                  onChange={(e) => setReferenceOpacity(Number(e.target.value))}
                  className="flex-1 h-2 bg-[#1d1d1d] rounded-lg appearance-none cursor-pointer"
                  style={{
                    accentColor: "#8aa7ff",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tools and Options */}
        <div className="w-64 bg-[#2b2b2b] border-l border-[#1a1a1a] flex flex-col overflow-hidden">
          {/* Tool Options Section */}
          <div className="p-3 border-b border-[#1a1a1a]">
            <div className="text-[10px] text-[#9b978e] uppercase tracking-wider mb-3 font-mono">
              Tool Options
            </div>

            {/* Brush Size - for pencil and eraser */}
            {(selectedTool === "pencil" || selectedTool === "eraser") && (
              <div className="mb-3">
                <div className="text-[9px] text-[#9b978e] mb-1.5">Brush Size</div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((size) => (
                    <button
                      key={size}
                      onClick={() => setBrushSize(size)}
                      className={`flex-1 px-2 py-1.5 text-[10px] border transition-all ${
                        brushSize === size
                          ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d]"
                          : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                      }`}
                    >
                      {size}x{size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filled Toggle - for rectangle and circle */}
            {(selectedTool === "rectangle" || selectedTool === "circle") && (
              <div className="mb-3">
                <div className="text-[9px] text-[#9b978e] mb-1.5">Fill Mode</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShapeFilled(false)}
                    className={`flex-1 px-2 py-1.5 text-[10px] border transition-all ${
                      !shapeFilled
                        ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d]"
                        : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                    }`}
                  >
                    Outline
                  </button>
                  <button
                    onClick={() => setShapeFilled(true)}
                    className={`flex-1 px-2 py-1.5 text-[10px] border transition-all ${
                      shapeFilled
                        ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d]"
                        : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                    }`}
                  >
                    Filled
                  </button>
                </div>
              </div>
            )}

            {/* Symmetry Mode */}
            <div>
              <div className="text-[9px] text-[#9b978e] mb-1.5">Symmetry</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() =>
                    setSymmetryMode((prev) => ({
                      ...prev,
                      horizontal: !prev.horizontal,
                    }))
                  }
                  className={`w-full px-2 py-1.5 text-[10px] border transition-all ${
                    symmetryMode.horizontal
                      ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d]"
                      : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                  }`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() =>
                    setSymmetryMode((prev) => ({
                      ...prev,
                      vertical: !prev.vertical,
                    }))
                  }
                  className={`w-full px-2 py-1.5 text-[10px] border transition-all ${
                    symmetryMode.vertical
                      ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d]"
                      : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                  }`}
                >
                  Vertical
                </button>
              </div>
            </div>
          </div>

          {/* Tools Section */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-[10px] text-[#9b978e] uppercase tracking-wider mb-2 font-mono">
              Tools
            </div>
            <div className="grid grid-cols-3 gap-2">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  className={`aspect-square border flex items-center justify-center transition-all ${
                    selectedTool === tool.id
                      ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] scale-105"
                      : "bg-[#1d1d1d] border-[#1a1a1a] hover:bg-[#404040] text-[#d6d2ca]"
                  }`}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  {tool.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Layers Panel */}
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onLayerSelect={setActiveLayerId}
          onLayerAdd={handleLayerAdd}
          onLayerDelete={handleLayerDelete}
          onLayerDuplicate={handleLayerDuplicate}
          onLayerReorder={handleLayerReorder}
          onLayerToggleVisibility={handleLayerToggleVisibility}
          onLayerOpacityChange={handleLayerOpacityChange}
          onLayerBlendModeChange={handleLayerBlendModeChange}
          onLayerRename={handleLayerRename}
        />
      </div>

      {/* Bottom Status Bar */}
      <div className="h-6 bg-[#a5a4a1] text-[#1d1d1d] flex items-center px-3 text-xs border-t border-[#1a1a1a]">
        <span>
          {width}×{height}px
        </span>
        <div className="mx-3 w-px h-4 bg-[#1a1a1a]" />
        <span>Zoom: {zoom}%</span>
        <div className="mx-3 w-px h-4 bg-[#1a1a1a]" />
        <span>Tool: {selectedTool}</span>
        <div className="mx-3 w-px h-4 bg-[#1a1a1a]" />
        <span>
          {cursorPos ? `X: ${cursorPos.x}, Y: ${cursorPos.y}` : "X: -, Y: -"}
        </span>
        <div className="mx-3 w-px h-4 bg-[#1a1a1a]" />
        <span>Layer: {getActiveLayer()?.name || "None"}</span>
        <div className="mx-3 w-px h-4 bg-[#1a1a1a]" />
        <span>Layers: {layers.length}</span>
        <div className="flex-1" />
        <span className="text-[#5a5349]">
          Project ID: {projectId.slice(0, 8)}...
        </span>
      </div>

      {/* Keyboard Shortcut Cheatsheet Modal */}
      {showCheatsheet && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          onClick={() => setShowCheatsheet(false)}
        >
          <div
            className="bg-[#2b2b2b] border-2 border-[#8aa7ff] rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#d6d2ca]">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowCheatsheet(false)}
                className="text-[#9b978e] hover:text-[#d6d2ca] text-xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Tools */}
              <div>
                <h3 className="text-sm font-bold text-[#8aa7ff] mb-2 uppercase tracking-wider">
                  Tools
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Pencil</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">B</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Eraser</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">E</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Fill/Bucket</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">G</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Eyedropper</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">I</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Line</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">L</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Rectangle</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">R</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Circle</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">C</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Select</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">M</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Eyedropper (temp)</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">Alt</kbd>
                  </div>
                </div>
              </div>

              {/* Editing */}
              <div>
                <h3 className="text-sm font-bold text-[#8aa7ff] mb-2 uppercase tracking-wider">
                  Editing
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Undo</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">Ctrl+Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Redo</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">Ctrl+Shift+Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Redo (alt)</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">Ctrl+Y</kbd>
                  </div>
                </div>
              </div>

              {/* View */}
              <div>
                <h3 className="text-sm font-bold text-[#8aa7ff] mb-2 uppercase tracking-wider">
                  View
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Zoom In/Out</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">Scroll</kbd>
                  </div>
                </div>
              </div>

              {/* Help */}
              <div>
                <h3 className="text-sm font-bold text-[#8aa7ff] mb-2 uppercase tracking-wider">
                  Help
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Toggle Shortcuts</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">?</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#1a1a1a] text-center">
              <p className="text-xs text-[#9b978e]">
                Press <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">?</kbd> or <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">Esc</kbd> to close
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
