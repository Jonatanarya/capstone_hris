"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hrApi } from "@/lib/api-client";
import Link from "next/link";

export default function RecoveryForm({
  valid,
  invitation,
}: {
  valid: boolean;
  invitation: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await hrApi.recoverPassword(password);
      setDone(true);
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pemulihan gagal.");
    } finally {
      setBusy(false);
    }
  }
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
        <h1>
          {done
            ? "Kata sandi tersimpan"
            : invitation
              ? "Aktifkan akun Anda"
              : "Atur kata sandi baru"}
        </h1>
        {!valid || done ? (
          <p>
            {done
              ? "Silakan masuk menggunakan kata sandi baru."
              : "Tautan tidak valid atau kedaluwarsa. Buka tautan dari email terbaru atau minta ulang kepada HR."}
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Kata sandi baru
              <Input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Konfirmasi kata sandi
              <Input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            {message && <p role="alert">{message}</p>}
            <Button className="w-full" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan kata sandi"}
            </Button>
          </form>
        )}
        <Link href="/">Kembali ke halaman masuk</Link>
      </section>
    </main>
  );
}
