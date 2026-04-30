// src/components/LoginForm.tsx

import { useState } from "react";
import { login } from "../lib/api";

export default function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      onLogin();
    } catch (e: any) {
      setError(e.message || "Błąd logowania");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-surface-0">
      <div className="w-full max-w-sm bg-surface-1 border border-surface-3 rounded-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🎤</div>
          <h1 className="text-xl font-semibold text-white">Smart Omni</h1>
          <p className="text-xs text-gray-500 mt-1">Głosowy asystent AI</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Użytkownik"
            autoFocus
            className="w-full bg-surface-2 border border-surface-4 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Hasło"
            className="w-full bg-surface-2 border border-surface-4 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 text-center">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !username || !password}
          className="w-full py-2.5 rounded-xl bg-accent text-surface-0 font-semibold text-sm hover:bg-accent-glow transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Logowanie..." : "Zaloguj się"}
        </button>
      </div>
    </div>
  );
}
