import { useState, useEffect } from "react";
import { Login } from "./components/Login";
import { CreateAccount } from "./components/CreateAccount";
import { ForgotPassword } from "./components/ForgotPassword";
import { Dashboard } from "./components/Dashboard";
import "./styles/App.css";

type AuthPage = "login" | "createAccount" | "forgotPassword";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentAuthPage, setCurrentAuthPage] = useState<AuthPage>("login");

  // Check for existing session on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true";
    setIsLoggedIn(loggedIn);
  }, []);

  const handleLoginSuccess = () => {
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

  // Main app view - Dashboard
  return <Dashboard />;
}

export default App;
