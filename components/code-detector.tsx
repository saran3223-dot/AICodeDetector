"use client";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileCheck2,
  FolderOpen,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  Plus,
  RefreshCw,
  RotateCw,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  WifiOff,
  X,
  XCircle,
  TriangleAlert,
} from "lucide-react";
import type {
  Extraction,
  Outcome,
  Report,
  ServiceConfig,
  Standard,
} from "@/lib/types";
import { outcomeLabel } from "@/lib/types";
import { bangkokToday, inspect } from "@/lib/inspection";
import {
  allReports,
  deleteReport,
  readSetting,
  saveReport,
  writeSetting,
} from "@/lib/local-store";
import {
  blobDataUrl,
  downloadBlob,
  imageFromFile,
  renderReport,
  rotateImage,
  previewDataUrl,
} from "@/lib/report-image";
import { StandardEditor, CorrectionEditor, Modal } from "./editors";
type Tab = "overview" | "scan" | "reports" | "standards" | "settings";
const tabs: [Tab, string, typeof Camera][] = [
  ["overview", "ภาพรวม", LayoutDashboard],
  ["scan", "ตรวจสินค้า", ScanLine],
  ["reports", "รายงาน", FileCheck2],
  ["standards", "มาตรฐาน", SlidersHorizontal],
];
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  let data: T & { error?: string };
  try {
    data = (await response.json()) as T & { error?: string };
  } catch {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
  }
  if (!response.ok) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
  return data;
}
const fmt = (v: string) =>
  new Date(v).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const reportId = (id: string) => "CD-" + id.slice(0, 8).toUpperCase();
function LineIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 3C6.48 3 2 6.6 2 11.03c0 3.97 3.55 7.29 8.35 7.92.33.07.77.21.88.49.1.25.07.63.03.89l-.14.84c-.04.25-.2.97.85.53 1.06-.44 5.7-3.34 7.77-5.72C21.18 14.43 22 12.83 22 11.03 22 6.6 17.52 3 12 3Zm-5.02 9.75H5.35V9.3h.8v2.66h.83v.79Zm1.3 0h-.8V9.3h.8v3.45Zm3.75 0h-.8l-1.5-2.04v2.04h-.8V9.3h.8l1.5 2.04V9.3h.8v3.45Zm2.95-2.66h-1.37v.53h1.37v.8h-1.37v.54h1.37v.79h-2.17V9.3h2.17v.79Z" />
    </svg>
  );
}
function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <ScanLine size={23} />
      </span>
      <span>
        Code<span className="brand-light">Detector</span>
        <small>PRODUCT QUALITY INTELLIGENCE</small>
      </span>
    </span>
  );
}
function Status({ status }: { status: Outcome }) {
  const Icon =
    status === "pass"
      ? CheckCircle2
      : status === "fail"
        ? XCircle
        : TriangleAlert;
  return (
    <span className={"status " + status}>
      <Icon size={14} />
      {outcomeLabel[status]}
    </span>
  );
}
function ScannerArt() {
  return (
    <div className="scanner-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="scan-corners">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="label-art">
        <div className="label-top">
          <span>▦</span> PRODUCT CODE
        </div>
        <div className="print-code">
          MFG <b>DD / MM / YYYY</b>
        </div>
        <div className="print-code">
          EXP <b>DD / MM / YYYY</b>
        </div>
        <div className="barcode">
          {Array.from({ length: 34 }, (_, i) => (
            <i
              key={i}
              style={{ width: (i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1) + "px" }}
            />
          ))}
        </div>
        <div className="scan-beam" />
      </div>
      <div className="art-spark">
        <Sparkles size={16} />
      </div>
    </div>
  );
}
export default function CodeDetector() {
  const [tab, setTab] = useState<Tab>("overview"),
    [standards, setStandards] = useState<Standard[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [config, setConfig] = useState<ServiceConfig | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(true),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [image, setImage] = useState(""),
    [selected, setSelected] = useState(""),
    [remembered, setRemembered] = useState(""),
    [current, setCurrent] = useState<Report | null>(null),
    [filter, setFilter] = useState<Outcome | "all">("all"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Standard | null | undefined>(undefined),
    [correcting, setCorrecting] = useState(false),
    [help, setHelp] = useState(false),
    [deleting, setDeleting] = useState<Report | null>(null),
    [date, setDate] = useState("");
  const upload = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    importer = useRef<HTMLInputElement>(null),
    sequence = useRef(0);
  const liffRef = useRef<
    Awaited<typeof import("@line/liff")>["default"] | null
  >(null);
  useEffect(() => {
    setRemembered(readSetting("last-product"));
    setOnline(navigator.onLine);
    setDate(
      new Date().toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    void refresh();
    void allReports()
      .then(setReports)
      .catch((e) => setError(e.message));
    if (new URLSearchParams(location.search).has("admin")) {
      setTab("standards");
      history.replaceState(null, "", location.pathname);
    }
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!reports.length) return;
    const resume = new URLSearchParams(location.search).get("resume");
    if (resume) {
      const report = reports.find((r) => r.id === resume);
      if (report) {
        setCurrent(report);
        setTab("reports");
        setNotice("กลับจาก LINE แล้ว กดแชร์รายงานอีกครั้งเพื่อเลือกผู้รับ");
      }
      history.replaceState(null, "", location.pathname);
    }
  }, [reports]);
  async function refresh() {
    setLoading(true);
    const r = await Promise.allSettled([
      api<ServiceConfig>("/api/config"),
      api<{ standards: Standard[] }>("/api/standards"),
    ]);
    if (r[0].status === "fulfilled") setConfig(r[0].value);
    else setError(r[0].reason.message);
    if (r[1].status === "fulfilled") {
      setStandards(r[1].value.standards);
      writeSetting("standards", JSON.stringify(r[1].value.standards));
    } else {
      setError(r[1].reason.message);
      try {
        setStandards(JSON.parse(readSetting("standards", "[]")));
      } catch {
        setStandards([]);
      }
    }
    setLoading(false);
  }
  function nav(next: Tab) {
    setTab(next);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function remember(id: string) {
    setRemembered(id);
    writeSetting("last-product", id);
  }
  async function pick(file?: File) {
    if (!file || busy) return;
    const seq = ++sequence.current;
    setBusy("prepare");
    setError("");
    try {
      const src = await imageFromFile(file);
      if (seq !== sequence.current) return;
      setImage(src);
      setCurrent(null);
      setTab("scan");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function persist(r: Report) {
    try {
      await saveReport(r);
      setCurrent({ ...r, saved: true });
      setReports(await allReports());
    } catch (e) {
      setCurrent({ ...r, saved: false });
      setError((e as Error).message);
    }
  }
  async function analyze() {
    if (!image || busy) return;
    setBusy("scan");
    setError("");
    try {
      const d = await api<{
        extraction: Extraction;
        result: ReturnType<typeof inspect>;
        model: string;
        inspectedAt: string;
      }>("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          image,
          selectedId: selected || null,
          rememberedId: remembered || null,
        }),
      });
      const r: Report = {
        ...d.result,
        id: crypto.randomUUID(),
        createdAt: d.inspectedAt,
        image,
        extraction: d.extraction,
        productName:
          d.result.standard?.name ||
          d.extraction.productName ||
          "ไม่สามารถระบุสินค้า",
        model: d.model,
        saved: false,
        corrections: [],
      };
      await persist(r);
      if (r.standard) remember(r.standard.id);
      setNotice("ตรวจเสร็จแล้ว · " + outcomeLabel[r.status]);
    } catch (e) {
      setError(
        navigator.onLine
          ? (e as Error).message
          : "ไม่มีอินเทอร์เน็ต ภาพยังอยู่ กรุณาเชื่อมต่อแล้วลองใหม่",
      );
    } finally {
      setBusy("");
    }
  }
  async function recheck(id: string, e?: Extraction) {
    if (!current || busy) return;
    setBusy("recheck");
    try {
      const fresh = await api<{ standards: Standard[] }>("/api/standards");
      setStandards(fresh.standards);
      const s = fresh.standards.find((s) => s.id === id && s.enabled) || null;
      const now = new Date().toISOString();
      const result = inspect(
        e || current.extraction,
        s,
        s ? "selected" : "none",
        bangkokToday(new Date(now)),
      );
      await persist({
        ...current,
        ...result,
        id: crypto.randomUUID(),
        createdAt: now,
        productName: s?.name || current.productName,
        extraction: e || current.extraction,
        saved: false,
        corrections: e
          ? [
              ...current.corrections,
              {
                at: new Date().toISOString(),
                before: current.extraction,
                after: e,
              },
            ]
          : current.corrections,
      });
      if (s) remember(s.id);
      setCorrecting(false);
      setNotice("สร้างผลตรวจฉบับใหม่แล้ว โดยยังเก็บฉบับเดิม");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function download(r: Report) {
    setBusy("download");
    try {
      downloadBlob(await renderReport(r), reportId(r.id) + ".png");
      setNotice("สร้างภาพรายงานแล้ว");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function nativeShare(r: Report) {
    const file = new File([await renderReport(r)], reportId(r.id) + ".png", {
      type: "image/png",
    });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "CodeDetector",
        text: outcomeLabel[r.status] + " · " + r.productName,
      });
      setNotice("ส่งรายงานไปยังเมนูแชร์ของเครื่องแล้ว");
    } else {
      downloadBlob(file, file.name);
      setNotice("ดาวน์โหลดรายงานแล้ว กรุณาแนบภาพใน LINE");
    }
  }
  async function share(r: Report, native = false) {
    setBusy("share");
    setError("");
    try {
      if (native || !config?.liffId) {
        await nativeShare(r);
        return;
      }
      if (!liffRef.current) {
        const mod = await import("@line/liff");
        await mod.default.init({
          liffId: config.liffId,
          withLoginOnExternalBrowser: false,
        });
        liffRef.current = mod.default;
      }
      const liff = liffRef.current;
      if (!liff.isLoggedIn()) {
        if (!r.saved)
          throw new Error("กรุณาบันทึกรายงานในเครื่องก่อนเข้าสู่ LINE");
        liff.login({ redirectUri: location.origin + "/?resume=" + r.id });
        return;
      }
      if (!liff.isApiAvailable("shareTargetPicker"))
        throw new Error(
          "เลือกผู้รับ LINE ไม่ได้ กรุณาใช้ปุ่มแชร์ไฟล์ผ่านเมนูมือถือ",
        );
      const blob = await renderReport(r);
      if (blob.size > 4_000_000)
        throw new Error("ภาพรายงานใหญ่เกินไป กรุณาดาวน์โหลดแล้วส่งเป็นไฟล์");
      const d = await api<{ url: string; previewUrl: string }>("/api/shares", {
        method: "POST",
        body: JSON.stringify({
          image: await blobDataUrl(blob),
          preview: await previewDataUrl(blob),
        }),
      });
      const text =
        "CodeDetector · " +
        outcomeLabel[r.status] +
        "\n" +
        r.productName +
        "\n" +
        reportId(r.id) +
        " · " +
        fmt(r.createdAt) +
        "\n" +
        r.checks
          .filter((c) => c.status !== "pass")
          .map((c) => c.field + ": " + c.reason)
          .join("\n") +
        "\nลิงก์ภาพต้นทางเปิดได้ 7 วัน";
      const result = await liff.shareTargetPicker(
        [
          { type: "text", text: text.slice(0, 4900) },
          {
            type: "image",
            originalContentUrl: d.url,
            previewImageUrl: d.previewUrl,
          },
        ],
        { isMultiple: true },
      );
      setNotice(result ? "แชร์รายงานผ่าน LINE สำเร็จ" : "ยกเลิกการแชร์แล้ว");
    } catch (e) {
      if ((e as Error).name === "AbortError") setNotice("ยกเลิกการแชร์แล้ว");
      else setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function backup() {
    setBusy("backup");
    try {
      downloadBlob(
        new Blob(
          [
            JSON.stringify({
              format: "codedetector-backup",
              version: 1,
              reports: await allReports(),
            }),
          ],
          { type: "application/json" },
        ),
        "CodeDetector-backup-" + bangkokToday() + ".json",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function restore(file?: File) {
    if (!file) return;
    setBusy("restore");
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("ไฟล์สำรองต้องไม่เกิน 50 MB");
      const d = JSON.parse(await file.text());
      if (d.format !== "codedetector-backup" || d.version !== 1)
        throw new Error("ไม่ใช่ไฟล์สำรอง CodeDetector");
      const { validateBackup } = await import("@/lib/backup");
      const valid = validateBackup(d.reports);
      for (const r of valid) await saveReport(r);
      setReports(await allReports());
      setNotice("นำเข้า " + valid.length + " รายงานแล้ว");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const active = standards.filter((s) => s.enabled),
    todayReports = reports.filter(
      (r) => bangkokToday(new Date(r.createdAt)) === bangkokToday(),
    ),
    filtered = reports.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        [r.productName, r.id, r.standard?.sku]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const menu = (mobile = false) =>
    tabs.map(([key, label, Icon]) => (
      <button
        key={key}
        className={
          (tab === key ? "active " : "") + (key === "scan" ? "nav-scan" : "")
        }
        onClick={() => nav(key)}
      >
        <Icon size={mobile ? 22 : 19} />
        <span>{label}</span>
        {!mobile && key === "reports" && reports.length > 0 && (
          <small>{reports.length}</small>
        )}
      </button>
    ));
  const reportView = (r: Report) => (
    <section className="result-panel card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">INSPECTION RESULT</span>
          <h2>ผลตรวจสอบ</h2>
        </div>
        <button
          className="icon-button"
          aria-label="ปิดผลตรวจ"
          onClick={() => setCurrent(null)}
        >
          <X size={19} />
        </button>
      </div>
      <div className={"result-banner " + r.status}>
        <span className="result-symbol">
          {r.status === "pass" ? (
            <ShieldCheck size={34} />
          ) : r.status === "fail" ? (
            <XCircle size={34} />
          ) : (
            <ScanLine size={34} />
          )}
        </span>
        <div>
          <h3>{outcomeLabel[r.status]}</h3>
          <p>{r.productName}</p>
        </div>
      </div>
      <div className="report-meta">
        <span>{reportId(r.id)}</span>
        <span>{fmt(r.createdAt)}</span>
      </div>
      {!r.saved && (
        <div className="inline-message warning">
          ยังบันทึกไม่ได้ กรุณาดาวน์โหลดก่อนปิดหน้านี้{" "}
          <button onClick={() => void persist(r)}>ลองบันทึกอีกครั้ง</button>
        </div>
      )}
      {r.match === "remembered" && (
        <div className="inline-message warning">
          ใช้สินค้าที่จำไว้: {r.standard?.name}{" "}
          กรุณายืนยันว่าเป็นสินค้าที่ถูกต้อง
        </div>
      )}
      {(!r.standard || r.match === "remembered") && (
        <label className="field">
          ยืนยันสินค้า
          <select
            value={r.standard?.id || ""}
            onChange={(e) => {
              if (e.target.value) void recheck(e.target.value);
            }}
          >
            <option value="">เลือก Standard สินค้า</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {r.match === "remembered" && (
            <button
              className="text-button"
              onClick={() => void recheck(r.standard!.id)}
            >
              ยืนยันสินค้านี้
            </button>
          )}
        </label>
      )}
      {tab !== "scan" && (
        <img
          className="report-evidence"
          src={r.image}
          alt="ภาพหลักฐานที่ใช้ตรวจ"
        />
      )}
      <div className="checks">
        {r.checks.map((c, i) => (
          <div key={i} className={"check-row " + c.status}>
            <span className="check-icon">
              {c.status === "pass" ? (
                <Check size={15} />
              ) : c.status === "fail" ? (
                <X size={15} />
              ) : (
                <TriangleAlert size={15} />
              )}
            </span>
            <div>
              <div className="check-title">
                <strong>{c.field}</strong>
                <span>
                  {c.status === "pass"
                    ? "ผ่าน"
                    : c.status === "fail"
                      ? "ไม่ผ่าน"
                      : "ตรวจซ้ำ"}
                </span>
              </div>
              <p className="check-value">{c.observed}</p>
              <small>Standard: {c.expected}</small>
              <p className="check-reason">{c.reason}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="standard-used">
        <BookOpen size={16} />
        <span>
          {r.standard
            ? r.standard.name + " · Standard v" + r.standard.revision
            : "ยังไม่มี Standard อ้างอิง"}
        </span>
      </div>
      <details className="raw-text">
        <summary>
          ข้อความที่อ่านจากภาพ
          <ChevronDown size={15} />
        </summary>
        <pre>{r.extraction.rawText || "ไม่พบข้อความ"}</pre>
        {r.extraction.notes.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
        <small>อ่านด้วย {r.model}</small>
      </details>
      {r.corrections.length > 0 && (
        <p className="muted small-copy">
          มีการแก้ไขข้อความ {r.corrections.length} ครั้ง · เก็บผล AI
          เดิมในประวัติ
        </p>
      )}
      <button className="text-button" onClick={() => setCorrecting(true)}>
        แก้ไขข้อความที่อ่านผิด
      </button>
      <div className="report-actions">
        <button
          className="button line-button"
          disabled={!!busy}
          onClick={() => void share(r)}
        >
          {busy === "share" ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <LineIcon />
          )}
          แชร์รายงานเข้า LINE
        </button>
        <button
          className="button secondary"
          disabled={!!busy}
          onClick={() => void download(r)}
        >
          <ArrowDownToLine size={18} />
          ดาวน์โหลดรายงาน
        </button>
        <button
          className="text-button"
          disabled={!!busy}
          onClick={() => void share(r, true)}
        >
          แชร์ไฟล์ผ่านเมนูมือถือ
        </button>
      </div>
      <p className="privacy-copy">
        <LockKeyhole size={12} />
        อัปโหลดเฉพาะเมื่อแชร์ผ่าน LIFF · ลิงก์เปิดได้ 7 วัน
      </p>
    </section>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-link" href="/">
          <Brand />
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="เมนูหลัก">{menu()}</nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="local-icon">
              <ShieldCheck size={22} />
            </span>
            <strong>ข้อมูลของคุณ อยู่กับคุณ</strong>
            <p>
              ภาพและประวัติรายงาน
              <br />
              เก็บไว้บนอุปกรณ์นี้
            </p>
            <span>
              <span className="dot" />
              LOCAL STORAGE
            </span>
          </div>
          <button
            className={"side-settings " + (tab === "settings" ? "active" : "")}
            onClick={() => nav("settings")}
          >
            <Settings2 size={18} />
            ตั้งค่าการใช้งาน
          </button>
          <div className="version">
            <span>CodeDetector</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{tabs.find((t) => t[0] === tab)?.[1] || "ตั้งค่า"}</strong>
          </div>
          <div className="topbar-right">
            <span className={"connection " + (!online ? "offline" : "")}>
              <span className="dot" />
              {online ? "พร้อมเชื่อมต่อ" : "ออฟไลน์"}
            </span>
            <span className="header-divider" />
            <button
              className="help-button"
              aria-label="วิธีใช้งาน"
              onClick={() => setHelp(true)}
            >
              ?
            </button>
            <button
              className="avatar"
              aria-label="ตั้งค่าผู้ดูแล"
              onClick={() => nav("settings")}
            >
              {config?.admin ? "AD" : <Settings2 size={18} />}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {tab === "overview"
                  ? "YOUR QUALITY, AT A GLANCE"
                  : tab === "scan"
                    ? "SCAN · VERIFY · CONFIRM"
                    : tab === "reports"
                      ? "YOUR INSPECTION RECORDS"
                      : tab === "standards"
                        ? "ONE STANDARD, EVERY SCAN"
                        : "WORKSPACE SETTINGS"}
              </div>
              <h1>
                {tab === "overview" ? (
                  <>
                    มั่นใจในคุณภาพ<span className="heading-dot">.</span>{" "}
                    ทุกการตรวจ
                  </>
                ) : tab === "scan" ? (
                  "ตรวจสอบผลิตภัณฑ์"
                ) : tab === "reports" ? (
                  "รายงานการตรวจสอบ"
                ) : tab === "standards" ? (
                  "มาตรฐานการตรวจสอบ"
                ) : (
                  "ตั้งค่าการใช้งาน"
                )}
              </h1>
              <p>
                {tab === "overview"
                  ? "ผู้ช่วยตรวจวันที่และรหัสผลิตภัณฑ์ เปลี่ยนภาพถ่ายให้เป็นความมั่นใจ"
                  : tab === "scan"
                    ? "ถ่ายให้เห็นวันที่และรหัสชัดเจน แล้วให้เราช่วยตรวจตาม Standard"
                    : tab === "reports"
                      ? "หลักฐานทุกการตรวจ อยู่ในอุปกรณ์นี้ พร้อมเรียกดูและแชร์"
                      : tab === "standards"
                        ? "กำหนดครั้งเดียว ตรวจได้ทุกคน โดยไม่ต้องกรอกค่าเทียบซ้ำ"
                        : "จัดการการเชื่อมต่อ สำรองข้อมูล และการเข้าถึงของผู้ดูแล"}
              </p>
            </div>
            <span className="date-tag">
              <Clock3 size={15} />
              {date || "วันนี้"}
            </span>
          </div>
          {!online && (
            <div className="alert warning">
              <WifiOff size={18} />
              ออฟไลน์ · ดูรายงานเดิมได้ การอ่านภาพใหม่ต้องใช้อินเทอร์เน็ต
            </div>
          )}
          {error && (
            <div role="alert" className="alert error">
              <TriangleAlert size={18} />
              <span>{error}</span>
              <button
                aria-label="ปิดข้อความผิดพลาด"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-bar" aria-label="กำลังโหลดข้อมูล" />
          )}
          {tab === "overview" && (
            <>
              <section className="stats-grid" aria-label="สถิติวันนี้">
                {[
                  {
                    label: "ตรวจสอบวันนี้",
                    value: todayReports.length,
                    Icon: ScanLine,
                    color: "blue",
                    foot: "รายการบนอุปกรณ์นี้",
                  },
                  {
                    label: "ผ่านมาตรฐาน",
                    value: todayReports.filter((r) => r.status === "pass")
                      .length,
                    Icon: CheckCheck,
                    color: "green",
                    foot: "ผ่านทุกเงื่อนไขที่กำหนด",
                  },
                  {
                    label: "ไม่ผ่าน / ตรวจซ้ำ",
                    value: todayReports.filter((r) => r.status !== "pass")
                      .length,
                    Icon: TriangleAlert,
                    color: "amber",
                    foot: "รายการที่ต้องติดตาม",
                  },
                  {
                    label: "Standard พร้อมใช้",
                    value: active.length,
                    Icon: BookOpen,
                    color: "violet",
                    foot: "ใช้ร่วมกันทุกอุปกรณ์",
                  },
                ].map((s) => (
                  <article className="stat-card card" key={s.label}>
                    <div className="stat-top">
                      <span>{s.label}</span>
                      <span className={"stat-icon " + s.color}>
                        <s.Icon size={18} />
                      </span>
                    </div>
                    <strong>{s.value}</strong>
                    <small>{s.foot}</small>
                  </article>
                ))}
              </section>
              <div className="overview-grid">
                <section className="hero-card">
                  <div className="hero-noise" />
                  <div className="hero-text">
                    <span className="feature-tag">
                      <Sparkles size={13} />
                      AI-POWERED INSPECTION
                    </span>
                    <h2>
                      ภาพเดียว
                      <br />
                      ตรวจได้ครบ<span className="blue-text">.</span>
                    </h2>
                    <p>
                      อ่านวันผลิต วันหมดอายุ และรหัสเครื่องจักร
                      <br className="desktop-break" />
                      เทียบ Standard อัตโนมัติ พร้อมรายงานทันที
                    </p>
                    <button
                      className="button primary hero-button"
                      onClick={() => {
                        nav("scan");
                        camera.current?.click();
                      }}
                    >
                      <Camera size={19} />
                      เริ่มตรวจสอบ
                      <ArrowUpRight size={18} />
                    </button>
                    <button
                      className="hero-upload"
                      onClick={() => upload.current?.click()}
                    >
                      <Upload size={14} />
                      หรืออัปโหลดภาพจากอุปกรณ์
                    </button>
                  </div>
                  <ScannerArt />
                  <div className="hero-footer">
                    <span>
                      <ShieldCheck size={15} />
                      เทียบกฎอย่างเป็นระบบ
                    </span>
                    <span>
                      <FileCheck2 size={15} />
                      เก็บภาพเป็นหลักฐาน
                    </span>
                    <span>
                      <LineIcon />
                      แชร์ผลเข้า LINE
                    </span>
                  </div>
                </section>
                <section className="card workflow-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">SIMPLE BY DESIGN</span>
                      <h2>ง่ายใน 3 ขั้นตอน</h2>
                    </div>
                    <ArrowUpRight size={18} className="muted" />
                  </div>
                  {[
                    {
                      n: "01",
                      title: "ถ่ายหรือเลือกภาพ",
                      text: "ให้เห็นวันที่และรหัสบนผลิตภัณฑ์ชัดเจน",
                      Icon: Camera,
                    },
                    {
                      n: "02",
                      title: "ตรวจเทียบอัตโนมัติ",
                      text: "อ่านข้อมูลและตรวจตาม Standard สินค้า",
                      Icon: ScanLine,
                    },
                    {
                      n: "03",
                      title: "รายงานพร้อมแชร์",
                      text: "ดูผลพร้อมเหตุผล แล้วส่งต่อเข้า LINE",
                      Icon: FileCheck2,
                    },
                  ].map((s) => (
                    <div className="workflow-step" key={s.n}>
                      <span className="step-number">{s.n}</span>
                      <div>
                        <strong>{s.title}</strong>
                        <p>{s.text}</p>
                      </div>
                      <s.Icon size={20} />
                    </div>
                  ))}
                  <div className="workflow-tip">
                    <span>
                      <Check size={14} />
                    </span>
                    ไม่ต้องกรอกค่ามาตรฐานทุกครั้ง
                  </div>
                </section>
              </div>
              <section className="card recent-card">
                <div className="section-heading">
                  <div className="title-row">
                    <h2>การตรวจสอบล่าสุด</h2>
                    <span className="count-tag">{reports.length}</span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => nav("reports")}
                  >
                    ดูรายงานทั้งหมด
                    <ArrowRight size={15} />
                  </button>
                </div>
                {reports.length ? (
                  <div>
                    {reports.slice(0, 4).map((r) => (
                      <ReportRow
                        key={r.id}
                        report={r}
                        onOpen={() => {
                          setCurrent(r);
                          nav("reports");
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-recent">
                    <span className="empty-icon">
                      <FileCheck2 size={25} />
                    </span>
                    <div>
                      <strong>การตรวจครั้งแรก เริ่มได้จากภาพเดียว</strong>
                      <p>รายงานที่ตรวจเสร็จจะแสดงที่นี่ พร้อมเปิดดูย้อนหลัง</p>
                    </div>
                    <button
                      className="button subtle"
                      onClick={() => nav("scan")}
                    >
                      เริ่มตรวจสินค้า
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </section>
              <div className="bottom-note">
                <ShieldCheck size={14} />
                ออกแบบเพื่อความมั่นใจในทุกขั้นตอนของการควบคุมคุณภาพ
                <span>CODEDETECTOR / QUALITY FIRST</span>
              </div>
            </>
          )}
          {tab === "scan" && (
            <div className="scan-layout">
              <section className="card capture-card">
                <div className="section-heading">
                  <div className="title-row">
                    <span className="section-icon">
                      <Camera size={18} />
                    </span>
                    <h2>ภาพผลิตภัณฑ์</h2>
                  </div>
                  <span className="small-tag">STEP 01</span>
                </div>
                {image ? (
                  <div className="image-preview">
                    <img src={image} alt="ภาพผลิตภัณฑ์ที่เลือกตรวจ" />
                    {busy === "scan" && (
                      <div className="analyzing-overlay">
                        <div className="scan-moving-line" />
                        <LoaderCircle className="spin" size={28} />
                        <strong>กำลังอ่านและตรวจสอบภาพ</strong>
                        <span>โปรดรอสักครู่ ไม่ต้องปิดหน้านี้</span>
                      </div>
                    )}
                    <div className="image-tools">
                      <button
                        disabled={!!busy}
                        onClick={async () => {
                          setBusy("rotate");
                          try {
                            setImage(await rotateImage(image));
                            setCurrent(null);
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy("");
                          }
                        }}
                      >
                        <RotateCw size={17} />
                        หมุนภาพ
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => upload.current?.click()}
                      >
                        <ImagePlus size={17} />
                        เปลี่ยนภาพ
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="capture-zone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void pick(e.dataTransfer.files[0]);
                    }}
                  >
                    <div className="capture-target">
                      <ScanLine size={53} />
                    </div>
                    <h3>ให้ทุกการตรวจ เริ่มจากภาพที่ชัดเจน</h3>
                    <p>
                      ถ่ายภาพวันที่และรหัสบนผลิตภัณฑ์
                      <br />
                      หรือเลือกภาพจากอุปกรณ์ของคุณ
                    </p>
                    <button
                      className="button primary"
                      disabled={!!busy}
                      onClick={() => camera.current?.click()}
                    >
                      <Camera size={19} />
                      ถ่ายภาพผลิตภัณฑ์
                    </button>
                    <button
                      className="button secondary"
                      disabled={!!busy}
                      onClick={() => upload.current?.click()}
                    >
                      <Upload size={18} />
                      อัปโหลดภาพ
                    </button>
                    <small>JPEG, PNG, WebP · ภาพถูกย่อก่อนส่งอ่าน</small>
                  </div>
                )}
                <label className="field product-selector">
                  <span>
                    <Sparkles size={14} />
                    Standard สำหรับตรวจ
                  </span>
                  <select
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      if (e.target.value) remember(e.target.value);
                    }}
                  >
                    <option value="">ระบุสินค้าจากภาพอัตโนมัติ</option>
                    {active.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.sku}
                      </option>
                    ))}
                  </select>
                </label>
                {remembered &&
                  active.some((s) => s.id === remembered) &&
                  !selected && (
                    <div className="remembered">
                      <span>
                        ภาพที่มีเฉพาะวันที่จะใช้:{" "}
                        {active.find((s) => s.id === remembered)?.name}
                      </span>
                      <button onClick={() => remember("")}>ล้าง</button>
                    </div>
                  )}
                {!active.length && !loading && (
                  <div className="inline-message warning">
                    <BookOpen size={16} />
                    <span>
                      ยังไม่มี Standard · อ่านภาพได้ แต่ผลจะเป็น “ต้องตรวจซ้ำ”
                      จนกว่าผู้ดูแลจะเพิ่มมาตรฐาน
                    </span>
                  </div>
                )}
                {image && (
                  <button
                    className="button primary analyze-button"
                    disabled={!!busy || !online}
                    onClick={() => void analyze()}
                  >
                    {busy === "scan" ? (
                      <LoaderCircle className="spin" size={19} />
                    ) : (
                      <ScanLine size={19} />
                    )}{" "}
                    {busy === "scan" ? "กำลังตรวจสอบ…" : "ตรวจสอบภาพนี้"}
                    <ArrowRight size={18} />
                  </button>
                )}
                <p className="privacy-copy">
                  <LockKeyhole size={13} />
                  ส่งภาพให้ OpenAI เมื่อกดตรวจ · ประวัติเก็บในอุปกรณ์นี้
                </p>
              </section>
              {current ? (
                reportView(current)
              ) : (
                <aside className="scan-guidance">
                  <div className="card">
                    <span className="eyebrow">A BETTER SCAN</span>
                    <h2>ภาพชัด ผลตรวจมั่นใจ</h2>
                    <ul className="scan-tips">
                      {[
                        [
                          "ถ่ายให้เห็นรหัสครบ",
                          "ให้เห็น MFG / EXP และรหัสเครื่องจักร รวมถึงชื่อสินค้าถ้าเป็นไปได้",
                        ],
                        [
                          "หลีกเลี่ยงแสงสะท้อน",
                          "ปรับมุมเล็กน้อย ให้ตัวอักษรไม่ถูกแสงบังและภาพไม่เบลอ",
                        ],
                        [
                          "ตรวจภาพก่อนส่ง",
                          "หากอ่านไม่ชัด แอปจะแจ้งให้ตรวจซ้ำ พร้อมเก็บเหตุผลไว้",
                        ],
                      ].map(([a, b], i) => (
                        <li key={a}>
                          <span>0{i + 1}</span>
                          <div>
                            <strong>{a}</strong>
                            <p>{b}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="scan-assurance">
                    <ShieldCheck size={24} />
                    <div>
                      <strong>ไม่เดาเมื่อข้อมูลไม่ครบ</strong>
                      <p>
                        ทุกผลตรวจอ้างอิง Standard ที่กำหนด
                        <br />
                        แยก “ผ่าน” ออกจาก “ยังยืนยันไม่ได้”
                      </p>
                    </div>
                  </div>
                  {config && !config.aiReady && (
                    <div className="inline-message warning">
                      ยังไม่เชื่อมต่อ OpenAI API
                      ผู้ดูแลต้องตั้งค่าก่อนอ่านภาพจริง
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}
          {tab === "reports" && (
            <>
              <div className="reports-toolbar">
                <div className="filter-tabs">
                  {(
                    [
                      ["all", "ทั้งหมด"],
                      ["pass", "ผ่าน"],
                      ["fail", "ไม่ผ่าน"],
                      ["review", "ตรวจซ้ำ"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={filter === key ? "active" : ""}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                      <span>
                        {key === "all"
                          ? reports.length
                          : reports.filter((r) => r.status === key).length}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="ค้นหารายงาน"
                    placeholder="ค้นหาสินค้า / รหัสรายงาน"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className={"history-layout " + (current ? "selected" : "")}>
                <section className="card history-card">
                  {filtered.length ? (
                    filtered.map((r) => (
                      <div
                        className={
                          "history-row-wrap " +
                          (current?.id === r.id ? "selected" : "")
                        }
                        key={r.id}
                      >
                        <ReportRow report={r} onOpen={() => setCurrent(r)} />
                        <button
                          className="icon-button delete-report"
                          aria-label={"ลบรายงาน " + reportId(r.id)}
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <Empty
                      Icon={FolderOpen}
                      title="ยังไม่มีรายงานที่ตรงกัน"
                      text="เมื่อถ่ายภาพและตรวจเสร็จ รายงานจะบันทึกที่นี่อัตโนมัติ"
                      action={
                        <button
                          className="button primary"
                          onClick={() => nav("scan")}
                        >
                          <Camera size={17} />
                          เริ่มตรวจสินค้า
                        </button>
                      }
                    />
                  )}
                </section>
                {current && reportView(current)}
              </div>
            </>
          )}
          {tab === "standards" && (
            <>
              <div className="standards-heading">
                <div className="inline-info">
                  <ShieldCheck size={19} />
                  <p>
                    <strong>มาตรฐานเดียวกัน ทุกอุปกรณ์</strong>
                    <span>
                      แก้ไขโดยผู้ดูแล · รายงานเดิมเก็บ Standard ณ เวลาตรวจ
                    </span>
                  </p>
                </div>
                <div className="button-group">
                  <button
                    className="button secondary"
                    disabled={loading}
                    onClick={() => void refresh()}
                  >
                    <RefreshCw size={16} />
                    อัปเดต
                  </button>
                  {config?.admin ? (
                    <button
                      className="button primary"
                      onClick={() => setEditing(null)}
                    >
                      <Plus size={18} />
                      เพิ่ม Standard
                    </button>
                  ) : (
                    <a
                      className="button secondary"
                      href="/signin-with-chatgpt?return_to=%2F%3Fadmin%3D1"
                      target="_top"
                    >
                      <LockKeyhole size={16} />
                      สำหรับผู้ดูแล
                    </a>
                  )}
                </div>
              </div>
              {standards.length ? (
                <div className="standards-grid">
                  {standards.map((s) => (
                    <article
                      className={
                        "card standard-card " + (!s.enabled ? "disabled" : "")
                      }
                      key={s.id}
                    >
                      <div className="section-heading">
                        <span className="product-mark">
                          <BookOpen size={23} />
                        </span>
                        <span
                          className={
                            "standard-live " + (!s.enabled ? "off" : "")
                          }
                        >
                          <span className="dot" />
                          {s.enabled ? "พร้อมใช้งาน" : "ปิดใช้งาน"}
                        </span>
                      </div>
                      <h3>{s.name}</h3>
                      <p className="standard-sku">
                        {s.sku}
                        <span>v{s.revision}</span>
                      </p>
                      <div className="standard-rules">
                        {s.required.mfg && <span>วันผลิต</span>}
                        {s.required.exp && <span>วันหมดอายุ</span>}
                        {s.required.machine && <span>เครื่องจักร</span>}
                      </div>
                      <dl>
                        <div>
                          <dt>รูปแบบวันที่</dt>
                          <dd>{s.dateFormat}</dd>
                        </div>
                        <div>
                          <dt>ปฏิทิน</dt>
                          <dd>{s.calendar === "BE" ? "พ.ศ." : "ค.ศ."}</dd>
                        </div>
                        {s.shelfLife !== null && (
                          <div>
                            <dt>อายุสินค้า</dt>
                            <dd>
                              {s.shelfLife}{" "}
                              {s.shelfUnit === "days" ? "วัน" : "เดือน"}
                            </dd>
                          </div>
                        )}
                        {s.required.machine && (
                          <div>
                            <dt>เครื่องจักร</dt>
                            <dd>{s.machines.join(", ")}</dd>
                          </div>
                        )}
                      </dl>
                      {config?.admin && (
                        <button
                          className="button secondary full-width"
                          onClick={() => setEditing(s)}
                        >
                          <Settings2 size={16} />
                          แก้ไข Standard
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <section className="card">
                  <Empty
                    Icon={BookOpen}
                    title="เตรียม Standard ครั้งเดียว พร้อมตรวจได้ทุกคน"
                    text="เพิ่มชื่อสินค้า รูปแบบวันที่ อายุสินค้า และเครื่องจักรที่ถูกต้อง แอปจะเลือกมาตรฐานให้อัตโนมัติจากภาพ"
                    action={
                      config?.admin ? (
                        <button
                          className="button primary"
                          onClick={() => setEditing(null)}
                        >
                          <Plus size={18} />
                          เพิ่ม Standard แรก
                        </button>
                      ) : (
                        <a
                          className="button primary"
                          href="/signin-with-chatgpt?return_to=%2F%3Fadmin%3D1"
                          target="_top"
                        >
                          <LogIn size={17} />
                          ผู้ดูแลเข้าสู่ระบบ
                        </a>
                      )
                    }
                  />
                </section>
              )}
            </>
          )}
          {tab === "settings" && (
            <div className="settings-grid">
              <section className="card settings-card">
                <div className="section-heading">
                  <h2>สถานะการเชื่อมต่อ</h2>
                  <Activity size={19} />
                </div>
                {[
                  [
                    "OpenAI · อ่านภาพผลิตภัณฑ์",
                    !!config?.aiReady,
                    config?.aiReady
                      ? "ตั้งค่าคีย์แล้ว · ต้องมีเครดิต API เพื่ออ่านภาพ"
                      : "ผู้ดูแลต้องตั้งค่า OPENAI_API_KEY",
                  ],
                  [
                    "Standard กลาง",
                    !!config?.standardsReady,
                    active.length + " Standard ที่เปิดใช้งาน",
                  ],
                  [
                    "LINE · เลือกผู้รับในแอป",
                    !!config?.lineReady,
                    config?.lineReady
                      ? "พร้อมเริ่มเชื่อมต่อ LINE"
                      : "ยังไม่มี LIFF ID · ใช้แชร์ไฟล์แทนได้",
                  ],
                ].map(([name, ready, detail]) => (
                  <div className="connection-row" key={String(name)}>
                    <span
                      className={"service-indicator " + (ready ? "ready" : "")}
                    >
                      <span className="dot" />
                    </span>
                    <div>
                      <strong>{name}</strong>
                      <p>{detail}</p>
                    </div>
                    <span className={"service-label " + (ready ? "ready" : "")}>
                      {ready ? "พร้อม" : "รอตั้งค่า"}
                    </span>
                  </div>
                ))}
                <button
                  className="button secondary full-width"
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={16} />
                  ตรวจสถานะอีกครั้ง
                </button>
              </section>
              <section className="card settings-card">
                <h2>สำรองข้อมูลในอุปกรณ์</h2>
                <p>
                  รายงานและภาพเก็บเฉพาะเบราว์เซอร์นี้
                  การล้างข้อมูลเว็บหรือเปลี่ยนเครื่องอาจทำให้ประวัติหาย
                  กรุณาส่งออกข้อมูลไว้
                </p>
                <div className="backup-count">
                  <strong>{reports.length}</strong>
                  <span>รายงานในอุปกรณ์นี้</span>
                </div>
                <div className="button-group">
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={() => void backup()}
                  >
                    <ArrowDownToLine size={16} />
                    ส่งออกข้อมูล
                  </button>
                  <button
                    className="button secondary"
                    disabled={!!busy}
                    onClick={() => importer.current?.click()}
                  >
                    <Upload size={16} />
                    นำเข้าสำรอง
                  </button>
                </div>
              </section>
              <section className="card settings-card">
                <h2>ผู้ดูแล Standard</h2>
                <p>
                  ผู้ใช้งานทั่วไปถ่ายและตรวจได้ทันที การเปลี่ยน Standard
                  จำกัดเฉพาะผู้ดูแลที่ลงชื่อผ่าน ChatGPT และได้รับอนุญาต
                </p>
                {config?.admin ? (
                  <>
                    <Status status="pass" />
                    <button
                      className="button secondary full-width"
                      onClick={() => nav("standards")}
                    >
                      จัดการ Standard
                      <ArrowRight size={16} />
                    </button>
                    <a
                      className="text-button"
                      href="/signout-with-chatgpt?return_to=%2F"
                      target="_top"
                    >
                      ออกจากระบบผู้ดูแล
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      className="button secondary"
                      href="/signin-with-chatgpt?return_to=%2F%3Fadmin%3D1"
                      target="_top"
                    >
                      <LogIn size={17} />
                      เข้าสู่ระบบผู้ดูแล
                    </a>
                    {config?.signedIn && (
                      <p className="amber-copy">
                        บัญชีนี้ยังไม่มีสิทธิ์ผู้ดูแล กรุณาติดต่อเจ้าของแอป
                      </p>
                    )}
                  </>
                )}
              </section>
              <section className="card settings-card">
                <h2>ความเป็นส่วนตัวและผลตรวจ</h2>
                <p>
                  AI อ่านข้อความจากภาพ โปรแกรมตรวจตามกฎที่ผู้ดูแลกำหนด
                  หากหลักฐานไม่ชัดเจนจะแสดง “ต้องตรวจซ้ำ”
                  ไม่รับรองว่าผ่านโดยไม่มี Standard
                </p>
                <p>
                  ภาพส่งให้ OpenAI เมื่อกดตรวจ ภาพรายงานอัปโหลดเมื่อแชร์ผ่าน
                  LIFF ลิงก์ต้นทางเปิดได้ 7 วัน สำเนาที่ผู้รับหรือ LINE
                  บันทึกไว้อาจยังอยู่
                </p>
              </section>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>© 2026 CodeDetector</span>
          <span>อ่านจากภาพ · ตรวจตามมาตรฐาน · มั่นใจด้วยหลักฐาน</span>
          <span>
            <LockKeyhole size={12} />
            ข้อมูลรายงานอยู่ในเครื่อง
          </span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="เมนูมือถือ">
        {menu(true)}
      </nav>
      <input
        ref={camera}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={upload}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={importer}
        className="hidden"
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          void restore(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button aria-label="ปิดการแจ้งเตือน" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {editing !== undefined && (
        <StandardEditor
          value={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await refresh();
            setNotice("เผยแพร่ Standard แล้ว ทุกอุปกรณ์จะได้รับกฎล่าสุด");
          }}
        />
      )}
      {correcting && current && (
        <CorrectionEditor
          report={current}
          onClose={() => setCorrecting(false)}
          onSave={(e) => void recheck(current.standard?.id || "", e)}
        />
      )}
      {help && (
        <Modal title="เริ่มตรวจได้ใน 3 ขั้นตอน" onClose={() => setHelp(false)}>
          <div className="help-content">
            <p>
              <strong>1. ถ่ายหรืออัปโหลดภาพ</strong>
              <br />
              ให้เห็นวันที่และรหัสชัดเจน รวมถึงชื่อสินค้าหรือ SKU เพื่อจับคู่
              Standard
            </p>
            <p>
              <strong>2. กดตรวจสอบภาพนี้</strong>
              <br />
              ดูผลพร้อมเหตุผล หากระบุสินค้าไม่ได้
              เลือกจากรายการโดยไม่ต้องกรอกค่าเทียบ
            </p>
            <p>
              <strong>3. ดูรายงานและแชร์</strong>
              <br />
              รายงานบันทึกในเครื่องอัตโนมัติ แชร์เข้า LINE
              หรือดาวน์โหลดภาพไว้ส่งต่อ
            </p>
          </div>
          <button
            className="button primary full-width"
            onClick={() => {
              setHelp(false);
              nav("scan");
            }}
          >
            เริ่มตรวจสินค้า
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {deleting && (
        <Modal title="ลบรายงานในอุปกรณ์นี้?" onClose={() => setDeleting(null)}>
          <p className="muted">
            รายงาน {reportId(deleting.id)} และภาพในเครื่องจะถูกลบ
            โดยไม่ลบภาพที่ส่งเข้า LINE แล้ว
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              ยกเลิก
            </button>
            <button
              className="button danger"
              onClick={async () => {
                try {
                  await deleteReport(deleting.id);
                  setReports(await allReports());
                  if (current?.id === deleting.id) setCurrent(null);
                  setDeleting(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Trash2 size={17} />
              ลบรายงาน
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ReportRow({
  report: r,
  onOpen,
}: {
  report: Report;
  onOpen: () => void;
}) {
  return (
    <button className="report-row" onClick={onOpen}>
      <img src={r.image} alt="" />
      <div className="report-row-name">
        <strong>{r.productName}</strong>
        <span>
          {reportId(r.id)} · {fmt(r.createdAt)}
        </span>
      </div>
      <Status status={r.status} />
      <ChevronRight className="row-chevron" size={17} />
    </button>
  );
}
function Empty({
  Icon,
  title,
  text,
  action,
}: {
  Icon: typeof Camera;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon size={33} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
