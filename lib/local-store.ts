import type { Report } from "./types";
const DB_NAME = "codedetector-local";
const STORE = "reports";
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new Error("เปิดพื้นที่เก็บรายงานไม่ได้ กรุณาตรวจการตั้งค่าเบราว์เซอร์"),
      );
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const tx = connection.transaction(STORE, mode);
    let value: T;
    const req = action(tx.objectStore(STORE));
    req.onsuccess = () => {
      value = req.result;
    };
    tx.oncomplete = () => {
      connection.close();
      resolve(value);
    };
    tx.onerror = tx.onabort = () => {
      connection.close();
      reject(
        new Error(
          "บันทึกไม่ได้ พื้นที่อาจเต็ม กรุณาดาวน์โหลดรายงานก่อนลบข้อมูลเก่า",
        ),
      );
    };
  });
}
export async function allReports(): Promise<Report[]> {
  const reports = await transaction<Report[]>("readonly", (s) => s.getAll());
  return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveReport(report: Report) {
  await transaction("readwrite", (s) => s.put({ ...report, saved: true }));
}
export async function deleteReport(id: string) {
  await transaction("readwrite", (s) => s.delete(id));
}
export function readSetting(key: string, fallback = "") {
  try {
    return localStorage.getItem("cd:" + key) || fallback;
  } catch {
    return fallback;
  }
}
export function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem("cd:" + key, value);
    return true;
  } catch {
    return false;
  }
}
