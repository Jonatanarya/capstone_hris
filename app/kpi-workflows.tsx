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
  kpiPublishIssues,
  commonKpiEvidence,
  validateIndicators,
  type KpiDto,
  type KpiIndicator,
  type KpiGoalDto,
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
  separateEvidence: boolean;
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
  const evaluator = role === "Admin HR";
  const editor = manager || evaluator;
  const [goals, setGoals] = useState<KpiGoalDto[]>([]);
  const [targets, setTargets] = useState<{ id: string; name: string }[]>([]);
  const [share, setShare] = useState<KpiDto | null>(null);
  const editorRef = useRef<HTMLFormElement>(null);
  const requestSequence = useRef(0);
  useEffect(() => {
    if (!form?.employeeId) return;
    const incomplete = editorRef.current?.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >('[data-kpi-incomplete="true"]');
    if (incomplete) incomplete.focus();
    else editorRef.current?.scrollIntoView({ block: "start" });
  }, [form?.employeeId, form?.separateEvidence]);
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    setRows([]);
    setGoals([]);
    setTargets([]);
    try {
      const [data, plans, allowed] = await Promise.all([
        hrApi.kpis(period),
        hrApi.kpiGoals(period),
        editor ? hrApi.kpiTargets() : Promise.resolve([]),
      ]);
      if (sequence === requestSequence.current) {
        setRows(data);
        setGoals(plans);
        setTargets(allowed.filter((e) => e.id !== ownId));
      }
    } catch (e) {
      if (sequence === requestSequence.current) setError(errorMessage(e));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [period, editor, ownId]);
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
      indicators: row
        ? structuredClone(row.indicators).map((item) =>
            manager ? { ...item, actual: null, evidence: "" } : item,
          )
        : kpiTemplate(),
      notes: manager ? "" : (row?.notes ?? ""),
      version: row?.version ?? null,
      separateEvidence: !!row && commonKpiEvidence(row.indicators) === null,
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
  const openPublishConfirmation = async (row: KpiDto) => {
    const review = (await hrApi.performanceReviews(period)).find(
      (r) => r.employeeId === row.employeeId,
    );
    setConfirm({
      row,
      reviewVersion: review?.version ?? null,
      previousScore: review?.score ?? null,
    });
  };
  const save = async (forPublication = false) => {
    if (
      !form ||
      busy ||
      !validateIndicators(form.indicators) ||
      (forPublication &&
        (!evaluator || kpiPublishIssues(form.indicators).length))
    )
      return;
    setBusy(true);
    let saved: KpiDto | null = null;
    try {
      saved = await hrApi.saveKpi({
        employeeId: form.employeeId,
        period,
        indicators: form.indicators,
        notes: form.notes,
        expectedVersion: form.version,
      });
      setForm(null);
      toast.success(
        manager
          ? "Draf target tersimpan. Bagikan agar dapat dinilai Admin HR."
          : "Draf penilaian tersimpan. Nilai belum final.",
      );
      await load();
      if (forPublication) await openPublishConfirmation(saved);
    } catch (e) {
      toast.error((saved ? "Draf sudah tersimpan. " : "") + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const shareGoals = async () => {
    if (!share || busy) return;
    setBusy(true);
    try {
      await hrApi.shareKpiGoals(share.id, share.version);
      setShare(null);
      setForm(null);
      toast.success(
        "Target dibagikan. Target dan bobot terkunci; realisasi tetap privat sampai final.",
      );
      await load();
    } catch (e) {
      setShare(null);
      toast.error(errorMessage(e));
      await load();
    } finally {
      setBusy(false);
    }
  };
  const preparePublish = async (row: KpiDto) => {
    if (busy || form || kpiPublishIssues(row.indicators).length) return;
    setBusy(true);
    try {
      await openPublishConfirmation(row);
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
  const targetLocked =
    !manager ||
    !!rows.find((r) => r.employeeId === form?.employeeId)?.goalsSharedAt;
  const availableTargets = targets.filter(
    (e) =>
      !goals.some((g) => g.employeeId === e.id) &&
      !rows.some(
        (r) =>
          r.employeeId === e.id &&
          (r.status === "PUBLISHED" || !!r.goalsSharedAt),
      ),
  );
  const average = published.length
    ? Math.round(
        published.reduce((sum, r) => sum + r.score!, 0) / published.length,
      )
    : null;
  const formIssues = form
    ? kpiPublishIssues(form.indicators, !form.separateEvidence)
    : [];
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
                  setShare(null);
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
              setShare(null);
              void load();
            }}
          >
            Muat ulang KPI
          </Button>
          {manager && (
            <Button
              disabled={busy || loading || !!error || !availableTargets.length}
              onClick={() => edit(availableTargets[0].id)}
            >
              <Plus size={16} /> Susun target bulanan
            </Button>
          )}
        </div>
        <p className="kpi-help">
          {manager
            ? "Tetapkan dan bagikan target bulanan tim. Setelah dibagikan, target terkunci. Admin HR mengisi realisasi dan menerbitkan nilai; Anda memantau hasilnya."
            : role === "Admin HR"
              ? "Kelola penilaian berdasarkan target yang dibagikan Manager. Isi realisasi dan bukti, lalu terbitkan nilai final. Target tidak dapat diubah dan Anda tidak bisa menilai diri sendiri."
              : "Lihat target yang telah dibagikan dan hasil final milik sendiri. Nilai draf tetap privat."}
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
          {form && editor && (
            <form
              ref={editorRef}
              className="panel kpi-editor"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="workflow-row">
                <h2>
                  {manager ? "Susun target bulanan" : "Isi realisasi KPI"}
                </h2>
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
                  disabled={busy || evaluator}
                  onChange={(e) => edit(e.target.value)}
                >
                  {(manager ? availableTargets : targets)
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
                {manager
                  ? "Sesuaikan nama dan target di bawah. Untuk KPI baru, tiga indikator contoh sudah disiapkan. Bobot dan cara hitung tersedia di Pengaturan lanjutan."
                  : `Isi realisasi ${form.indicators.length} indikator, tulis catatan bukti, lalu Simpan & terbitkan. Target dan perhitungan sudah diatur Manager.`}
              </p>
              {form.indicators.map((item, i) => (
                <fieldset key={i} className="kpi-indicator">
                  <legend>{manager ? `Indikator ${i + 1}` : item.name}</legend>
                  {manager ? (
                    <>
                      <div className="kpi-target-fields">
                        <label>
                          Nama indikator
                          <Input
                            aria-label={`Nama indikator ${i + 1}`}
                            required
                            maxLength={120}
                            value={item.name}
                            disabled={busy || targetLocked}
                            onChange={(e) => patch(i, { name: e.target.value })}
                          />
                        </label>
                        <label>
                          Target ({item.unit})
                          <Input
                            aria-label={`Target ${i + 1}`}
                            type="number"
                            required
                            min="0.000001"
                            max="1000000000"
                            step="any"
                            value={item.target || ""}
                            disabled={busy || targetLocked}
                            onChange={(e) =>
                              patch(i, { target: Number(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                      <details className="kpi-details">
                        <summary>
                          Pengaturan lanjutan indikator {i + 1} · Bobot{" "}
                          {item.weight}%
                        </summary>
                        <div className="kpi-fields">
                          <label>
                            Satuan
                            <Input
                              aria-label={`Satuan ${i + 1}`}
                              required
                              maxLength={30}
                              value={item.unit}
                              disabled={busy || targetLocked}
                              onChange={(e) =>
                                patch(i, { unit: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Arah target
                            <select
                              aria-label={`Arah target ${i + 1}`}
                              value={item.direction}
                              disabled={busy || targetLocked}
                              onChange={(e) =>
                                patch(i, {
                                  direction: e.target
                                    .value as KpiIndicator["direction"],
                                })
                              }
                            >
                              <option value="HIGHER">
                                Lebih tinggi lebih baik
                              </option>
                              <option value="LOWER">
                                Lebih rendah lebih baik
                              </option>
                            </select>
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
                              disabled={busy || targetLocked}
                              onChange={(e) =>
                                patch(i, { weight: Number(e.target.value) })
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Cara mengukur / sumber data
                          <textarea
                            aria-label={`Cara mengukur ${i + 1}`}
                            maxLength={1000}
                            value={item.measurement ?? ""}
                            disabled={busy || targetLocked}
                            onChange={(e) =>
                              patch(i, { measurement: e.target.value })
                            }
                          />
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={
                            busy || form.indicators.length === 1 || targetLocked
                          }
                          onClick={() =>
                            setForm({
                              ...form,
                              indicators: form.indicators.filter(
                                (_, n) => n !== i,
                              ),
                            })
                          }
                        >
                          Hapus indikator {i + 1}
                        </Button>
                      </details>
                    </>
                  ) : (
                    <>
                      <div className="kpi-evaluation-row">
                        <div className="kpi-target-summary">
                          <small>Target dari Manager</small>
                          <strong>
                            {item.target} {item.unit}
                          </strong>
                        </div>
                        <label>
                          Realisasi ({item.unit})
                          <Input
                            aria-label={`Realisasi ${i + 1}`}
                            aria-describedby={
                              item.actual === null
                                ? `kpi-actual-${i}`
                                : undefined
                            }
                            data-kpi-incomplete={
                              item.actual === null || undefined
                            }
                            type="number"
                            min="0"
                            max="1000000000"
                            step="any"
                            placeholder="Isi hasilnya"
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
                          {item.actual === null && (
                            <small
                              id={`kpi-actual-${i}`}
                              className="kpi-field-hint"
                            >
                              Isi 0 jika tidak ada realisasi.
                            </small>
                          )}
                        </label>
                        <div className="kpi-target-summary">
                          <small>Capaian otomatis</small>
                          <strong>
                            {indicatorScore(item)?.toFixed(0) ?? "—"}%
                          </strong>
                        </div>
                      </div>
                      {form.separateEvidence && (
                        <label>
                          Bukti realisasi {i + 1}
                          <textarea
                            aria-label={`Bukti realisasi ${i + 1}`}
                            maxLength={1000}
                            data-kpi-incomplete={
                              !item.evidence?.trim() || undefined
                            }
                            value={item.evidence ?? ""}
                            disabled={busy}
                            placeholder="Keterangan singkat sumber penilaian, tidak perlu unggah file."
                            onChange={(e) =>
                              patch(i, { evidence: e.target.value })
                            }
                          />
                        </label>
                      )}
                      <details className="kpi-details">
                        <summary>Cara penilaian indikator {i + 1}</summary>
                        <p>
                          Bobot {item.weight}% ·{" "}
                          {item.direction === "HIGHER"
                            ? "Semakin tinggi semakin baik"
                            : "Semakin rendah semakin baik"}
                        </p>
                        <p>{item.measurement}</p>
                      </details>
                    </>
                  )}
                </fieldset>
              ))}
              {manager && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    busy || form.indicators.length >= 10 || targetLocked
                  }
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
              )}
              {evaluator && (
                <>
                  {!form.separateEvidence ? (
                    <div className="kpi-common-evidence">
                      <label>
                        Catatan bukti penilaian
                        <textarea
                          aria-label="Catatan bukti penilaian"
                          maxLength={1000}
                          aria-describedby="kpi-common-evidence-help"
                          data-kpi-incomplete={
                            !commonKpiEvidence(form.indicators)?.trim() ||
                            undefined
                          }
                          value={commonKpiEvidence(form.indicators) ?? ""}
                          disabled={busy}
                          placeholder="Contoh: Berdasarkan rekap tugas dan pemeriksaan hasil kerja bulan Oktober."
                          onChange={(e) =>
                            setForm({
                              ...form,
                              indicators: form.indicators.map((item) => ({
                                ...item,
                                evidence: e.target.value,
                              })),
                            })
                          }
                        />
                      </label>
                      <small id="kpi-common-evidence-help" className="kpi-help">
                        Cukup isi sekali. Catatan ini menjadi bukti untuk semua
                        indikator. Tidak perlu unggah file.
                      </small>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          setForm({ ...form, separateEvidence: true })
                        }
                      >
                        Isi bukti per indikator
                      </Button>
                    </div>
                  ) : (
                    <div className="kpi-help">
                      <p>
                        Bukti berbeda per indikator tetap dipertahankan.
                        Lengkapi kolom bukti di atas.
                      </p>
                      {commonKpiEvidence(form.indicators) !== null && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            setForm({ ...form, separateEvidence: false })
                          }
                        >
                          Gunakan satu catatan
                        </Button>
                      )}
                    </div>
                  )}
                  <details className="kpi-details">
                    <summary>Catatan tambahan (opsional)</summary>
                    <label>
                      Catatan KPI
                      <textarea
                        aria-label="Catatan KPI"
                        maxLength={2000}
                        value={form.notes}
                        disabled={busy}
                        onChange={(e) =>
                          setForm({ ...form, notes: e.target.value })
                        }
                      />
                    </label>
                  </details>
                </>
              )}
              <div className="workflow-row">
                {manager && (
                  <strong>
                    Total bobot:{" "}
                    {form.indicators.reduce((sum, i) => sum + i.weight, 0)}% /
                    100%
                  </strong>
                )}
                {evaluator && (
                  <span>
                    Pratinjau nilai:{" "}
                    {kpiScore(form.indicators) ?? "Belum lengkap"}
                  </span>
                )}
              </div>
              {!validateIndicators(form.indicators) && (
                <p role="alert">
                  Isi indikator unik dan valid. Total bobot wajib tepat 100%.
                </p>
              )}
              {evaluator && (
                <div className="kpi-readiness" aria-live="polite">
                  {formIssues.length ? (
                    <>
                      <strong>Lengkapi sebelum diterbitkan</strong>
                      <ul>
                        {formIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                      <p>Draf tetap bisa disimpan meskipun belum lengkap.</p>
                    </>
                  ) : (
                    <p>
                      Realisasi dan bukti sudah lengkap. Klik Simpan &
                      terbitkan, lalu periksa konfirmasi nilai final.
                    </p>
                  )}
                </div>
              )}
              <div className="workflow-row kpi-save-actions">
                {evaluator && (
                  <Button
                    type="button"
                    disabled={busy || !!formIssues.length}
                    onClick={() => void save(true)}
                  >
                    <CheckCircle2 size={16} /> Simpan & terbitkan
                  </Button>
                )}
                <Button
                  type="submit"
                  variant={manager ? "default" : "outline"}
                  disabled={busy || !validateIndicators(form.indicators)}
                >
                  {manager ? "Simpan draf target" : "Simpan draf KPI"}
                </Button>
              </div>
              <small>
                {manager
                  ? "Bagikan target melalui kartu draf setelah disimpan."
                  : "Simpan draf jika belum selesai. Nilai hanya diterbitkan setelah Anda menyetujui konfirmasi."}
              </small>
            </form>
          )}
          {!rows.length && !goals.length && !form && (
            <div className="panel kpi-empty">
              <Target size={32} />
              <h2>
                Belum ada KPI{" "}
                {role === "Karyawan" ? "final" : "pada periode ini"}
              </h2>
              <p>
                Nilai tidak dibuat otomatis.{" "}
                {manager
                  ? "Mulai dari Susun target bulanan untuk menentukan target tim."
                  : "Hasil akan muncul setelah Admin HR menerbitkan penilaian. Target ditentukan Manager."}
              </p>
            </div>
          )}
          <div className="cards-grid">
            {goals
              .filter((g) => !rows.some((r) => r.id === g.id))
              .map((goal) => (
                <article className="panel kpi-card" key={goal.id}>
                  <h2>{goal.employeeName || "Target KPI saya"}</h2>
                  <span className="kpi-badge">Target dibagikan</span>
                  <p>Target periode {goal.period}. Penilaian belum final.</p>
                  {goal.indicators.map((item, i) => (
                    <div className="kpi-result" key={i}>
                      <strong>{item.name}</strong>
                      <div>
                        Target {item.target} {item.unit} · Bobot {item.weight}%
                        ·{" "}
                        {item.direction === "HIGHER"
                          ? "Lebih tinggi lebih baik"
                          : "Lebih rendah lebih baik"}
                      </div>
                      <p>{item.measurement}</p>
                    </div>
                  ))}
                </article>
              ))}
            {rows.map((row) => {
              const canEvaluate = targets.some((e) => e.id === row.employeeId);
              const commonEvidence = commonKpiEvidence(row.indicators);
              const publishIssues = kpiPublishIssues(
                row.indicators,
                commonEvidence !== null,
              );
              const readinessId = `kpi-readiness-${row.id}`;
              return (
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
                      <div>
                        Target {item.target} {item.unit} · Realisasi{" "}
                        {item.actual ?? "—"} {item.unit}
                      </div>
                      <details className="kpi-details">
                        <summary>Detail penilaian</summary>
                        <p>
                          Bobot {item.weight}% ·{" "}
                          {item.direction === "HIGHER"
                            ? "↑ Lebih tinggi"
                            : "↓ Lebih rendah"}
                        </p>
                        <p>
                          Capaian {indicatorScore(item)?.toFixed(1) ?? "—"}%
                        </p>
                        {item.measurement && (
                          <p>Cara mengukur: {item.measurement}</p>
                        )}
                      </details>
                      {commonEvidence === null && item.evidence && (
                        <p>Bukti: {item.evidence}</p>
                      )}
                    </div>
                  ))}
                  {commonEvidence?.trim() && (
                    <p className="kpi-note">Catatan bukti: {commonEvidence}</p>
                  )}
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
                  {evaluator && row.status === "DRAFT" && (
                    <div id={readinessId} className="kpi-readiness">
                      {row.employeeId === ownId ? (
                        <p>
                          KPI diri sendiri hanya dapat dinilai dan diterbitkan
                          oleh Admin HR lain.
                        </p>
                      ) : !canEvaluate ? (
                        <p>
                          Penilaian tidak tersedia untuk karyawan ini. Pastikan
                          akun karyawan aktif dan termasuk cakupan penilaian
                          Anda.
                        </p>
                      ) : !row.goalsSharedAt ? (
                        <p>
                          Menunggu Manager membagikan target. Setelah dibagikan,
                          Admin HR dapat mengisi realisasi dan menerbitkan KPI.
                        </p>
                      ) : (
                        <>
                          <strong>
                            {publishIssues.length || form
                              ? "Belum bisa diterbitkan"
                              : "Siap diterbitkan"}
                          </strong>
                          {!!publishIssues.length && (
                            <>
                              <ul>
                                {publishIssues.map((issue) => (
                                  <li key={issue}>{issue}</li>
                                ))}
                              </ul>
                              <p>Klik Isi realisasi KPI untuk melengkapinya.</p>
                            </>
                          )}
                          {form ? (
                            <p>
                              Editor sedang terbuka. Simpan draf atau tutup
                              editor sebelum menerbitkan KPI.
                            </p>
                          ) : !publishIssues.length ? (
                            <p>
                              Realisasi dan bukti seluruh indikator sudah
                              lengkap.
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                  {editor &&
                    targets.some((e) => e.id === row.employeeId) &&
                    row.status === "DRAFT" &&
                    (manager ? !row.goalsSharedAt : !!row.goalsSharedAt) && (
                      <div className="workflow-row">
                        {manager && !row.goalsSharedAt && (
                          <Button
                            variant="outline"
                            disabled={
                              busy ||
                              !!form ||
                              row.indicators.some((i) => !i.measurement?.trim())
                            }
                            onClick={() => setShare(row)}
                          >
                            Bagikan target KPI
                          </Button>
                        )}
                        {row.goalsSharedAt && (
                          <small>Target sudah dibagikan · Terkunci</small>
                        )}
                        <Button
                          variant="outline"
                          disabled={busy || !!form}
                          onClick={() => edit(row.employeeId)}
                        >
                          {manager
                            ? "Edit target bulanan"
                            : "Isi realisasi KPI"}
                        </Button>
                        {evaluator && (
                          <Button
                            aria-describedby={readinessId}
                            disabled={
                              busy ||
                              !row.goalsSharedAt ||
                              !!publishIssues.length ||
                              !!form
                            }
                            onClick={() => void preparePublish(row)}
                          >
                            <CheckCircle2 size={16} /> Terbitkan KPI
                          </Button>
                        )}
                      </div>
                    )}
                </article>
              );
            })}
          </div>
        </>
      )}
      <div className="panel kpi-help">
        <strong>Memahami nilai KPI</strong>
        <p>
          Nilai dihitung otomatis, maksimal 100. Bobot menentukan seberapa besar
          pengaruh tiap indikator terhadap nilai akhir.
        </p>
        <p>
          Contoh: selesai 8 dari target 10 tugas = capaian 80%. Jika bobotnya
          50%, indikator ini menyumbang 40 poin. Untuk target yang ingin
          dikurangi, seperti jumlah kesalahan, semakin sedikit semakin baik.
        </p>
        <p>
          90–100: Sangat baik · 75–89: Baik · 60–74: Cukup · Di bawah 60: Perlu
          peningkatan.
        </p>
        <p>KPI tidak otomatis mengubah gaji atau bonus.</p>
      </div>
      <Dialog
        open={!!share}
        onOpenChange={(open) => {
          if (!open && !busy) setShare(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bagikan target KPI?</DialogTitle>
            <DialogDescription>
              Target, bobot, dan cara mengukur akan terlihat oleh pemilik KPI
              dan terkunci. Realisasi, bukti, catatan, dan nilai draf tidak
              dibagikan. Gunakan periode berikutnya untuk target baru.
            </DialogDescription>
          </DialogHeader>
          <Button disabled={busy} onClick={() => void shareGoals()}>
            Ya, bagikan target KPI
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setShare(null)}
          >
            Batal
          </Button>
        </DialogContent>
      </Dialog>
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
              Nilai {confirm ? kpiScore(confirm.row.indicators) : "—"}/100 untuk{" "}
              {confirm?.row.employeeName ||
                employees.find((e) => e.id === confirm?.row.employeeId)?.name ||
                "karyawan ini"}{" "}
              akan terlihat oleh karyawan dan menjadi nilai penilaian kinerja
              periode {period}. Setelah final, indikator dan nilai tidak dapat
              diubah.
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
