import { useState } from "react";
import { login } from "../lib/api";

export default function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const ok = await login(password.trim());
    setLoading(false);
    if (ok) onLogin();
    else setError("Nieprawidłowy token");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎤</div>
          <h1 className="text-2xl font-bold text-white">Smart Omni</h1>
          <p className="text-sm text-gray-500 mt-1">Wpisz token dostępu</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="VOICE_API_TOKEN"
          autoFocus
          className="w-full bg-surface-2 border border-surface-4 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 transition-colors mb-3"
        />

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full py-3 rounded-xl bg-accent text-surface-0 font-semibold text-sm hover:bg-accent-glow transition-colors disabled:opacity-40"
        >
          {loading ? "Sprawdzam..." : "Zaloguj"}
        </button>
      </form>
    </div>
  );
}
