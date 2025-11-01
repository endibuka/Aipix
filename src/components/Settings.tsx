import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { supabase } from "../lib/supabase";

interface SettingsProps {
  onBack: () => void;
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: string;
  email: string;
  username: string;
  invited_at: string;
  joined_at?: string;
}

export const Settings = ({ onBack }: SettingsProps) => {
  const userId = localStorage.getItem("userId") || "";
  const userEmail = localStorage.getItem("userEmail") || "user@example.com";
  const storedUsername = localStorage.getItem("username") || userEmail.split("@")[0];

  const [activeTab, setActiveTab] = useState<"account" | "team" | "preferences" | "about">("account");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [username, setUsername] = useState(storedUsername);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      alert("Username cannot be empty");
      return;
    }

    setIsSaving(true);

    try {
      const now = new Date().toISOString();

      // Update in local SQLite
      await invoke("update_user", {
        user: {
          id: userId,
          email: userEmail,
          username: username,
          profile_picture: null,
          created_at: now,
          updated_at: now,
        },
      });

      // Update in Supabase
      const { error } = await supabase
        .from("users")
        .update({
          username: username,
          updated_at: now,
        })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update user in Supabase:", error);
      }

      // Update localStorage
      localStorage.setItem("username", username);

      alert("Profile updated successfully!");
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      alert(`Failed to update profile: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#3e323b] font-mono">
      {/* Header */}
      <div className="bg-[#2b2b2b] border-b border-[#1a1a1a] px-6 py-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3 py-2 bg-[#404040] text-[#d6d2ca] text-xs uppercase
                       hover:bg-[#505050] transition-colors border border-[#1a1a1a]"
            >
              ← Back
            </button>
            <h1 className="text-lg font-pixel text-[#d6d2ca] leading-relaxed">Settings</h1>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-[#404040] text-[#ff6b6b] text-xs uppercase
                     hover:bg-[#505050] transition-colors border border-[#1a1a1a]"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[#1a1a1a]">
          <button
            onClick={() => setActiveTab("account")}
            className={`px-6 py-3 text-xs uppercase font-semibold transition-colors border-b-2
                     ${activeTab === "account" ? 'border-[#8aa7ff] text-[#8aa7ff]' : 'border-transparent text-[#9b978e] hover:text-[#d6d2ca]'}`}
          >
            Account
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={`px-6 py-3 text-xs uppercase font-semibold transition-colors border-b-2
                     ${activeTab === "team" ? 'border-[#8aa7ff] text-[#8aa7ff]' : 'border-transparent text-[#9b978e] hover:text-[#d6d2ca]'}`}
          >
            Team
          </button>
          <button
            onClick={() => setActiveTab("preferences")}
            className={`px-6 py-3 text-xs uppercase font-semibold transition-colors border-b-2
                     ${activeTab === "preferences" ? 'border-[#8aa7ff] text-[#8aa7ff]' : 'border-transparent text-[#9b978e] hover:text-[#d6d2ca]'}`}
          >
            Preferences
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`px-6 py-3 text-xs uppercase font-semibold transition-colors border-b-2
                     ${activeTab === "about" ? 'border-[#8aa7ff] text-[#8aa7ff]' : 'border-transparent text-[#9b978e] hover:text-[#d6d2ca]'}`}
          >
            About
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-[#2b2b2b] border border-[#1a1a1a] pixel-panel">
          {activeTab === "account" && (
            <div className="p-6 space-y-6">
              {/* Profile Picture Section */}
              <div>
                <h2 className="text-sm font-pixel text-[#d6d2ca] mb-4 leading-relaxed uppercase">
                  Profile Picture
                </h2>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 bg-[#4d404f] border-2 border-[#8aa7ff] flex items-center justify-center">
                    <span className="text-4xl font-pixel text-[#8aa7ff]">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <button
                      className="px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                               hover:bg-[#a0b7ff] transition-colors font-semibold block"
                    >
                      Upload Picture
                    </button>
                    <button
                      className="px-4 py-2 bg-[#404040] text-[#d6d2ca] text-xs uppercase
                               hover:bg-[#505050] transition-colors border border-[#1a1a1a] block"
                    >
                      Remove Picture
                    </button>
                    <p className="text-xs text-[#9b978e]">Recommended: 512x512px</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#1a1a1a] pt-6">
                <h2 className="text-sm font-pixel text-[#d6d2ca] mb-4 leading-relaxed uppercase">
                  Profile Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#9b978e] uppercase tracking-wide mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                               text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#9b978e] uppercase tracking-wide mb-2">
                      Email (Read-only)
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#1a1a1a]
                               text-[#9b978e] text-sm cursor-not-allowed opacity-60"
                    />
                    <p className="text-xs text-[#9b978e] mt-1">Email cannot be changed</p>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                               hover:bg-[#a0b7ff] transition-colors font-semibold
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#1a1a1a] pt-6">
                <h2 className="text-sm font-pixel text-[#d6d2ca] mb-4 leading-relaxed uppercase">
                  Password
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#9b978e] uppercase tracking-wide mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                               text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#9b978e] uppercase tracking-wide mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                               text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      className="px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                               hover:bg-[#a0b7ff] transition-colors font-semibold"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div className="p-6 space-y-6">
              {/* Team Members Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-pixel text-[#d6d2ca] leading-relaxed uppercase">
                    Team Members
                  </h2>
                  <span className="text-xs text-[#9b978e]">{teamMembers.length + 1} Members</span>
                </div>

                {/* Team Member List */}
                <div className="space-y-3 mb-6">
                  {/* Current User (Owner) */}
                  <div className="flex items-center justify-between p-3 bg-[#1d1d1d] border border-[#1a1a1a]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#4d404f] border-2 border-[#8aa7ff] flex items-center justify-center">
                        <span className="text-sm font-pixel text-[#8aa7ff]">
                          {username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-[#d6d2ca] font-semibold">{username}</p>
                        <p className="text-xs text-[#9b978e]">{userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase font-semibold">
                        Owner
                      </span>
                    </div>
                  </div>

                  {/* Team Members from Database */}
                  {teamMembers.length === 0 ? (
                    <div className="p-4 text-center text-[#9b978e] text-sm bg-[#1d1d1d] border border-[#1a1a1a]">
                      No team members yet. Invite teammates to collaborate!
                    </div>
                  ) : (
                    teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-[#1d1d1d] border border-[#1a1a1a]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#4d404f] border-2 border-[#4ecdc4] flex items-center justify-center">
                            <span className="text-sm font-pixel text-[#4ecdc4]">
                              {member.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-[#d6d2ca] font-semibold">{member.username}</p>
                            <p className="text-xs text-[#9b978e]">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="px-2 py-1 bg-[#404040] border border-[#1a1a1a] text-[#d6d2ca] text-xs"
                            value={member.role}
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button className="text-[#ff6b6b] hover:text-[#ff5252] transition-colors text-xs">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Invite Section */}
              <div className="border-t border-[#1a1a1a] pt-6">
                <h2 className="text-sm font-pixel text-[#d6d2ca] mb-4 leading-relaxed uppercase">
                  Invite Team Members
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#9b978e] uppercase tracking-wide mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="teammate@example.com"
                      className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                               text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]
                               placeholder-[#9b978e]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#9b978e] uppercase tracking-wide mb-2">
                      Role
                    </label>
                    <select className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                                     text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]">
                      <option>Editor</option>
                      <option>Viewer</option>
                      <option>Admin</option>
                    </select>
                  </div>

                  <div className="pt-4">
                    <button
                      className="px-4 py-2 bg-[#8aa7ff] text-[#1d1d1d] text-xs uppercase
                               hover:bg-[#a0b7ff] transition-colors font-semibold"
                    >
                      Send Invitation
                    </button>
                  </div>
                </div>
              </div>

              {/* Pending Invitations */}
              <div className="border-t border-[#1a1a1a] pt-6">
                <h2 className="text-sm font-pixel text-[#d6d2ca] mb-4 leading-relaxed uppercase">
                  Pending Invitations
                </h2>
                <div className="space-y-2">
                  {pendingInvitations.length === 0 ? (
                    <div className="p-4 text-center text-[#9b978e] text-sm bg-[#1d1d1d] border border-[#1a1a1a]">
                      No pending invitations
                    </div>
                  ) : (
                    pendingInvitations.map((invitation) => (
                      <div key={invitation.id} className="flex items-center justify-between p-3 bg-[#1d1d1d] border border-[#1a1a1a]">
                        <div>
                          <p className="text-sm text-[#d6d2ca]">{invitation.email}</p>
                          <p className="text-xs text-[#9b978e]">
                            {new Date(invitation.created_at).toLocaleDateString()} · {invitation.role}
                          </p>
                        </div>
                        <button className="text-[#ff6b6b] hover:text-[#ff5252] transition-colors text-xs uppercase">
                          Revoke
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-sm font-pixel text-[#d6d2ca] mb-4 leading-relaxed uppercase">
                  Display Settings
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-[#1a1a1a]">
                    <div>
                      <p className="text-sm text-[#d6d2ca]">Grid Density</p>
                      <p className="text-xs text-[#9b978e]">Adjust project grid spacing</p>
                    </div>
                    <select
                      className="px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                               text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                    >
                      <option>Comfortable</option>
                      <option>Compact</option>
                      <option>Spacious</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-[#1a1a1a]">
                    <div>
                      <p className="text-sm text-[#d6d2ca]">Default View</p>
                      <p className="text-xs text-[#9b978e]">Starting view when opening dashboard</p>
                    </div>
                    <select
                      className="px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                               text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]"
                    >
                      <option>All Projects</option>
                      <option>Recent</option>
                      <option>Favorites</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-[#d6d2ca]">Show Thumbnails</p>
                      <p className="text-xs text-[#9b978e]">Display project previews in cards</p>
                    </div>
                    <label className="relative inline-block w-12 h-6">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-12 h-6 bg-[#404040] peer-focus:outline-none
                                    peer-checked:bg-[#8aa7ff] transition-colors cursor-pointer
                                    border border-[#1a1a1a]">
                        <div className="absolute top-0.5 left-0.5 bg-[#1d1d1d] w-5 h-5
                                      transition-transform peer-checked:translate-x-6"></div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div className="p-6 space-y-6">
              <div className="text-center py-8">
                <h1 className="text-4xl font-pixel text-[#8aa7ff] mb-4 leading-relaxed">
                  AIPIX
                </h1>
                <p className="text-sm text-[#9b978e] mb-2">Version 1.0.0</p>
                <p className="text-xs text-[#9b978e]">Pixel Art Editor & Project Manager</p>
              </div>

              <div className="border-t border-[#1a1a1a] pt-6">
                <h2 className="text-sm font-pixel text-[#d6d2ca] mb-4 leading-relaxed uppercase">
                  System Information
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                    <span className="text-[#9b978e]">Platform</span>
                    <span className="text-[#d6d2ca]">{navigator.platform}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                    <span className="text-[#9b978e]">User Agent</span>
                    <span className="text-[#d6d2ca] text-xs truncate max-w-xs">
                      {navigator.userAgent.split(' ')[0]}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-[#9b978e]">Language</span>
                    <span className="text-[#d6d2ca]">{navigator.language}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#1a1a1a] pt-6">
                <p className="text-xs text-[#9b978e] text-center">
                  © 2025 AIPIX. Built with Tauri + React + TypeScript
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
