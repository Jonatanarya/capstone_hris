"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function ConfirmInvitation() {
  const started = useRef(false);
  const [message, setMessage] = useState("Memeriksa undangan Anda…");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    // Never persist tokens in browser storage or retain them in the address bar.
    window.history.replaceState(null, "", window.location.pathname);
    async function confirm() {
      const access_token = fragment.get("access_token");
      const refresh_token = fragment.get("refresh_token");
      if (fragment.get("type") !== "invite" || !access_token || !refresh_token)
        throw new Error("Tautan tidak valid atau kedaluwarsa. Hubungi HR.");
      const response = await fetch("/api/v1/auth/confirm", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-HRIS-Request": "1" },
        body: JSON.stringify({ access_token, refresh_token }),
      });
      const result = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "Undangan belum dapat diverifikasi.",
        );
      window.location.replace("/auth/recovery");
    }
    void confirm().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "Verifikasi gagal."),
    );
  }, []);
  return (
    <main
      className="login-shell"
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <section className="login-card" style={{ maxWidth: 440, width: "100%" }}>
        <div className="eyebrow">PEOPLESPACE HRIS</div>
        <h1>Konfirmasi undangan</h1>
        <p role="status">{message}</p>
        <Link href="/">Kembali ke halaman masuk</Link>
      </section>
    </main>
  );
}
