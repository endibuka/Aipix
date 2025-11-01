// Toolbar component for drawing tools
import React from "react";

export const Toolbar: React.FC = () => {
  return (
    <div className="bg-gray-800 p-4 border-b border-gray-700">
      <div className="flex gap-2">
        <button className="tool-button active" title="Pencil">
          ✏️
        </button>
        <button className="tool-button" title="Eraser">
          🧹
        </button>
        <button className="tool-button" title="Fill">
          🪣
        </button>
        <button className="tool-button" title="Color Picker">
          🎨
        </button>
      </div>
    </div>
  );
};
