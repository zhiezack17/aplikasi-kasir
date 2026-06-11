import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Coffee, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-bg">
      {/* Left: Image */}
      <div
        className="hidden md:flex md:w-1/2 relative bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1600&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-brand-text/40" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary flex items-center justify-center shadow-button-glow">
              <Coffee className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Warung Kopi POS</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Selamat datang kembali.
          </h1>
          <p className="text-white/80 text-lg max-w-md leading-relaxed">
            Sistem kasir modern untuk cafe & restoran. Cepat, sederhana, dan menyenangkan untuk digunakan.
          </p>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary flex items-center justify-center shadow-button-glow">
              <Coffee className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-brand-text">Warung Kopi POS</span>
          </div>

          <div className="bg-brand-surface rounded-2xl p-8 shadow-card-subtle border border-brand-border">
            <h2 className="text-3xl font-bold tracking-tight text-brand-text mb-1">Masuk</h2>
            <p className="text-brand-textMuted mb-8">Silakan masukkan akun Anda</p>

            <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
              <div>
                <label className="text-xs tracking-[0.05em] uppercase font-bold text-brand-textMuted block mb-2">
                  Username
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-brand-border bg-brand-surface2 text-brand-text focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
                  placeholder="admin atau kasir"
                  required
                  data-testid="login-username-input"
                />
              </div>

              <div>
                <label className="text-xs tracking-[0.05em] uppercase font-bold text-brand-textMuted block mb-2">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-brand-border bg-brand-surface2 text-brand-text focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
                  placeholder="••••••••"
                  required
                  data-testid="login-password-input"
                />
              </div>

              {error && (
                <div
                  className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
                  data-testid="login-error"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-brand-primary hover:bg-brand-primaryHover text-white font-semibold tracking-wide transition shadow-button-glow disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="login-form-submit-button"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Memproses..." : "Masuk"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-brand-border">
              <p className="text-xs text-brand-textMuted text-center mb-2 uppercase tracking-wider font-bold">Akun demo</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-brand-surface2 rounded-lg p-2 text-center">
                  <div className="font-semibold text-brand-text">admin / admin123</div>
                  <div className="text-brand-textMuted">Admin</div>
                </div>
                <div className="bg-brand-surface2 rounded-lg p-2 text-center">
                  <div className="font-semibold text-brand-text">kasir / kasir123</div>
                  <div className="text-brand-textMuted">Kasir</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
