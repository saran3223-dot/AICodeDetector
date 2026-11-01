"use client";
import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";
import type { Extraction, Report, Standard } from "@/lib/types";
import { DATE_FORMATS } from "@/lib/inspection";
async function saveStandard(data: unknown) {
  const res = await fetch("/api/standards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
}
const defaults: Omit<Standard, "id" | "revision" | "updatedAt"> = {
  name: "",
  sku: "",
  aliases: [],
  required: { mfg: true, exp: true, machine: false },
  dateFormat: "DD/MM/YYYY",
  calendar: "CE",
  twoDigitBase: 2000,
  shelfLife: null,
  shelfUnit: "days",
  checkExpired: false,
  checkMfgToday: false,
  machines: [],
  enabled: true,
};
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input:not(:disabled),select,textarea",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="ปิดหน้าต่าง"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function StandardEditor({
  value,
  onClose,
  onSaved,
}: {
  value: Standard | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({ ...defaults, ...value }),
    [aliases, setAliases] = useState(value?.aliases.join("\n") || ""),
    [machines, setMachines] = useState(value?.machines.join("\n") || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const field = <K extends keyof typeof form>(key: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveStandard({
        ...form,
        aliases: aliases
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
        machines: machines
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean),
      });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (value?.kind === "printed_code")
    return (
      <Modal
        title="Standard รูปแบบ Code"
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <form onSubmit={submit}>
          {error && <div className="alert error">{error}</div>}
          <div className="ocr-policy">
            <h3>{value.name}</h3>
            <p>
              {value.codeRule?.lines === 2
                ? "บรรทัดบน DD/MM/YYYY · บรรทัดล่าง HH:MM:SS รหัสเครื่อง"
                : "DDMMYYYY HH:MM รหัสเครื่อง"}
            </p>
            <p>
              ปี ค.ศ. = ปีตรวจตามเวลาไทย +1 · ไม่บังคับวันเดือนให้ตรงวันตรวจ
            </p>
            <p>รหัสเครื่อง: ตรวจเฉพาะการมีรหัส · เวลา 24 ชั่วโมง</p>
            <p>
              เกณฑ์ OCR ขั้นต่ำ 85 เป็นคะแนนของตัวอ่าน
              ไม่ใช่เปอร์เซ็นต์ความถูกต้อง
            </p>
          </div>
          <label className="checkbox-confirm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => field("enabled", e.target.checked)}
            />
            เปิดใช้งาน Standard นี้
          </label>
          <div className="modal-actions">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              ปิด
            </button>
            <button className="button primary" disabled={busy}>
              บันทึกสถานะ
            </button>
          </div>
        </form>
      </Modal>
    );
  return (
    <Modal
      title={value ? "แก้ไข Standard" : "เพิ่ม Standard สินค้า"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} className="standard-form">
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            ชื่อสินค้า
            <input
              required
              maxLength={120}
              value={form.name}
              placeholder="ชื่อสินค้าตามฉลาก"
              onChange={(e) => field("name", e.target.value)}
            />
          </label>
          <label className="field">
            SKU / รหัสสินค้า
            <input
              required
              maxLength={80}
              value={form.sku}
              placeholder="รหัสที่ใช้ระบุสินค้า"
              onChange={(e) => field("sku", e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          ชื่ออื่น / บาร์โค้ดที่ใช้จับคู่
          <span className="optional">หนึ่งค่าต่อบรรทัดหรือคั่นด้วยจุลภาค</span>
          <textarea
            value={aliases}
            rows={2}
            maxLength={4000}
            placeholder="ชื่อบนฉลาก หรือเลขบาร์โค้ด"
            onChange={(e) => setAliases(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>รายการที่ต้องตรวจ</legend>
          <div className="checkbox-row">
            {(
              [
                ["mfg", "วันผลิต"],
                ["exp", "วันหมดอายุ"],
                ["machine", "เครื่องจักร"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={form.required[key]}
                  onChange={(e) =>
                    field("required", {
                      ...form.required,
                      [key]: e.target.checked,
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label className="field">
            รูปแบบวันที่
            <select
              value={form.dateFormat}
              onChange={(e) =>
                field("dateFormat", e.target.value as Standard["dateFormat"])
              }
            >
              {DATE_FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="field">
            ปฏิทิน
            <select
              value={form.calendar}
              onChange={(e) => {
                field("calendar", e.target.value as "CE" | "BE");
                field("twoDigitBase", e.target.value === "BE" ? 2500 : 2000);
              }}
            >
              <option value="CE">ค.ศ. · ปีสองหลัก = 20xx</option>
              <option value="BE">พ.ศ. · ปีสองหลัก = 25xx</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            อายุสินค้า
            <span className="optional">เว้นว่างเพื่อไม่ตรวจข้อนี้</span>
            <input
              type="number"
              min={1}
              max={36500}
              value={form.shelfLife ?? ""}
              onChange={(e) =>
                field(
                  "shelfLife",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              placeholder="จำนวนวันหรือเดือน"
            />
          </label>
          <label className="field">
            หน่วยอายุสินค้า
            <select
              value={form.shelfUnit}
              onChange={(e) =>
                field("shelfUnit", e.target.value as "days" | "months")
              }
            >
              <option value="days">วันหลังวันที่ผลิต</option>
              <option value="months">เดือนหลังวันที่ผลิต</option>
            </select>
          </label>
        </div>
        <p className="form-hint">
          EXP = MFG + อายุสินค้า · แบบเดือนใช้วันสุดท้ายของเดือนหากไม่มีวันเดิม
        </p>
        <label className="field">
          รหัสเครื่องจักรที่อนุญาต
          <textarea
            rows={2}
            value={machines}
            maxLength={8000}
            onChange={(e) => setMachines(e.target.value)}
            placeholder="ระบุรหัสจริง หนึ่งค่าต่อบรรทัด"
          />
        </label>
        <div className="checkbox-column">
          <label>
            <input
              type="checkbox"
              checked={form.checkExpired}
              onChange={(e) => field("checkExpired", e.target.checked)}
            />
            ตรวจว่ายังไม่หมดอายุ ณ วันตรวจ
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.checkMfgToday}
              onChange={(e) => field("checkMfgToday", e.target.checked)}
            />
            วันผลิตต้องตรงกับวันที่ตรวจในประเทศไทย
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => field("enabled", e.target.checked)}
            />
            เปิดใช้งาน Standard นี้
          </label>
        </div>
        <div className="inline-message warning">
          ตรวจข้อมูลกับ Standard ต้นฉบับก่อนเผยแพร่
          การตั้งค่านี้มีผลกับทุกคนที่ตรวจสินค้านี้
        </div>
        <div className="modal-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            บันทึกและเผยแพร่
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function CorrectionEditor({
  report,
  onClose,
  onSave,
}: {
  report: Report;
  onClose: () => void;
  onSave: (e: Extraction) => void;
}) {
  const [fields, setFields] = useState({
      mfg: report.extraction.mfg || "",
      exp: report.extraction.exp || "",
      machine: report.extraction.machine || "",
    }),
    [confirmed, setConfirmed] = useState(false);
  if (
    report.extraction.code &&
    (!report.standard || report.standard.kind === "printed_code")
  )
    return (
      <CodeCorrectionEditor report={report} onClose={onClose} onSave={onSave} />
    );
  return (
    <Modal title="แก้ไขข้อความที่อ่านจากภาพ" onClose={onClose}>
      <p className="muted small-copy">
        เทียบกับภาพต้นฉบับก่อนแก้ แอปจะสร้างรายงานฉบับใหม่และเก็บฉบับเดิมไว้
      </p>
      <img
        className="correction-image"
        src={report.image}
        alt="ภาพต้นฉบับสำหรับตรวจทาน"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirmed) return;
          const changed = (
            Object.keys(fields) as (keyof typeof fields)[]
          ).filter((k) => fields[k] !== String(report.extraction[k] || ""));
          onSave({
            ...report.extraction,
            ...Object.fromEntries(
              Object.entries(fields).map(([k, v]) => [k, v.trim() || null]),
            ),
            ambiguousFields: report.extraction.ambiguousFields.filter(
              (f) => !changed.includes(f as keyof typeof fields),
            ),
          });
        }}
      >
        {(
          [
            ["mfg", "วันที่ผลิต"],
            ["exp", "วันหมดอายุ"],
            ["machine", "รหัสเครื่องจักร"],
          ] as const
        ).map(([k, label]) => (
          <label className="field" key={k}>
            {label}
            <input
              value={fields[k]}
              maxLength={100}
              onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="checkbox-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          ตรวจทานกับภาพจริงแล้ว และยืนยันค่าที่แก้ไข
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!confirmed}
          >
            ตรวจและบันทึกฉบับใหม่
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CodeCorrectionEditor({
  report,
  onClose,
  onSave,
}: {
  report: Report;
  onClose: () => void;
  onSave: (e: Extraction) => void;
}) {
  const [text, setText] = useState(
    report.extraction.code?.manualText ||
      report.extraction.code?.lines.map((l) => l.text).join("\n") ||
      "",
  );
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal title="ตรวจทาน Code จากภาพต้นฉบับ" onClose={onClose}>
      <p className="muted small-copy">
        ผลนี้จะระบุว่า “ยืนยันโดยผู้ใช้” พร้อมเก็บผลอ่าน OCR เดิมไว้
        ห้ามเติมตัวคั่นที่ไม่มีอยู่จริงบนผลิตภัณฑ์
      </p>
      <img
        className="correction-image"
        src={report.codeImage || report.image}
        alt="ภาพโค้ดต้นฉบับสำหรับตรวจทาน"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!confirmed) return;
          const rows = text
            .replace(/\r\n?/g, "\n")
            .trim()
            .split("\n")
            .map((l) => l.trim());
          const first = rows[0]?.split(/[ \t]+/) ?? [];
          const last =
            rows.length === 1
              ? first.slice(1)
              : (rows.at(-1)?.split(/[ \t]+/) ?? []);
          onSave({
            ...report.extraction,
            exp: first[0] || null,
            time: last[0] || null,
            machine: last[1] || null,
            code: {
              engine: "tesseract.js@7.0.0",
              lines: report.extraction.code?.lines ?? [],
              layout: rows.length === 1 ? 1 : rows.length === 2 ? 2 : null,
              confidence: report.extraction.code?.confidence ?? {
                date: 0,
                time: 0,
                machine: 0,
              },
              ambiguous: [],
              crop: report.extraction.code?.crop,
              manualFields: ["exp", "time", "machine"],
              manualText: rows.join("\n"),
            },
          });
        }}
      >
        <label className="field">
          ข้อความ Code ตามภาพ (คงจำนวนบรรทัดและตัวคั่นจริง)
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setConfirmed(false);
            }}
            rows={4}
            maxLength={2000}
          />
        </label>
        <label className="checkbox-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          ตรวจวัน เวลา รหัส ช่องว่าง และการขึ้นบรรทัดเทียบกับภาพจริงแล้ว
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!confirmed || !text.trim()}
          >
            ยืนยันและสร้างรายงานฉบับใหม่
          </button>
        </div>
      </form>
    </Modal>
  );
}
