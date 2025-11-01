import { useState } from "react";

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export const ForgotPassword = ({ onBackToLogin }: ForgotPasswordProps) => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Password reset logic will be added later
    console.log("Password reset request for:", email);
    setIsSubmitted(true);
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
            Reset Password
          </p>
        </div>

        {/* Forgot Password Panel */}
        <div className="bg-aipix-panel border border-aipix-divider rounded pixel-panel">
          {/* Panel Header */}
          <div className="bg-aipix-panelLight border-b border-aipix-divider px-4 py-3">
            <h2 className="text-aipix-text text-sm uppercase tracking-wider">
              Password Recovery
            </h2>
          </div>

          {/* Content */}
          <div className="p-6">
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Instructions */}
                <div className="text-sm text-aipix-textMuted leading-relaxed">
                  Enter your email address and we'll send you instructions to
                  reset your password.
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-aipix-input border border-aipix-divider
                             text-aipix-text text-sm focus:outline-none focus:border-aipix-accent
                             transition-colors"
                    placeholder="your@email.com"
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-aipix-panel border border-aipix-divider
                           text-aipix-text text-sm uppercase tracking-wider
                           hover:bg-aipix-hover active:bg-aipix-active
                           transition-colors font-semibold"
                >
                  Send Reset Link
                </button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-aipix-divider"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-aipix-panel px-2 text-aipix-textMuted">
                      or
                    </span>
                  </div>
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
            ) : (
              /* Success Message */
              <div className="space-y-6">
                {/* Success Icon/Message */}
                <div className="text-center py-4">
                  <div className="text-4xl mb-4">✓</div>
                  <h3 className="text-lg text-aipix-text font-semibold mb-2">
                    Check Your Email
                  </h3>
                  <p className="text-sm text-aipix-textMuted leading-relaxed">
                    We've sent password reset instructions to{" "}
                    <span className="text-aipix-text">{email}</span>
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-aipix-input border border-aipix-divider p-4">
                  <p className="text-xs text-aipix-textMuted leading-relaxed">
                    Didn't receive the email? Check your spam folder or try
                    again in a few minutes.
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="w-full px-4 py-2 bg-aipix-input border border-aipix-divider
                             text-aipix-text text-xs uppercase tracking-wider
                             hover:bg-aipix-hover transition-colors"
                  >
                    Try Another Email
                  </button>
                  <button
                    onClick={onBackToLogin}
                    className="w-full px-4 py-2 text-aipix-textMuted text-xs uppercase
                             tracking-wider hover:text-aipix-text transition-colors"
                  >
                    Back to Login
                  </button>
                </div>
              </div>
            )}
          </div>
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
