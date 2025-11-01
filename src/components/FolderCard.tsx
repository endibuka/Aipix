import { memo } from "react";

interface FolderCardProps {
  folder: {
    id: string;
    name: string;
    projectCount: number;
    lastModified: string;
    color?: string;
  };
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Memoized Folder Card - Prevents unnecessary re-renders
 */
export const FolderCard = memo(({ folder, onContextMenu }: FolderCardProps) => {
  return (
    <div
      onContextMenu={onContextMenu}
      className="bg-[#2b2b2b] border border-[#1a1a1a] hover:border-[#8aa7ff]
                 transition-colors cursor-pointer pixel-panel group will-change-transform"
    >
      {/* Folder Icon Area */}
      <div className="bg-[#4d404f] h-48 flex items-center justify-center border-b border-[#1a1a1a]">
        <div className="text-center">
          <div
            className="w-20 h-16 mx-auto mb-2 relative"
            style={{ color: folder.color || "#8aa7ff" }}
          >
            {/* Optimized Folder Icon */}
            <svg
              viewBox="0 0 80 64"
              fill="currentColor"
              className="w-full h-full"
            >
              <rect x="0" y="8" width="32" height="8" />
              <rect x="0" y="16" width="80" height="48" />
              <rect
                x="4"
                y="20"
                width="72"
                height="40"
                fill="#2b2b2b"
                opacity="0.3"
              />
            </svg>
          </div>
          <p className="text-xs text-[#9b978e]">
            {folder.projectCount} project
            {folder.projectCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Folder Info */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-[#d6d2ca] mb-1 group-hover:text-[#8aa7ff] transition-colors truncate">
          📁 {folder.name}
        </h4>
        <p className="text-xs text-[#9b978e] truncate">
          Modified: {new Date(folder.lastModified).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.folder.id === nextProps.folder.id &&
    prevProps.folder.name === nextProps.folder.name &&
    prevProps.folder.projectCount === nextProps.folder.projectCount &&
    prevProps.folder.lastModified === nextProps.folder.lastModified &&
    prevProps.folder.color === nextProps.folder.color
  );
});

FolderCard.displayName = "FolderCard";
