import { useState } from "react";

interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  lastModified: string;
  thumbnail?: string;
}

// Mock projects data
const MOCK_PROJECTS: Project[] = [
  {
    id: "1",
    name: "Character Sprite",
    width: 32,
    height: 32,
    lastModified: "2025-10-28",
  },
  {
    id: "2",
    name: "Game Background",
    width: 256,
    height: 192,
    lastModified: "2025-10-25",
  },
  {
    id: "3",
    name: "UI Icons Set",
    width: 16,
    height: 16,
    lastModified: "2025-10-20",
  },
];

export const Dashboard = () => {
  const [projects] = useState<Project[]>(MOCK_PROJECTS);
  const [showNewProject, setShowNewProject] = useState(false);
  const userEmail = localStorage.getItem("userEmail") || "user@example.com";
  const username = userEmail.split("@")[0];

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#3e323b] font-mono">
      {/* Top Menu Bar */}
      <div className="bg-[#c8b79e] border-b border-[#1a1a1a] px-6 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-pixel text-[#1a1a1a] leading-relaxed">
            AIPIX
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-xs uppercase text-[#1a1a1a]">
              {username}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-[#1a1a1a] text-[#c8b79e] text-xs uppercase
                       hover:bg-[#2b2b2b] transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Profile Section */}
        <div className="bg-[#2b2b2b] border border-[#1a1a1a] p-6 mb-8 pixel-panel">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 bg-[#4d404f] border-2 border-[#8aa7ff] flex items-center justify-center">
              <span className="text-3xl font-pixel text-[#8aa7ff]">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h2 className="text-xl font-pixel text-[#d6d2ca] mb-2 leading-relaxed">
                {username}
              </h2>
              <p className="text-sm text-[#9b978e]">{userEmail}</p>
              <div className="flex gap-6 mt-3 text-xs text-[#9b978e]">
                <div>
                  <span className="text-[#d6d2ca] font-semibold">
                    {projects.length}
                  </span>{" "}
                  Projects
                </div>
                <div>
                  <span className="text-[#d6d2ca] font-semibold">0</span> Shared
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-pixel text-[#d6d2ca] leading-relaxed">
              Your Projects
            </h3>
            <button
              onClick={() => setShowNewProject(true)}
              className="px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                       hover:bg-[#a0b7ff] transition-colors font-semibold"
            >
              + New Project
            </button>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-[#2b2b2b] border border-[#1a1a1a] hover:border-[#8aa7ff]
                         transition-colors cursor-pointer pixel-panel group"
              >
                {/* Thumbnail Area */}
                <div className="bg-[#4d404f] h-48 flex items-center justify-center border-b border-[#1a1a1a]">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-2 bg-[#3e323b] border border-[#8aa7ff]
                                  flex items-center justify-center">
                      <span className="text-2xl">🎨</span>
                    </div>
                    <p className="text-xs text-[#9b978e]">
                      {project.width}x{project.height}px
                    </p>
                  </div>
                </div>

                {/* Project Info */}
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-[#d6d2ca] mb-1 group-hover:text-[#8aa7ff] transition-colors">
                    {project.name}
                  </h4>
                  <p className="text-xs text-[#9b978e]">
                    Modified: {project.lastModified}
                  </p>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {projects.length === 0 && (
              <div className="col-span-full text-center py-16">
                <p className="text-[#9b978e] mb-4">No projects yet</p>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="px-4 py-2 bg-[#2b2b2b] border border-[#1a1a1a]
                           text-[#d6d2ca] text-xs uppercase hover:bg-[#404040]
                           transition-colors"
                >
                  Create Your First Project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2b2b2b] border border-[#1a1a1a] max-w-md w-full pixel-panel">
            {/* Modal Header */}
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

            {/* Modal Content */}
            <form className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                  Project Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                           text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                  placeholder="My Pixel Art"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs text-[#9b978e] uppercase tracking-wide">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    defaultValue="32"
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
                    defaultValue="32"
                    className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                             text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                           hover:bg-[#a0b7ff] transition-colors font-semibold"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 px-4 py-2 bg-[#2b2b2b] border border-[#1a1a1a]
                           text-[#d6d2ca] text-xs uppercase hover:bg-[#404040]
                           transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
