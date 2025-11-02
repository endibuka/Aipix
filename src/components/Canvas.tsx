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
  | "select"
  | "colorReplace";

export const Canvas = ({
  projectId,
  projectName,
  width,
  height,
  onBack,
}: CanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
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

  // Color Replace tool options
  const [replaceFromColor, setReplaceFromColor] = useState("#000000");
  const [replaceToColor, setReplaceToColor] = useState("#ffffff");

  // Reference image overlay
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceOpacity, setReferenceOpacity] = useState(30); // 0-100
  const [showReference, setShowReference] = useState(true);

  // Keyboard shortcut cheatsheet
  const [showCheatsheet, setShowCheatsheet] = useState(false);

  // Tool context menu for right-click
  const [toolContextMenu, setToolContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tool: Tool;
  } | null>(null);

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

  // Space key for temporary pan tool
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });

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
  const flushTimerRef = useRef<number | null>(null);
  const lastFlushTimeRef = useRef<number>(0);

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
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
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
    // Handle panning with space key
    if (isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      // Store current scroll position
      if (canvasContainerRef.current) {
        setScrollOffset({
          x: canvasContainerRef.current.scrollLeft,
          y: canvasContainerRef.current.scrollTop,
        });
      }
      return;
    }

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

    if (selectedTool === "colorReplace") {
      // Start drawing mode for color replace brush
      setIsDrawing(true);
      isDrawingRef.current = true;
      await replaceColorAtPixel(x, y);
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
    // Handle panning - only if space is actually pressed
    if (isPanning && panStart && isSpacePressed) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;

      if (canvasContainerRef.current) {
        canvasContainerRef.current.scrollLeft = scrollOffset.x - deltaX;
        canvasContainerRef.current.scrollTop = scrollOffset.y - deltaY;
      }
      return;
    }

    // Safety: reset panning state if space is not pressed
    if (isPanning && !isSpacePressed) {
      setIsPanning(false);
      setPanStart(null);
    }

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

    // Safety check: Verify mouse button is actually pressed
    // e.buttons === 0 means no buttons pressed, === 1 means left button
    if (isDrawing && e.buttons !== 1) {
      console.log("Mouse button released outside canvas, stopping drawing");
      setIsDrawing(false);
      isDrawingRef.current = false;
      if (selectedTool === "pencil" || selectedTool === "eraser" || selectedTool === "colorReplace") {
        await flushDrawBatch();
      }
      return;
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

    if (selectedTool === "colorReplace") {
      await replaceColorAtPixel(x, y);
      return;
    }

    await drawPixel(x, y);
  };

  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle panning end
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      // Save the current scroll position
      if (canvasContainerRef.current) {
        setScrollOffset({
          x: canvasContainerRef.current.scrollLeft,
          y: canvasContainerRef.current.scrollTop,
        });
      }
      return;
    }

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

    // Helper function to draw a single pixel or brush stroke (optimized)
    const drawBrush = (centerX: number, centerY: number) => {
      const offset = Math.floor(brushSize / 2);
      const startX = Math.max(0, centerX - offset);
      const startY = Math.max(0, centerY - offset);
      const endX = Math.min(width - 1, centerX - offset + brushSize - 1);
      const endY = Math.min(height - 1, centerY - offset + brushSize - 1);

      const brushWidth = endX - startX + 1;
      const brushHeight = endY - startY + 1;

      if (brushWidth <= 0 || brushHeight <= 0) return;

      if (selectedTool === "pencil") {
        // Use single fillRect for entire brush area (much faster!)
        ctx.fillStyle = selectedColor;
        ctx.fillRect(startX, startY, brushWidth, brushHeight);
      } else if (selectedTool === "eraser") {
        // Use single clearRect for entire brush area
        ctx.clearRect(startX, startY, brushWidth, brushHeight);
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

  const scheduleFlush = () => {
    // Cancel any pending flush
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }

    // Schedule flush for 100ms from now (debounce)
    flushTimerRef.current = window.setTimeout(async () => {
      await flushDrawBatch();
    }, 100);
  };

  const flushDrawBatch = async () => {
    if (drawBatchRef.current.length === 0) return;

    // Throttle: Don't flush more than once every 50ms
    const now = Date.now();
    if (now - lastFlushTimeRef.current < 50) {
      scheduleFlush();
      return;
    }
    lastFlushTimeRef.current = now;

    const batch = [...drawBatchRef.current];
    drawBatchRef.current = [];

    try {
      // Use Set to deduplicate pixels (key: "x,y")
      const pixelSet = new Set<string>();
      const offset = Math.floor(brushSize / 2);

      for (const { x, y } of batch) {
        // Add brush size pixels
        for (let dy = 0; dy < brushSize; dy++) {
          for (let dx = 0; dx < brushSize; dx++) {
            const px = x - offset + dx;
            const py = y - offset + dy;

            if (px >= 0 && px < width && py >= 0 && py < height) {
              pixelSet.add(`${px},${py}`);

              // Add symmetry pixels
              if (symmetryMode.horizontal) {
                const mirrorX = width - 1 - px;
                if (mirrorX >= 0 && mirrorX < width) {
                  pixelSet.add(`${mirrorX},${py}`);
                }
              }

              if (symmetryMode.vertical) {
                const mirrorY = height - 1 - py;
                if (mirrorY >= 0 && mirrorY < height) {
                  pixelSet.add(`${px},${mirrorY}`);
                }
              }

              if (symmetryMode.horizontal && symmetryMode.vertical) {
                const mirrorX = width - 1 - px;
                const mirrorY = height - 1 - py;
                if (mirrorX >= 0 && mirrorX < width && mirrorY >= 0 && mirrorY < height) {
                  pixelSet.add(`${mirrorX},${mirrorY}`);
                }
              }
            }
          }
        }
      }

      // Convert Set back to array of pixels
      const uniquePixels = Array.from(pixelSet).map(key => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });

      // Batch pixels into chunks - larger chunks for better performance
      const CHUNK_SIZE = 500;
      const chunks = [];
      for (let i = 0; i < uniquePixels.length; i += CHUNK_SIZE) {
        chunks.push(uniquePixels.slice(i, i + CHUNK_SIZE));
      }

      // Process all chunks in parallel (don't wait between chunks)
      const allPromises = [];
      for (const chunk of chunks) {
        for (const { x, y } of chunk) {
          if (selectedTool === "pencil") {
            allPromises.push(invoke("draw_pencil", {
              projectId,
              x,
              y,
              color: selectedColor,
            }));
          } else if (selectedTool === "eraser") {
            allPromises.push(invoke("draw_eraser", {
              projectId,
              x,
              y,
            }));
          } else if (selectedTool === "colorReplace") {
            allPromises.push(invoke("draw_pencil", {
              projectId,
              x,
              y,
              color: replaceToColor,
            }));
          }
        }
      }

      // Wait for all operations to complete in parallel
      await Promise.all(allPromises);
    } catch (error) {
      console.error("Failed to flush draw batch:", error);
      // Re-render from backend if batch fails
      await renderCanvas();
    }
  };

  // Helper to convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };

  // Color replace brush - replaces pixels of specific color with immediate visual feedback
  const replaceColorAtPixel = async (x: number, y: number) => {
    // Check bounds
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    // Get the active layer canvas for immediate drawing
    const layerCanvas = layerCanvasesRef.current.get(activeLayerId);
    if (!layerCanvas) return;

    const ctx = layerCanvas.getContext("2d");
    if (!ctx) return;

    try {
      // Get the color at the current pixel directly from canvas (fast!)
      const imageData = ctx.getImageData(x, y, 1, 1);
      const [r, g, b, a] = imageData.data;

      // Convert to hex for comparison
      const currentColor = rgbToHex(r, g, b);

      // Only replace if the current pixel matches the "from" color and is not transparent
      if (a > 0 && currentColor.toLowerCase() === replaceFromColor.toLowerCase()) {
        // Draw immediately on canvas for instant feedback
        ctx.fillStyle = replaceToColor;
        ctx.fillRect(x, y, 1, 1);

        // Add to batch for backend update (async)
        drawBatchRef.current.push({ x, y });
      }
    } catch (error) {
      console.error("Failed to replace color at pixel:", error);
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
    {
      id: "colorReplace",
      label: "Color Replace",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M12 2a10 10 0 1 0 10 10H12V2Z" />
          <path d="M12 12 2 2" />
          <path d="M12 12l10 10" />
        </svg>
      ),
      shortcut: "H",
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

      // Space key for temporary pan tool (only if not in an input field)
      if (key === " " && !isSpacePressed && e.target === document.body) {
        e.preventDefault();
        setIsSpacePressed(true);
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

      // Save: Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        e.preventDefault();
        console.log("Save triggered");
        invoke("save_canvas", { projectId })
          .then(() => console.log("Canvas saved successfully"))
          .catch((error) => console.error("Failed to save canvas:", error));
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
      const key = e.key.toLowerCase();

      // Space key released - disable pan mode
      if (key === " " && isSpacePressed) {
        setIsSpacePressed(false);
        setIsPanning(false);
        setPanStart(null);
      }

      // Alt key released - restore previous tool
      if (!e.altKey && isAltPressed) {
        setIsAltPressed(false);
        if (previousTool) {
          setSelectedTool(previousTool);
          setPreviousTool(null);
        }
      }
    };

    const handleWindowBlur = () => {
      // Reset space key state when window loses focus
      setIsSpacePressed(false);
      setIsPanning(false);
      setPanStart(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [projectId, isAltPressed, isSpacePressed, selectedTool, previousTool]);

  // Sidebar visibility state
  const [showColorPanel, setShowColorPanel] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(true);

  // Dropdown menu states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  return (
    <div className="h-screen flex flex-col bg-[#3e323b] font-mono text-[#d6d2ca]">
      {/* Top Header Container */}
      <div className="bg-[#c8b79e] text-[#1d1d1d] border-b-2 border-[#1a1a1a] shadow-md">
        {/* Primary Menu Bar */}
        <div className="h-10 flex items-center px-4 text-xs border-b border-[#1a1a1a]">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#b0a68e] transition-colors rounded"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="mx-3 w-px h-5 bg-[#1a1a1a]" />

        {/* View toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowColorPanel(!showColorPanel)}
            className={`px-3 py-1.5 hover:bg-[#b0a68e] transition-colors rounded ${!showColorPanel ? 'bg-[#b0a68e]' : ''}`}
            title="Toggle Color Panel"
          >
            Colors
          </button>
          <button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            className={`px-3 py-1.5 hover:bg-[#b0a68e] transition-colors rounded ${!showLayerPanel ? 'bg-[#b0a68e]' : ''}`}
            title="Toggle Layer Panel"
          >
            Layers
          </button>
        </div>

        <div className="mx-3 w-px h-5 bg-[#1a1a1a]" />

        {/* File Dropdown */}
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === "file" ? null : "file")}
            className="px-3 py-1.5 hover:bg-[#b0a68e] transition-colors rounded flex items-center gap-1"
          >
            File
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {activeDropdown === "file" && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
              <div className="absolute left-0 top-full mt-1 bg-[#2b2b2b] border-2 border-[#1a1a1a] rounded shadow-lg z-50 min-w-[220px] overflow-hidden"
                style={{ boxShadow: "0 4px 8px rgba(0,0,0,0.3)" }}>
                <button
                  onClick={async () => {
                    setActiveDropdown(null);
                    try {
                      await invoke("save_canvas", { projectId });
                      console.log("Canvas saved successfully");
                    } catch (error) {
                      console.error("Failed to save canvas:", error);
                    }
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3 border-b border-[#1a1a1a]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[#d6d2ca] font-medium">Save</span>
                    <span className="text-[9px] text-[#9b978e] uppercase tracking-wider">Ctrl+S</span>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    setActiveDropdown(null);
                    try {
                      const data: number[] = await invoke("get_canvas_data", { projectId });
                      const canvas = document.createElement("canvas");
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext("2d");
                      if (ctx) {
                        const imageData = ctx.createImageData(width, height);
                        const uint8Data = new Uint8ClampedArray(data);
                        imageData.data.set(uint8Data);
                        ctx.putImageData(imageData, 0, 0);

                        canvas.toBlob((blob) => {
                          if (blob) {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${projectName}.png`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }
                        });
                      }
                    } catch (error) {
                      console.error("Failed to export:", error);
                    }
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3 border-b border-[#1a1a1a]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span className="text-[#d6d2ca] font-medium">Export as PNG</span>
                </button>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    onBack();
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  <span className="text-[#d6d2ca] font-medium">Close Project</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Edit Dropdown */}
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === "edit" ? null : "edit")}
            className="px-3 py-1.5 hover:bg-[#b0a68e] transition-colors rounded flex items-center gap-1"
          >
            Edit
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {activeDropdown === "edit" && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
              <div className="absolute left-0 top-full mt-1 bg-[#2b2b2b] border-2 border-[#1a1a1a] rounded shadow-lg z-50 min-w-[220px] overflow-hidden"
                style={{ boxShadow: "0 4px 8px rgba(0,0,0,0.3)" }}>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    handleUndo();
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3 border-b border-[#1a1a1a]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[#d6d2ca] font-medium">Undo</span>
                    <span className="text-[9px] text-[#9b978e] uppercase tracking-wider">Ctrl+Z</span>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveDropdown(null);
                    handleRedo();
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3 border-b border-[#1a1a1a]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[#d6d2ca] font-medium">Redo</span>
                    <span className="text-[9px] text-[#9b978e] uppercase tracking-wider">Ctrl+Y</span>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    setActiveDropdown(null);
                    try {
                      await invoke("clear_canvas", { projectId });
                      await renderCanvas();
                    } catch (error) {
                      console.error("Failed to clear canvas:", error);
                    }
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  </svg>
                  <span className="text-[#d6d2ca] font-medium">Clear Canvas</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Reference Dropdown */}
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === "reference" ? null : "reference")}
            className="px-3 py-1.5 hover:bg-[#b0a68e] transition-colors rounded flex items-center gap-1"
          >
            Reference
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {activeDropdown === "reference" && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
              <div className="absolute left-0 top-full mt-1 bg-[#2b2b2b] border-2 border-[#1a1a1a] rounded shadow-lg z-50 min-w-[220px] overflow-hidden"
                style={{ boxShadow: "0 4px 8px rgba(0,0,0,0.3)" }}>
                <label className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3 cursor-pointer border-b border-[#1a1a1a]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span className="text-[#d6d2ca] font-medium">Load Reference Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleReferenceUpload(e);
                      setActiveDropdown(null);
                    }}
                    className="hidden"
                  />
                </label>
                {referenceImage && (
                  <>
                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        setShowReference(!showReference);
                      }}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3 border-b border-[#1a1a1a]"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                        {showReference ? (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        ) : (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        )}
                      </svg>
                      <span className="text-[#d6d2ca] font-medium">{showReference ? "Hide Reference" : "Show Reference"}</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveDropdown(null);
                        clearReferenceImage();
                      }}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-[#505050] transition-all flex items-center gap-3"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#d6d2ca]">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                      <span className="text-[#d6d2ca] font-medium">Clear Reference</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            className="p-2 hover:bg-[#b0a68e] transition-colors rounded"
            title="Undo (Ctrl+Z)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
            </svg>
          </button>
          <button
            onClick={handleRedo}
            className="p-2 hover:bg-[#b0a68e] transition-colors rounded"
            title="Redo (Ctrl+Y)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
            </svg>
          </button>
        </div>

        <div className="mx-3 w-px h-5 bg-[#1a1a1a]" />
        <button
          onClick={() => setShowCheatsheet(!showCheatsheet)}
          className="p-2 hover:bg-[#b0a68e] transition-colors rounded"
          title="Keyboard Shortcuts (?)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
        <div className="mx-3 w-px h-5 bg-[#1a1a1a]" />
        <span className="px-3 text-[#5a5349] font-semibold">{projectName}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar - Color Palette (Collapsible) */}
          <div className={`bg-[#2b2b2b] border-r border-[#1a1a1a] flex flex-col overflow-hidden transition-all duration-300 ease-in-out shadow-lg ${showColorPanel ? 'w-72' : 'w-0'}`}>
          {showColorPanel && (
            <>
              {/* Palette Section */}
              <div className="p-4 border-b border-[#1a1a1a]">
                <div className="text-xs text-[#9b978e] uppercase tracking-wider mb-3 font-mono font-bold">
                  Palette
                </div>
                <div className="bg-[#1d1d1d] border border-[#1a1a1a] p-2 rounded-lg">
                  <div className="grid grid-cols-6 gap-1">
                    {colorPalette.map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedColor(color)}
                        className={`w-9 h-9 border-2 transition-all rounded ${
                          selectedColor === color
                            ? "border-[#8aa7ff] ring-2 ring-[#8aa7ff] ring-offset-2 ring-offset-[#1d1d1d] scale-110 shadow-lg"
                            : "border-[#1a1a1a] hover:border-[#505050] hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Color Picker Section */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-xs text-[#9b978e] uppercase tracking-wider mb-3 font-mono font-bold">
                  Color Picker
                </div>
                <ColorPicker
                  color={selectedColor}
                  onChange={setSelectedColor}
                  onAddToPalette={handleAddToPalette}
                />
              </div>
            </>
          )}
        </div>

          {/* Center Canvas Area - Maximized space */}
        <div
          className="flex-1 flex flex-col bg-[#4d404f] overflow-auto relative"
          onWheel={handleWheel}
        >
          {/* Secondary Toolbar - Horizontal bar at top of canvas */}
          <div className="h-16 bg-[#b0a68e] border-b border-[#1a1a1a] flex items-center px-4 gap-4 shadow-lg">
            {/* Brush/Tool Size */}
            <div className="flex items-center gap-2">
              <span className="text-[#1d1d1d] text-xs uppercase tracking-wider font-semibold">Size</span>
              <input
                type="number"
                min="1"
                value={brushSize}
                onChange={(e) => setBrushSize(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 h-10 px-3 text-sm border bg-[#c8b79e] border-[#8a7d6e] text-[#1d1d1d] focus:border-[#5a5349] focus:outline-none focus:ring-1 focus:ring-[#5a5349] transition-all"
                title="Brush Size"
              />
            </div>

            <div className="h-10 w-px bg-[#8a7d6e]" />

            {/* Canvas Info */}
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#1d1d1d]">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              </svg>
              <div className="text-[#1d1d1d] text-sm font-mono font-semibold">
                {width}×{height}
              </div>
            </div>

            <div className="h-10 w-px bg-[#8a7d6e]" />

            {/* Zoom */}
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-[#1d1d1d]">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <div className="text-[#1d1d1d] text-sm font-mono font-semibold">
                {zoom}%
              </div>
            </div>

            {/* Shape Fill */}
            {(selectedTool === "rectangle" || selectedTool === "circle") && (
              <>
                <div className="h-10 w-px bg-[#8a7d6e]" />
                <div className="flex items-center gap-2">
                  <span className="text-[#1d1d1d] text-xs uppercase tracking-wider font-semibold">Fill</span>
                  <button
                    onClick={() => setShapeFilled(!shapeFilled)}
                    className={`w-10 h-10 text-lg border transition-all ${
                      shapeFilled
                        ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] font-bold"
                        : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                    }`}
                  >
                    {shapeFilled ? "■" : "□"}
                  </button>
                </div>
              </>
            )}

            {/* Symmetry */}
            {(selectedTool === "pencil" || selectedTool === "eraser") && (
              <>
                <div className="h-10 w-px bg-[#8a7d6e]" />
                <div className="flex items-center gap-2">
                  <span className="text-[#1d1d1d] text-xs uppercase tracking-wider font-semibold">Symmetry</span>
                  <button
                    onClick={() =>
                      setSymmetryMode((prev) => ({
                        ...prev,
                        horizontal: !prev.horizontal,
                      }))
                    }
                    className={`w-10 h-10 text-lg border transition-all ${
                      symmetryMode.horizontal
                        ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] font-bold"
                        : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                    }`}
                    title="Horizontal Symmetry"
                  >
                    ↔
                  </button>
                  <button
                    onClick={() =>
                      setSymmetryMode((prev) => ({
                        ...prev,
                        vertical: !prev.vertical,
                      }))
                    }
                    className={`w-10 h-10 text-lg border transition-all ${
                      symmetryMode.vertical
                        ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] font-bold"
                        : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                    }`}
                    title="Vertical Symmetry"
                  >
                    ↕
                  </button>
                </div>
              </>
            )}

            {/* Color Replace Options */}
            {selectedTool === "colorReplace" && (
              <>
                <div className="h-10 w-px bg-[#8a7d6e]" />
                <div className="flex items-center gap-2">
                  <span className="text-[#1d1d1d] text-xs uppercase tracking-wider font-semibold">From</span>
                  <input
                    type="color"
                    value={replaceFromColor}
                    onChange={(e) => setReplaceFromColor(e.target.value)}
                    className="w-12 h-10 border border-[#8a7d6e] cursor-pointer"
                    title="Color to replace"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#1d1d1d] text-xs uppercase tracking-wider font-semibold">To</span>
                  <input
                    type="color"
                    value={replaceToColor}
                    onChange={(e) => setReplaceToColor(e.target.value)}
                    className="w-12 h-10 border border-[#8a7d6e] cursor-pointer"
                    title="Replacement color"
                  />
                </div>
              </>
            )}

            {/* Tool Display */}
            <div className="ml-auto flex items-center gap-2 bg-[#1d1d1d] border border-[#1a1a1a] px-3 py-2">
              {tools.find(t => t.id === selectedTool)?.icon}
              <span className="text-[#d6d2ca] text-sm font-mono capitalize">
                {selectedTool === "colorReplace" ? "Color Replace" : selectedTool}
              </span>
            </div>
          </div>

          {/* Canvas Content Area */}
          <div
            ref={canvasContainerRef}
            className="flex-1 flex items-center justify-center p-8 overflow-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
          {/* Floating Tool Palette - Left side of canvas */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10">
            <div className="bg-[#2b2b2b] border border-[#1a1a1a] rounded-lg shadow-2xl overflow-hidden">
              {/* Tool buttons */}
              <div className="p-2 space-y-1">
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Only show context menu for pencil tool
                      if (tool.id === "pencil") {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setToolContextMenu({
                          visible: true,
                          x: rect.right + 10,
                          y: rect.top,
                          tool: tool.id,
                        });
                      }
                    }}
                    className={`w-12 h-12 border flex items-center justify-center transition-all rounded ${
                      selectedTool === tool.id
                        ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] shadow-lg scale-110"
                        : "bg-[#1d1d1d] border-[#1a1a1a] hover:bg-[#404040] hover:scale-105 text-[#d6d2ca]"
                    }`}
                    title={`${tool.label} (${tool.shortcut})`}
                  >
                    {tool.icon}
                  </button>
                ))}
              </div>

              {/* Tool Options - Context aware */}
              <div className="border-t border-[#1a1a1a] p-3 bg-[#1d1d1d]">
                <div className="text-[9px] text-[#9b978e] uppercase tracking-wider mb-2">
                  Options
                </div>

                {/* Filled Toggle - for rectangle and circle */}
                {(selectedTool === "rectangle" || selectedTool === "circle") && (
                  <div className="mb-3">
                    <div className="text-[8px] text-[#9b978e] mb-1.5">Fill</div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => setShapeFilled(false)}
                        className={`px-2 py-1.5 text-[9px] border transition-all rounded ${
                          !shapeFilled
                            ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] font-bold"
                            : "bg-[#2b2b2b] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                        }`}
                      >
                        Outline
                      </button>
                      <button
                        onClick={() => setShapeFilled(true)}
                        className={`px-2 py-1.5 text-[9px] border transition-all rounded ${
                          shapeFilled
                            ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] font-bold"
                            : "bg-[#2b2b2b] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                        }`}
                      >
                        Filled
                      </button>
                    </div>
                  </div>
                )}

                {/* Symmetry Mode */}
                {(selectedTool === "pencil" || selectedTool === "eraser") && (
                  <div>
                    <div className="text-[8px] text-[#9b978e] mb-1.5">Symmetry</div>
                    <div className="space-y-1">
                      <button
                        onClick={() =>
                          setSymmetryMode((prev) => ({
                            ...prev,
                            horizontal: !prev.horizontal,
                          }))
                        }
                        className={`w-full px-2 py-1.5 text-[9px] border transition-all rounded ${
                          symmetryMode.horizontal
                            ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] font-bold"
                            : "bg-[#2b2b2b] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                        }`}
                      >
                        ↔ H
                      </button>
                      <button
                        onClick={() =>
                          setSymmetryMode((prev) => ({
                            ...prev,
                            vertical: !prev.vertical,
                          }))
                        }
                        className={`w-full px-2 py-1.5 text-[9px] border transition-all rounded ${
                          symmetryMode.vertical
                            ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] font-bold"
                            : "bg-[#2b2b2b] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                        }`}
                      >
                        ↕ V
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Current color indicator */}
              <div className="border-t border-[#1a1a1a] p-2">
                <div
                  className="w-full h-8 border-2 border-[#1a1a1a] rounded"
                  style={{ backgroundColor: selectedColor }}
                  title={selectedColor}
                />
              </div>
            </div>
          </div>
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
                  isSpacePressed
                    ? isPanning
                      ? "grabbing"
                      : "grab"
                    : selectedTool === "colorReplace"
                    ? "cell"
                    : isAltPressed || selectedTool === "eyedropper"
                    ? "crosshair"
                    : `url("data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='white' stroke-width='5' stroke-linecap='square'%3E%3Cline x1='16' y1='3' x2='16' y2='11'/%3E%3Cline x1='16' y1='21' x2='16' y2='29'/%3E%3Cline x1='3' y1='16' x2='11' y2='16'/%3E%3Cline x1='21' y1='16' x2='29' y2='16'/%3E%3C/g%3E%3Cg stroke='black' stroke-width='2' stroke-linecap='square'%3E%3Cline x1='16' y1='3' x2='16' y2='11'/%3E%3Cline x1='16' y1='21' x2='16' y2='29'/%3E%3Cline x1='3' y1='16' x2='11' y2='16'/%3E%3Cline x1='21' y1='16' x2='29' y2='16'/%3E%3C/g%3E%3C/svg%3E") 16 16, crosshair`,
              }}
            />
          </div>

          {/* Floating Canvas Controls - Bottom center */}
          {referenceImage && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-3">
            {/* Reference Image Controls */}
              <div className="bg-[#2b2b2b] border border-[#1a1a1a] px-4 py-2 rounded-lg shadow-2xl flex items-center gap-3">
                <span className="text-xs text-[#9b978e]">Reference</span>
                <button
                  onClick={() => setShowReference(!showReference)}
                  className={`px-3 py-1 text-[9px] border transition-all rounded ${
                    showReference
                      ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d] font-bold"
                      : "bg-[#1d1d1d] border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040]"
                  }`}
                >
                  {showReference ? "Visible" : "Hidden"}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={referenceOpacity}
                  onChange={(e) => setReferenceOpacity(Number(e.target.value))}
                  className="w-24 h-2 bg-[#1d1d1d] rounded-lg appearance-none cursor-pointer"
                  style={{
                    accentColor: "#8aa7ff",
                  }}
                />
                <span className="text-xs text-[#9b978e] w-8 text-right">{referenceOpacity}%</span>
                <button
                  onClick={clearReferenceImage}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[#ff4444] hover:border-[#ff4444] transition-all rounded"
                  title="Clear Reference"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Layers Panel (Collapsible) */}
        <div className={`bg-[#2b2b2b] border-l border-[#1a1a1a] flex flex-col overflow-hidden transition-all duration-300 ease-in-out shadow-lg ${showLayerPanel ? 'w-80' : 'w-0'}`}>
          {showLayerPanel && (
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
          )}
        </div>
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
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Pan (temp)</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">Space</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Color Replace</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">H</kbd>
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
                  <div className="flex justify-between">
                    <span className="text-[#9b978e]">Pan Canvas</span>
                    <kbd className="bg-[#1d1d1d] px-2 py-0.5 rounded border border-[#1a1a1a]">Space+Drag</kbd>
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

      {/* Tool Context Menu */}
      {toolContextMenu?.visible && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setToolContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-[#2b2b2b] border border-[#1a1a1a] rounded-lg shadow-2xl overflow-hidden min-w-[180px]"
            style={{
              left: `${toolContextMenu.x}px`,
              top: `${toolContextMenu.y}px`,
            }}
          >
            <button
              onClick={() => {
                setSelectedTool("colorReplace");
                setToolContextMenu(null);
              }}
              className="w-full px-4 py-3 text-left text-sm hover:bg-[#404040] transition-all flex items-center gap-3 text-[#d6d2ca]"
            >
              {tools.find(t => t.id === "colorReplace")?.icon}
              <span>Color Replace</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
