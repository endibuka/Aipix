import { useState } from "react";

interface LoginProps {
  onCreateAccount: () => void;
  onForgotPassword: () => void;
  onLoginSuccess: () => void;
}

export const Login = ({ onCreateAccount, onForgotPassword, onLoginSuccess }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Mock authentication
    if (email === "endibuka@gmail.com" && password === "endibuka123") {
      // Store user session
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userEmail", email);
      onLoginSuccess();
    } else {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#3e323b] font-mono">
      {/* Main Login Container */}
      <div className="w-full max-w-md">
        {/* Header/Logo Area */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-pixel text-[#d6d2ca] mb-4 leading-relaxed">
            AIPIX
          </h1>
          <p className="text-sm text-[#9b978e] uppercase tracking-widest font-mono">
            Pixel Art Editor
          </p>
        </div>

        {/* Login Panel */}
        <div className="bg-[#2b2b2b] border border-[#1a1a1a] rounded pixel-panel">
          {/* Panel Header */}
          <div className="bg-[#404040] border-b border-[#1a1a1a] px-4 py-3">
            <h2 className="text-[#d6d2ca] text-sm uppercase tracking-wider">
              Sign In
            </h2>
          </div>

          {/* Form Content */}
          <form onSubmit={handleLogin} className="p-6 space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs text-[#9b978e] uppercase tracking-wide"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                         text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]
                         transition-colors"
                placeholder="Enter email"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs text-[#9b978e] uppercase tracking-wide"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                         text-[#d6d2ca] text-sm focus:outline-none focus:border-[#8aa7ff]
                         transition-colors"
                placeholder="Enter password"
                required
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-[#1d1d1d] border border-[#ff6b6b] px-3 py-2 text-[#ff6b6b] text-xs">
                {error}
              </div>
            )}

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember"
                className="pixel-checkbox"
              />
              <label
                htmlFor="remember"
                className="ml-2 text-xs text-[#9b978e] uppercase cursor-pointer"
              >
                Remember me
              </label>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-[#2b2b2b] border border-[#1a1a1a]
                       text-[#d6d2ca] text-sm uppercase tracking-wider
                       hover:bg-[#404040] active:bg-[#606060]
                       transition-colors font-semibold"
            >
              Login
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#1a1a1a]"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#2b2b2b] px-2 text-[#9b978e]">or</span>
              </div>
            </div>

            {/* Secondary Actions */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={onCreateAccount}
                className="w-full px-4 py-2 bg-[#1d1d1d] border border-[#1a1a1a]
                         text-[#d6d2ca] text-xs uppercase tracking-wider
                         hover:bg-[#404040] transition-colors"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={onForgotPassword}
                className="w-full px-4 py-2 text-[#9b978e] text-xs uppercase
                         tracking-wider hover:text-[#d6d2ca] transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#9b978e]">
            v0.1.0 | Powered by Tauri + React
          </p>
        </div>
      </div>
    </div>
  );
};
