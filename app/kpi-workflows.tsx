"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Target, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { hrApi, ApiClientError } from "@/lib/api-client";
import {
  indicatorScore,
  kpiScore,
  kpiRating,
  kpiTemplate,
  validateIndicators,
  type KpiDto,
  type KpiIndicator,
} from "@/lib/kpi";
import { toast } from "sonner";

const errorMessage = (error: unknown) =>
  error instanceof ApiClientError && error.fieldErrors
    ? Object.values(error.fieldErrors).flat().join(" · ")
    : error instanceof Error
      ? error.message
      : "Permintaan gagal.";
type Form = {
  employeeId: string;
  indicators: KpiIndicator[];
  notes: string;
  version: number | null;
};
export function KpiWorkflows({
  role,
  ownId,
  employees,
  period,
  onPeriod,
}: {
  role: string;
  ownId: string;
  employees: { id: string; name: string }[];
  period: string;
  onPeriod: (value: string) => void;
}) {
  const [rows, setRows] = useState<KpiDto[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [form, setForm] = useState<Form | null>(null),
    [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{
    row: KpiDto;
    reviewVersion: number | null;
    previousScore: number | null;
  } | null>(null);
  const manager = role === "Manager";
  const requestSequence = useRef(0);
  const targets = employees.filter((e) => e.id !== ownId);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    setRows([]);
    try {
      const data = await hrApi.kpis(period);
      if (sequence === requestSequence.current) setRows(data);
    } catch (e) {
      if (sequence === requestSequence.current) setError(errorMessage(e));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [period]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize with external period-scoped API data.
    void load();
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the latest request counter, not a captured DOM ref.
      requestSequence.current++;
    };
  }, [load]);
  const edit = (employeeId: string) => {
    const row = rows.find((r) => r.employeeId === employeeId);
    if (row?.status === "PUBLISHED") return;
    setForm({
      employeeId,
      indicators: row ? structuredClone(row.indicators) : kpiTemplate(),
      notes: row?.notes ?? "",
      version: row?.version ?? null,
    });
  };
  const patch = (index: number, value: Partial<KpiIndicator>) =>
    setForm(
      (f) =>
        f && {
          ...f,
          indicators: f.indicators.map((item, i) =>
            i === index ? { ...item, ...value } : item,
          ),
        },
    );
  const save = async () => {
    if (!form || busy) return;
    setBusy(true);
    try {
      const row = await hrApi.saveKpi({
        employeeId: form.employeeId,
        period,
        indicators: form.indicators,
        notes: form.notes,
        expectedVersion: form.version,
      });
      setForm((f) => f && { ...f, version: row.version });
      toast.success("Draf KPI tersimpan. Karyawan belum melihat nilai ini.");
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const preparePublish = async (row: KpiDto) => {
    if (busy) return;
    setBusy(true);
    try {
      const review = (await hrApi.performanceReviews(period)).find(
        (r) => r.employeeId === row.employeeId,
      );
      setConfirm({
        row,
        reviewVersion: review?.version ?? null,
        previousScore: review?.score ?? null,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      await hrApi.publishKpi(
        confirm.row.id,
        confirm.row.version,
        confirm.reviewVersion,
      );
      setConfirm(null);
      setForm(null);
      toast.success(
        "KPI final diterbitkan dan nilai penilaian kinerja diperbarui.",
      );
      await load();
    } catch (e) {
      setConfirm(null);
      toast.error(errorMessage(e));
      await load();
    } finally {
      setBusy(false);
    }
  };
  const published = rows.filter((r) => r.status === "PUBLISHED");
  const average = published.length
    ? Math.round(
        published.reduce((sum, r) => sum + r.score!, 0) / published.length,
      )
    : null;
  return (
    <section className="kpi-page">
      <div className="panel kpi-intro">
        <div className="workflow-row">
          <Target size={24} />
          <div>
            <h2>Key Performance Indicator</h2>
            <p>
              Target yang jelas, hasil yang terukur. Penilaian per karyawan dan
              per bulan.
            </p>
          </div>
        </div>
        <div className="workflow-row">
          <label>
            Periode KPI
            <Input
              aria-label="Periode KPI"
              type="month"
              min="2000-01"
              max="2100-12"
              value={period}
              disabled={busy}
              onChange={(e) => {
                if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                  setForm(null);
                  setConfirm(null);
                  onPeriod(e.target.value);
                }
              }}
            />
          </label>
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => {
              setForm(null);
              void load();
            }}
          >
            Muat ulang KPI
          </Button>
          {manager && (
            <Button
              disabled={
                busy ||
                loading ||
                !!error ||
                !targets.some(
                  (e) =>
                    !rows.some(
                      (r) => r.employeeId === e.id && r.status === "PUBLISHED",
                    ),
                )
              }
              onClick={() =>
                edit(
                  targets.find(
                    (e) =>
                      !rows.some(
                        (r) =>
                          r.employeeId === e.id && r.status === "PUBLISHED",
                      ),
                  )!.id,
                )
              }
            >
              <Plus size={16} /> Susun KPI
            </Button>
          )}
        </div>
        <p className="kpi-help">
          {manager
            ? "Susun target dan bobot terlebih dahulu, isi realisasi, lalu terbitkan hasil final. Tidak bisa menilai diri sendiri."
            : role === "Admin HR"
              ? "HR memantau draf dan hasil final. Penetapan target serta penilaian dilakukan Manager departemen."
              : "Anda hanya melihat KPI final milik sendiri. Hubungi Manager untuk target atau evaluasi."}
        </p>
      </div>
      <div className="kpi-summary">
        <div className="panel">
          <small>KPI final</small>
          <strong>{published.length}</strong>
        </div>
        <div className="panel">
          <small>Rata-rata nilai final</small>
          <strong>
            {average ?? "—"}
            <span> / 100</span>
          </strong>
        </div>
        {role !== "Karyawan" && (
          <div className="panel">
            <small>Masih draf</small>
            <strong>{rows.length - published.length}</strong>
          </div>
        )}
      </div>
      {loading ? (
        <p role="status">Memuat KPI…</p>
      ) : error ? (
        <div className="panel" role="alert">
          {error}
          <Button onClick={() => void load()}>Coba kembali</Button>
        </div>
      ) : (
        <>
          {form && manager && (
            <form
              className="panel kpi-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="workflow-row">
                <h2>Susun draf KPI</h2>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setForm(null)}
                >
                  Tutup editor
                </Button>
              </div>
              <label>
                Karyawan KPI
                <select
                  aria-label="Karyawan KPI"
                  value={form.employeeId}
                  disabled={busy}
                  onChange={(e) => edit(e.target.value)}
                >
                  {targets
                    .filter(
                      (e) =>
                        !rows.some(
                          (r) =>
                            r.employeeId === e.id && r.status === "PUBLISHED",
                        ),
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </label>
              <p className="kpi-help">
                Template awal dapat diubah. Realisasi kosong berarti belum
                dinilai, bukan nol. Pilih “Lebih rendah lebih baik” untuk jumlah
                kesalahan atau durasi.
              </p>
              {form.indicators.map((item, i) => (
                <fieldset key={i} className="kpi-indicator">
                  <legend>Indikator {i + 1}</legend>
                  <div className="kpi-fields">
                    <label>
                      Nama indikator
                      <Input
                        aria-label={`Nama indikator ${i + 1}`}
                        required
                        maxLength={120}
                        value={item.name}
                        disabled={busy}
                        onChange={(e) => patch(i, { name: e.target.value })}
                      />
                    </label>
                    <label>
                      Satuan
                      <Input
                        aria-label={`Satuan ${i + 1}`}
                        required
                        maxLength={30}
                        value={item.unit}
                        disabled={busy}
                        onChange={(e) => patch(i, { unit: e.target.value })}
                      />
                    </label>
                    <label>
                      Arah target
                      <select
                        aria-label={`Arah target ${i + 1}`}
                        value={item.direction}
                        disabled={busy}
                        onChange={(e) =>
                          patch(i, {
                            direction: e.target
                              .value as KpiIndicator["direction"],
                          })
                        }
                      >
                        <option value="HIGHER">Lebih tinggi lebih baik</option>
                        <option value="LOWER">Lebih rendah lebih baik</option>
                      </select>
                    </label>
                    <label>
                      Target
                      <Input
                        aria-label={`Target ${i + 1}`}
                        type="number"
                        required
                        min="0.000001"
                        max="1000000000"
                        step="any"
                        value={item.target || ""}
                        disabled={busy}
                        onChange={(e) =>
                          patch(i, { target: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Bobot (%)
                      <Input
                        aria-label={`Bobot ${i + 1}`}
                        type="number"
                        required
                        min="1"
                        max="100"
                        step="1"
                        value={item.weight || ""}
                        disabled={busy}
                        onChange={(e) =>
                          patch(i, { weight: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label>
                      Realisasi
                      <Input
                        aria-label={`Realisasi ${i + 1}`}
                        type="number"
                        min="0"
                        max="1000000000"
                        step="any"
                        placeholder="Belum dinilai"
                        value={item.actual ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          patch(i, {
                            actual:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || form.indicators.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        indicators: form.indicators.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Hapus indikator {i + 1}
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={busy || form.indicators.length >= 10}
                onClick={() =>
                  setForm({
                    ...form,
                    indicators: [
                      ...form.indicators,
                      {
                        name: "",
                        unit: "%",
                        direction: "HIGHER",
                        target: 100,
                        weight: 1,
                        actual: null,
                      },
                    ],
                  })
                }
              >
                Tambah indikator
              </Button>
              <label>
                Catatan KPI
                <textarea
                  aria-label="Catatan KPI"
                  maxLength={2000}
                  value={form.notes}
                  disabled={busy}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <div className="workflow-row">
                <strong>
                  Total bobot:{" "}
                  {form.indicators.reduce((sum, i) => sum + i.weight, 0)}% /
                  100%
                </strong>
                <span>
                  Pratinjau nilai:{" "}
                  {kpiScore(form.indicators) ?? "Belum lengkap"}
                </span>
              </div>
              {!validateIndicators(form.indicators) && (
                <p role="alert">
                  Isi indikator unik dan valid. Total bobot wajib tepat 100%.
                </p>
              )}
              <Button
                type="submit"
                disabled={busy || !validateIndicators(form.indicators)}
              >
                Simpan draf KPI
              </Button>
              <small>
                Terbitkan melalui kartu draf setelah semua perubahan disimpan.
              </small>
            </form>
          )}
          {!rows.length && !form && (
            <div className="panel kpi-empty">
              <Target size={32} />
              <h2>
                Belum ada KPI{" "}
                {role === "Karyawan" ? "final" : "pada periode ini"}
              </h2>
              <p>
                Nilai tidak dibuat otomatis.{" "}
                {manager
                  ? "Mulai dari Susun KPI untuk menentukan target tim."
                  : "Hasil akan muncul setelah Manager menyelesaikan penilaian."}
              </p>
            </div>
          )}
          <div className="cards-grid">
            {rows.map((row) => (
              <article className="panel kpi-card" key={row.id}>
                <div className="workflow-row">
                  <h2>
                    {row.employeeName ||
                      employees.find((e) => e.id === row.employeeId)?.name ||
                      "Karyawan"}
                  </h2>
                  <span
                    className={`kpi-badge ${row.status === "PUBLISHED" ? "final" : ""}`}
                  >
                    {row.status === "PUBLISHED" ? "Final" : "Draf"}
                  </span>
                </div>
                <div className="score">
                  {row.score ?? kpiScore(row.indicators) ?? "—"}
                  <span> / 100</span>
                </div>
                <p>
                  {row.status === "PUBLISHED"
                    ? kpiRating(row.score!)
                    : "Pratinjau, belum diterbitkan"}
                </p>
                {row.indicators.map((item, i) => (
                  <div className="kpi-result" key={i}>
                    <strong>{item.name}</strong>
                    <small>
                      Bobot {item.weight}% ·{" "}
                      {item.direction === "HIGHER"
                        ? "↑ Lebih tinggi"
                        : "↓ Lebih rendah"}
                    </small>
                    <div>
                      Target {item.target} {item.unit} · Realisasi{" "}
                      {item.actual ?? "—"} {item.unit}
                    </div>
                    <small>
                      Capaian {indicatorScore(item)?.toFixed(1) ?? "—"}%
                    </small>
                  </div>
                ))}
                {row.notes && <p className="kpi-note">{row.notes}</p>}
                {row.publishedAt && (
                  <small>
                    Final{" "}
                    {new Date(row.publishedAt).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}{" "}
                    WIB · Terkunci
                  </small>
                )}
                {manager && row.status === "DRAFT" && (
                  <div className="workflow-row">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => edit(row.employeeId)}
                    >
                      Edit draf KPI
                    </Button>
                    <Button
                      disabled={
                        busy ||
                        kpiScore(row.indicators) === null ||
                        form?.employeeId === row.employeeId
                      }
                      onClick={() => void preparePublish(row)}
                    >
                      <CheckCircle2 size={16} /> Terbitkan KPI
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <div className="panel kpi-help">
        <strong>Cara menghitung</strong>
        <p>
          Capaian = realisasi ÷ target × 100 untuk target lebih tinggi; target ÷
          realisasi × 100 untuk target lebih rendah (realisasi 0 = 100%).
          Capaian dibatasi 100%. Nilai akhir = jumlah capaian × bobot,
          dibulatkan ke bilangan bulat.
        </p>
        <p>
          ≥90 Sangat baik · ≥75 Baik · ≥60 Cukup · &lt;60 Perlu peningkatan. KPI
          tidak otomatis mengubah gaji atau bonus.
        </p>
      </div>
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terbitkan KPI final?</DialogTitle>
            <DialogDescription>
              Nilai {confirm ? kpiScore(confirm.row.indicators) : "—"}/100 akan
              terlihat oleh karyawan dan menjadi nilai penilaian kinerja periode{" "}
              {period}. Setelah final, indikator dan nilai tidak dapat diubah.
            </DialogDescription>
          </DialogHeader>
          {confirm?.previousScore !== null &&
            confirm?.previousScore !== undefined && (
              <p>
                Penilaian lama {confirm.previousScore}/100 akan diganti hasil
                KPI. Riwayat perubahan tercatat di audit HR.
              </p>
            )}
          <Button disabled={busy} onClick={() => void publish()}>
            Ya, terbitkan KPI final
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            Batal
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
