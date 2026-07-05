import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { StaffRole } from "../types";

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "security", label: "Security" },
  { value: "medical", label: "Medical" },
  { value: "fire", label: "Fire Response" },
  { value: "general", label: "General" },
];

export default function LoginPage() {
  const { login, register, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "security" as StaffRole,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (isRegister) {
        await register(form);
      } else {
        await login(form.email, form.password);
      }
      navigate("/", { replace: true });
    } catch {
      // Error is set in AuthContext
    }
  };

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/15 border border-danger/30">
            <Shield className="h-8 w-8 text-danger" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            RAPID RESPONSE
          </h1>
          <p className="mt-1 text-sm text-muted">
            Staff Emergency Dashboard
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-border-dim bg-surface-2 p-8 shadow-2xl"
        >
          <h2 className="mb-6 text-center text-lg font-bold text-white">
            {isRegister ? "Create Account" : "Sign In"}
          </h2>

          {error && (
            <div className="mb-4 rounded-xl bg-danger/10 border border-danger/30 px-4 py-3 text-xs text-danger">
              {error.replace("Firebase: ", "").replace(/\(auth\/.*\)/, "").trim()}
            </div>
          )}

          <div className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted tracking-wider">
                    FULL NAME
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    className="w-full rounded-xl border border-border-dim bg-surface-3 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition-colors focus:border-danger/50"
                    placeholder="Officer Singh"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted tracking-wider">
                    PHONE
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    className="w-full rounded-xl border border-border-dim bg-surface-3 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition-colors focus:border-danger/50"
                    placeholder="+91-9876543210"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-muted tracking-wider">
                    ROLE
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => set("role", e.target.value)}
                    className="w-full rounded-xl border border-border-dim bg-surface-3 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-danger/50"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted tracking-wider">
                EMAIL
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full rounded-xl border border-border-dim bg-surface-3 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition-colors focus:border-danger/50"
                placeholder="officer@hotel.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted tracking-wider">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  className="w-full rounded-xl border border-border-dim bg-surface-3 px-4 py-3 pr-11 text-sm text-white placeholder-neutral-600 outline-none transition-colors focus:border-danger/50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-danger py-3.5 text-sm font-black tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                {isRegister ? "CREATE ACCOUNT" : "SIGN IN"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="mt-5 text-center text-xs text-muted">
            {isRegister ? "Already have an account?" : "Need an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegister((v) => !v);
                clearError();
              }}
              className="font-bold text-danger hover:underline"
            >
              {isRegister ? "Sign In" : "Register"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
