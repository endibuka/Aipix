import { useState } from "react";
import { signUp } from "../lib/auth";
import { invoke } from "@tauri-apps/api/core";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!formData.username || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Initialize database
      await invoke("init_database");

      // Create account with Supabase
      const { user, error: signUpError } = await signUp({
        email: formData.email,
        password: formData.password,
        username: formData.username,
      });

      if (signUpError || !user) {
        setError(signUpError || "Failed to create account");
        setLoading(false);
        return;
      }

      setSuccess("Account created successfully! Please check your email to verify your account.");

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        onBackToLogin();
      }, 3000);
    } catch (err: any) {
      console.error("Sign up error:", err);
      setError(err.message || "An error occurred during sign up");
    } finally {
      setLoading(false);
    }
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

            {/* Error Message */}
            {error && (
              <div className="bg-[#1d1d1d] border border-[#ff6b6b] px-3 py-2 text-[#ff6b6b] text-xs">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-[#1d1d1d] border border-[#6bff6b] px-3 py-2 text-[#6bff6b] text-xs">
                {success}
              </div>
            )}

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
              disabled={loading}
              className="w-full px-4 py-3 bg-aipix-panel border border-aipix-divider
                       text-aipix-text text-sm uppercase tracking-wider
                       hover:bg-aipix-hover active:bg-aipix-active
                       transition-colors font-semibold mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating Account..." : "Create Account"}
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
