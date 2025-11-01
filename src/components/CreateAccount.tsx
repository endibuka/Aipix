import { useState } from "react";

interface CreateAccountProps {
  onBackToLogin: () => void;
}

export const CreateAccount = ({ onBackToLogin }: CreateAccountProps) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Account creation logic will be added later
    console.log("Create account attempt:", formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#3e323b] font-mono">
      {/* Main Container */}
      <div className="w-full max-w-md">
        {/* Header/Logo Area */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-pixel text-aipix-text mb-4 leading-relaxed">
            AIPIX
          </h1>
          <p className="text-sm text-aipix-textMuted uppercase tracking-widest font-mono">
            Create New Account
          </p>
        </div>

        {/* Create Account Panel */}
        <div className="bg-aipix-panel border border-aipix-divider rounded pixel-panel">
          {/* Panel Header */}
          <div className="bg-aipix-panelLight border-b border-aipix-divider px-4 py-3">
            <h2 className="text-aipix-text text-sm uppercase tracking-wider">
              Sign Up
            </h2>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Username Field */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-xs text-aipix-textMuted uppercase tracking-wide"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-aipix-input border border-aipix-divider
                         text-aipix-text text-sm focus:outline-none focus:border-aipix-accent
                         transition-colors"
                placeholder="Choose a username"
                required
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs text-aipix-textMuted uppercase tracking-wide"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-aipix-input border border-aipix-divider
                         text-aipix-text text-sm focus:outline-none focus:border-aipix-accent
                         transition-colors"
                placeholder="your@email.com"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs text-aipix-textMuted uppercase tracking-wide"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-aipix-input border border-aipix-divider
                         text-aipix-text text-sm focus:outline-none focus:border-aipix-accent
                         transition-colors"
                placeholder="Create a password"
                required
              />
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="block text-xs text-aipix-textMuted uppercase tracking-wide"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-aipix-input border border-aipix-divider
                         text-aipix-text text-sm focus:outline-none focus:border-aipix-accent
                         transition-colors"
                placeholder="Confirm your password"
                required
              />
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start pt-2">
              <input
                type="checkbox"
                id="terms"
                className="pixel-checkbox mt-0.5"
                required
              />
              <label
                htmlFor="terms"
                className="ml-2 text-xs text-aipix-textMuted leading-relaxed cursor-pointer"
              >
                I agree to the Terms of Service and Privacy Policy
              </label>
            </div>

            {/* Create Account Button */}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-aipix-panel border border-aipix-divider
                       text-aipix-text text-sm uppercase tracking-wider
                       hover:bg-aipix-hover active:bg-aipix-active
                       transition-colors font-semibold mt-4"
            >
              Create Account
            </button>

            {/* Divider */}
            <div className="relative pt-2 flex items-center">
              <div className="flex-grow border-t border-aipix-divider"></div>
              <span className="flex-shrink mx-2 text-xs uppercase text-aipix-textMuted">
                Already have an account?
              </span>
              <div className="flex-grow border-t border-aipix-divider"></div>
            </div>

            {/* Back to Login */}
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full px-4 py-2 text-aipix-textMuted text-xs uppercase
                       tracking-wider hover:text-aipix-text transition-colors"
            >
              Back to Login
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-aipix-textMuted">
            v0.1.0 | Powered by Tauri + React
          </p>
        </div>
      </div>
    </div>
  );
};
