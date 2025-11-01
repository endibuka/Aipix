import { useState } from "react";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  thumbnail?: string;
}

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onLayerSelect: (layerId: string) => void;
  onLayerAdd: () => void;
  onLayerDelete: (layerId: string) => void;
  onLayerDuplicate: (layerId: string) => void;
  onLayerReorder: (fromIndex: number, toIndex: number) => void;
  onLayerToggleVisibility: (layerId: string) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onLayerBlendModeChange: (layerId: string, blendMode: BlendMode) => void;
  onLayerRename: (layerId: string, name: string) => void;
}

export const LayerPanel = ({
  layers,
  activeLayerId,
  onLayerSelect,
  onLayerAdd,
  onLayerDelete,
  onLayerDuplicate,
  onLayerReorder,
  onLayerToggleVisibility,
  onLayerOpacityChange,
  onLayerBlendModeChange,
  onLayerRename,
}: LayerPanelProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      onLayerReorder(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleRenameStart = (layer: Layer) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  const handleRenameSubmit = (layerId: string) => {
    if (editingName.trim()) {
      onLayerRename(layerId, editingName.trim());
    }
    setEditingLayerId(null);
    setEditingName("");
  };

  const blendModes: BlendMode[] = ["normal", "multiply", "screen", "overlay", "darken", "lighten"];

  return (
    <div className="w-64 bg-[#2b2b2b] border-l border-[#1a1a1a] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-[#1a1a1a]">
        <div className="text-[10px] text-[#9b978e] uppercase tracking-wider mb-2 font-mono">
          Layers
        </div>
        <div className="flex gap-1">
          <button
            onClick={onLayerAdd}
            className="flex-1 px-2 py-1.5 text-[10px] bg-[#1d1d1d] border border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040] transition-all"
            title="Add Layer"
          >
            + Add
          </button>
          <button
            onClick={() => {
              const activeLayer = layers.find((l) => l.id === activeLayerId);
              if (activeLayer) onLayerDuplicate(activeLayer.id);
            }}
            className="flex-1 px-2 py-1.5 text-[10px] bg-[#1d1d1d] border border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#404040] transition-all"
            title="Duplicate Layer"
            disabled={!activeLayerId}
          >
            Duplicate
          </button>
          <button
            onClick={() => {
              if (activeLayerId && layers.length > 1) {
                onLayerDelete(activeLayerId);
              }
            }}
            className="px-2 py-1.5 text-[10px] bg-[#1d1d1d] border border-[#1a1a1a] text-[#d6d2ca] hover:bg-[#ff4444] hover:border-[#ff4444] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete Layer"
            disabled={!activeLayerId || layers.length <= 1}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.map((layer, index) => {
          const isActive = layer.id === activeLayerId;
          const isEditing = layer.id === editingLayerId;

          return (
            <div
              key={layer.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => onLayerSelect(layer.id)}
              className={`border rounded p-2 cursor-pointer transition-all ${
                isActive
                  ? "bg-[#8aa7ff] border-[#8aa7ff] text-[#1d1d1d]"
                  : "bg-[#1d1d1d] border-[#1a1a1a] hover:bg-[#2b2b2b] text-[#d6d2ca]"
              } ${draggedIndex === index ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2">
                {/* Visibility Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerToggleVisibility(layer.id);
                  }}
                  className={`w-4 h-4 flex items-center justify-center text-xs ${
                    isActive ? "text-[#1d1d1d]" : "text-[#9b978e]"
                  } hover:text-[#d6d2ca]`}
                  title={layer.visible ? "Hide Layer" : "Show Layer"}
                >
                  {layer.visible ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>

                {/* Thumbnail */}
                {layer.thumbnail && (
                  <div
                    className="w-8 h-8 border border-[#505050] flex-shrink-0"
                    style={{
                      backgroundImage: `url(${layer.thumbnail})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                      imageRendering: "pixelated",
                    }}
                  />
                )}

                {/* Layer Name */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRenameSubmit(layer.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit(layer.id);
                        if (e.key === "Escape") {
                          setEditingLayerId(null);
                          setEditingName("");
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-[#2b2b2b] border border-[#8aa7ff] px-1 py-0.5 text-[10px] font-mono focus:outline-none text-[#d6d2ca]"
                      autoFocus
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleRenameStart(layer);
                      }}
                      className="text-[10px] font-mono truncate"
                      title={`Double-click to rename: ${layer.name}`}
                    >
                      {layer.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Layer Controls (shown when active) */}
              {isActive && !isEditing && (
                <div className="mt-2 pt-2 border-t border-[#1a1a1a] space-y-2">
                  {/* Opacity Slider */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#1d1d1d] w-12">
                      Opacity
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={layer.opacity}
                      onChange={(e) => {
                        e.stopPropagation();
                        onLayerOpacityChange(layer.id, Number(e.target.value));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-1 bg-[#2b2b2b] rounded-lg appearance-none cursor-pointer"
                      style={{
                        accentColor: "#1d1d1d",
                      }}
                    />
                    <span className="text-[9px] text-[#1d1d1d] w-8 text-right">
                      {layer.opacity}%
                    </span>
                  </div>

                  {/* Blend Mode */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#1d1d1d] w-12">Blend</span>
                    <select
                      value={layer.blendMode}
                      onChange={(e) => {
                        e.stopPropagation();
                        onLayerBlendModeChange(layer.id, e.target.value as BlendMode);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-[#2b2b2b] border border-[#1a1a1a] px-1 py-0.5 text-[9px] font-mono focus:outline-none focus:border-[#8aa7ff] text-[#d6d2ca]"
                    >
                      {blendModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
