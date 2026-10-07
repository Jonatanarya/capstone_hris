"use client";
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
  type FormEvent,
  type ComponentProps,
  type CSSProperties,
} from "react";
import {
  LayoutDashboard,
  Users,
  Clock3,
  CalendarDays,
  Wallet,
  ChartNoAxesCombined,
  Files,
  Building2,
  BriefcaseBusiness,
  Settings2,
  Bell,
  Search,
  Plus,
  Download,
  ChevronRight,
  LogOut,
  CircleHelp,
  Check,
  X,
  Sun,
  TrendingUp,
  MoreHorizontal,
  Sparkles,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import {
  workingDays,
  availableLeave,
  leaveError,
  csvCell,
  payrollError,
} from "@/lib/hris";
import { isLiveMode } from "@/lib/api-mode";
import { payrollNet, salaryConfigured } from "@/lib/payroll";
import {
  hrApi,
  ApiClientError,
  type Me,
  type DashboardDto,
} from "@/lib/api-client";
import {
  personFromMe,
  personFromDto,
  uiRole,
  backendRole,
  labelFromPeriod,
  attendanceFromDto,
  leaveFromDto,
  leaveTypeCode,
  leaveStatusCode,
  periodFromLabel,
  type MasterDto,
  type AccountDto,
  type PayrollItemDto,
  type PayrollRunDto,
  type PayrollReadinessDto,
} from "@/lib/api-adapters";
type Role = "Admin HR" | "Manager" | "Karyawan";
type Person = {
  id: string;
  name: string;
  email: string;
  dept: string;
  position: string;
  status: string;
  salary: number;
  score: number;
  employeeNo: string;
  phone: string;
  address: string;
  joinDate: string;
};
type Leave = {
  id: string;
  employee: string;
  type: string;
  start: string;
  end: string;
  reason: string;
  status: string;
  submittedAt?: string;
  approver?: string;
  decidedAt?: string;
  rejectionReason?: string;
  version?: number;
};
const seed: Person[] = [
  ["Nadia Putri", "Human Resources", "HR Specialist", 7500000, 92],
  ["Rizky Pratama", "Engineering", "Frontend Developer", 9000000, 88],
  ["Alya Maharani", "Design", "Product Designer", 8500000, 95],
  ["Dimas Saputra", "Engineering", "Backend Developer", 9500000, 86],
  ["Citra Lestari", "Marketing", "Marketing Specialist", 7000000, 90],
  ["Fajar Ramadhan", "Finance", "Finance Analyst", 8000000, 89],
  ["Salsa Amalia", "Design", "UI Designer", 8000000, 91],
  ["Bima Aditya", "Engineering", "QA Engineer", 7500000, 84],
].map((p, i) => ({
  id: String(i + 1),
  name: String(p[0]),
  dept: String(p[1]),
  position: String(p[2]),
  salary: Number(p[3]),
  score: Number(p[4]),
  email: String(p[0]).toLowerCase().replace(" ", ".") + "@peoplespace.demo",
  status: i === 7 ? "Nonaktif" : "Aktif",
  employeeNo: `EMP-${String(i + 1).padStart(3, "0")}`,
  phone: `08120000000${i}`,
  address: "Bandung (alamat contoh)",
  joinDate: "2025-01-06",
}));
const seedLeaves: Leave[] = [
  {
    id: "1",
    employee: "3",
    type: "Cuti tahunan",
    start: "2026-10-05",
    end: "2026-10-06",
    reason: "Keperluan keluarga",
    status: "Menunggu",
  },
  {
    id: "2",
    employee: "2",
    type: "Cuti tahunan",
    start: "2026-10-08",
    end: "2026-10-09",
    reason: "Istirahat bersama keluarga",
    status: "Menunggu",
  },
  {
    id: "3",
    employee: "5",
    type: "Izin",
    start: "2026-10-02",
    end: "2026-10-02",
    reason: "Keperluan pribadi",
    status: "Menunggu",
  },
  {
    id: "4",
    employee: "4",
    type: "Cuti tahunan",
    start: "2026-09-21",
    end: "2026-09-22",
    reason: "Keperluan keluarga",
    status: "Disetujui",
  },
];
const menu = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "employees", label: "Karyawan", icon: Users },
  { id: "attendance", label: "Absensi", icon: Clock3 },
  { id: "leave", label: "Pengajuan cuti", icon: CalendarDays },
  { id: "payroll", label: "Payroll", icon: Wallet },
  { id: "performance", label: "Penilaian kinerja", icon: ChartNoAxesCombined },
  { id: "reports", label: "Laporan", icon: Files },
  { id: "departments", label: "Departemen", icon: Building2 },
  { id: "positions", label: "Jabatan", icon: BriefcaseBusiness },
  { id: "accounts", label: "Akun pengguna", icon: Settings2 },
  { id: "profile", label: "Profil saya", icon: Users },
];
const money = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const date = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const days = workingDays;
type AttendanceRecord = {
  employee: string;
  date: string;
  checkIn: string;
  checkOut: string;
};
const seedAttendance = (today: string): AttendanceRecord[] => [
  ...seed
    .filter((p) => p.status === "Aktif" && p.id !== "2")
    .map((p) => ({
      employee: p.id,
      date: today,
      checkIn: p.id === "4" ? "08:04" : "07:52",
      checkOut: "",
    })),
  ...seed
    .filter((p) => p.status === "Aktif")
    .map((p) => ({
      employee: p.id,
      date: "2026-09-30",
      checkIn: "07:55",
      checkOut: "17:00",
    })),
];
function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span className={"avatar color-" + (index % 5)}>
      {name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "status " +
        (value === "Menunggu" || value === "Terlambat"
          ? "amber"
          : value === "Ditolak" || value === "Nonaktif"
            ? "red"
            : "green")
      }
    >
      {value}
    </span>
  );
}
function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Choice({
  value,
  change,
  values,
  label,
}: {
  value: string;
  change: (v: string) => void;
  values: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((v) => (
          <SelectItem value={v} key={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function NavigationButton(props: ComponentProps<typeof SidebarMenuButton>) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuButton
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        setOpenMobile(false);
      }}
    />
  );
}
export default function HrisApp({ today }: { today: string }) {
  const live = isLiveMode();
  const [role, setRole] = useState<Role>("Admin HR"),
    [view, setView] = useState("dashboard"),
    [people, setPeople] = useState<Person[]>(live ? [] : seed),
    [leaves, setLeaves] = useState(live ? [] : seedLeaves),
    [search, setSearch] = useState(""),
    [dept, setDept] = useState("Semua departemen"),
    [filter, setFilter] = useState("Semua"),
    [dialog, setDialog] = useState<string | null>(null),
    [selected, setSelected] = useState(seed[0]),
    [selectedLeave, setSelectedLeave] = useState<string | null>(null),
    [masterName, setMasterName] = useState(""),
    [accountRoles, setAccountRoles] = useState<Record<string, Role>>({
      "1": "Admin HR",
      "4": "Manager",
    }),
    [accountStatus, setAccountStatus] = useState<Record<string, string>>({}),
    [signed, setSigned] = useState(!live),
    [checking, setChecking] = useState(live),
    [session, setSession] = useState<Me | null>(null),
    [email, setEmail] = useState(live ? "" : "admin@peoplespace.demo"),
    [password, setPassword] = useState(live ? "" : "demo123"),
    [authBusy, setAuthBusy] = useState(false),
    [records, setRecords] = useState(() => (live ? [] : seedAttendance(today))),
    [attendanceDate, setAttendanceDate] = useState(today),
    [period, setPeriod] = useState(
      live ? labelFromPeriod(today.slice(0, 7)) : "September 2026",
    ),
    [processedPeriods, setProcessedPeriods] = useState<string[]>([]),
    [allowance, setAllowance] = useState(500000),
    [bonus, setBonus] = useState(250000),
    [deduction, setDeduction] = useState(0),
    [pay, setPay] = useState<
      Record<
        string,
        { allowance: number; bonus: number; deduction: number; salary?: number }
      >
    >({}),
    [reviews, setReviews] = useState<
      Record<
        string,
        {
          score: number;
          notes: string;
          assessedAt: string;
          assessor: string;
          version?: number;
        }
      >
    >({}),
    [extraDepts, setExtraDepts] = useState<string[]>([]),
    [extraPositions, setExtraPositions] = useState<string[]>([]),
    [master, setMaster] = useState<MasterDto[]>([]),
    [masterPositions, setMasterPositions] = useState<MasterDto[]>([]),
    [accounts, setAccounts] = useState<AccountDto[]>([]),
    [employeeMeta, setEmployeeMeta] = useState<
      Record<
        string,
        {
          departmentId: string;
          positionId: string;
          version: number;
          contactVersion: number;
        }
      >
    >({}),
    [payItems, setPayItems] = useState<PayrollItemDto[]>([]),
    [payRun, setPayRun] = useState<PayrollRunDto | null>(null),
    [payBusy, setPayBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const [payReadiness, setPayReadiness] = useState<PayrollReadinessDto | null>(
    null,
  );
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [payPeriod, setPayPeriod] = useState("");
  const payrollLoadId = useRef(0);
  const [employeeBusy, setEmployeeBusy] = useState(false);
  const [inviteEmployeeId, setInviteEmployeeId] = useState("");
  const [inviteKeys, setInviteKeys] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);
  const periods = live
    ? Array.from({ length: 12 }, (_, offset) => {
        const date = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
        date.setUTCMonth(date.getUTCMonth() - offset);
        return labelFromPeriod(date.toISOString().slice(0, 7));
      })
    : ["Oktober 2026", "September 2026", "Agustus 2026"];
  // Identitas demo per peran (id seed string). Pada mode terintegrasi, identitas
  // berasal dari sesi Supabase, bukan dari pemilih peran.
  const demoIds: Record<Role, string> = {
    "Admin HR": "1",
    Manager: "4",
    Karyawan: "2",
  };
  const demoLock = ["1", "2", "4"];
  const sessionPerson = useMemo(
    () => (session ? personFromMe(session) : null),
    [session],
  );
  const currentUser: Person = live
    ? (sessionPerson ?? {
        ...seed[0],
        id: "",
        name: "",
        email: "",
        dept: "",
        phone: "",
        address: "",
        salary: 0,
      })
    : (people.find((p) => p.id === demoIds[role]) ?? people[0]);
  const me = live
    ? currentUser
    : (people.find((p) => p.id === "2") ?? currentUser);
  const team =
    role === "Manager"
      ? people.filter((p) => p.dept === currentUser.dept)
      : role === "Karyawan"
        ? [me]
        : people;
  const nav = useMemo(
    () =>
      menu.filter(
        (n) =>
          role === "Admin HR" ||
          (role === "Manager"
            ? [
                "dashboard",
                "employees",
                "attendance",
                "leave",
                "performance",
                "profile",
              ].includes(n.id)
            : [
                "dashboard",
                "attendance",
                "leave",
                "payroll",
                "performance",
                "profile",
              ].includes(n.id)),
      ),
    [role],
  );
  const visibleLeaves = leaves.filter((l) =>
      team.some((p) => p.id === l.employee),
    ),
    pending = visibleLeaves.filter((l) => l.status === "Menunggu");
  const active = team.filter((p) => p.status === "Aktif");
  const payrollPeople: Person[] = live
    ? (payPeriod === periodFromLabel(period) ? payItems : []).map((item) => ({
        id: item.employeeId,
        name: item.fullName,
        employeeNo: item.employeeNo,
        dept: item.departmentName,
        position: item.positionName,
        salary: item.baseSalaryIdr,
        email: "",
        status: "Aktif",
        score: 0,
        phone: "",
        address: "",
        joinDate: "",
      }))
    : role === "Karyawan" && !processedPeriods.includes(period)
      ? []
      : active;
  const remaining = live
    ? (liveBalance ?? "—")
    : availableLeave(leaves, currentUser.id, today.slice(0, 4));
  const mine = records.find(
    (r) => r.employee === currentUser.id && r.date === today,
  );
  const checkIn = mine?.checkIn ?? "",
    checkOut = mine?.checkOut ?? "";
  const present = active.filter((p) =>
    records.some((r) => r.employee === p.id && r.date === today && r.checkIn),
  );
  const processed = live
    ? payPeriod === periodFromLabel(period) && payRun?.status === "PUBLISHED"
    : processedPeriods.includes(period);
  const reviewFor = (p: Person) =>
    reviews[p.id + period] ??
    (!live && period === "September 2026"
      ? {
          score: p.score,
          notes: "Penilaian contoh September",
          assessedAt: "2026-09-30",
          assessor: "Manager demo",
        }
      : undefined);
  const go = useCallback((id: string) => {
    setView(id);
    setSearch("");
    setDept("Semua departemen");
    setFilter("Semua");
  }, []);
  const changeRole = (r: string) => {
    // Pemilih peran hanya untuk mode demo; mode terintegrasi memakai sesi nyata.
    if (live) return;
    setRole(r as Role);
    go("dashboard");
    setDialog(null);
  };
  // Muat sesi nyata saat mode terintegrasi: /me menentukan peran + profil.
  const loadMe = useCallback(async () => {
    try {
      const current = await hrApi.me();
      setSession(current);
      setRole(uiRole(current.role));
      setSigned(true);
    } catch (error) {
      setSession(null);
      setSigned(false);
      if (error instanceof ApiClientError && error.status >= 500) {
        toast.error(error.message);
      }
    } finally {
      setChecking(false);
    }
  }, []);
  const signIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!live) {
      setSigned(true);
      go("dashboard");
      return;
    }
    setAuthBusy(true);
    try {
      const current = await hrApi.login(email.trim(), password);
      setSession(current);
      setRole(uiRole(current.role));
      setSigned(true);
      go("dashboard");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Tidak dapat masuk saat ini",
      );
    } finally {
      setAuthBusy(false);
    }
  };
  const signOut = async () => {
    try {
      if (live) await hrApi.logout();
      setSigned(false);
      setSession(null);
      setPassword("");
      setDialog(null);
      if (live) {
        setPeople([]);
        setLeaves([]);
        setRecords([]);
        setAccounts([]);
        setPayRun(null);
        setPayItems([]);
        setReviews({});
        setEmployeeMeta({});
        setDashboard(null);
        setLiveBalance(null);
        window.location.reload();
      }
    } catch {
      toast.error(
        "Logout gagal. Coba lagi agar sesi server benar-benar berakhir.",
      );
    }
  };
  // --- Aksi mode terintegrasi (memanggil `/api/v1`) ---
  const refreshAttendance = useCallback(async (date: string) => {
    try {
      const rows = await hrApi.attendance(date);
      setRecords((rs) => [
        ...rs.filter((r) => r.date !== date),
        ...rows.map(attendanceFromDto),
      ]);
    } catch (error) {
      if (error instanceof ApiClientError && error.status >= 500) {
        toast.error(error.message);
      }
    }
  }, []);
  const refreshMaster = useCallback(async () => {
    try {
      const [depts, positions] = await Promise.all([
        hrApi.departments({ pageSize: 100 }),
        hrApi.positions({ pageSize: 100 }),
      ]);
      setMaster(depts);
      setMasterPositions(positions);
    } catch (error) {
      if (error instanceof ApiClientError && error.status >= 500) {
        toast.error(error.message);
      }
    }
  }, []);
  const refreshLeaves = useCallback(async (year: number) => {
    try {
      const rows = await hrApi.leaveRequests({ year, pageSize: 100 });
      const nameFor = (userId: string | null) => {
        if (!userId) return undefined;
        return "Manager";
      };
      setLeaves(rows.map((l) => leaveFromDto(l, nameFor)));
    } catch (error) {
      if (error instanceof ApiClientError && error.status >= 500) {
        toast.error(error.message);
      }
    }
  }, []);
  const toggleAttendance = async (arrive: boolean) => {
    try {
      if (arrive) await hrApi.checkIn();
      else await hrApi.checkOut();
      await refreshAttendance(today);
      toast.success(arrive ? "Absen masuk tercatat" : "Absen keluar tercatat");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Absen gagal dicatat",
      );
    }
  };
  const decideLeave = async (id: string, decision: string) => {
    const request = leaves.find((l) => l.id === id);
    try {
      await hrApi.decideLeaveRequest(id, {
        decision: leaveStatusCode(decision),
        expectedVersion: request?.version ?? 1,
      });
      await refreshLeaves(Number(today.slice(0, 4)));
      toast.success("Pengajuan " + decision.toLowerCase());
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Keputusan gagal disimpan",
      );
    }
  };
  const loadPayroll = useCallback(async () => {
    if (live && role === "Manager") return;
    const apiPeriod = periodFromLabel(period);
    if (!apiPeriod) return;
    const loadId = ++payrollLoadId.current;
    setPayLoading(true);
    setPayError("");
    setPayReadiness(null);
    setPayRun(null);
    setPayItems([]);
    try {
      const runs = await hrApi.payrollRuns(apiPeriod);
      const run = runs.find((r) => r.period === apiPeriod) ?? null;
      if (!run) {
        if (loadId === payrollLoadId.current) setPayPeriod(apiPeriod);
        return true;
      }
      const [items, readiness] = await Promise.all([
        hrApi.payrollItems(run.id),
        role === "Admin HR" && run.status === "DRAFT"
          ? hrApi.payrollReadiness(run.id)
          : Promise.resolve(null),
      ]);
      if (loadId !== payrollLoadId.current) return false;
      setPayRun(run);
      setPayItems(items);
      setPayReadiness(readiness);
      setPayPeriod(apiPeriod);
      return true;
    } catch (error) {
      if (loadId !== payrollLoadId.current) return false;
      const message =
        error instanceof Error ? error.message : "Payroll gagal dimuat";
      setPayError(message);
      setPayPeriod("");
      toast.error(message);
      return false;
    } finally {
      if (loadId === payrollLoadId.current) setPayLoading(false);
    }
  }, [live, role, period]);
  const runPayroll = async () => {
    const apiPeriod = periodFromLabel(period);
    if (!apiPeriod) return;
    setPayBusy(true);
    try {
      await hrApi.createPayrollRun(apiPeriod);
      await loadPayroll();
      toast.success("Payroll " + period + " dibuat");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Payroll gagal dibuat",
      );
    } finally {
      setPayBusy(false);
    }
  };
  const publishRun = async () => {
    if (!payRun) return;
    if (
      payBusy ||
      !payReadiness?.ready ||
      payPeriod !== periodFromLabel(period)
    ) {
      toast.error(
        "Lengkapi gaji pokok dan sinkronkan draft sebelum menerbitkan.",
      );
      return;
    }
    setPayBusy(true);
    try {
      await hrApi.publishPayrollRun(payRun.id, payRun.version);
      await loadPayroll();
      setDialog(null);
      toast.success("Payroll " + period + " diterbitkan");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Payroll gagal diterbitkan",
      );
      // Refresh readiness/version after a concurrent HR edit or publication.
      await loadPayroll();
      setDialog(null);
    } finally {
      setPayBusy(false);
    }
  };
  const syncPayroll = async () => {
    if (!payRun || payBusy || payLoading || payRun.status !== "DRAFT") return;
    setPayBusy(true);
    try {
      await hrApi.syncPayrollRun(payRun.id, payRun.version);
      await loadPayroll();
      toast.success(
        "Draft disinkronkan dengan karyawan aktif dan gaji pokok terbaru.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Sinkronisasi gagal",
      );
    } finally {
      setPayBusy(false);
    }
  };
  const refreshReviews = useCallback(async () => {
    const apiPeriod = periodFromLabel(period);
    if (!apiPeriod) return;
    try {
      const rows = await hrApi.performanceReviews(apiPeriod);
      setReviews((rs) => {
        const next = Object.fromEntries(
          Object.entries(rs).filter(([key]) => !key.endsWith(period)),
        );
        for (const r of rows) {
          next[r.employeeId + period] = {
            score: r.score,
            notes: r.notes,
            assessedAt: r.assessedAt.slice(0, 10),
            assessor: r.employeeId === currentUser.id ? "Saya" : "Manager",
            version: r.version,
          };
        }
        return next;
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status >= 500) {
        toast.error(error.message);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  const createLeaveLive = async (f: FormData) => {
    try {
      await hrApi.createLeaveRequest({
        type: leaveTypeCode(String(f.get("type"))),
        startDate: String(f.get("start")),
        endDate: String(f.get("end")),
        reason: String(f.get("reason")).trim(),
      });
      await refreshLeaves(Number(today.slice(0, 4)));
      toast.success("Pengajuan berhasil dikirim");
      setDialog(null);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Pengajuan gagal dikirim",
      );
    }
  };
  const saveEmployeeLive = async (f: FormData) => {
    if (role !== "Admin HR") {
      toast.error("Hanya Admin HR yang dapat menyimpan karyawan");
      return;
    }
    const name = String(f.get("name")).trim();
    const email = String(f.get("email")).trim().toLowerCase();
    const deptName = String(f.get("dept"));
    const posName = String(f.get("position")).trim();
    const employeeNo = String(f.get("employeeNo")).trim().toUpperCase();
    const phone = String(f.get("phone")).trim();
    const address = String(f.get("address")).trim();
    const joinDate = String(f.get("joinDate"));
    const salary = Number(f.get("salary"));
    const status = String(f.get("status"));
    const departmentId = master.find((d) => d.name === deptName)?.id ?? "";
    const positionId =
      masterPositions.find((p) => p.name === posName)?.id ?? "";
    if (
      !name ||
      !employeeNo ||
      !phone ||
      !address ||
      !departmentId ||
      !positionId
    ) {
      toast.error("Lengkapi data karyawan termasuk departemen dan jabatan");
      return;
    }
    const employmentStatus = status === "Aktif" ? "ACTIVE" : "INACTIVE";
    try {
      if (selected.id.startsWith("new-")) {
        await hrApi.createEmployee({
          employeeNo,
          fullName: name,
          workEmail: email,
          departmentId,
          positionId,
          employmentStatus,
          joinedOn: joinDate,
          phone,
          address,
          baseSalaryIdr: salary,
        });
      } else {
        await hrApi.updateEmployee(selected.id, {
          fullName: name,
          departmentId,
          positionId,
          employmentStatus,
          joinedOn: joinDate,
          phone,
          address,
          baseSalaryIdr: salary,
          ...(email !== selected.email ? { workEmail: email } : {}),
          expectedVersion: employeeMeta[selected.id]?.version ?? 1,
        });
      }
      await loadDirectory();
      if (payRun?.status === "DRAFT") await loadPayroll();
      toast.success("Data berhasil disimpan");
      setDialog(null);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Data gagal disimpan",
      );
    }
  };
  const saveReviewLive = async (f: FormData) => {
    const score = Number(f.get("score"));
    const notes = String(f.get("notes")).trim();
    try {
      await hrApi.upsertReview(selected.id, periodFromLabel(period), {
        score,
        notes,
        // Edit penilaian yang sudah ada butuh expectedVersion (optimistic lock);
        // baris baru boleh tanpa expectedVersion.
        ...(reviewFor(selected)?.version
          ? { expectedVersion: reviewFor(selected)?.version }
          : {}),
      });
      await refreshReviews();
      toast.success("Penilaian tersimpan");
      setDialog(null);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Penilaian gagal disimpan",
      );
    }
  };
  const savePayrollLive = async () => {
    if (!payRun) {
      toast.error("Payroll periode ini belum dibuat");
      return;
    }
    const item = payItems.find((i) => i.employeeId === selected.id);
    if (!item) {
      toast.error("Karyawan tidak ada pada payroll periode ini");
      return;
    }
    if (
      payBusy ||
      payLoading ||
      processed ||
      payPeriod !== periodFromLabel(period)
    )
      return;
    if (payrollNet(item.baseSalaryIdr, allowance, bonus, deduction) === null) {
      toast.error(
        "Komponen harus berupa rupiah bulat; potongan tidak boleh melebihi gaji bruto.",
      );
      return;
    }
    setPayBusy(true);
    try {
      await hrApi.updatePayrollItem(item.id, {
        allowanceIdr: allowance,
        bonusIdr: bonus,
        deductionIdr: deduction,
        expectedVersion: item.version,
      });
      await loadPayroll();
      toast.success("Payroll karyawan tersimpan");
      setDialog(null);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Payroll gagal disimpan",
      );
    } finally {
      setPayBusy(false);
    }
  };
  const rejectLeaveLive = async (f: FormData) => {
    const reason = String(f.get("reason")).trim();
    const request = leaves.find((l) => l.id === selectedLeave);
    if (!selectedLeave || !request) return;
    try {
      await hrApi.decideLeaveRequest(selectedLeave, {
        decision: "REJECTED",
        rejectionReason: reason,
        expectedVersion: request.version ?? 1,
      });
      await refreshLeaves(Number(today.slice(0, 4)));
      toast.success("Pengajuan ditolak");
      setDialog(null);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Penolakan gagal disimpan",
      );
    }
  };
  const saveContactLive = async (f: FormData) => {
    const phone = String(f.get("phone")).trim();
    const address = String(f.get("address")).trim();
    try {
      await hrApi.updateContact(
        phone,
        address,
        session?.employee.contact?.version ?? 1,
      );
      await loadMe();
      toast.success("Kontak tersimpan");
      setDialog(null);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Kontak gagal disimpan",
      );
    }
  };
  const saveMasterLive = async (f: FormData) => {
    const name = String(f.get("name")).trim();
    const isDept = dialog === "department" || dialog === "rename-department";
    const renaming = dialog?.startsWith("rename-");
    try {
      if (isDept) {
        if (renaming) {
          const target = master.find((d) => d.name === masterName);
          if (target)
            await hrApi.renameDepartment(target.id, name, target.version);
        } else {
          await hrApi.createDepartment(name);
        }
      } else if (renaming) {
        const target = masterPositions.find((p) => p.name === masterName);
        if (target) await hrApi.renamePosition(target.id, name, target.version);
      } else {
        await hrApi.createPosition(name);
      }
      await refreshMaster();
      await loadDirectory();
      toast.success("Data master tersimpan");
      setDialog(null);
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Data master gagal disimpan",
      );
    }
  };
  const submitLive = (f: FormData) => {
    if (dialog === "invite") return inviteAccountLive(f);
    if (dialog === "employee") return saveEmployeeLive(f);
    if (dialog === "leave") return createLeaveLive(f);
    if (dialog === "review") return saveReviewLive(f);
    if (dialog === "payroll") return savePayrollLive();
    if (dialog === "reject") return rejectLeaveLive(f);
    if (dialog === "profile") return saveContactLive(f);
    if (
      [
        "department",
        "position",
        "rename-department",
        "rename-position",
      ].includes(dialog ?? "")
    )
      return saveMasterLive(f);
    return Promise.resolve();
  };

  // Muat direktori karyawan (mode terintegrasi). Admin HR/Manager dapat membaca
  // direktori; Karyawan hanya profilnya sendiri (RLS menolak list).
  const loadDirectory = useCallback(async () => {
    if (!live) return;
    if (role === "Karyawan") {
      setPeople([currentUser]);
      return;
    }
    try {
      const rows = await hrApi.employees({ pageSize: 100 });
      const list = rows.map(personFromDto);
      setPeople(list);
      setEmployeeMeta((meta) => {
        const next = { ...meta };
        for (const row of rows) {
          const current = next[row.id];
          next[row.id] = {
            departmentId: row.department?.id ?? current?.departmentId ?? "",
            positionId: row.position?.id ?? current?.positionId ?? "",
            version: row.version,
            contactVersion:
              row.contact?.version ?? current?.contactVersion ?? 0,
          };
        }
        return next;
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.status >= 500) {
        toast.error(error.message);
      }
    }
    // currentUser sengaja tidak dimasukkan agar tidak memicu refetch berulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, role, currentUser.id]);
  const loadAccounts = useCallback(async () => {
    if (role !== "Admin HR") return;
    try {
      setAccounts(await hrApi.accounts());
    } catch (error) {
      if (error instanceof ApiClientError && error.status >= 500) {
        toast.error(error.message);
      }
    }
  }, [role]);
  const changeAccount = async (
    account: AccountDto,
    changes: Record<string, unknown>,
  ) => {
    if (accountBusy || account.userId === session?.userId) return;
    setAccountBusy(account.userId);
    try {
      await hrApi.updateAccount(account.userId, {
        ...changes,
        expectedVersion: account.version,
      });
      await loadAccounts();
      toast.success("Akun diperbarui");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Akun gagal diperbarui",
      );
      await loadAccounts();
    } finally {
      setAccountBusy(null);
    }
  };
  const inviteAccountLive = async (form: FormData) => {
    if (accountBusy) return;
    const role = String(form.get("role"));
    const payloadKey = inviteEmployeeId + ":" + role;
    const key = inviteKeys[payloadKey] ?? crypto.randomUUID();
    setInviteKeys((keys) => ({ ...keys, [payloadKey]: key }));
    setAccountBusy(inviteEmployeeId);
    try {
      await hrApi.inviteAccount(inviteEmployeeId, role, key);
      await loadAccounts();
      setDialog(null);
      toast.success("Undangan dikirim. Akun menunggu aktivasi oleh pemilik.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Undangan gagal diproses",
      );
    } finally {
      setAccountBusy(null);
    }
  };
  const loadDashboard = useCallback(async () => {
    try {
      setDashboard(await hrApi.dashboard(periodFromLabel(period)));
    } catch (error) {
      setDashboard(null);
      toast.error(
        error instanceof Error ? error.message : "Dashboard gagal dimuat",
      );
    }
  }, [period]);
  const loadBalance = useCallback(async () => {
    try {
      setLiveBalance(
        (await hrApi.leaveBalance(Number(today.slice(0, 4)))).availableDays,
      );
    } catch (error) {
      setLiveBalance(null);
      toast.error(
        error instanceof Error ? error.message : "Saldo cuti gagal dimuat",
      );
    }
  }, [today]);
  // Efek pemuatan data: menyinkronkan state React dengan sumber eksternal
  // (`/api/v1`). Pola fetch-async → setState ini sengaja dikecualikan dari
  // aturan `set-state-in-effect` karena memang men-subscribe ke data server.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (live) void loadMe();
    const expire = () => window.location.reload();
    window.addEventListener("hris-session-expired", expire);
    return () => window.removeEventListener("hris-session-expired", expire);
  }, [live, loadMe]);
  useEffect(() => {
    if (!live || !signed) return;
    void loadDirectory();
    void refreshAttendance(attendanceDate);
    void refreshLeaves(Number(today.slice(0, 4)));
    void refreshMaster();
    if (role === "Admin HR") void loadAccounts();
    if (role === "Karyawan") void loadBalance();
    if (view === "dashboard") {
      void loadDashboard();
      void refreshAttendance(today);
    }
    if (["payroll", "dashboard"].includes(view)) void loadPayroll();
    if (view === "performance") void refreshReviews();
  }, [
    live,
    signed,
    role,
    view,
    attendanceDate,
    period,
    today,
    loadDirectory,
    refreshAttendance,
    refreshLeaves,
    refreshMaster,
    loadAccounts,
    loadDashboard,
    loadBalance,
    loadPayroll,
    refreshReviews,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const total = (p: Person) => {
    if (live) {
      const item = payItems.find((i) => i.employeeId === p.id);
      if (item) return item.netSalaryIdr;
      return 0;
    }
    const v = pay[p.id + period];
    return (
      (v?.salary ?? p.salary) +
      (v?.allowance ?? 500000) +
      (v?.bonus ?? 250000) -
      (v?.deduction ?? 0)
    );
  };
  /** Komponen payroll satu karyawan (mode terintegrasi maupun demo). */
  const payFor = (p: Person) => {
    if (live) {
      const item = payItems.find((i) => i.employeeId === p.id);
      if (item) {
        return {
          salary: item.baseSalaryIdr,
          allowance: item.allowanceIdr,
          bonus: item.bonusIdr,
          deduction: item.deductionIdr,
        };
      }
      return { salary: 0, allowance: 0, bonus: 0, deduction: 0 };
    }
    const v = pay[p.id + period];
    return {
      salary: v?.salary ?? p.salary,
      allowance: v?.allowance ?? 500000,
      bonus: v?.bonus ?? 250000,
      deduction: v?.deduction ?? 0,
    };
  };
  const approve = (id: string, status: string) => {
    const request = leaves.find((l) => l.id === id);
    if (
      role !== "Manager" ||
      !request ||
      request.status !== "Menunggu" ||
      request.employee === currentUser.id ||
      !team.some((p) => p.id === request.employee)
    ) {
      toast.error("Pengajuan tidak dapat diputuskan oleh akun ini");
      return;
    }
    if (status === "Ditolak") {
      setSelectedLeave(id);
      setDialog("reject");
      return;
    }
    if (live) {
      void decideLeave(id, "Disetujui");
      return;
    }
    setLeaves((ls) =>
      ls.map((l) =>
        l.id === id
          ? { ...l, status, approver: currentUser.name, decidedAt: today }
          : l,
      ),
    );
    toast.success("Pengajuan " + status.toLowerCase());
  };
  const attendance = () => {
    if (currentUser.status !== "Aktif" || checkOut) return;
    const t = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (live) {
      void toggleAttendance(!checkIn);
      return;
    }
    if (!checkIn) {
      setRecords((rs) => [
        ...rs,
        { employee: currentUser.id, date: today, checkIn: t, checkOut: "" },
      ]);
      toast.success("Absen masuk tercatat pukul " + t);
    } else {
      setRecords((rs) =>
        rs.map((r) =>
          r.employee === currentUser.id && r.date === today
            ? { ...r, checkOut: t }
            : r,
        ),
      );
      toast.success("Absen keluar tercatat pukul " + t);
    }
  };
  const download = async (kind: string) => {
    if (kind === "payroll" && role === "Karyawan" && !processed) {
      toast.error("Payroll periode ini belum diterbitkan");
      return;
    }
    if (live) {
      const kindMap: Record<string, string> = {
        payroll: "payroll",
        cuti: "leave",
        absensi: "attendance",
        kinerja: "performance",
        karyawan: "employees",
      };
      const target = kindMap[kind] ?? kind;
      const params: Record<string, string> = {};
      if (target === "attendance") params.date = attendanceDate;
      if (["payroll", "performance"].includes(target)) {
        params.period = periodFromLabel(period);
      }
      if (target === "employees") {
        params.q = search;
        const department = master.find((d) => d.name === dept);
        if (department) params.departmentId = department.id;
        if (filter === "Aktif" || filter === "Nonaktif")
          params.employmentStatus = filter === "Aktif" ? "ACTIVE" : "INACTIVE";
      }
      try {
        const response = await fetch(hrApi.reportUrl(target, params), {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(body?.error?.message ?? "Laporan gagal diunduh");
        }
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = `PeopleSpace-${target}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Laporan berhasil diunduh");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unduhan gagal");
      }
      return;
    }
    let rows: unknown[][] = [];
    if (kind === "payroll")
      rows = [
        ["Nama", "Periode", "Gaji Pokok", "Gaji Bersih"],
        ...active.map((p) => [p.name, period, payFor(p).salary, total(p)]),
      ];
    else if (kind === "cuti")
      rows = [
        ["Nama", "Jenis", "Mulai", "Selesai", "Status"],
        ...visibleLeaves.map((l) => [
          people.find((p) => p.id === l.employee)?.name,
          l.type,
          l.start,
          l.end,
          l.status,
        ]),
      ];
    else if (kind === "absensi")
      rows = [
        ["Nama", "Tanggal", "Masuk", "Keluar"],
        ...records
          .filter(
            (r) =>
              r.date === attendanceDate &&
              team.some((p) => p.id === r.employee),
          )
          .map((r) => [
            people.find((p) => p.id === r.employee)?.name,
            r.date,
            r.checkIn,
            r.checkOut,
          ]),
      ];
    else if (kind === "kinerja")
      rows = [
        ["Nama", "Periode", "Nilai", "Catatan"],
        ...team.map((p) => [
          p.name,
          period,
          reviewFor(p)?.score ?? "Belum dinilai",
          reviewFor(p)?.notes ?? "",
        ]),
      ];
    else
      rows = [
        ["Nomor induk", "Nama", "Email", "Departemen", "Jabatan", "Status"],
        ...list.map((p) => [
          p.employeeNo,
          p.name,
          p.email,
          p.dept,
          p.position,
          p.status,
        ]),
      ];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const u = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = "PeopleSpace-" + kind + ".csv";
    a.click();
    URL.revokeObjectURL(u);
    toast.success("Laporan berhasil diunduh");
  };
  const showPerson = async (p: Person, mode: "employee" | "detail") => {
    if (!live) {
      setSelected(p);
      setDialog(mode);
      return;
    }
    if (employeeBusy) return;
    setEmployeeBusy(true);
    try {
      const row = await hrApi.employee(p.id);
      if (mode === "employee" && (!row.contact || !row.compensation))
        throw new Error(
          "Detail kontak/gaji belum tersedia. Form tidak dibuka agar data tidak tertimpa.",
        );
      setSelected(personFromDto(row));
      setEmployeeMeta((values) => ({
        ...values,
        [row.id]: {
          departmentId: row.department?.id ?? "",
          positionId: row.position?.id ?? "",
          version: row.version,
          contactVersion: row.contact?.version ?? 0,
        },
      }));
      setDialog(mode);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Detail gagal dimuat",
      );
    } finally {
      setEmployeeBusy(false);
    }
  };
  const edit = (p?: Person) => {
    if (p && live) {
      void showPerson(p, "employee");
      return;
    }
    setSelected(
      p ?? {
        id: "new-" + Date.now(),
        name: "",
        email: "",
        dept: "Engineering",
        position: "",
        status: "Aktif",
        salary: live ? 0 : 7000000,
        score: 0,
        employeeNo: "",
        phone: "",
        address: "",
        joinDate: today,
      },
    );
    setDialog("employee");
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (live) {
      void submitLive(f);
      return;
    }
    if (dialog === "employee") {
      const p = {
        ...selected,
        name: String(f.get("name")).trim(),
        email: String(f.get("email")).trim().toLowerCase(),
        dept: String(f.get("dept")),
        position: String(f.get("position")).trim(),
        status: String(f.get("status")),
        salary: Number(f.get("salary")),
        employeeNo: String(f.get("employeeNo")).trim().toUpperCase(),
        phone: String(f.get("phone")).trim(),
        address: String(f.get("address")).trim(),
        joinDate: String(f.get("joinDate")),
      };
      if (
        role !== "Admin HR" ||
        !p.name ||
        !p.position ||
        !p.employeeNo ||
        !p.address ||
        !/^[+\d][\d\s-]{7,19}$/.test(p.phone) ||
        !Number.isFinite(p.salary) ||
        p.salary < 0
      ) {
        toast.error("Lengkapi data karyawan dengan nilai yang valid");
        return;
      }
      if (people.some((x) => x.employeeNo === p.employeeNo && x.id !== p.id)) {
        toast.error("Nomor induk sudah digunakan");
        return;
      }
      if ([...demoLock].includes(p.id) && p.status !== "Aktif") {
        toast.error("Identitas akun simulasi harus tetap aktif");
        return;
      }
      if (
        people.some(
          (x) =>
            x.email.toLowerCase() === p.email.toLowerCase() && x.id !== p.id,
        )
      ) {
        toast.error("Email sudah digunakan");
        return;
      }
      setPeople((ps) =>
        ps.some((x) => x.id === p.id)
          ? ps.map((x) => (x.id === p.id ? p : x))
          : [...ps, p],
      );
    } else if (dialog === "leave") {
      const start = String(f.get("start")),
        end = String(f.get("end"));
      const error = leaveError(
        {
          employee: currentUser.id,
          type: String(f.get("type")),
          start,
          end,
          status: "Menunggu",
        },
        leaves,
        today,
      );
      if (role !== "Karyawan" || error || !String(f.get("reason")).trim()) {
        toast.error(error ?? "Alasan harus diisi oleh karyawan");
        return;
      }
      setLeaves((ls) => [
        {
          id: "new-" + Date.now(),
          employee: currentUser.id,
          type: String(f.get("type")),
          start,
          end,
          reason: String(f.get("reason")).trim(),
          status: "Menunggu",
          submittedAt: today,
        },
        ...ls,
      ]);
    } else if (dialog === "review") {
      const score = Number(f.get("score")),
        notes = String(f.get("notes")).trim();
      if (
        role !== "Manager" ||
        selected.id === currentUser.id ||
        selected.dept !== currentUser.dept ||
        selected.status !== "Aktif" ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > 100 ||
        !notes
      ) {
        toast.error("Penilaian tim tidak valid");
        return;
      }
      setReviews((rs) => ({
        ...rs,
        [selected.id + period]: {
          score,
          notes,
          assessedAt: today,
          assessor: currentUser.name,
        },
      }));
    } else if (dialog === "payroll") {
      if (
        role !== "Admin HR" ||
        processed ||
        payrollError(selected.salary, allowance, bonus, deduction)
      ) {
        toast.error(
          "Komponen payroll tidak valid atau periode sudah diterbitkan",
        );
        return;
      }
      setPay((ps) => ({
        ...ps,
        [selected.id + period]: { allowance, bonus, deduction },
      }));
    } else if (dialog === "reject") {
      const reason = String(f.get("reason")).trim();
      if (!reason || role !== "Manager") {
        toast.error("Alasan penolakan wajib diisi");
        return;
      }
      setLeaves((ls) =>
        ls.map((l) =>
          l.id === selectedLeave &&
          l.status === "Menunggu" &&
          l.employee !== currentUser.id &&
          team.some((p) => p.id === l.employee)
            ? {
                ...l,
                status: "Ditolak",
                rejectionReason: reason,
                approver: currentUser.name,
                decidedAt: today,
              }
            : l,
        ),
      );
    } else if (dialog === "profile") {
      const phone = String(f.get("phone")).trim(),
        address = String(f.get("address")).trim();
      if (!/^[+\d][\d\s-]{7,19}$/.test(phone) || !address) {
        toast.error("Telepon atau alamat tidak valid");
        return;
      }
      setPeople((ps) =>
        ps.map((p) => (p.id === currentUser.id ? { ...p, phone, address } : p)),
      );
    } else if (
      [
        "department",
        "position",
        "rename-department",
        "rename-position",
      ].includes(dialog ?? "")
    ) {
      const name = String(f.get("name")).trim();
      const isDept = dialog === "department" || dialog === "rename-department";
      const renaming = dialog?.startsWith("rename-");
      const existing = isDept
        ? [...people.map((p) => p.dept), ...extraDepts]
        : [...people.map((p) => p.position), ...extraPositions];
      if (
        role !== "Admin HR" ||
        !name ||
        existing.some((v) => v.toLowerCase() === name.toLowerCase())
      ) {
        toast.error("Nama kosong atau sudah digunakan");
        return;
      }
      if (renaming)
        setPeople((ps) =>
          ps.map((p) =>
            isDept && p.dept === masterName
              ? { ...p, dept: name }
              : !isDept && p.position === masterName
                ? { ...p, position: name }
                : p,
          ),
        );
      if (isDept)
        setExtraDepts((ds) =>
          renaming
            ? [...ds.filter((d) => d !== masterName), name]
            : [...ds, name],
        );
      else
        setExtraPositions((ps) =>
          renaming
            ? [...ps.filter((p) => p !== masterName), name]
            : [...ps, name],
        );
    }
    toast.success(
      dialog === "leave"
        ? "Pengajuan berhasil dikirim"
        : "Data berhasil disimpan",
    );
    setDialog(null);
  };
  useEffect(() => {
    const ctx = (
      document as unknown as {
        modelContext?: { registerTool: (t: unknown, o: unknown) => unknown };
      }
    ).modelContext;
    if (!ctx) return;
    const ac = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: "navigate_hris",
            description: "Open a HRIS module for the current demo role.",
            inputSchema: {
              type: "object",
              properties: {
                module: { type: "string", enum: nav.map((n) => n.id) },
              },
              required: ["module"],
              additionalProperties: false,
            },
            execute: (input: unknown) => {
              const id = (input as { module: string }).module;
              if (!nav.some((n) => n.id === id))
                throw new Error("Unavailable module");
              go(id);
              return { module: id };
            },
          },
          { signal: ac.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => ac.abort();
  }, [nav, go]);
  const list = team.filter(
    (p) =>
      (p.name + " " + p.email + " " + p.position)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (dept === "Semua departemen" || p.dept === dept),
  );
  const title = nav.find((n) => n.id === view)?.label ?? "Profil saya";
  if (checking)
    return (
      <main className="login">
        <div className="brand login-brand">
          <span className="logo">p.</span>PeopleSpace
        </div>
        <div className="login-card">
          <div className="eyebrow">WORKSPACE HRIS</div>
          <h1>Memuat sesi…</h1>
          <p>Memeriksa sesi Supabase Anda.</p>
        </div>
        <Toaster richColors />
      </main>
    );
  if (!signed)
    return (
      <main className="login">
        <div className="brand login-brand">
          <span className="logo">p.</span>PeopleSpace
        </div>
        <div className="login-card">
          <div className="eyebrow">WORKSPACE HRIS</div>
          <h1>Selamat datang kembali.</h1>
          <p>Kelola tim dan aktivitas kerja dalam satu ruang.</p>
          <form onSubmit={signIn}>
            <label>
              NIM / NPM
              <Input
                type="text"
                required
                maxLength={254}
                placeholder="Masukkan NIM / NPM"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {!live && (
              <label>
                Masuk sebagai
                <Choice
                  value={role}
                  change={changeRole}
                  values={["Admin HR", "Manager", "Karyawan"]}
                  label="Peran demo"
                />
              </label>
            )}
            <Button className="w-full" disabled={authBusy}>
              {authBusy ? "Memproses…" : "Masuk ke workspace"}
            </Button>
          </form>
          {live && (
            <Button
              variant="ghost"
              disabled={authBusy}
              onClick={async () => {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                  toast.error(
                    "Akun NIM/NPM demo: hubungi Admin HR untuk reset kata sandi. Pemulihan email hanya untuk akun dengan alamat email aktif.",
                  );
                  return;
                }
                setAuthBusy(true);
                try {
                  await hrApi.resetPassword(email.trim());
                  toast.success(
                    "Jika email terdaftar, tautan pemulihan akan dikirim. Periksa inbox/spam.",
                  );
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Pemulihan gagal",
                  );
                } finally {
                  setAuthBusy(false);
                }
              }}
            >
              Lupa kata sandi?
            </Button>
          )}
          <small>
            {live
              ? "Masuk dengan NIM/NPM · akun lama tetap bisa memakai email"
              : "Mode demo frontend · akun dan data contoh"}
          </small>
        </div>
        <Toaster richColors />
      </main>
    );
  return (
    <SidebarProvider style={{ "--sidebar-width": "15rem" } as CSSProperties}>
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <div className="brand">
            <span className="logo">p.</span>
            <strong>PeopleSpace</strong>
          </div>
          <div className="workspace">
            <Building2 size={20} />
            <div>
              <strong>Capstone HRIS</strong>
              <small>Workspace kelompok 4E</small>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {(role === "Admin HR"
            ? ["WORKSPACE", "MASTER DATA"]
            : ["WORKSPACE"]
          ).map((group, i) => (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
              <SidebarMenu>
                {nav
                  .filter((n) =>
                    i === 0
                      ? !["departments", "positions", "accounts"].includes(n.id)
                      : ["departments", "positions", "accounts"].includes(n.id),
                  )
                  .map((n) => (
                    <SidebarMenuItem key={n.id}>
                      <NavigationButton
                        aria-label={
                          role === "Manager" && n.id === "employees"
                            ? "Anggota tim"
                            : role === "Karyawan" && n.id === "payroll"
                              ? "Slip gaji saya"
                              : n.label
                        }
                        isActive={view === n.id}
                        onClick={() => go(n.id)}
                      >
                        <n.icon size={19} />
                        <span>
                          {role === "Manager" && n.id === "employees"
                            ? "Anggota tim"
                            : role === "Karyawan" && n.id === "payroll"
                              ? "Slip gaji saya"
                              : n.label}
                        </span>
                        {n.id === "leave" && pending.length > 0 && (
                          <b className="nav-count">{pending.length}</b>
                        )}
                      </NavigationButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <div className="demo-note">
            <Sparkles size={17} />
            <div>
              <strong>Ruang untuk tim yang lebih baik</strong>
              <small>
                {live ? "Terhubung ke Supabase" : "Demo frontend · data contoh"}
              </small>
            </div>
          </div>
          <Button
            variant="ghost"
            className="help"
            onClick={() => setDialog("help")}
          >
            <CircleHelp size={18} />
            Pusat bantuan
          </Button>
          <div className="sidebar-user">
            <Avatar name={currentUser.name} />
            <div>
              <strong>{currentUser.name}</strong>
              <small>{role}</small>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Keluar"
              onClick={() => void signOut()}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger />
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="demo-pill">{live ? "Live" : "Demo"}</span>
            {!live && (
              <Choice
                value={role}
                change={changeRole}
                values={["Admin HR", "Manager", "Karyawan"]}
                label="Ganti peran demo"
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifikasi"
              onClick={() => setDialog("notifications")}
            >
              <Bell size={19} />
            </Button>
            <Avatar name={currentUser.name} index={2} />
          </div>
        </header>
        <main className="content">
          <div className="page-header">
            <div>
              <div className="eyebrow">
                {view === "dashboard"
                  ? date(today).toUpperCase() + " · WIB"
                  : "PEOPLESPACE / " + title.toUpperCase()}
              </div>
              <h1>
                {view === "dashboard"
                  ? "Halo, " + currentUser.name.split(" ")[0] + " 👋"
                  : title}
              </h1>
              <p>
                {view === "dashboard"
                  ? "Inilah kabar tim Anda hari ini. Mari buat hari kerja lebih berarti."
                  : view === "employees"
                    ? "Semua informasi tim, tersusun dalam satu tempat."
                    : view === "leave"
                      ? "Kelola waktu istirahat dan pengajuan cuti tim."
                      : "Informasi HR yang Anda perlukan, selalu mudah ditemukan."}
              </p>
            </div>
            <div className="page-actions">
              {view === "dashboard" && (
                <span className="date-chip">
                  <CalendarDays size={16} />
                  {date(today)}
                </span>
              )}
              {["dashboard", "employees"].includes(view) &&
                role === "Admin HR" && (
                  <Button onClick={() => edit()}>
                    <Plus size={16} />
                    Tambah karyawan
                  </Button>
                )}
              {view === "leave" && role === "Karyawan" && (
                <Button onClick={() => setDialog("leave")}>
                  <Plus size={16} />
                  Ajukan cuti
                </Button>
              )}
              {view === "payroll" && role === "Admin HR" && (
                <Button
                  disabled={
                    payBusy ||
                    (live &&
                      (payLoading ||
                        !!payError ||
                        payPeriod !== periodFromLabel(period) ||
                        (payRun?.status === "DRAFT" &&
                          !payReadiness?.ready))) ||
                    active.length === 0 ||
                    (live ? payRun?.status === "PUBLISHED" : processed)
                  }
                  onClick={() => {
                    if (live) {
                      void (payRun && payRun.status === "DRAFT"
                        ? setDialog("publish-payroll")
                        : runPayroll());
                      return;
                    }
                    setPay((ps) => ({
                      ...ps,
                      ...Object.fromEntries(
                        active.map((p) => [
                          p.id + period,
                          {
                            ...(ps[p.id + period] ?? {
                              allowance: 500000,
                              bonus: 250000,
                              deduction: 0,
                            }),
                            salary: p.salary,
                          },
                        ]),
                      ),
                    }));
                    setProcessedPeriods((ps) => [...ps, period]);
                    toast.success(
                      "Payroll " + period + " diterbitkan (simulasi)",
                    );
                  }}
                >
                  {live
                    ? payRun?.status === "DRAFT"
                      ? "Terbitkan payroll"
                      : processed
                        ? "Payroll diproses"
                        : "Buat payroll"
                    : processed
                      ? "Payroll diproses"
                      : "Proses payroll"}
                </Button>
              )}
            </div>
          </div>
          {view === "dashboard" && (
            <>
              <div className="stats">
                {[
                  {
                    label: role === "Karyawan" ? "Sisa cuti" : "Total karyawan",
                    value:
                      role === "Karyawan"
                        ? remaining
                        : live
                          ? (dashboard?.employeeCount ?? "—")
                          : team.length,
                    detail:
                      role === "Karyawan"
                        ? "hari tersedia"
                        : "anggota dalam workspace",
                    icon: Users,
                    color: "blue",
                  },
                  {
                    label:
                      role === "Karyawan"
                        ? "Absensi hari ini"
                        : "Hadir hari ini",
                    value:
                      role === "Karyawan"
                        ? checkIn || "Belum absen"
                        : live
                          ? (dashboard?.presentCount ?? "—")
                          : present.length,
                    detail:
                      role === "Karyawan"
                        ? "Jadwal 08.00 – 17.00"
                        : "dari " + team.length + " anggota tim",
                    icon: Clock3,
                    color: "green",
                  },
                  {
                    label: "Pengajuan cuti",
                    value: live
                      ? (dashboard?.pendingLeaveCount ?? "—")
                      : pending.length,
                    detail: "menunggu persetujuan",
                    icon: CalendarDays,
                    color: "orange",
                  },
                  {
                    label: "Rata-rata kinerja",
                    value: live
                      ? dashboard?.averageReviewScore == null
                        ? "—"
                        : Math.round(dashboard.averageReviewScore)
                      : Math.round(
                          team.reduce(
                            (a, p) => a + (reviewFor(p)?.score ?? 0),
                            0,
                          ) /
                            Math.max(
                              1,
                              team.filter((p) => reviewFor(p)).length,
                            ),
                        ),
                    detail: period + " · hanya yang sudah dinilai",
                    icon: ChartNoAxesCombined,
                    color: "purple",
                  },
                ].map((s) => (
                  <div className="stat" key={s.label}>
                    <div className="stat-top">
                      <span>{s.label}</span>
                      <span className={"stat-icon " + s.color}>
                        <s.icon size={20} />
                      </span>
                    </div>
                    <strong>{s.value}</strong>
                    <small>{s.detail}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <Panel
                  title="Ringkasan kehadiran"
                  action={
                    <Choice
                      value={period}
                      change={setPeriod}
                      values={periods}
                      label="Periode ringkasan"
                    />
                  }
                >
                  <div className="chart-summary">
                    <strong>
                      {Math.round(
                        (present.length / Math.max(1, active.length)) * 100,
                      )}
                      <span>%</span>
                    </strong>
                    <div>
                      <span className="trend">
                        <TrendingUp size={14} />
                        Kehadiran hari ini
                      </span>
                      <small>
                        {present.length} hadir dari {active.length} karyawan
                        aktif
                      </small>
                    </div>
                  </div>
                  <div
                    className="bar-chart"
                    role="img"
                    aria-label="Ilustrasi ringkasan kehadiran mingguan"
                  >
                    <div className="y-axis">
                      <span>100%</span>
                      <span>75%</span>
                      <span>50%</span>
                      <span>25%</span>
                    </div>
                    <div className="chart-columns">
                      {[84, 92, 88, 96, 90].map((v, i) => (
                        <div className="chart-column" key={i}>
                          <div className="bars">
                            <div
                              style={{
                                height:
                                  (period === "Agustus 2026" ? v - 10 : v) +
                                  "%",
                              }}
                            />
                            <div
                              className="bar-pale"
                              style={{ height: v - 9 + "%" }}
                            />
                          </div>
                          <span>{["Sen", "Sel", "Rab", "Kam", "Jum"][i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i />
                      Minggu ini
                    </span>
                    <span>
                      <i className="pale" />
                      Minggu lalu
                    </span>
                    <small>Ilustrasi data mingguan</small>
                  </div>
                </Panel>
                <Panel title="Komposisi tim" action={<Building2 size={18} />}>
                  <div className="donut-wrap">
                    <div
                      className="donut"
                      style={{
                        background:
                          "conic-gradient(" +
                          [...new Set(team.map((p) => p.dept))]
                            .map((d, i, all) => {
                              const before =
                                (all
                                  .slice(0, i)
                                  .reduce(
                                    (a, x) =>
                                      a +
                                      team.filter((p) => p.dept === x).length,
                                    0,
                                  ) /
                                  team.length) *
                                100;
                              const after =
                                before +
                                (team.filter((p) => p.dept === d).length /
                                  team.length) *
                                  100;
                              return (
                                [
                                  "#4169e1",
                                  "#7a98ee",
                                  "#a9bef5",
                                  "#c9d7fa",
                                  "#e0e8fd",
                                ][i % 5] +
                                " " +
                                before +
                                "% " +
                                after +
                                "%"
                              );
                            })
                            .join(",") +
                          ")",
                      }}
                    >
                      <div>
                        <strong>{team.length}</strong>
                        <span>Karyawan</span>
                      </div>
                    </div>
                  </div>
                  <div className="dept-legend">
                    {[...new Set(team.map((p) => p.dept))].map((d, i) => (
                      <div key={d}>
                        <span>
                          <i
                            style={{
                              background: [
                                "#4169e1",
                                "#7a98ee",
                                "#a9bef5",
                                "#c9d7fa",
                                "#e0e8fd",
                              ][i % 5],
                            }}
                          />
                          {d}
                        </span>
                        <strong>
                          {team.filter((p) => p.dept === d).length}
                        </strong>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <div className="dashboard-grid bottom-grid">
                <Panel
                  title="Pengajuan cuti terbaru"
                  action={
                    <button className="text-link" onClick={() => go("leave")}>
                      Lihat semua <ChevronRight size={15} />
                    </button>
                  }
                >
                  <div className="leave-preview">
                    {visibleLeaves.slice(0, 3).map((l, i) => {
                      const p = people.find((p) => p.id === l.employee)!;
                      return (
                        <div className="preview-row" key={l.id}>
                          <Avatar name={p.name} index={i + 1} />
                          <div className="grow">
                            <strong>{p.name}</strong>
                            <small>
                              {l.type} · {date(l.start)} ·{" "}
                              {days(l.start, l.end)} hari
                            </small>
                          </div>
                          <Status value={l.status} />
                          {l.approver && (
                            <small className="cell-small">
                              {l.approver} · {l.decidedAt}
                            </small>
                          )}
                          {l.rejectionReason && (
                            <small className="cell-small">
                              Alasan: {l.rejectionReason}
                            </small>
                          )}
                        </div>
                      );
                    })}
                    {!visibleLeaves.length && <p>Belum ada pengajuan cuti.</p>}
                  </div>
                </Panel>
                <Panel title="Akses cepat">
                  <div className="quick-grid">
                    {[
                      {
                        label:
                          role === "Karyawan"
                            ? "Absen sekarang"
                            : "Data karyawan",
                        icon: Users,
                        target:
                          role === "Karyawan" ? "attendance" : "employees",
                      },
                      {
                        label: "Pengajuan cuti",
                        icon: CalendarDays,
                        target: "leave",
                      },
                      {
                        label:
                          role === "Manager" ? "Penilaian tim" : "Slip gaji",
                        icon: Wallet,
                        target: role === "Manager" ? "performance" : "payroll",
                      },
                      {
                        label:
                          role === "Admin HR" ? "Laporan HR" : "Profil saya",
                        icon: Files,
                        target: role === "Admin HR" ? "reports" : "profile",
                      },
                    ].map((a) => (
                      <button key={a.label} onClick={() => go(a.target)}>
                        <a.icon size={20} />
                        <span>{a.label}</span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                  <div className="reminder">
                    <Sun size={22} />
                    <div>
                      <strong>Tim yang baik dimulai dari perhatian.</strong>
                      <p>
                        Luangkan waktu untuk melihat kabar anggota tim hari ini.
                      </p>
                    </div>
                  </div>
                </Panel>
              </div>
            </>
          )}
          {view === "employees" && (
            <Panel>
              <div className="toolbar">
                <div className="search-field">
                  <Search size={17} />
                  <Input
                    placeholder="Cari nama, email, atau jabatan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Cari karyawan"
                  />
                </div>
                <Choice
                  value={dept}
                  change={setDept}
                  values={[
                    "Semua departemen",
                    ...new Set(team.map((p) => p.dept)),
                  ]}
                  label="Filter departemen"
                />
                <Button variant="outline" onClick={() => download("karyawan")}>
                  <Download size={16} />
                  Ekspor
                </Button>
              </div>
              <div className="table-meta">{list.length} karyawan ditemukan</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "Karyawan",
                      "Departemen",
                      "Jabatan",
                      "Status",
                      "Aksi",
                    ].map((s) => (
                      <TableHead key={s}>{s}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((p, i) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="person">
                          <Avatar name={p.name} index={i} />
                          <div>
                            <strong>{p.name}</strong>
                            <small>{p.email}</small>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{p.dept}</TableCell>
                      <TableCell>{p.position}</TableCell>
                      <TableCell>
                        <Status value={p.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={"Detail " + p.name}
                          onClick={() => {
                            void showPerson(p, "detail");
                          }}
                        >
                          <MoreHorizontal size={18} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!list.length && (
                <div className="empty">
                  <Search />
                  <strong>Karyawan tidak ditemukan</strong>
                  <p>Coba kata kunci atau departemen lain.</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setDept("Semua departemen");
                    }}
                  >
                    Hapus filter
                  </Button>
                </div>
              )}
            </Panel>
          )}
          {view === "attendance" && (
            <>
              <div className="attendance-banner">
                <div>
                  <div className="eyebrow">ABSENSI SAYA</div>
                  <h2>
                    {checkOut
                      ? "Hari kerja selesai. Terima kasih!"
                      : checkIn
                        ? "Selamat bekerja, " + currentUser.name + "."
                        : "Siap memulai hari Anda?"}
                  </h2>
                  <p>
                    08.00 – 17.00 WIB ·{" "}
                    {checkIn ? "Masuk " + checkIn : "Belum absen"}
                    {checkOut ? " · Keluar " + checkOut : ""}
                  </p>
                </div>
                <Button onClick={attendance} disabled={!!checkOut}>
                  <Clock3 size={17} />
                  {checkOut
                    ? "Absensi selesai"
                    : checkIn
                      ? "Absen keluar"
                      : "Absen masuk"}
                </Button>
              </div>
              <Panel
                title="Catatan kehadiran"
                action={
                  <Input
                    aria-label="Tanggal kehadiran"
                    type="date"
                    value={attendanceDate}
                    max={today}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                  />
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      {["Karyawan", "Tanggal", "Masuk", "Keluar", "Status"].map(
                        (s) => (
                          <TableHead key={s}>{s}</TableHead>
                        ),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="person">
                            <Avatar name={p.name} index={i} />
                            <strong>{p.name}</strong>
                          </div>
                        </TableCell>
                        <TableCell>{date(attendanceDate)}</TableCell>
                        <TableCell>
                          {records.find(
                            (r) =>
                              r.employee === p.id && r.date === attendanceDate,
                          )?.checkIn || "—"}
                        </TableCell>
                        <TableCell>
                          {records.find(
                            (r) =>
                              r.employee === p.id && r.date === attendanceDate,
                          )?.checkOut || "—"}
                        </TableCell>
                        <TableCell>
                          <Status
                            value={
                              records.some(
                                (r) =>
                                  r.employee === p.id &&
                                  r.date === attendanceDate &&
                                  r.checkIn,
                              )
                                ? records.find(
                                    (r) =>
                                      r.employee === p.id &&
                                      r.date === attendanceDate,
                                  )!.checkIn > "08:00"
                                  ? "Terlambat"
                                  : "Hadir"
                                : "Belum absen"
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </>
          )}
          {view === "leave" && (
            <Panel>
              <div className="toolbar">
                <Tabs value={filter} onValueChange={setFilter}>
                  <TabsList>
                    {["Semua", "Menunggu", "Disetujui", "Ditolak"].map((v) => (
                      <TabsTrigger value={v} key={v}>
                        {v}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                {role === "Karyawan" && (
                  <span className="muted">
                    Sisa cuti {remaining} hari kerja · termasuk reservasi
                    menunggu
                  </span>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {[
                      "Karyawan",
                      "Jenis",
                      "Periode",
                      "Durasi",
                      "Status",
                      "Aksi",
                    ].map((s) => (
                      <TableHead key={s}>{s}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLeaves
                    .filter((l) => filter === "Semua" || l.status === filter)
                    .map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <strong>
                            {people.find((p) => p.id === l.employee)?.name}
                          </strong>
                          <small className="cell-small">{l.reason}</small>
                        </TableCell>
                        <TableCell>{l.type}</TableCell>
                        <TableCell>
                          {date(l.start)}
                          <small className="cell-small">
                            s.d. {date(l.end)}
                          </small>
                        </TableCell>
                        <TableCell>{days(l.start, l.end)} hari</TableCell>
                        <TableCell>
                          <Status value={l.status} />
                          {l.approver && (
                            <small className="cell-small">
                              {l.approver} · {l.decidedAt}
                            </small>
                          )}
                          {l.rejectionReason && (
                            <small className="cell-small">
                              Alasan: {l.rejectionReason}
                            </small>
                          )}
                        </TableCell>
                        <TableCell>
                          {role === "Manager" &&
                          l.employee !== currentUser.id &&
                          l.status === "Menunggu" ? (
                            <div className="inline-actions">
                              <Button
                                size="sm"
                                onClick={() => approve(l.id, "Disetujui")}
                              >
                                <Check size={14} />
                                Setujui
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approve(l.id, "Ditolak")}
                              >
                                <X size={14} />
                                Tolak
                              </Button>
                            </div>
                          ) : (
                            <span className="muted">
                              {l.status === "Menunggu"
                                ? "Menunggu manager"
                                : "Selesai"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {!visibleLeaves.some(
                (l) => filter === "Semua" || l.status === filter,
              ) && (
                <div className="empty">
                  <CalendarDays />
                  <strong>Belum ada pengajuan</strong>
                  <p>Pengajuan dengan status ini akan muncul di sini.</p>
                </div>
              )}
            </Panel>
          )}
          {view === "payroll" && (
            <>
              <div className="toolbar plain">
                <Choice
                  value={period}
                  change={setPeriod}
                  values={periods}
                  label="Periode payroll"
                />
                <Button
                  variant="outline"
                  disabled={role === "Karyawan" && !processed}
                  onClick={() => download("payroll")}
                >
                  <Download size={16} />
                  Ekspor payroll
                </Button>
              </div>
              <p className="table-meta">
                {live && payLoading
                  ? "Memuat payroll…"
                  : processed
                    ? "Diterbitkan · komponen periode dikunci"
                    : live
                      ? payRun
                        ? "Draft · belum diterbitkan; bukan pembayaran atau transfer bank"
                        : "Belum ada payroll periode ini · buat draft terlebih dahulu"
                      : "Draft simulasi · slip tersedia setelah Admin HR menerbitkan"}
              </p>
              {live && role === "Admin HR" && payRun?.status === "DRAFT" && (
                <>
                  <div className="toolbar plain">
                    <Button
                      variant="outline"
                      disabled={payBusy || payLoading}
                      onClick={() => void syncPayroll()}
                    >
                      Sinkronkan draft
                    </Button>
                    <span className="muted">
                      Memperbarui gaji pokok dan daftar karyawan aktif, bukan
                      menerbitkan.
                    </span>
                  </div>
                  {payReadiness && !payReadiness.ready && (
                    <Panel>
                      <div role="alert">
                        <strong>Payroll belum siap diterbitkan</strong>
                        {payReadiness.missingSalaryCount > 0 && (
                          <p>
                            {payReadiness.missingSalaryCount} karyawan belum
                            memiliki gaji pokok. Lengkapi melalui edit karyawan;
                            Rp0 bukan gaji siap proses.
                          </p>
                        )}
                        {payReadiness.missingItemCount +
                          payReadiness.inactiveItemCount +
                          payReadiness.staleItemCount >
                          0 && (
                          <p>
                            Data karyawan/gaji berubah. Sinkronkan draft agar
                            daftar dan nominal sesuai data terbaru.
                          </p>
                        )}
                        {payReadiness.invalidDeductionCount > 0 && (
                          <p>
                            {payReadiness.invalidDeductionCount} potongan
                            melebihi gaji bruto terbaru. Koreksi potongan
                            sebelum sinkronisasi.
                          </p>
                        )}
                        {payReadiness.missingSalaryEmployees.length > 0 && (
                          <details>
                            <summary>Karyawan yang gajinya belum diisi</summary>
                            <ul
                              style={{
                                maxHeight: 240,
                                overflowY: "auto",
                                paddingLeft: 20,
                              }}
                            >
                              {payReadiness.missingSalaryEmployees.map(
                                (employee) => (
                                  <li
                                    key={employee.id}
                                    style={{
                                      padding: "8px 0",
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {employee.fullName} · {employee.employeeNo}{" "}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={employeeBusy}
                                      onClick={() =>
                                        void showPerson(
                                          { ...currentUser, id: employee.id },
                                          "employee",
                                        )
                                      }
                                    >
                                      Isi gaji
                                    </Button>
                                  </li>
                                ),
                              )}
                            </ul>
                            {payReadiness.missingSalaryCount >
                              payReadiness.missingSalaryEmployees.length && (
                              <p>
                                Menampilkan 20 pertama; karyawan lainnya
                                tersedia di direktori.
                              </p>
                            )}
                          </details>
                        )}
                      </div>
                    </Panel>
                  )}
                </>
              )}
              {live && payError && (
                <Panel>
                  <p role="alert">{payError}</p>
                  <Button variant="outline" onClick={() => void loadPayroll()}>
                    Muat ulang payroll
                  </Button>
                </Panel>
              )}
              <Panel title="Data payroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        "Karyawan",
                        "Gaji pokok",
                        "Tunjangan & bonus",
                        "Gaji bersih",
                        "Aksi",
                      ].map((s) => (
                        <TableHead key={s}>{s}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollPeople.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <strong>{p.name}</strong>
                          <small className="cell-small">{period}</small>
                        </TableCell>
                        <TableCell>
                          {live &&
                          !processed &&
                          !salaryConfigured(payFor(p).salary)
                            ? "Belum diisi"
                            : money(payFor(p).salary)}
                        </TableCell>
                        <TableCell>
                          {money(payFor(p).allowance + payFor(p).bonus)}
                        </TableCell>
                        <TableCell>
                          <strong>
                            {live &&
                            !processed &&
                            !salaryConfigured(payFor(p).salary)
                              ? "Belum siap"
                              : money(total(p))}
                          </strong>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelected(p);
                              setDialog("payslip");
                            }}
                          >
                            {live && !processed ? "Tinjau draft" : "Slip gaji"}
                          </Button>
                          {role === "Admin HR" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={processed || payBusy || payLoading}
                              aria-label={
                                live ? `Edit komponen ${p.name}` : undefined
                              }
                              onClick={() => {
                                setSelected(p);
                                const v = payFor(p);
                                setAllowance(v.allowance);
                                setBonus(v.bonus);
                                setDeduction(v.deduction);
                                setDialog("payroll");
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          {live && role === "Admin HR" && !processed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={employeeBusy || payBusy}
                              onClick={() => void showPerson(p, "employee")}
                            >
                              Edit gaji pokok
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {payrollPeople.length === 0 && (
                  <div className="empty">
                    <Wallet />
                    <strong>
                      {payLoading
                        ? "Memuat data payroll…"
                        : payError
                          ? "Data payroll tidak tersedia"
                          : role === "Karyawan"
                            ? "Belum ada slip gaji yang diterbitkan untuk Anda."
                            : "Belum ada item payroll periode ini."}
                    </strong>
                  </div>
                )}
              </Panel>
            </>
          )}
          {view === "performance" && (
            <section>
              <div className="toolbar plain">
                <Choice
                  value={period}
                  change={setPeriod}
                  values={periods}
                  label="Periode penilaian"
                />
              </div>
              <div className="cards-grid">
                {active.map((p, i) => (
                  <Panel className="review-card" key={p.id}>
                    <div className="person">
                      <Avatar name={p.name} index={i} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.position}</small>
                      </div>
                    </div>
                    <div className="score">
                      {reviewFor(p)?.score ?? "—"}
                      <span>/ 100</span>
                    </div>
                    <Progress value={reviewFor(p)?.score ?? 0} />
                    <small className="review-period">{period}</small>
                    <p>
                      {reviewFor(p)?.notes ??
                        "Belum ada penilaian untuk periode ini."}
                    </p>
                    {role === "Manager" && p.id !== currentUser.id && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelected(p);
                          setDialog("review");
                        }}
                      >
                        Beri penilaian
                      </Button>
                    )}
                  </Panel>
                ))}
              </div>
            </section>
          )}
          {view === "reports" && (
            <section>
              <div className="toolbar plain">
                <Choice
                  value={period}
                  change={setPeriod}
                  values={periods}
                  label="Periode laporan payroll dan kinerja"
                />
                <Input
                  aria-label="Tanggal laporan absensi"
                  type="date"
                  value={attendanceDate}
                  max={today}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </div>
              <div className="cards-grid">
                {[
                  ["Karyawan", "karyawan"],
                  ["Absensi", "absensi"],
                  ["Cuti", "cuti"],
                  ["Payroll", "payroll"],
                  ["Penilaian kinerja", "kinerja"],
                ].map(([s, k]) => (
                  <Panel className="report-card" key={s}>
                    <span className="report-icon">
                      <Files size={24} />
                    </span>
                    <h2>Laporan {s.toLowerCase()}</h2>
                    <p>
                      {k === "absensi"
                        ? date(attendanceDate)
                        : ["payroll", "kinerja"].includes(k)
                          ? period
                          : "Semua data dalam lingkup akses"}{" "}
                      · CSV {live ? "data server sesuai akses" : "data contoh"}
                    </p>
                    <Button variant="outline" onClick={() => download(k)}>
                      <Download size={16} />
                      Unduh CSV
                    </Button>
                  </Panel>
                ))}
              </div>
            </section>
          )}
          {["departments", "positions"].includes(view) && (
            <>
              <div className="toolbar plain">
                <Button
                  onClick={() =>
                    setDialog(
                      view === "departments" ? "department" : "position",
                    )
                  }
                >
                  <Plus size={16} />
                  Tambah {view === "departments" ? "departemen" : "jabatan"}
                </Button>
              </div>
              <div className="cards-grid">
                {[
                  ...new Set(
                    view === "departments"
                      ? live
                        ? master.map((d) => d.name)
                        : [...people.map((p) => p.dept), ...extraDepts]
                      : live
                        ? masterPositions.map((p) => p.name)
                        : [...people.map((p) => p.position), ...extraPositions],
                  ),
                ].map((s) => (
                  <Panel className="report-card" key={s}>
                    <Building2 size={24} color="#4169e1" />
                    <h2>{s}</h2>
                    <p>
                      {
                        people.filter((p) =>
                          view === "departments"
                            ? p.dept === s
                            : p.position === s,
                        ).length
                      }{" "}
                      karyawan
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMasterName(s);
                        setDialog(
                          view === "departments"
                            ? "rename-department"
                            : "rename-position",
                        );
                      }}
                    >
                      Ubah nama
                    </Button>
                  </Panel>
                ))}
              </div>
            </>
          )}
          {view === "accounts" && (
            <Panel title="Akun pengguna">
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Nama", "Email", "Peran", "Status"].map((s) => (
                      <TableHead key={s}>{s}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {live
                    ? accounts.map((account) => (
                        <TableRow key={account.userId}>
                          <TableCell>{account.fullName}</TableCell>
                          <TableCell>{account.workEmail}</TableCell>
                          <TableCell>
                            <select
                              aria-label={"Peran akun " + account.fullName}
                              value={uiRole(account.role)}
                              disabled={
                                accountBusy !== null ||
                                account.userId === session?.userId
                              }
                              onChange={(event) =>
                                void changeAccount(account, {
                                  role: backendRole(event.target.value as Role),
                                })
                              }
                            >
                              <option>Karyawan</option>
                              <option>Manager</option>
                              <option>Admin HR</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <select
                              aria-label={"Status akun " + account.fullName}
                              value={account.accountStatus}
                              disabled={
                                accountBusy !== null ||
                                account.userId === session?.userId ||
                                account.accountStatus === "INVITED"
                              }
                              onChange={(event) =>
                                void changeAccount(account, {
                                  accountStatus: event.target.value,
                                })
                              }
                            >
                              {account.accountStatus === "INVITED" && (
                                <option value="INVITED">
                                  Menunggu aktivasi
                                </option>
                              )}
                              <option value="ACTIVE">Aktif</option>
                              <option value="DISABLED">Nonaktif</option>
                            </select>
                          </TableCell>
                        </TableRow>
                      ))
                    : people.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{p.email}</TableCell>
                          <TableCell>
                            {demoLock.includes(p.id) ? (
                              (accountRoles[p.id] ?? "Karyawan")
                            ) : (
                              <select
                                aria-label={"Peran akun " + p.name}
                                value={accountRoles[p.id] ?? "Karyawan"}
                                onChange={(e) =>
                                  setAccountRoles((rs) => ({
                                    ...rs,
                                    [p.id]: e.target.value as Role,
                                  }))
                                }
                              >
                                <option>Karyawan</option>
                                <option>Manager</option>
                                <option>Admin HR</option>
                              </select>
                            )}
                          </TableCell>
                          <TableCell>
                            {demoLock.includes(p.id) ? (
                              <Status value="Aktif" />
                            ) : (
                              <select
                                aria-label={"Status akun " + p.name}
                                value={accountStatus[p.id] ?? p.status}
                                onChange={(e) =>
                                  setAccountStatus((ss) => ({
                                    ...ss,
                                    [p.id]: e.target.value,
                                  }))
                                }
                              >
                                <option>Aktif</option>
                                <option>Nonaktif</option>
                              </select>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
              {live && (
                <div className="report-grid" style={{ padding: 16 }}>
                  {people
                    .filter(
                      (p) =>
                        p.status === "Aktif" &&
                        !accounts.some((a) => a.employeeId === p.id),
                    )
                    .map((p) => (
                      <Button
                        key={p.id}
                        variant="outline"
                        disabled={accountBusy !== null}
                        onClick={() => {
                          setInviteEmployeeId(p.id);
                          setDialog("invite");
                        }}
                      >
                        Undang {p.name}
                      </Button>
                    ))}
                </div>
              )}
              <p className="table-meta">
                {live
                  ? `${accounts.length} akun terhubung. Perubahan memakai versi data terbaru. Akun sendiri tidak dapat dinonaktifkan; undangan diaktifkan oleh pemilik setelah menetapkan kata sandi.`
                  : "Simulasi pengaturan akun; tiga identitas penguji dikunci. Perubahan peran/status ini bukan pemberian akses nyata."}
              </p>
            </Panel>
          )}
          {view === "profile" && (
            <Panel title="Profil saya">
              <div className="profile">
                <Avatar name={currentUser.name} />
                <h2>{currentUser.name}</h2>
                <p>
                  {currentUser.position} · {currentUser.dept}
                </p>
                <div className="detail-grid">
                  <span>
                    Email<strong>{currentUser.email}</strong>
                  </span>
                  <span>
                    Nomor induk<strong>{currentUser.employeeNo}</strong>
                  </span>
                  <span>
                    Departemen<strong>{currentUser.dept}</strong>
                  </span>
                  <span>
                    Status<strong>{currentUser.status}</strong>
                  </span>
                  <span>
                    Telepon<strong>{currentUser.phone}</strong>
                  </span>
                  <span>
                    Tanggal bergabung
                    <strong>{date(currentUser.joinDate)}</strong>
                  </span>
                  <span>
                    Alamat<strong>{currentUser.address}</strong>
                  </span>
                </div>
                <Button variant="outline" onClick={() => setDialog("profile")}>
                  Edit kontak saya
                </Button>
              </div>
            </Panel>
          )}
          <footer className="page-footer">
            <span>PeopleSpace · Human Resource Information System</span>
            <span>Capstone Project / 4E</span>
          </footer>
        </main>
      </div>
      <Dialog
        open={!!dialog}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
      >
        <DialogContent className="modal-content">
          <DialogHeader>
            <DialogTitle>
              {
                (
                  {
                    employee: "Data karyawan",
                    leave: "Ajukan cuti",
                    review: "Penilaian kinerja",
                    payroll: "Edit payroll",
                    payslip: "Slip gaji",
                    detail: "Detail karyawan",
                    notifications: "Notifikasi",
                    department: "Tambah departemen",
                    position: "Tambah jabatan",
                    help: "Pusat bantuan",
                    reject: "Tolak pengajuan cuti",
                    profile: "Edit kontak saya",
                    "rename-department": "Ubah nama departemen",
                    "rename-position": "Ubah nama jabatan",
                    invite: "Undang akun pengguna",
                    "publish-payroll": "Konfirmasi penerbitan payroll",
                  } as Record<string, string>
                )[dialog ?? "help"]
              }
            </DialogTitle>
            <DialogDescription>
              {live
                ? "Workspace terhubung · perubahan disimpan ke server."
                : "Workspace demo · data contoh selama sesi ini."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "publish-payroll" && (
            <div>
              <p>
                Terbitkan payroll {period} untuk {payItems.length} karyawan?
                Setelah diterbitkan, komponen dikunci dan slip gaji dapat
                dilihat pemiliknya.
              </p>
              <p>Proses ini tidak mentransfer uang ke rekening.</p>
              <div className="inline-actions">
                <Button
                  variant="outline"
                  disabled={payBusy}
                  onClick={() => setDialog(null)}
                >
                  Batal
                </Button>
                <Button
                  disabled={payBusy || !payReadiness?.ready}
                  onClick={() => void publishRun()}
                >
                  {payBusy ? "Menerbitkan…" : "Ya, terbitkan"}
                </Button>
              </div>
            </div>
          )}
          {[
            "employee",
            "leave",
            "review",
            "payroll",
            "department",
            "position",
            "reject",
            "profile",
            "rename-department",
            "rename-position",
            "invite",
          ].includes(dialog ?? "") && (
            <form className="form-grid" onSubmit={submit}>
              {dialog === "invite" && (
                <>
                  <p className="full">
                    Undangan akan dikirim ke{" "}
                    {people.find((p) => p.id === inviteEmployeeId)?.email}.
                    Penerima harus menetapkan kata sandi sebelum akun aktif.
                  </p>
                  <label className="full">
                    Peran
                    <select name="role" defaultValue="EMPLOYEE" required>
                      <option value="EMPLOYEE">Karyawan</option>
                      <option value="MANAGER">Manager</option>
                      <option value="ADMIN_HR">Admin HR</option>
                    </select>
                  </label>
                  <p className="full">
                    Jika proses gagal sebagian, gunakan percobaan yang sama dan
                    minta HR melakukan rekonsiliasi. Jangan mengirim undangan
                    baru.
                  </p>
                </>
              )}
              {dialog === "employee" && (
                <>
                  <label>
                    Nomor induk
                    <Input
                      name="employeeNo"
                      readOnly={live && !selected.id.startsWith("new-")}
                      required
                      defaultValue={selected.employeeNo}
                    />
                  </label>
                  <label>
                    Telepon
                    <Input
                      name="phone"
                      type="tel"
                      required
                      defaultValue={selected.phone}
                    />
                  </label>
                  <label>
                    Tanggal bergabung
                    <Input
                      name="joinDate"
                      type="date"
                      required
                      defaultValue={selected.joinDate}
                    />
                  </label>
                  <label>
                    Alamat
                    <Input
                      name="address"
                      required
                      defaultValue={selected.address}
                    />
                  </label>
                  <label>
                    Nama lengkap
                    <Input name="name" required defaultValue={selected.name} />
                  </label>
                  <label>
                    Email
                    <Input
                      name="email"
                      readOnly={
                        live &&
                        accounts.some((a) => a.employeeId === selected.id)
                      }
                      type="email"
                      required
                      defaultValue={selected.email}
                    />
                  </label>
                  <label>
                    Departemen
                    <select name="dept" defaultValue={selected.dept}>
                      {[
                        ...new Set([
                          ...(live
                            ? master
                                .filter((d) => d.status === "ACTIVE")
                                .map((d) => d.name)
                            : people.map((p) => p.dept)),
                          ...extraDepts,
                        ]),
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Jabatan
                    {live ? (
                      <select
                        name="position"
                        required
                        defaultValue={selected.position}
                      >
                        <option value="">Pilih jabatan</option>
                        {masterPositions
                          .filter((p) => p.status === "ACTIVE")
                          .map((p) => (
                            <option key={p.id}>{p.name}</option>
                          ))}
                      </select>
                    ) : (
                      <Input
                        name="position"
                        required
                        defaultValue={selected.position}
                      />
                    )}
                  </label>
                  <label>
                    Gaji pokok
                    <Input
                      name="salary"
                      type="number"
                      min="0"
                      required
                      defaultValue={selected.salary}
                    />
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue={selected.status}>
                      <option>Aktif</option>
                      <option>Nonaktif</option>
                    </select>
                  </label>
                </>
              )}
              {dialog === "leave" && (
                <>
                  <label className="full">
                    Jenis cuti
                    <select name="type">
                      <option>Cuti tahunan</option>
                      <option>Izin</option>
                      <option>Sakit</option>
                    </select>
                  </label>
                  <label>
                    Tanggal mulai
                    <Input name="start" type="date" required min={today} />
                  </label>
                  <label>
                    Tanggal selesai
                    <Input name="end" type="date" required min={today} />
                  </label>
                  <label className="full">
                    Alasan
                    <textarea name="reason" rows={3} required />
                  </label>
                </>
              )}
              {dialog === "reject" && (
                <label className="full">
                  Alasan penolakan
                  <textarea name="reason" rows={3} required />
                </label>
              )}
              {dialog === "review" && (
                <>
                  <p className="full">
                    {selected.name} · {period}
                  </p>
                  <label className="full">
                    Nilai (0 – 100)
                    <Input
                      name="score"
                      type="number"
                      min="0"
                      max="100"
                      required
                      defaultValue={reviewFor(selected)?.score ?? ""}
                    />
                  </label>
                  <label className="full">
                    Catatan
                    <textarea
                      name="notes"
                      rows={4}
                      required
                      defaultValue={reviewFor(selected)?.notes}
                    />
                  </label>
                </>
              )}
              {dialog === "payroll" && (
                <>
                  <p className="full">
                    {selected.name} · {period} · Gaji pokok{" "}
                    {live && !salaryConfigured(payFor(selected).salary)
                      ? "belum diisi — lengkapi data karyawan"
                      : money(live ? payFor(selected).salary : selected.salary)}
                  </p>
                  <label>
                    Tunjangan
                    <Input
                      type="number"
                      min="0"
                      required
                      value={allowance}
                      onChange={(e) => setAllowance(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Bonus
                    <Input
                      type="number"
                      min="0"
                      required
                      value={bonus}
                      onChange={(e) => setBonus(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Potongan
                    <Input
                      type="number"
                      min="0"
                      max={
                        (live ? payFor(selected).salary : selected.salary) +
                        allowance +
                        bonus
                      }
                      required
                      value={deduction}
                      onChange={(e) => setDeduction(Number(e.target.value))}
                    />
                  </label>
                  <div className="full payroll-total">
                    Gaji bersih
                    <strong>
                      {live && !salaryConfigured(payFor(selected).salary)
                        ? "Belum siap"
                        : payrollNet(
                              live ? payFor(selected).salary : selected.salary,
                              allowance,
                              bonus,
                              deduction,
                            ) === null
                          ? "Komponen tidak valid"
                          : money(
                              payrollNet(
                                live
                                  ? payFor(selected).salary
                                  : selected.salary,
                                allowance,
                                bonus,
                                deduction,
                              )!,
                            )}
                    </strong>
                  </div>
                </>
              )}
              {dialog === "profile" && (
                <>
                  <label>
                    Telepon
                    <Input
                      name="phone"
                      type="tel"
                      required
                      defaultValue={currentUser.phone}
                    />
                  </label>
                  <label>
                    Alamat
                    <Input
                      name="address"
                      required
                      defaultValue={currentUser.address}
                    />
                  </label>
                </>
              )}
              {[
                "department",
                "position",
                "rename-department",
                "rename-position",
              ].includes(dialog ?? "") && (
                <label className="full">
                  Nama
                  <Input
                    name="name"
                    required
                    defaultValue={
                      dialog?.startsWith("rename-") ? masterName : ""
                    }
                  />
                </label>
              )}
              <div className="full form-actions">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDialog(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={
                    live &&
                    (accountBusy !== null || (dialog === "payroll" && payBusy))
                  }
                >
                  {dialog === "leave"
                    ? "Kirim pengajuan"
                    : dialog === "invite"
                      ? "Kirim undangan"
                      : "Simpan"}
                </Button>
              </div>
            </form>
          )}
          {dialog === "detail" && (
            <div className="profile">
              <Avatar name={selected.name} />
              <h2>{selected.name}</h2>
              <p>{selected.position}</p>
              <div className="detail-grid">
                <span>
                  Email<strong>{selected.email}</strong>
                </span>
                <span>
                  Departemen<strong>{selected.dept}</strong>
                </span>
                <span>
                  Status<strong>{selected.status}</strong>
                </span>
                <span>
                  Nomor induk<strong>{selected.employeeNo}</strong>
                </span>
                <span>
                  Telepon<strong>{selected.phone}</strong>
                </span>
                <span>
                  Tanggal bergabung<strong>{date(selected.joinDate)}</strong>
                </span>
                <span>
                  Alamat<strong>{selected.address}</strong>
                </span>
              </div>
              {role === "Admin HR" && (
                <Button disabled={employeeBusy} onClick={() => edit(selected)}>
                  Edit karyawan
                </Button>
              )}
            </div>
          )}
          {dialog === "payslip" && (
            <div className="payslip">
              <div className="brand">
                <span className="logo">p.</span>PeopleSpace
              </div>
              <p>{period}</p>
              <p>
                {processed
                  ? live
                    ? "Diterbitkan"
                    : "Diterbitkan (simulasi)"
                  : live
                    ? "Draft · belum diterbitkan"
                    : "Draft simulasi · bukan slip resmi"}
              </p>
              <h2>{selected.name}</h2>
              <p>
                {selected.position} · {selected.dept}
              </p>
              {[
                ["Gaji pokok", payFor(selected).salary],
                ["Tunjangan", payFor(selected).allowance],
                ["Bonus", payFor(selected).bonus],
                ["Potongan", payFor(selected).deduction],
              ].map(([k, v]) => (
                <div className="payslip-row" key={String(k)}>
                  <span>{k}</span>
                  <strong>
                    {live &&
                    !processed &&
                    k === "Gaji pokok" &&
                    !salaryConfigured(Number(v))
                      ? "Belum diisi"
                      : money(Number(v))}
                  </strong>
                </div>
              ))}
              <div className="payroll-total">
                Gaji bersih
                <strong>
                  {live &&
                  !processed &&
                  !salaryConfigured(payFor(selected).salary)
                    ? "Belum siap"
                    : money(total(selected))}
                </strong>
              </div>
              <Button
                className="w-full"
                disabled={live && !processed}
                onClick={() => window.print()}
              >
                <Download size={16} />
                Cetak atau simpan PDF
              </Button>
            </div>
          )}
          {dialog === "notifications" && (
            <div>
              {visibleLeaves.map((l) => (
                <button
                  key={l.id}
                  className="notification-row"
                  onClick={() => {
                    setDialog(null);
                    go("leave");
                  }}
                >
                  <CalendarDays size={19} />
                  <div>
                    <strong>
                      {people.find((p) => p.id === l.employee)?.name} mengajukan
                      cuti · {l.status}
                    </strong>
                    <small>
                      {date(l.start)} · {days(l.start, l.end)} hari
                    </small>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!visibleLeaves.length && <p>Tidak ada notifikasi baru.</p>}
            </div>
          )}
          {dialog === "help" && (
            <div className="help-copy">
              <p>
                {live
                  ? "Hak akses berasal dari akun login. Hubungi Admin HR bila perlu perubahan peran atau status."
                  : "Ganti peran di kanan atas untuk mencoba Admin HR, Manager, atau Karyawan."}
              </p>
              <p>
                Admin HR mengelola karyawan dan payroll. Manager memutuskan cuti
                dan memberi penilaian tim departemennya. Karyawan dapat absen,
                mengajukan cuti, serta melihat slip gaji.
              </p>
              <p>
                {live
                  ? "Perubahan disimpan ke Supabase. Payroll yang sudah diterbitkan tidak bisa diedit. Bila data berubah, muat ulang sebelum menyimpan. Pemulihan kata sandi tersedia di halaman masuk."
                  : "Perubahan demo berlaku selama sesi. Refresh mengembalikan data contoh."}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Toaster richColors position="bottom-right" />
    </SidebarProvider>
  );
}
