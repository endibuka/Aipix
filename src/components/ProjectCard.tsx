import { memo, useState } from "react";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    width: number;
    height: number;
    lastModified: string;
    thumbnail?: string;
  };
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Memoized Project Card with progressive image loading
 * Prevents unnecessary re-renders
 */
export const ProjectCard = memo(({ project, onClick, onContextMenu }: ProjectCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="bg-[#2b2b2b] border border-[#1a1a1a] hover:border-[#8aa7ff]
                 transition-colors cursor-pointer pixel-panel group will-change-transform"
    >
      {/* Thumbnail Area with skeleton loader */}
      <div className="bg-[#4d404f] h-48 flex items-center justify-center border-b border-[#1a1a1a] relative overflow-hidden">
        {project.thumbnail && !imageError ? (
          <>
            {/* Skeleton loader */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-r from-[#4d404f] via-[#5d505f] to-[#4d404f] animate-pulse" />
            )}

            {/* Actual thumbnail */}
            <img
              src={project.thumbnail}
              alt={project.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              style={{ imageRendering: "pixelated" }}
            />
          </>
        ) : (
          <div className="text-center">
            <div
              className="w-20 h-16 mx-auto mb-2 relative"
              style={{ color: "#8aa7ff" }}
            >
              {/* Placeholder Icon - Optimized SVG */}
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
              {project.width}x{project.height}px
            </p>
          </div>
        )}
      </div>

      {/* Project Info */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-[#d6d2ca] mb-1 group-hover:text-[#8aa7ff] transition-colors truncate">
          {project.name}
        </h4>
        <p className="text-xs text-[#9b978e] truncate">
          Modified: {new Date(project.lastModified).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.name === nextProps.project.name &&
    prevProps.project.lastModified === nextProps.project.lastModified &&
    prevProps.project.thumbnail === nextProps.project.thumbnail
  );
});

ProjectCard.displayName = "ProjectCard";
