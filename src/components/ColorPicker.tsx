import { useState, useRef, useEffect } from "react";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  onAddToPalette?: (color: string) => void;
}

export const ColorPicker = ({ color, onChange, onAddToPalette }: ColorPickerProps) => {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [value, setValue] = useState(100);
  const [rgb, setRgb] = useState({ r: 0, g: 0, b: 0 });

  const svPickerRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);

  // Convert hex to HSV
  useEffect(() => {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Calculate HSV
    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / delta + 2) / 6;
      } else {
        h = ((r - g) / delta + 4) / 6;
      }
    }

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    setHue(h * 360);
    setSaturation(s * 100);
    setValue(v * 100);
    setRgb({
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    });
  }, [color]);

  // Convert HSV to hex
  const hsvToHex = (h: number, s: number, v: number): string => {
    h = h / 360;
    s = s / 100;
    v = v / 100;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r = 0,
      g = 0,
      b = 0;

    switch (i % 6) {
      case 0:
        (r = v), (g = t), (b = p);
        break;
      case 1:
        (r = q), (g = v), (b = p);
        break;
      case 2:
        (r = p), (g = v), (b = t);
        break;
      case 3:
        (r = p), (g = q), (b = v);
        break;
      case 4:
        (r = t), (g = p), (b = v);
        break;
      case 5:
        (r = v), (g = p), (b = q);
        break;
    }

    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    const toHex = (n: number) =>
      Math.min(255, Math.max(0, n))
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Handle SV picker interaction
  const handleSVPick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!svPickerRef.current) return;
    const rect = svPickerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const newSaturation = (x / rect.width) * 100;
    const newValue = ((rect.height - y) / rect.height) * 100;

    setSaturation(newSaturation);
    setValue(newValue);

    const newColor = hsvToHex(hue, newSaturation, newValue);
    onChange(newColor);
  };

  const handleSVMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleSVPick(e);

    const handleMouseMove = (e: MouseEvent) => {
      if (!svPickerRef.current) return;
      const rect = svPickerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

      const newSaturation = (x / rect.width) * 100;
      const newValue = ((rect.height - y) / rect.height) * 100;

      setSaturation(newSaturation);
      setValue(newValue);

      const newColor = hsvToHex(hue, newSaturation, newValue);
      onChange(newColor);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle hue slider interaction
  const handleHueChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const newHue = (y / rect.height) * 360;

    setHue(newHue);
    const newColor = hsvToHex(newHue, saturation, value);
    onChange(newColor);
  };

  const handleHueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleHueChange(e);

    const handleMouseMove = (e: MouseEvent) => {
      if (!hueSliderRef.current) return;
      const rect = hueSliderRef.current.getBoundingClientRect();
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
      const newHue = (y / rect.height) * 360;

      setHue(newHue);
      const newColor = hsvToHex(newHue, saturation, value);
      onChange(newColor);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Handle RGB slider changes
  const handleRGBChange = (component: "r" | "g" | "b", value: number) => {
    const newRgb = { ...rgb, [component]: value };
    setRgb(newRgb);
    const newColor = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    onChange(newColor);
  };

  // Get current hue color
  const hueColor = hsvToHex(hue, 100, 100);

  return (
    <div className="flex flex-col gap-3">
      {/* Color Preview */}
      <div className="bg-[#1d1d1d] border border-[#1a1a1a] p-2">
        <div
          className="w-full h-12 border border-[#505050]"
          style={{
            backgroundColor: color,
            background: `
              ${color},
              repeating-conic-gradient(#808080 0% 25%, #606060 0% 50%) 50% / 8px 8px
            `,
          }}
        />
      </div>

      {/* Main SV Picker + Hue Slider */}
      <div className="flex gap-2">
        {/* Saturation-Value Picker */}
        <div
          ref={svPickerRef}
          onMouseDown={handleSVMouseDown}
          className="relative w-[160px] h-[160px] border border-[#1a1a1a] cursor-crosshair"
          style={{
            background: `
              linear-gradient(to top, #000, transparent),
              linear-gradient(to right, #fff, ${hueColor})
            `,
          }}
        >
          {/* Picker cursor */}
          <div
            className="absolute w-2.5 h-2.5 border-2 border-white rounded-full pointer-events-none"
            style={{
              left: `${saturation}%`,
              top: `${100 - value}%`,
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 0 1px #000, 0 0 3px rgba(0,0,0,0.5)",
            }}
          />
        </div>

        {/* Hue Slider */}
        <div
          ref={hueSliderRef}
          onMouseDown={handleHueMouseDown}
          className="relative w-[24px] h-[160px] border border-[#1a1a1a] cursor-pointer"
          style={{
            background: `
              linear-gradient(to bottom,
                #ff0000 0%,
                #ffff00 16.66%,
                #00ff00 33.33%,
                #00ffff 50%,
                #0000ff 66.66%,
                #ff00ff 83.33%,
                #ff0000 100%
              )
            `,
          }}
        >
          {/* Hue cursor */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-white pointer-events-none border-t border-b border-black"
            style={{
              top: `${(hue / 360) * 100}%`,
              transform: "translateY(-50%)",
            }}
          />
        </div>
      </div>

      {/* RGB Sliders */}
      <div className="space-y-2 bg-[#1d1d1d] border border-[#1a1a1a] p-2">
        {/* Red Slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#d6d2ca] w-4 font-mono">R</span>
          <div className="flex-1 relative h-3 border border-[#1a1a1a]">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right,
                  rgb(0, ${rgb.g}, ${rgb.b}),
                  rgb(255, ${rgb.g}, ${rgb.b})
                )`,
              }}
            />
            <input
              type="range"
              min="0"
              max="255"
              value={rgb.r}
              onChange={(e) => handleRGBChange("r", parseInt(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <input
            type="number"
            min="0"
            max="255"
            value={rgb.r}
            onChange={(e) => handleRGBChange("r", parseInt(e.target.value) || 0)}
            className="w-12 bg-[#2b2b2b] border border-[#1a1a1a] px-1 py-0.5 text-[#d6d2ca] text-[10px] text-center font-mono focus:outline-none focus:border-[#8aa7ff]"
          />
        </div>

        {/* Green Slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#d6d2ca] w-4 font-mono">G</span>
          <div className="flex-1 relative h-3 border border-[#1a1a1a]">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right,
                  rgb(${rgb.r}, 0, ${rgb.b}),
                  rgb(${rgb.r}, 255, ${rgb.b})
                )`,
              }}
            />
            <input
              type="range"
              min="0"
              max="255"
              value={rgb.g}
              onChange={(e) => handleRGBChange("g", parseInt(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <input
            type="number"
            min="0"
            max="255"
            value={rgb.g}
            onChange={(e) => handleRGBChange("g", parseInt(e.target.value) || 0)}
            className="w-12 bg-[#2b2b2b] border border-[#1a1a1a] px-1 py-0.5 text-[#d6d2ca] text-[10px] text-center font-mono focus:outline-none focus:border-[#8aa7ff]"
          />
        </div>

        {/* Blue Slider */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#d6d2ca] w-4 font-mono">B</span>
          <div className="flex-1 relative h-3 border border-[#1a1a1a]">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right,
                  rgb(${rgb.r}, ${rgb.g}, 0),
                  rgb(${rgb.r}, ${rgb.g}, 255)
                )`,
              }}
            />
            <input
              type="range"
              min="0"
              max="255"
              value={rgb.b}
              onChange={(e) => handleRGBChange("b", parseInt(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <input
            type="number"
            min="0"
            max="255"
            value={rgb.b}
            onChange={(e) => handleRGBChange("b", parseInt(e.target.value) || 0)}
            className="w-12 bg-[#2b2b2b] border border-[#1a1a1a] px-1 py-0.5 text-[#d6d2ca] text-[10px] text-center font-mono focus:outline-none focus:border-[#8aa7ff]"
          />
        </div>
      </div>

      {/* HEX Input */}
      <div className="bg-[#1d1d1d] border border-[#1a1a1a] p-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9b978e] font-mono">#</span>
          <input
            type="text"
            value={color.replace("#", "").toUpperCase()}
            onChange={(e) => {
              const hex = e.target.value.replace(/[^0-9A-Fa-f]/g, "");
              if (hex.length === 6) {
                onChange(`#${hex}`);
              }
            }}
            maxLength={6}
            className="flex-1 bg-[#2b2b2b] border border-[#1a1a1a] px-2 py-1 text-[#d6d2ca] text-xs font-mono focus:outline-none focus:border-[#8aa7ff]"
          />
        </div>
      </div>

      {/* Add to Palette Button */}
      {onAddToPalette && (
        <button
          onClick={() => onAddToPalette(color)}
          className="w-full bg-[#1d1d1d] border border-[#1a1a1a] hover:border-[#8aa7ff] hover:bg-[#2b2b2b] px-3 py-2 text-[#d6d2ca] text-xs font-mono transition-colors"
        >
          Add to Palette
        </button>
      )}
    </div>
  );
};
