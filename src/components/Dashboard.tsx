import { useState, useRef, useEffect, useMemo, useCallback, memo, Suspense, lazy } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectCard } from "./ProjectCard";
import { FolderCard } from "./FolderCard";

interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  lastModified: string;
  thumbnail?: string;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
  projectCount: number;
  lastModified: string;
  color?: string;
}

interface ContextMenu {
  itemId: string;
  itemType: "project" | "folder";
  x: number;
  y: number;
}

interface DashboardProps {
  onOpenSettings: () => void;
  onOpenProject: (project: { id: string; name: string; width: number; height: number }) => void;
}

// Skeleton loading component
const SkeletonCard = memo(() => (
  <div className="bg-[#2b2b2b] border border-[#1a1a1a] pixel-panel animate-pulse">
    <div className="bg-[#4d404f] h-48 border-b border-[#1a1a1a]" />
    <div className="p-4 space-y-2">
      <div className="h-4 bg-[#4d404f] rounded w-3/4" />
      <div className="h-3 bg-[#4d404f] rounded w-1/2" />
    </div>
  </div>
));
SkeletonCard.displayName = "SkeletonCard";

export const Dashboard = memo(({ onOpenSettings, onOpenProject }: DashboardProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSize, setFilterSize] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const userId = useMemo(() => localStorage.getItem("userId") || "", []);
  const userEmail = useMemo(() => localStorage.getItem("userEmail") || "user@example.com", []);
  const username = useMemo(() => localStorage.getItem("username") || userEmail.split("@")[0], [userEmail]);

  // Form state for new project
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectWidth, setNewProjectWidth] = useState(32);
  const [newProjectHeight, setNewProjectHeight] = useState(32);
  const [newProjectColorMode, setNewProjectColorMode] = useState("rgba");
  const [newProjectBackgroundColor, setNewProjectBackgroundColor] = useState("#00000000");
  const [newProjectPixelAspectRatio, setNewProjectPixelAspectRatio] = useState("1:1");

  // Form state for new folder
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#8aa7ff");

  // Loading states
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Debounced search with useMemo
  const debouncedSearch = useMemo(() => searchQuery.toLowerCase().trim(), [searchQuery]);

  // Load projects and folders from database
  const loadData = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      // Load in parallel for better performance
      const [projectsData, foldersData] = await Promise.all([
        invoke("get_user_projects", { userId }) as Promise<any[]>,
        invoke("get_user_folders", { userId }) as Promise<any[]>,
      ]);

      // Batch state updates
      requestAnimationFrame(() => {
        setProjects(
          projectsData.map((p) => ({
            id: p.id,
            name: p.name,
            width: p.width,
            height: p.height,
            lastModified: p.last_modified,
            thumbnail: p.thumbnail,
            folderId: p.folder_id,
          }))
        );

        setFolders(
          foldersData.map((f) => ({
            id: f.id,
            name: f.name,
            color: f.color,
            lastModified: f.updated_at,
            projectCount: 0, // Calculate this
          }))
        );

        setIsLoading(false);
      });
    } catch (error) {
      console.error("Failed to load data:", error);
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Memoized filtered data
  const filteredData = useMemo(() => {
    const filteredFolders = folders.filter((folder) =>
      folder.name.toLowerCase().includes(debouncedSearch)
    );

    const filteredProjects = projects.filter((project) => {
      const matchesSearch = project.name.toLowerCase().includes(debouncedSearch);

      let matchesSize = true;
      if (filterSize !== "all") {
        const size = project.width * project.height;
        switch (filterSize) {
          case "small":
            matchesSize = size <= 1024;
            break;
          case "medium":
            matchesSize = size > 1024 && size <= 16384;
            break;
          case "large":
            matchesSize = size > 16384;
            break;
        }
      }

      return matchesSearch && matchesSize;
    });

    return { filteredFolders, filteredProjects };
  }, [folders, projects, debouncedSearch, filterSize]);

  // Optimistic UI project creation
  const handleCreateProject = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!newProjectName.trim()) {
        alert("Please enter a project name");
        return;
      }

      if (newProjectWidth < 1 || newProjectHeight < 1) {
        alert("Width and height must be at least 1 pixel");
        return;
      }

      setIsCreatingProject(true);

      const now = new Date().toISOString();
      const projectId = crypto.randomUUID();
      const projectName = newProjectName;
      const projectWidth = newProjectWidth;
      const projectHeight = newProjectHeight;

      // Optimistic UI update
      const newProject: Project = {
        id: projectId,
        name: projectName,
        width: projectWidth,
        height: projectHeight,
        lastModified: now,
        thumbnail: undefined,
        folderId: undefined,
      };

      setProjects((prev) => [newProject, ...prev]);

      // Reset form immediately
      setNewProjectName("");
      setNewProjectWidth(32);
      setNewProjectHeight(32);
      setNewProjectColorMode("rgba");
      setNewProjectBackgroundColor("#00000000");
      setNewProjectPixelAspectRatio("1:1");
      setShowNewProject(false);
      setIsCreatingProject(false);

      // Background save
      invoke("create_project", {
        project: {
          id: projectId,
          user_id: userId,
          folder_id: null,
          name: projectName,
          width: projectWidth,
          height: projectHeight,
          color_mode: newProjectColorMode,
          background_color: newProjectBackgroundColor,
          pixel_aspect_ratio: newProjectPixelAspectRatio,
          thumbnail: null,
          created_at: now,
          updated_at: now,
          last_modified: now,
          synced_at: null,
        },
      }).catch((error: any) => {
        console.error("Failed to save project:", error);
        alert(`Failed to save project: ${error}`);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      });
    },
    [newProjectName, newProjectWidth, newProjectHeight, newProjectColorMode, newProjectBackgroundColor, newProjectPixelAspectRatio, userId]
  );

  // Optimistic UI folder creation
  const handleCreateFolder = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!newFolderName.trim()) {
        alert("Please enter a folder name");
        return;
      }

      setIsCreatingFolder(true);

      const now = new Date().toISOString();
      const folderId = crypto.randomUUID();
      const folderName = newFolderName;
      const folderColor = newFolderColor;

      const newFolder: Folder = {
        id: folderId,
        name: folderName,
        color: folderColor,
        lastModified: now,
        projectCount: 0,
      };

      setFolders((prev) => [newFolder, ...prev]);

      setNewFolderName("");
      setNewFolderColor("#8aa7ff");
      setShowNewFolder(false);
      setIsCreatingFolder(false);

      invoke("create_folder", {
        folder: {
          id: folderId,
          user_id: userId,
          name: folderName,
          color: folderColor,
          created_at: now,
          updated_at: now,
          synced_at: null,
        },
      }).catch((error: any) => {
        console.error("Failed to save folder:", error);
        alert(`Failed to save folder: ${error}`);
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
      });
    },
    [newFolderName, newFolderColor, userId]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, itemId: string, itemType: "project" | "folder") => {
      e.preventDefault();
      setContextMenu({
        itemId,
        itemType,
        x: e.clientX,
        y: e.clientY,
      });
    },
    []
  );

  const handleContextMenuAction = useCallback(
    (action: string, itemId: string, itemType: "project" | "folder") => {
      console.log(`Action: ${action}, ${itemType}: ${itemId}`);
      setContextMenu(null);

      switch (action) {
        case "open":
          console.log(`Opening ${itemType}:`, itemId);
          break;
        case "rename":
          console.log(`Renaming ${itemType}:`, itemId);
          break;
        case "duplicate":
          if (itemType === "project") {
            console.log("Duplicating project:", itemId);
          }
          break;
        case "delete":
          const confirmMessage =
            itemType === "folder"
              ? "Are you sure you want to delete this folder and all its contents?"
              : "Are you sure you want to delete this project?";
          if (confirm(confirmMessage)) {
            console.log(`Deleting ${itemType}:`, itemId);
          }
          break;
      }
    },
    []
  );

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu]);

  // Memoized card renderers
  const renderProjectCard = useCallback(
    (project: Project) => (
      <ProjectCard
        key={project.id}
        project={project}
        onClick={() => onOpenProject(project)}
        onContextMenu={(e) => handleContextMenu(e, project.id, "project")}
      />
    ),
    [onOpenProject, handleContextMenu]
  );

  const renderFolderCard = useCallback(
    (folder: Folder) => (
      <FolderCard
        key={folder.id}
        folder={folder}
        onContextMenu={(e) => handleContextMenu(e, folder.id, "folder")}
      />
    ),
    [handleContextMenu]
  );

  return (
    <div className="min-h-screen bg-[#3e323b] font-mono">
      {/* Header - Optimized with will-change */}
      <div className="bg-[#2b2b2b] border-b border-[#1a1a1a] px-6 py-4 will-change-transform">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#4d404f] border-2 border-[#8aa7ff] flex items-center justify-center">
              <span className="text-lg font-pixel text-[#8aa7ff]">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm text-[#d6d2ca] font-semibold">{username}</p>
              <p className="text-xs text-[#9b978e]">{userEmail}</p>
            </div>
          </div>

          <button
            onClick={onOpenSettings}
            className="px-4 py-2 bg-[#404040] text-[#d6d2ca] text-xs uppercase
                     hover:bg-[#505050] transition-colors border border-[#1a1a1a]"
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Projects Section */}
        <div>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-pixel text-[#d6d2ca] leading-relaxed">
              Your Projects
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewFolder(true)}
                className="px-4 py-2 bg-[#2b2b2b] border border-[#8aa7ff] text-[#8aa7ff] text-xs uppercase
                         hover:bg-[#404040] transition-colors font-semibold"
              >
                + New Folder
              </button>
              <button
                onClick={() => setShowNewProject(true)}
                className="px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                         hover:bg-[#a0b7ff] transition-colors font-semibold"
              >
                + New Project
              </button>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                         text-[#d6d2ca] text-sm placeholder-[#9b978e]
                         focus:outline-none focus:border-[#8aa7ff] transition-colors"
              />
            </div>

            <div className="w-48">
              <select
                value={filterSize}
                onChange={(e) => setFilterSize(e.target.value)}
                className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                         text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]
                         transition-colors cursor-pointer"
              >
                <option value="all">All Sizes</option>
                <option value="small">Small (≤32x32)</option>
                <option value="medium">Medium (33-128)</option>
                <option value="large">Large (&gt;128)</option>
              </select>
            </div>
          </div>

          {/* Projects Grid with loading state */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.filteredFolders.map(renderFolderCard)}
              {filteredData.filteredProjects.map(renderProjectCard)}

              {/* Empty State */}
              {filteredData.filteredProjects.length === 0 &&
                filteredData.filteredFolders.length === 0 && (
                  <div className="col-span-full text-center py-16">
                    {projects.length === 0 && folders.length === 0 ? (
                      <>
                        <p className="text-[#9b978e] mb-4">No projects yet</p>
                        <button
                          onClick={() => setShowNewProject(true)}
                          className="px-4 py-2 bg-[#2b2b2b] border border-[#1a1a1a]
                                   text-[#d6d2ca] text-xs uppercase hover:bg-[#404040]
                                   transition-colors"
                        >
                          Create Your First Project
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-[#9b978e] mb-2">No projects match your search</p>
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setFilterSize("all");
                          }}
                          className="px-4 py-2 bg-[#2b2b2b] border border-[#1a1a1a]
                                   text-[#d6d2ca] text-xs uppercase hover:bg-[#404040]
                                   transition-colors"
                        >
                          Clear Filters
                        </button>
                      </>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Modals and Context Menu - Render only when needed */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2b2b2b] border border-[#1a1a1a] max-w-md w-full pixel-panel">
            <div className="bg-[#404040] border-b border-[#1a1a1a] px-4 py-3 flex justify-between items-center">
              <h3 className="text-[#d6d2ca] text-sm uppercase tracking-wider">
                New Project
              </h3>
              <button
                onClick={() => setShowNewProject(false)}
                className="text-[#9b978e] hover:text-[#d6d2ca] text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                           text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                  placeholder="My Pixel Art"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    value={newProjectWidth}
                    onChange={(e) => setNewProjectWidth(parseInt(e.target.value) || 32)}
                    min="1"
                    max="1024"
                    className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                             text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={newProjectHeight}
                    onChange={(e) => setNewProjectHeight(parseInt(e.target.value) || 32)}
                    min="1"
                    max="1024"
                    className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                             text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                  Color Mode
                </label>
                <select
                  value={newProjectColorMode}
                  onChange={(e) => setNewProjectColorMode(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                           text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                >
                  <option value="rgba">RGBA (Full Color)</option>
                  <option value="rgb">RGB (No Alpha)</option>
                  <option value="indexed">Indexed (Palette)</option>
                  <option value="grayscale">Grayscale</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                  Background Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={newProjectBackgroundColor.substring(0, 7)}
                    onChange={(e) => {
                      const alpha = newProjectBackgroundColor.length === 9 ? newProjectBackgroundColor.substring(7) : "ff";
                      setNewProjectBackgroundColor(e.target.value + alpha);
                    }}
                    className="w-16 h-10 bg-[#1d1d1d] border border-[#1a1a1a] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newProjectBackgroundColor}
                    onChange={(e) => setNewProjectBackgroundColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                             text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff] font-mono"
                    placeholder="#RRGGBBAA"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                  Pixel Aspect Ratio
                </label>
                <select
                  value={newProjectPixelAspectRatio}
                  onChange={(e) => setNewProjectPixelAspectRatio(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                           text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                >
                  <option value="1:1">Square (1:1)</option>
                  <option value="2:1">Wide (2:1)</option>
                  <option value="1:2">Tall (1:2)</option>
                  <option value="4:3">Classic (4:3)</option>
                  <option value="16:9">Widescreen (16:9)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isCreatingProject}
                  className="flex-1 px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                           hover:bg-[#a0b7ff] transition-colors font-semibold
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingProject ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  disabled={isCreatingProject}
                  className="flex-1 px-4 py-2 bg-[#2b2b2b] border border-[#1a1a1a]
                           text-[#d6d2ca] text-xs uppercase hover:bg-[#404040]
                           transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2b2b2b] border border-[#1a1a1a] max-w-md w-full pixel-panel">
            <div className="bg-[#404040] border-b border-[#1a1a1a] px-4 py-3 flex justify-between items-center">
              <h3 className="text-[#d6d2ca] text-sm uppercase tracking-wider">
                New Folder
              </h3>
              <button
                onClick={() => setShowNewFolder(false)}
                className="text-[#9b978e] hover:text-[#d6d2ca] text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                           text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                  placeholder="My Assets"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                  Folder Color
                </label>
                <div className="flex gap-2">
                  {["#8aa7ff", "#ff6b6b", "#4ecdc4", "#ffe66d", "#a8e6cf"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewFolderColor(color)}
                      className={`w-10 h-10 border-2 transition-colors ${
                        newFolderColor === color
                          ? "border-[#d6d2ca] scale-110"
                          : "border-[#1a1a1a] hover:border-[#9b978e]"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  className="flex-1 px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                           hover:bg-[#a0b7ff] transition-colors font-semibold
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingFolder ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewFolder(false)}
                  disabled={isCreatingFolder}
                  className="flex-1 px-4 py-2 bg-[#2b2b2b] border border-[#1a1a1a]
                           text-[#d6d2ca] text-xs uppercase hover:bg-[#404040]
                           transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[#2b2b2b] border border-[#1a1a1a] pixel-panel z-50"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <div className="py-1 min-w-[160px]">
            <button
              onClick={() =>
                handleContextMenuAction("open", contextMenu.itemId, contextMenu.itemType)
              }
              className="w-full px-4 py-2 text-left text-xs text-[#d6d2ca] hover:bg-[#404040]
                       transition-colors uppercase tracking-wide"
            >
              Open
            </button>
            <div className="border-t border-[#1a1a1a] my-1" />
            <button
              onClick={() =>
                handleContextMenuAction("rename", contextMenu.itemId, contextMenu.itemType)
              }
              className="w-full px-4 py-2 text-left text-xs text-[#d6d2ca] hover:bg-[#404040]
                       transition-colors uppercase tracking-wide"
            >
              Rename
            </button>
            {contextMenu.itemType === "project" && (
              <button
                onClick={() =>
                  handleContextMenuAction("duplicate", contextMenu.itemId, contextMenu.itemType)
                }
                className="w-full px-4 py-2 text-left text-xs text-[#d6d2ca] hover:bg-[#404040]
                         transition-colors uppercase tracking-wide"
              >
                Duplicate
              </button>
            )}
            <div className="border-t border-[#1a1a1a] my-1" />
            <button
              onClick={() =>
                handleContextMenuAction("delete", contextMenu.itemId, contextMenu.itemType)
              }
              className="w-full px-4 py-2 text-left text-xs text-[#ff6b6b] hover:bg-[#404040]
                       transition-colors uppercase tracking-wide"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

Dashboard.displayName = "Dashboard";
