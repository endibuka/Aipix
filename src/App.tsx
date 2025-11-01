import { useState, useEffect } from "react";
import { Login } from "./components/Login";
import { CreateAccount } from "./components/CreateAccount";
import { ForgotPassword } from "./components/ForgotPassword";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import "./styles/App.css";

type AuthPage = "login" | "createAccount" | "forgotPassword";
type AppPage = "dashboard" | "settings";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentAuthPage, setCurrentAuthPage] = useState<AuthPage>("login");
  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");

  // Check for existing session on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true";
    setIsLoggedIn(loggedIn);
  }, []);

  const handleLoginSuccess = (_userId: string, _email: string, _username: string) => {
    setIsLoggedIn(true);
  };

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
