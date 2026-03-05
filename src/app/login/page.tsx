"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = "/";
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold text-center mb-1">Workspace Dashboard</h1>
        <p className="text-sm text-[#86868b] text-center mb-6">Enter password to continue</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-[#e5e5e5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent"
        />
        {error && <p className="text-red-500 text-xs mt-2">Wrong password</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full mt-4 bg-[#1d1d1f] text-white text-sm font-medium py-3 rounded-xl hover:bg-[#333] transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
