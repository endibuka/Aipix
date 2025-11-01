import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Login } from "./components/Login";
import { CreateAccount } from "./components/CreateAccount";
import { ForgotPassword } from "./components/ForgotPassword";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { setupAutoSync, pushToCloud } from "./lib/sync";
import "./styles/App.css";

type AuthPage = "login" | "createAccount" | "forgotPassword";
type AppPage = "dashboard" | "settings";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentAuthPage, setCurrentAuthPage] = useState<AuthPage>("login");
  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");
  const [dbInitialized, setDbInitialized] = useState(false);

  // Check for existing session on mount and initialize database
  useEffect(() => {
    const initializeApp = async () => {
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";

      if (loggedIn) {
        try {
          // Initialize database for existing session
          await invoke("init_database");
          setDbInitialized(true);
          console.log("Database initialized for existing session");

          // Start auto-sync and do initial push
          const userId = localStorage.getItem("userId");
          if (userId) {
            console.log("Setting up auto-sync...");
            const cleanup = setupAutoSync(userId, 5); // Sync every 5 minutes

            // Do an immediate push to sync any pending changes
            console.log("Pushing pending changes to Supabase...");
            await pushToCloud();

            // Return cleanup function
            return () => cleanup();
          }
        } catch (error) {
          console.error("Failed to initialize database:", error);
        }
      }

      setIsLoggedIn(loggedIn);
    };

    initializeApp();
  }, []);

  const handleLoginSuccess = (_userId: string, _email: string, _username: string) => {
    setIsLoggedIn(true);
    setDbInitialized(true);
  };

  // Show loading state while initializing database for existing session
  if (isLoggedIn && !dbInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#3e323b] font-mono">
        <div className="text-center">
          <div className="text-[#d6d2ca] text-lg mb-2">Initializing database...</div>
          <div className="text-[#9b978e] text-sm">Please wait</div>
        </div>
      </div>
    );
  }

  // Authentication page routing
  if (!isLoggedIn) {
    switch (currentAuthPage) {
      case "createAccount":
        return (
          <CreateAccount onBackToLogin={() => setCurrentAuthPage("login")} />
        );
      case "forgotPassword":
        return (
          <ForgotPassword onBackToLogin={() => setCurrentAuthPage("login")} />
        );
      case "login":
      default:
        return (
          <Login
            onCreateAccount={() => setCurrentAuthPage("createAccount")}
            onForgotPassword={() => setCurrentAuthPage("forgotPassword")}
            onLoginSuccess={handleLoginSuccess}
          />
        );
    }
  }

  // Main app view - Dashboard or Settings
  if (currentPage === "settings") {
    return <Settings onBack={() => setCurrentPage("dashboard")} />;
  }

  return <Dashboard onOpenSettings={() => setCurrentPage("settings")} />;
}

export default App;
