"""Editable vector UML report. No network, credentials, or business writes."""
from pathlib import Path
from math import atan2, cos, sin, pi
from shutil import copy2
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/UML_Revisi_HRIS_v3.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("UI", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("UIB", "C:/Windows/Fonts/arialbd.ttf"))
W, H = landscape(A4)
c = canvas.Canvas(str(OUT), pagesize=(W, H))
c.setTitle("Perencanaan dan UML HRIS - Revisi v3")
c.setAuthor("Kelompok Capstone Project HRIS - Kelas 4E")
INK, BLUE, LIGHT, MUTED = map(HexColor, ["#142D4E", "#315DE1", "#F1F5FD", "#5D6D83"])
page = 0

def text(x, y, value, size=10, bold=False, color=INK, align="left"):
    c.setFillColor(color); c.setFont("UIB" if bold else "UI", size)
    method = c.drawCentredString if align == "center" else c.drawRightString if align == "right" else c.drawString
    method(x, y, str(value))

def wrap(value, width, size=10):
    lines, line = [], ""
    for word in value.split():
        candidate = (line + " " + word).strip()
        if pdfmetrics.stringWidth(candidate, "UI", size) > width and line:
            lines.append(line); line = word
        else: line = candidate
    return lines + [line]

def para(x, y, value, width=740, size=11, leading=17):
    for line in wrap(value, width, size):
        text(x, y, line, size); y -= leading
    return y

def centered(x, y, value, width, size=10):
    lines = wrap(value, width, size)
    for i, line in enumerate(lines): text(x, y + (len(lines)-1)*6-i*12-3, line, size, align="center")

def begin(title, subtitle):
    global page
    page += 1
    c.setFillColor(white); c.rect(0, 0, W, H, fill=1, stroke=0)
    text(40, H-40, title, 21, True)
    text(40, H-61, subtitle, 10, color=MUTED)
    c.setStrokeColor(BLUE); c.setLineWidth(2); c.line(40, H-75, W-40, H-75)

def finish(note="Acuan: PRD bagian 23/27, API /api/v1, migrasi Supabase 0001-0013."):
    for i, line in enumerate(wrap(note, 555, 8)):
        text(40, 36-i*10, line, 8, color=MUTED)
    text(W-40, 30, f"PeopleSpace HRIS | v3 | {page}", 8, color=MUTED, align="right")
    c.showPage()

def box(x, y, label, width=175, height=38, fill=LIGHT, size=10):
    c.setStrokeColor(INK); c.setLineWidth(.9); c.setFillColor(fill)
    c.roundRect(x-width/2, y-height/2, width, height, 7, fill=1, stroke=1)
    centered(x, y, label, width-14, size)

def arrow(x1, y1, x2, y2, label="", dashed=False, hollow=False):
    c.setStrokeColor(MUTED); c.setFillColor(MUTED); c.setLineWidth(.85)
    if dashed: c.setDash(4, 3)
    c.line(x1,y1,x2,y2); c.setDash()
    a=atan2(y2-y1,x2-x1); s=6
    p=c.beginPath(); p.moveTo(x2,y2)
    p.lineTo(x2-s*cos(a-pi/6),y2-s*sin(a-pi/6)); p.lineTo(x2-s*cos(a+pi/6),y2-s*sin(a+pi/6)); p.close()
    if hollow: c.setFillColor(white)
    c.drawPath(p,fill=1,stroke=1)
    if label: text((x1+x2)/2+4,(y1+y2)/2+6,label,8)

def orth(points,label=""):
    for a,b in zip(points,points[1:-1]):
        c.setStrokeColor(MUTED); c.setLineWidth(.85); c.line(*a,*b)
    arrow(*points[-2],*points[-1],label)

def diamond(x,y,label,width=140,height=45):
    c.setStrokeColor(INK); c.setFillColor(white)
    p=c.beginPath(); p.moveTo(x,y+height/2); p.lineTo(x+width/2,y); p.lineTo(x,y-height/2); p.lineTo(x-width/2,y);p.close()
    c.drawPath(p,fill=1,stroke=1);centered(x,y,label,width-28,9)

def dot(x,y,final=False):
    c.setStrokeColor(INK);c.setFillColor(INK);c.circle(x,y,5,fill=1,stroke=1)
    if final:c.circle(x,y,9,fill=0,stroke=1)

def actor(x,y,name):
    c.setStrokeColor(INK);c.setLineWidth(1)
    c.circle(x,y+20,8,fill=0,stroke=1);c.line(x,y+12,x,y-15)
    c.line(x-14,y+4,x+14,y+4);c.line(x,y-15,x-12,y-30);c.line(x,y-15,x+12,y-30)
    text(x,y-48,name,10,True,align="center")

begin("PERENCANAAN DAN PERANCANGAN HRIS", "Laporan revisi implementasi demo Capstone Project | 11 Oktober 2026")
text(40, H-124, "Kelompok Capstone Project Topik HRIS", 20, True, BLUE)
text(40, H-156, "Kelas: 4E", 14, True)
for y, name, nim in [(365,"Mochamad Faisal","2313020196"),(334,"Wilda Putra Cahya Ramadhan","2313020203"),(303,"Jonatan Arya Santosa","2313020222")]:
    text(40,y,name,13);text(445,y,nim,13,True)
y=para(40,245,"PeopleSpace HRIS mengintegrasikan direktori karyawan, absensi, cuti, payroll dan penilaian kinerja bulanan. HR mengelola organisasi, Manager mengawasi departemen, dan Karyawan mengakses layanan pribadinya. Semua role memiliki layanan pribadi tanpa memperoleh akses gaji rekan.",740)
y=para(40,y-13,"Implementasi: frontend Next.js/React/TypeScript, Route Handlers sebagai API, Supabase Auth serta PostgreSQL/RLS/RPC, Vercel untuk hosting. Mutasi kritis memakai transaksi, versi, otorisasi server dan audit. GitHub Actions memeriksa commit sebelum deploy.",740)
para(40,y-13,"Khusus demonstrasi akademik. Gaji pokok 40 akun kelas adalah contoh Rp3.000.000/bulan; KPI tidak mengubah gaji. Model PowerDesigner asli tidak ditimpa. Paket ini merevisi alur dan model domain, bukan sistem payroll produksi.",740)
finish()

begin("01 / Use Case Diagram per role", "Kewenangan khusus + layanan pribadi bersama; setiap panel merupakan bagian dari sistem HRIS yang sama.")
panels=[("Admin HR",["Login / logout","Kelola karyawan, akun dan master","Kelola kebijakan dan audit","Proses / terbitkan payroll","Putuskan cuti fallback dan koreksi","Nilai KPI Manager"]),
        ("Manager",["Login / logout","Lihat tim departemen","Putuskan cuti anggota tim","Susun dan bagikan target KPI","Isi bukti / finalkan KPI tim","Lihat KPI pribadi dari HR"]),
        ("Karyawan",["Login / logout","Kelola kontak pribadi","Absen masuk / keluar","Ajukan / batalkan cuti PENDING","Ajukan koreksi / lihat slip sendiri","Lihat target KPI dan hasil final"])]
for i,(role,cases) in enumerate(panels):
    x=40+i*260
    text(x+120,490,role,12,True,align="center")
    c.setStrokeColor(MUTED);c.rect(x+65,110,185,355,fill=0,stroke=1)
    text(x+155,450,"PeopleSpace HRIS",9,True,align="center")
    actor(x+27,310,role)
    for j,case in enumerate(cases):
        cy=418-j*53;c.setStrokeColor(INK);c.setFillColor(white)
        c.ellipse(x+75,cy-19,x+240,cy+19,fill=1,stroke=1)
        centered(x+157,cy,case,151,9)
        c.setStrokeColor(MUTED);c.line(x+42,310,x+75,cy)
para(40,85,"HR dan Manager juga melakukan kontak/absensi/cuti/koreksi/slip pribadi. Semua mutasi memerlukan sesi aktif. Tidak ada persetujuan atau penilaian diri sendiri. HR menilai KPI Manager saja, Manager bukan penilai Manager lain.",740,9,13)
finish("Notasi: aktor di luar batas sistem; oval = use case; garis = asosiasi, bukan urutan proses.")

def lanes(names):
    for i,name in enumerate(names):
        x=40+i*254;c.setStrokeColor(HexColor("#D8E0EF"));c.rect(x,50,254,450,stroke=1,fill=0)
        text(x+127,483,name,11,True,align="center")

begin("02 / Activity Diagram - Pengajuan cuti", "Kalender dan quota divalidasi server; keputusan mengikuti role, scope dan versi.")
lanes(["Pemohon: semua role","Sistem / Supabase","Penilai: Manager atau HR"])
dot(167,452);box(167,405,"Ajukan tanggal, jenis dan alasan")
arrow(167,447,167,424);arrow(255,405,333,363)
box(421,363,"Validasi kalender, bentrok, quota")
arrow(421,344,421,323);diamond(421,300,"Valid?")
arrow(351,300,255,300,"[tidak]");box(167,300,"Perbaiki input / pesan gagal")
orth([(167,319),(167,353),(167,386)],"ulang")
arrow(421,277,421,252,"[ya]");box(421,232,"Simpan PENDING; reservasi quota")
arrow(421,213,421,194);diamond(421,170,"Aksi berikut?")
arrow(351,170,255,170,"[batalkan]");box(167,170,"Pemilik membatalkan PENDING")
arrow(167,151,167,121);box(167,100,"CANCELLED; reservasi dilepas")
arrow(167,81,167,77);dot(167,69,True)
arrow(491,170,588,170,"[tinjau]");box(675,170,"Cek penilai / bukan diri sendiri")
arrow(675,151,675,130);box(675,110,"APPROVED atau REJECTED")
arrow(675,91,675,87);dot(675,79,True)
text(540,55,"Alasan wajib jika ditolak; audit + notifikasi",8)
finish("Fallback: HR menangani Manager atau departemen tanpa Manager aktif. Status keputusan final tidak dibatalkan langsung.")

begin("03 / Activity Diagram - KPI", "Tahapan target transparan berbeda dari evaluasi privat. Arah HIGHER/LOWER + bobot total 100%.")
lanes(["Penilai: Manager / HR","Sistem / Supabase","Pemilik KPI"])
dot(167,452);box(167,410,"Susun target, bobot, cara ukur")
arrow(167,447,167,429);arrow(255,410,333,410);box(421,410,"Validasi / simpan DRAFT")
arrow(421,391,421,365);box(421,345,"Bagikan snapshot target aman")
arrow(167,391,167,345);box(167,345,"Konfirmasi Bagikan target")
arrow(255,345,333,345);arrow(509,345,588,345);box(675,345,"Baca target; belum melihat nilai")
arrow(421,326,421,300);box(421,280,"Kunci target / bobot / cara ukur")
arrow(167,326,167,280);box(167,280,"Isi realisasi dan bukti; simpan")
arrow(255,280,333,280);arrow(167,261,167,219);box(167,200,"Konfirmasi final + versi review")
arrow(255,200,351,200);diamond(421,200,"Lengkap / versi cocok?")
orth([(421,222),(548,222),(548,245),(255,245),(255,261)])
text(262,249,"[tidak: perbaiki / muat ulang]",8)
arrow(421,177,421,153,"[ya]");box(421,132,"Hitung nilai; atomik KPI + review")
arrow(509,132,588,132);box(675,132,"Baca hasil final + notifikasi")
arrow(421,113,421,92);dot(421,80,True)
finish("Target dibagikan tanpa actual/evidence/notes/score. HR menilai Manager; Manager menilai tim, tanpa self-assessment.")

begin("03b / Activity Diagram - Absensi dan koreksi", "Tanggal Jakarta dan jam server; koreksi tidak langsung menimpa catatan absensi.")
lanes(["Pemilik: semua role","Sistem / Supabase","HR selain pemilik"])
dot(167,452);arrow(167,447,167,429);box(167,410,"Minta check-in / check-out hari ini")
arrow(255,410,333,410);box(421,410,"Cek aktif, hari kerja, cuti, duplikat")
arrow(421,391,421,374);diamond(421,350,"Memenuhi aturan?")
arrow(351,350,255,350,"[tidak]");box(167,350,"Pesan gagal; tidak menyimpan")
arrow(167,331,167,312);dot(167,304,True)
arrow(421,327,421,308,"[ya]");box(421,287,"Simpan jam, status, snapshot policy")
arrow(421,268,421,250);dot(421,242,True)
text(588,285,"HR tidak terlibat check-in langsung",9)
dot(167,235);arrow(167,230,167,215)
box(167,196,"Ajukan koreksi tanggal <= 30 hari")
arrow(255,196,333,196);box(421,196,"Simpan koreksi PENDING + versi")
arrow(509,196,588,196);box(675,196,"Tinjau jam, alasan; putuskan")
arrow(675,177,675,156);diamond(675,133,"Setuju / versi cocok?")
arrow(605,133,509,133,"[ya]");box(421,133,"Update absensi; audit; APPROVED")
arrow(421,114,421,96);dot(421,88,True)
arrow(675,110,675,99);text(746,90,"[tidak] ditolak / konflik",8,align="center");dot(675,82,True)
finish("Check-out mengikuti record check-in yang ada. Koreksi ditolak tidak mengubah absensi; self-approval HR dilarang.")

def sequence(title,subtitle,participants,messages,note):
    begin(title,subtitle)
    xs=[65+i*(W-130)/(len(participants)-1) for i in range(len(participants))]
    for x,name in zip(xs,participants):
        box(x,474,name,110,35,size=9)
        c.setStrokeColor(MUTED);c.setDash(4,3);c.line(x,456,x,95);c.setDash()
    gap=min(35,330/max(1,len(messages)-1))
    for n,(source,target,label,response) in enumerate(messages):
        y=427-n*gap
        arrow(xs[source],y,xs[target],y,dashed=response)
        lo=min(xs[source],xs[target]);hi=max(xs[source],xs[target]);mid=(lo+hi)/2
        centered(mid,y+13,f"{n+1}. {label}",max(100,hi-lo-15),8)
    para(40,74,note,740,9,12);finish("Garis putus = respons. Setiap mutasi melewati same-origin check, sesi aktif dan otorisasi RPC; gagal tidak mengubah data.")

sequence("04 / Sequence - Pengajuan dan persetujuan cuti","Contoh jalur sukses; penolakan/fallback mengikuti Activity dan kebijakan role.",
 ["Pemohon","Next.js API","Supabase RPC","Penilai"],[
 (0,1,"POST leave-requests: jenis, tanggal, alasan",False),(1,2,"JWT + create_leave_request",False),
 (2,1,"Validasi; simpan PENDING + quota + audit",True),(1,0,"201 + ID / status / version",True),
 (3,1,"GET daftar pengajuan terotorisasi",False),(1,3,"PENDING + canDecide + versi",True),
 (3,1,"POST decision + expectedVersion",False),(1,2,"decide_leave_request; lock + cek scope",False),
 (2,1,"APPROVED/REJECTED; audit + metadata",True),(1,3,"200 keputusan tersimpan",True),
 (0,1,"GET status / notifications",False),(1,0,"Status, penilai, alasan / notifikasi pribadi",True)],
 "Pemohon dapat membatalkan PENDING. Manager tidak menyetujui sendiri; HR fallback bukan akses blanket untuk semua anggota tim.")

sequence("05 / Sequence - Draft dan penerbitan payroll","Roster seluruh karyawan aktif; salary 0 menghalangi penerbitan, bukan gaji nyata nol.",
 ["Admin HR","Next.js API","Supabase RPC","Pemilik slip"],[
 (0,1,"Buat draft: periode + idempotency key",False),(1,2,"create_payroll_run; snapshot salary / roster",False),
 (2,1,"DRAFT + item per karyawan aktif",True),(1,0,"201 draft dan versi",True),
 (0,1,"GET items / readiness; edit komponen",False),(1,0,"Nominal snapshot / missing salary / stale roster",True),
 (0,1,"Sinkronkan jika perlu; konfirmasi publish",False),(1,2,"publish_payroll_run + expectedVersion",False),
 (2,1,"Lock; validasi; PUBLISHED immutable + audit",True),(1,0,"200 terbit; tanpa transfer uang",True),
 (3,1,"GET me/payslips atau payslip ID",False),(1,3,"Hanya item milik sendiri yang terbit",True)],
 "Payroll live uji tidak diterbitkan bagi akun kelas tanpa izin. Regresi database menguji publish nyata lalu rollback; payroll historis tetap utuh.")

sequence("06 / Sequence - Target aman dan final KPI","Penilai = Manager untuk tim atau HR untuk Manager. Final memperbarui performance review secara atomik.",
 ["Penilai","Next.js API","Supabase RPC","Pemilik KPI"],[
 (0,1,"PUT kpis: indikator, notes, expectedVersion",False),(1,2,"save_kpi; cek scope / validasi / versi",False),
 (2,1,"DRAFT tersimpan",True),(1,0,"200 draf; editor ditutup",True),(0,1,"POST share-goals + versi; konfirmasi",False),
 (1,2,"Snapshot aman; kunci target; audit",False),(3,1,"GET kpi-goals / notifications",False),
 (1,3,"Target / bobot / cara ukur saja",True),(0,1,"PUT actual / evidence; target tetap",False),
 (0,1,"POST publish + versi KPI/review",False),(1,2,"Hitung bobot; KPI + review + audit atomik",False),
 (2,1,"PUBLISHED + skor server",True),(3,1,"GET kpis / performance-reviews",False),
 (1,3,"Final sendiri; review kpi_id; terkunci",True)],
 "Konflik versi menolak perubahan; target bersama tidak dapat digeser diam-diam. KPI final tidak dapat ditimpa review manual dan tidak memicu bonus/gaji.")

def klass(x,y,name,attributes,operations=(),width=210):
    # Fixed-size class compartments make relations predictable and legible.
    height=145;left=x-width/2;top=y+height/2
    c.setStrokeColor(INK);c.setFillColor(white);c.rect(left,y-height/2,width,height,fill=1,stroke=1)
    c.setFillColor(LIGHT);c.rect(left,top-27,width,27,fill=1,stroke=0)
    text(x,top-18,name,11,True,align="center");c.line(left,top-27,left+width,top-27)
    ay=top-43
    for attribute in attributes:text(left+10,ay,attribute,9);ay-=13
    opy=y-height/2+31;c.line(left,opy+8,left+width,opy+8)
    for operation in operations:text(left+10,opy-5,operation,9);opy-=12

def relation(a,b,left="1",right="0..*",label=""):
    c.setStrokeColor(MUTED);c.setLineWidth(.85);c.line(*a,*b)
    if a[1]==b[1]:
        sign=1 if b[0]>a[0] else -1
        text(a[0]+sign*11,a[1]+8,left,8,align="center")
        text(b[0]-sign*15,b[1]+8,right,8,align="center")
    else:
        text(a[0]+4,a[1]+5,left,8);text(b[0]+4,b[1]+5,right,8)
    if label: text((a[0]+b[0])/2,(a[1]+b[1])/2-14,label,7,align="center")

begin("07 / Class Diagram - Identitas dan akses", "Model domain konseptual; PK/FK mengikuti tabel. Operasi mewakili perilaku API/RPC, bukan metode ORM.")
klass(150,402,"Department",["id: UUID {PK}","name: String","status: MasterStatus"],["+ rename(version)"])
klass(421,402,"Employee",["id: UUID {PK}","employeeNo: String {unique}","departmentId, positionId: UUID","status: ACTIVE | INACTIVE","version: Integer"],["+ update(expectedVersion)"])
klass(691,402,"Position",["id: UUID {PK}","name: String","status: MasterStatus"],["+ rename(version)"])
relation((255,402),(316,402),"1","0..*");relation((586,402),(526,402),"1","0..*")
klass(150,164,"UserProfile",["userId: UUID {PK, Auth FK}","employeeId: UUID {unique FK}","role: HR | MANAGER | EMPLOYEE","accountStatus: AccountStatus"],["+ authorize(actor)"])
klass(421,164,"EmployeeContact",["employeeId: UUID {PK, FK}","phone, address: String","version: Integer"],["+ updateOwn(version)"])
klass(691,164,"EmployeeCompensation",["<<private>>","employeeId: UUID {PK, FK}","baseSalaryIdr: Integer"],["+ updateByHR(version)"])
relation((350,330),(230,237),"1","0..1");relation((421,330),(421,237),"1","1");relation((492,330),(612,237),"1","1")
text(40,62,"Auth user 1 - 0..1 UserProfile. Compensation tidak tersedia pada direktori atau akses kolega Manager/Karyawan.",9)
finish()

begin("08 / Class Diagram - Transaksi dan kebijakan", "Employee direferensikan oleh semua transaksi pribadi; diagram dibagi agar atribut tetap terbaca.")
klass(150,402,"Attendance",["id, employeeId: UUID","workDate: Date {unique per owner}","checkIn, checkOut: Timestamp","status: PRESENT | LATE"],["+ checkIn() / checkOut()"])
klass(421,402,"AttendanceCorrection",["id, employeeId: UUID","workDate; requestedIn/Out","status: PENDING | APPROVED", "| REJECTED; version"],["+ request() / decide(version)"])
klass(691,402,"HRPolicy",["id, version: Integer","workDays, holidays: Calendar","workStart, workEnd: Time","leaveQuota, sickBackdate"],["+ updateByHR(version)"])
relation((255,402),(316,402),"0..1","0..*","corrects date")
klass(150,164,"LeaveRequest",["id, employeeId: UUID","type; startDate, endDate","workingDays; policy snapshot","PENDING -> APPROVED /", "REJECTED / CANCELLED"],["+ cancel() / decide(version)"])
klass(421,164,"PayrollRun",["id: UUID; period: YYYY-MM","status: DRAFT | PUBLISHED","publishedAt; version"],["+ sync() / publish(version)"])
klass(691,164,"PayrollItem",["id, employeeId, runId: UUID","baseSalarySnapshot: Integer","allowance, bonus, deduction","netSalary; status; version"],["+ updateDraft(version)"])
relation((526,164),(586,164),"1","1..*","contains")
text(40,62,"Employee 1 - 0..* Attendance / Correction / LeaveRequest / PayrollItem. Policy tersimpan sebagai snapshot pada transaksi.",9)
finish()

begin("09 / Class Diagram - KPI dan audit", "Realisasi, bukti, notes dan skor draf tidak masuk snapshot target bersama.")
klass(150,402,"KpiAssessment",["id, employeeId: UUID","period; indicators: JSON[]","notes; status; score; version","goalsSharedAt; publishedAt"],["+ save() / share() / publish()"])
klass(421,402,"KpiGoalPlan",["assessmentId: UUID {PK, FK}","employeeId; period {unique}","targetIndicators: JSON[]","sharedAt; sharedBy"],["+ readSafeTargets()"])
klass(691,402,"PerformanceReview",["id, employeeId: UUID","period; score; notes; version","assessedBy, assessedAt","kpiId: UUID? {FK}"],["+ upsert() / readFinal()"])
relation((255,402),(316,402),"1","0..1","shares")
c.setStrokeColor(MUTED);c.line(215,475,215,501);c.line(215,501,625,501);c.line(625,501,625,475)
text(223,483,"1",8);text(633,483,"0..1",8)
text(420,506,"KpiAssessment menghasilkan review final",8,align="center")
klass(150,164,"KpiIndicator",["<<value object in JSON>>","name, unit, direction","target > 0; weight: 1..100","actual: Number?; evidence","measurement: String"],["+ weightedScore()"])
klass(421,164,"AuditEvent",["<<private, append-only>>","id; actorUserId; action","resourceType; resourceId","metadata; occurredAt"],["+ append() / readByHR()"])
klass(691,164,"NotificationRead",["<<private>>","userId + eventId: composite PK","readAt: Timestamp","events derived from records"],["+ markOwnRead()"])
c.setStrokeColor(INK);c.setFillColor(INK)
p=c.beginPath();p.moveTo(150,330);p.lineTo(145,323);p.lineTo(150,316);p.lineTo(155,323);p.close();c.drawPath(p,fill=1,stroke=1)
relation((150,316),(150,237),"1","1..10")
text(40,62,"Employee 1 - 0..* KPI/Review. Audit actor 0..1 UserProfile; ReadReceipt owner 1 UserProfile. Total indikator = 100% bobot.",9)
finish()

begin("10 / Keterlacakan dan batas demonstrasi", "FR terbaru dipetakan ke diagram serta verifikasi, bukan sekadar kebutuhan yang direncanakan.")
entries=[
 ("FR46-48","Layanan pribadi, fallback, CANCELLED","Use Case; Activity/Sequence cuti; Class transaksi"),
 ("FR49-51","Kalender, koreksi, kebijakan HR","Use Case; Class Attendance/Correction/HRPolicy"),
 ("FR52-53","Notifikasi, audit, akun aktif","Use Case; Class identitas/KPI/audit"),
 ("FR54-56","KPI berbobot, target aman, HR menilai Manager","Activity/Sequence KPI; Class KPI/review/goal plan"),
 ("Payroll","Snapshot, readiness, final immutable","Sequence payroll; Class PayrollRun/Item"),
]
y=475
for key,need,diagram in entries:
    text(40,y,key,12,True,BLUE);text(165,y,need,11)
    text(165,y-20,diagram,10,color=MUTED);y-=62
y=para(40,150,"Pengujian: unit/route, regresi database rollback-only, browser mock desktop/ponsel, dan UAT tiga role dengan Supabase nyata. Data UAT berlabel [UAT], tidak mengganti identitas/password akun kelas. Payroll historis tidak diubah; uji publish payroll di-rollback, tidak mengirim uang atau membuat slip kelas tambahan.",740,10,15)
para(40,y-10,"Belum termasuk: pajak/BPJS/transfer bank, histori effective salary/resign/prorata, delegasi supervisor, KPI otomatis dari sistem operasional, kalibrasi, GPS/fingerprint, backup recovery drill, dan audit kepatuhan produksi. Sumber detail: docs/DEMO_CAPSTONE.md dan PRD bagian 27.",740,10,15)
finish()
c.save()
reader=PdfReader(OUT)
assert len(reader.pages)==12
assert all(len(p.extract_text())>200 for p in reader.pages)
# Same generated deliverable next to the untouched academic UML originals.
local_revision=ROOT.parent / "UML/Revisi_2026-10-11"
local_revision.mkdir(parents=True,exist_ok=True)
copy2(OUT,local_revision/OUT.name)
print(f"Created {len(reader.pages)} verified-text pages: {OUT}")
