"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileChartColumn, UserRoundSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { hrApi } from "@/lib/api-client";
import { csvCell } from "@/lib/hris";
import { kpiRating } from "@/lib/kpi";
import {
  applicantScore,
  monthlySummary,
  monthlyHeaders,
  monthlyCells,
  type Applicant,
  type MonthlyReportRow,
} from "@/lib/lecturer-revision";
import { toast } from "sonner";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "Data gagal dimuat";
const monthLabel = (period: string) =>
  new Date(`${period}-01T12:00:00Z`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
function csvDownload(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function useRevisionData<T>(fetcher: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError("");
    setRows([]);
    try {
      const data = await fetcher();
      if (id === seq.current) setRows(data);
    } catch (e) {
      if (id === seq.current) setError(message(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [fetcher]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch period-scoped external data and invalidate stale requests.
    void load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Request sequence counter, not a DOM ref; invalidate the newest request.
      seq.current++;
    };
  }, [load]);
  return { rows, setRows, loading, error, load };
}

export function MonthlyPerformance({
  role,
  period,
  onPeriod,
  live,
  demoRows,
}: {
  role: string;
  period: string;
  onPeriod: (s: string) => void;
  live: boolean;
  demoRows: MonthlyReportRow[];
}) {
  const fetcher = useCallback(
    () => (live ? hrApi.monthlyPerformance(period) : Promise.resolve(demoRows)),
    [live, period, demoRows],
  );
  const { rows, loading, error, load } = useRevisionData(fetcher);
  const [search, setSearch] = useState(""),
    [department, setDepartment] = useState("");
  const filtered = rows.filter(
    (r) =>
      (!department || r.department === department) &&
      `${r.name} ${r.employeeNo}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const summary = monthlySummary(filtered);
  return (
    <section className="revision-page">
      <div className="panel revision-intro">
        <div className="workflow-row">
          <FileChartColumn size={26} />
          <div>
            <h2>Rekap kinerja bulanan</h2>
            <p>
              {role === "Manager"
                ? "Pantau hasil dan kehadiran anggota departemen Anda."
                : "Rekap operasional dan penilaian karyawan dalam satu periode."}
            </p>
          </div>
        </div>
        <div className="revision-toolbar">
          <label>
            Periode rekap
            <Input
              type="month"
              aria-label="Periode rekap"
              min="2000-01"
              max="2100-12"
              value={period}
              onChange={(e) => {
                if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(e.target.value))
                  onPeriod(e.target.value);
              }}
            />
          </label>
          <Input
            aria-label="Cari karyawan pada rekap"
            placeholder="Cari nama atau nomor induk"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Departemen rekap"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Semua departemen</option>
            {[...new Set(rows.map((r) => r.department))].sort().map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            Muat ulang rekap
          </Button>
          <Button
            disabled={loading || !!error || !filtered.length}
            onClick={() =>
              csvDownload(`PeopleSpace-rekap-kinerja-${period}.csv`, [
                monthlyHeaders,
                ...filtered.map(monthlyCells),
              ])
            }
          >
            <Download size={16} /> Unduh rekap CSV
          </Button>
        </div>
        <p className="revision-note">
          {monthLabel(period)} ·{" "}
          {live ? "Data server sesuai hak akses" : "Data contoh lokal"}.
          Kehadiran mengikuti hari kerja, libur, dan tanggal bergabung. Hari
          mendatang tidak dihitung; hari ini baru dianggap tanpa keterangan
          setelah jam kerja berakhir. Kalender memakai kebijakan HR saat laporan
          dibuka.
        </p>
      </div>
      <div className="revision-summary">
        {[
          ["Karyawan", summary.count],
          ["Sudah dinilai", `${summary.scored} / ${summary.count}`],
          [
            "Rata-rata nilai",
            summary.average === null ? "—" : `${summary.average} / 100`,
          ],
          ["Koreksi menunggu", summary.pendingCorrections],
        ].map(([label, value]) => (
          <div className="panel" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {loading ? (
        <p role="status">Memuat rekap bulanan…</p>
      ) : error ? (
        <div className="panel" role="alert">
          {error}
          <Button onClick={() => void load()}>Coba kembali</Button>
        </div>
      ) : (
        <div className="panel revision-table">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Karyawan",
                  "Departemen",
                  "Hari kerja berjalan",
                  "Hadir",
                  "Terlambat",
                  "Cuti / Izin / Sakit",
                  "Tanpa keterangan",
                  "Nilai kinerja",
                  "Tindak lanjut",
                ].map((s) => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell>
                    <strong>{r.name}</strong>
                    <small className="cell-small">
                      {r.employeeNo}
                      {r.employmentStatus === "INACTIVE" ? " · Nonaktif" : ""}
                    </small>
                  </TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{r.workDays}</TableCell>
                  <TableCell>{r.presentDays}</TableCell>
                  <TableCell>{r.lateDays}</TableCell>
                  <TableCell>
                    {r.annualLeaveDays} / {r.permissionDays} / {r.sickDays}
                  </TableCell>
                  <TableCell>{r.absenceDays}</TableCell>
                  <TableCell>
                    {r.score === null ? (
                      <span>Belum dinilai</span>
                    ) : (
                      <>
                        <strong>{r.score} / 100</strong>
                        <small className="cell-small">
                          {kpiRating(r.score)} ·{" "}
                          {r.scoreSource === "LEGACY"
                            ? "Penilaian lama"
                            : "KPI final"}
                        </small>
                      </>
                    )}
                    <small className="cell-small">
                      {r.kpiStatus === "FINAL"
                        ? "Terkunci"
                        : r.kpiStatus === "IN_REVIEW"
                          ? "Target dibagikan · Menunggu final HR"
                          : "Belum ada target dibagikan"}
                    </small>
                  </TableCell>
                  <TableCell>
                    {r.pendingCorrections} koreksi menunggu
                    <small className="cell-small">
                      {r.incompleteDays} belum absen keluar
                    </small>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!filtered.length && (
            <div className="empty">
              <FileChartColumn />
              <strong>Tidak ada karyawan sesuai periode atau filter.</strong>
            </div>
          )}
          <p className="revision-note">
            Hadir sudah termasuk terlambat. Tanpa keterangan berarti belum ada
            absensi atau cuti yang disetujui, bukan keputusan disiplin otomatis.
            Nilai kosong tidak dihitung sebagai nol dalam rata-rata. Rekap ini
            tidak mengubah gaji.
          </p>
        </div>
      )}
    </section>
  );
}

const demoApplicants: Applicant[] = [
  "Aditya Pranawa",
  "Nadira Lestari",
  "Bima Hartanto",
  "Alya Maheswari",
  "Raka Permana",
  "Citra Anggraini",
].map((name, i) => ({
  id: `demo-applicant-${i}`,
  full_name: name,
  position_name: ["Staff Administrasi", "Frontend Developer", "Staff Keuangan"][
    i % 3
  ],
  applied_on: "2026-10-01",
  aptitude_score: 50 + ((i * 17) % 51),
  technical_score: 55 + ((i * 13) % 46),
  interview_score: 60 + ((i * 11) % 41),
  notes: "",
  is_dummy: true,
  version: 1,
}));

export function Recruitment({ role, live }: { role: string; live: boolean }) {
  const fetcher = useCallback(
    () => (live ? hrApi.applicants() : Promise.resolve(demoApplicants)),
    [live],
  );
  const { rows, setRows, loading, error, load } = useRevisionData(fetcher);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Semua"),
    [form, setForm] = useState<Applicant | null>(null),
    [busy, setBusy] = useState(false);
  const filtered = rows.filter(
    (a) =>
      `${a.full_name} ${a.position_name}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (filter === "Semua" ||
        (applicantScore(a) >= 75 ? "Lulus simulasi" : "Perlu evaluasi") ===
          filter),
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || busy || role !== "Admin HR") return;
    setBusy(true);
    try {
      if (live) {
        await hrApi.updateApplicant(form.id, {
          aptitudeScore: form.aptitude_score,
          technicalScore: form.technical_score,
          interviewScore: form.interview_score,
          notes: form.notes,
          expectedVersion: form.version,
        });
        await load();
      } else
        setRows(
          rows.map((r) =>
            r.id === form.id ? { ...form, version: form.version + 1 } : r,
          ),
        );
      setForm(null);
      toast.success(
        live
          ? "Skor simulasi tersimpan"
          : "Skor contoh berubah untuk sesi ini saja",
      );
    } catch (err) {
      toast.error(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="revision-page">
      <div className="panel revision-intro">
        <div className="workflow-row">
          <UserRoundSearch size={26} />
          <div>
            <h2>Tes pelamar baru</h2>
            <p>Ringkasan skor seleksi untuk demonstrasi Capstone.</p>
          </div>
          <span className="kpi-badge">Data Dummy</span>
        </div>
        <p className="revision-note">
          Semua nama dan nilai adalah data fiktif. Nilai awal diacak sekali dan
          disimpan, bukan berubah setiap halaman dibuka. Rata-rata tiga tes
          berbobot sama; minimal 75 diberi label lulus simulasi, bukan keputusan
          penerimaan kerja. Pelamar tidak otomatis menjadi karyawan.
          {!live && " Mode lokal: perubahan hanya untuk sesi ini."}
        </p>
        <div className="revision-toolbar">
          <Input
            aria-label="Cari pelamar"
            placeholder="Cari nama atau posisi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Hasil seleksi simulasi"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["Semua", "Lulus simulasi", "Perlu evaluasi"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            Muat ulang pelamar
          </Button>
        </div>
      </div>
      <div className="revision-summary">
        <div className="panel">
          <small>Pelamar fiktif</small>
          <strong>{rows.length}</strong>
        </div>
        <div className="panel">
          <small>Lulus simulasi</small>
          <strong>{rows.filter((a) => applicantScore(a) >= 75).length}</strong>
        </div>
        <div className="panel">
          <small>Hak akses</small>
          <strong className="revision-role">
            {role === "Admin HR" ? "Kelola skor" : "Pantau saja"}
          </strong>
        </div>
      </div>
      {loading ? (
        <p role="status">Memuat pelamar…</p>
      ) : error ? (
        <div role="alert" className="panel">
          {error}
          <Button onClick={() => void load()}>Coba kembali</Button>
        </div>
      ) : (
        <div className="panel revision-table">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Pelamar",
                  "Posisi",
                  "Tes potensi",
                  "Tes teknis",
                  "Wawancara",
                  "Rata-rata",
                  "Hasil simulasi",
                  ...(role === "Admin HR" ? ["Aksi"] : []),
                ].map((s) => (
                  <TableHead key={s}>{s}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <strong>{a.full_name}</strong>
                    <small className="cell-small">
                      {a.applied_on} · Fiktif
                    </small>
                    {a.notes && <small className="cell-small">{a.notes}</small>}
                  </TableCell>
                  <TableCell>{a.position_name}</TableCell>
                  <TableCell>{a.aptitude_score}</TableCell>
                  <TableCell>{a.technical_score}</TableCell>
                  <TableCell>{a.interview_score}</TableCell>
                  <TableCell>
                    <strong>{applicantScore(a)} / 100</strong>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`kpi-badge ${applicantScore(a) >= 75 ? "final" : ""}`}
                    >
                      {applicantScore(a) >= 75
                        ? "Lulus simulasi"
                        : "Perlu evaluasi"}
                    </span>
                  </TableCell>
                  {role === "Admin HR" && (
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Edit skor ${a.full_name}`}
                        onClick={() => setForm({ ...a })}
                      >
                        Edit skor
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!filtered.length && (
            <div className="empty">
              <UserRoundSearch />
              <strong>Tidak ada pelamar sesuai filter.</strong>
            </div>
          )}
        </div>
      )}
      <Dialog
        open={!!form}
        onOpenChange={(open) => {
          if (!open && !busy) setForm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit skor simulasi</DialogTitle>
            <DialogDescription>
              {form?.full_name} · Nilai 0–100, bukan data tes nyata.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form className="revision-form" onSubmit={(e) => void save(e)}>
              {(
                [
                  ["aptitude_score", "Tes potensi"],
                  ["technical_score", "Tes teknis"],
                  ["interview_score", "Wawancara"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <Input
                    aria-label={label}
                    type="number"
                    required
                    min={0}
                    max={100}
                    step={1}
                    disabled={busy}
                    value={Number.isNaN(form[key]) ? "" : form[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]:
                          e.target.value === "" ? NaN : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Catatan simulasi
                <textarea
                  aria-label="Catatan simulasi"
                  maxLength={1000}
                  value={form.notes}
                  disabled={busy}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <p>
                Rata-rata:{" "}
                {Number.isNaN(applicantScore(form))
                  ? "—"
                  : applicantScore(form)}{" "}
                / 100
              </p>
              <Button disabled={busy} type="submit">
                Simpan skor simulasi
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
