"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  Clock3,
  Download,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  hrApi,
  ApiClientError,
  type Me,
  type HrPolicy,
  type PersonalPayslip,
  type AttendanceCorrection,
  type NotificationDto,
  type AuditDto,
} from "@/lib/api-client";
import { labelFromPeriod, leaveStatusLabel, wibTime } from "@/lib/api-adapters";
import { offsetDate } from "@/lib/workflows";
import { toast } from "sonner";

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
const message = (error: unknown) => {
  if (error instanceof ApiClientError && error.fieldErrors) {
    const detail = Object.values(error.fieldErrors).flat().join(" · ");
    if (detail) return detail;
  }
  return error instanceof Error
    ? error.message
    : "Permintaan gagal. Coba kembali.";
};
function LoadingError({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return loading ? (
    <p role="status">Memuat data…</p>
  ) : error ? (
    <div role="alert">
      <p>{error}</p>
      <Button variant="outline" onClick={retry}>
        <RefreshCw size={16} /> Coba kembali
      </Button>
    </div>
  ) : null;
}

export function LiveNotifications({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  const [rows, setRows] = useState<NotificationDto[]>([]);
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await hrApi.notifications());
    } catch (e) {
      setRows([]);
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Subscribe to external API data on mount.
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [load]);
  const unread = rows.filter((r) => !r.read).length;
  const read = async (ids: string[]) => {
    setBusy(true);
    try {
      await hrApi.readNotifications(ids);
      setRows((rs) =>
        rs.map((r) => (ids.includes(r.id) ? { ...r, read: true } : r)),
      );
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        className="icon-button"
        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="notification-count">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal-content">
          <DialogHeader>
            <DialogTitle>Notifikasi</DialogTitle>
            <DialogDescription>
              Persetujuan, slip gaji, koreksi absensi, dan penilaian yang
              relevan untuk akun Anda.
            </DialogDescription>
          </DialogHeader>
          <LoadingError
            loading={loading}
            error={error}
            retry={() => void load()}
          />
          {!loading && !error && (
            <>
              <Button
                variant="outline"
                disabled={busy || !unread}
                onClick={() =>
                  void read(rows.filter((r) => !r.read).map((r) => r.id))
                }
              >
                Tandai semua dibaca
              </Button>
              <div className="workflow-notifications">
                {rows.map((r) => (
                  <button
                    key={r.id}
                    className="notification-row"
                    disabled={busy}
                    onClick={async () => {
                      if (!r.read) await read([r.id]);
                      setOpen(false);
                      onNavigate(r.view);
                    }}
                  >
                    <Bell size={18} />
                    <div>
                      <strong>
                        {!r.read && "● "}
                        {r.title}
                      </strong>
                      <small>{r.message}</small>
                      <small>
                        {new Date(r.at).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                        })}{" "}
                        WIB
                      </small>
                    </div>
                  </button>
                ))}
              </div>
              {!rows.length && <p>Belum ada notifikasi untuk akun ini.</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PersonalServices({
  session,
  today,
}: {
  session: Me;
  today: string;
}) {
  const [slips, setSlips] = useState<PersonalPayslip[]>([]),
    [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<PersonalPayslip | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, c] = await Promise.all([
        hrApi.personalPayslips(),
        hrApi.corrections(),
      ]);
      setSlips(s);
      setCorrections(c);
    } catch (e) {
      setSlips([]);
      setCorrections([]);
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Subscribe to external API data on mount.
    void load();
  }, [load]);
  const request = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await hrApi.requestCorrection({
        workDate: String(data.get("date")),
        checkIn: String(data.get("in")),
        checkOut: String(data.get("out") ?? ""),
        reason: String(data.get("reason")),
      });
      form.reset();
      toast.success(
        "Koreksi diajukan. Catatan absensi berubah hanya setelah disetujui HR.",
      );
      await load();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  const decide = async (
    event: FormEvent<HTMLFormElement>,
    row: AttendanceCorrection,
  ) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const decision = (
      (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement
    )?.value;
    if (!decision) return;
    setBusy(true);
    try {
      await hrApi.decideCorrection(
        row.id,
        decision,
        String(data.get("note")),
        row.version,
      );
      toast.success("Keputusan koreksi tersimpan");
      await load();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  const password = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("new"));
    if (next !== data.get("confirm")) {
      toast.error("Konfirmasi password tidak sama");
      return;
    }
    setBusy(true);
    try {
      await hrApi.changePassword(String(data.get("current")), next);
      form.reset();
      toast.success(
        "Password diubah. Silakan masuk kembali dengan NIM dan password baru.",
      );
      window.location.reload();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="workflow-stack">
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <Wallet size={18} /> Slip gaji pribadi
          </h2>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading || busy}
          >
            Muat ulang
          </Button>
        </div>
        <p className="muted">
          Hanya slip milik {session.employee.fullName} yang sudah diterbitkan
          HR. Draft dan gaji rekan tidak ditampilkan.
        </p>
        <LoadingError
          loading={loading}
          error={error}
          retry={() => void load()}
        />
        {!loading &&
          !error &&
          (!slips.length ? (
            <div className="empty">
              <Wallet />
              <strong>Belum ada slip gaji pribadi</strong>
              <p>
                HR perlu melengkapi gaji pokok dan menerbitkan payroll terlebih
                dahulu.
              </p>
            </div>
          ) : (
            slips.map((s) => (
              <div className="workflow-row" key={s.id}>
                <div>
                  <strong>{labelFromPeriod(s.period)}</strong>
                  <p>{rupiah(s.netSalaryIdr)} · Diterbitkan</p>
                </div>
                <Button variant="outline" onClick={() => setSelected(s)}>
                  Lihat slip
                </Button>
              </div>
            ))
          ))}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <Clock3 size={18} /> Koreksi absensi
          </h2>
        </div>
        <p className="muted">
          Lupa absen atau salah catatan? Ajukan tanggal dalam 30 hari terakhir.
          HR meninjau alasan; tidak boleh menyetujui koreksi miliknya sendiri.
          Semua waktu WIB.
        </p>
        <form className="workflow-form" onSubmit={request}>
          <label>
            Tanggal
            <Input
              name="date"
              type="date"
              min={offsetDate(today, -30)}
              max={today}
              required
            />
          </label>
          <label>
            Jam masuk
            <Input name="in" type="time" required />
          </label>
          <label>
            Jam keluar (opsional)
            <Input name="out" type="time" />
          </label>
          <label className="full">
            Alasan koreksi
            <textarea name="reason" rows={2} required maxLength={2000} />
          </label>
          <Button type="submit" disabled={busy || loading || !!error}>
            Ajukan koreksi
          </Button>
        </form>
        {!loading && !error && (
          <div>
            {corrections.map((c) => (
              <article key={c.id} className="workflow-card">
                <div className="workflow-row">
                  <strong>
                    {c.employees?.full_name ?? session.employee.fullName} ·{" "}
                    {c.work_date}
                  </strong>
                  <span>{leaveStatusLabel(c.status)}</span>
                </div>
                <p>
                  {wibTime(c.requested_in)} – {wibTime(c.requested_out) || "—"}{" "}
                  WIB · {c.reason}
                </p>
                {c.decision_note && <p>Catatan HR: {c.decision_note}</p>}
                {session.role === "ADMIN_HR" &&
                  c.employee_id !== session.employee.id &&
                  c.status === "PENDING" && (
                    <form
                      className="workflow-form"
                      onSubmit={(e) => void decide(e, c)}
                    >
                      <label className="full">
                        Catatan keputusan
                        <Input name="note" required maxLength={2000} />
                      </label>
                      <label className="full workflow-check">
                        <input type="checkbox" required /> Saya sudah memeriksa
                        jam, alasan, dan tanggal pengajuan.
                      </label>
                      <Button type="submit" value="APPROVED" disabled={busy}>
                        Setujui koreksi
                      </Button>
                      <Button
                        variant="outline"
                        type="submit"
                        value="REJECTED"
                        disabled={busy}
                      >
                        Tolak koreksi
                      </Button>
                    </form>
                  )}
              </article>
            ))}
            {!corrections.length && (
              <p className="muted">Belum ada pengajuan koreksi.</p>
            )}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <ShieldCheck size={18} /> Ganti password
          </h2>
        </div>
        <p className="muted">
          Opsional untuk demo. NIM tetap menjadi identitas login. Alias
          @example.test bukan kotak masuk; reset lewat email tidak tersedia
          untuk alias demo tersebut.
        </p>
        <form className="workflow-form" onSubmit={password}>
          <label className="full">
            Password saat ini
            <Input
              name="current"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            Password baru
            <Input
              name="new"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          <label>
            Konfirmasi password baru
            <Input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          <Button type="submit" disabled={busy}>
            Ganti password dan masuk ulang
          </Button>
        </form>
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="modal-content">
          <DialogHeader>
            <DialogTitle>Slip gaji pribadi</DialogTitle>
            <DialogDescription>
              Snapshot payroll yang sudah diterbitkan.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="payslip">
              <h2>PeopleSpace</h2>
              <p>{labelFromPeriod(selected.period)}</p>
              <strong>
                {selected.fullName} · {selected.employeeNo}
              </strong>
              <p>
                {selected.departmentName} · {selected.positionName}
              </p>
              <div className="workflow-stack">
                {[
                  ["Gaji pokok", selected.baseSalaryIdr],
                  ["Tunjangan", selected.allowanceIdr],
                  ["Bonus", selected.bonusIdr],
                  ["Potongan", selected.deductionIdr],
                  ["Gaji bersih", selected.netSalaryIdr],
                ].map(([label, value]) => (
                  <div className="workflow-row" key={label}>
                    <span>{label}</span>
                    <strong>{rupiah(Number(value))}</strong>
                  </div>
                ))}
              </div>
              <Button onClick={() => window.print()}>
                <Download size={16} /> Cetak atau simpan PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PolicySettings({
  onSaved,
}: {
  onSaved: (policy: HrPolicy) => void;
}) {
  const [policy, setPolicy] = useState<HrPolicy | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPolicy(await hrApi.policy());
    } catch (e) {
      setPolicy(null);
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Subscribe to external API data on mount.
    void load();
  }, [load]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!policy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const saved = await hrApi.updatePolicy({
        expectedVersion: policy.version,
        workStart: String(data.get("start")),
        workEnd: String(data.get("end")),
        workingDays: data.getAll("days").map(Number),
        holidayDates: String(data.get("holidays"))
          .split(/[,\s]+/)
          .filter(Boolean),
        defaultEntitlement: Number(data.get("quota")),
        sickBackdateDays: Number(data.get("sick")),
      });
      setPolicy(saved);
      onSaved(saved);
      toast.success("Kebijakan HR disimpan dan tercatat di audit.");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Kebijakan HR</h2>
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={busy || loading}
        >
          Muat ulang
        </Button>
      </div>
      <LoadingError loading={loading} error={error} retry={() => void load()} />
      {!loading && policy && (
        <form key={policy.version} className="workflow-form" onSubmit={submit}>
          <p className="full muted">
            Zona waktu Asia/Jakarta. Kebijakan berlaku untuk absensi dan
            pengajuan baru; riwayat menyimpan kebijakan saat dibuat. Kuota
            individual yang telah ditetapkan tetap berlaku. Untuk demo akhir
            pekan, pilih hari presentasi sebagai hari kerja lalu kembalikan
            setelah selesai.
          </p>
          <label>
            Jam mulai
            <Input
              name="start"
              type="time"
              defaultValue={policy.workStart}
              required
            />
          </label>
          <label>
            Jam selesai
            <Input
              name="end"
              type="time"
              defaultValue={policy.workEnd}
              required
            />
          </label>
          <fieldset className="full">
            <legend>Hari kerja</legend>
            <div className="workflow-days">
              {[
                "Senin",
                "Selasa",
                "Rabu",
                "Kamis",
                "Jumat",
                "Sabtu",
                "Minggu",
              ].map((day, i) => (
                <label key={day} className="workflow-check">
                  <input
                    type="checkbox"
                    name="days"
                    value={i + 1}
                    defaultChecked={policy.workingDays.includes(i + 1)}
                  />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Kuota cuti tahunan default (hari)
            <Input
              name="quota"
              type="number"
              defaultValue={policy.defaultEntitlement}
              min={0}
              max={60}
              required
            />
          </label>
          <label>
            Batas lapor sakit mundur (hari)
            <Input
              name="sick"
              type="number"
              defaultValue={policy.sickBackdateDays}
              min={0}
              max={30}
              required
            />
          </label>
          <label className="full">
            Tanggal libur (YYYY-MM-DD, pisahkan dengan koma)
            <textarea
              name="holidays"
              rows={3}
              defaultValue={policy.holidayDates.join(", ")}
            />
          </label>
          <label className="full workflow-check">
            <input type="checkbox" required /> Saya memahami perubahan
            memengaruhi aturan absensi dan pengajuan baru.
          </label>
          <Button type="submit" disabled={busy}>
            Simpan kebijakan
          </Button>
        </form>
      )}
    </section>
  );
}

export function AuditLog() {
  const [page, setPage] = useState(1),
    [rows, setRows] = useState<AuditDto[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await hrApi.auditLog(page));
    } catch (e) {
      setRows([]);
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Subscribe to the selected page of external API data.
    void load();
  }, [load]);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Riwayat aktivitas</h2>
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          Muat ulang
        </Button>
      </div>
      <p className="muted">
        Catatan perubahan untuk HR, hanya baca. Password dan token tidak
        ditampilkan.
      </p>
      <LoadingError loading={loading} error={error} retry={() => void load()} />
      {!loading && !error && (
        <>
          <div className="workflow-audit">
            {rows.map((r) => (
              <div key={r.id} className="workflow-card">
                <strong>{r.action}</strong>
                <p>
                  {r.actor_name ?? "Sistem"} ·{" "}
                  {new Date(r.occurred_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB
                </p>
                <small>
                  {r.resource_type} · {r.resource_id ?? "Organisasi"}
                </small>
              </div>
            ))}
            {!rows.length && <p>Belum ada aktivitas pada halaman ini.</p>}
          </div>
          <div className="workflow-row">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Sebelumnya
            </Button>
            <span>Halaman {page}</span>
            <Button
              variant="outline"
              disabled={rows.length < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
