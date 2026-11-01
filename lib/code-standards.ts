import type { Standard } from "./types";
const common: Omit<
  Standard,
  "id" | "name" | "sku" | "dateFormat" | "codeRule"
> = {
  kind: "printed_code",
  aliases: [],
  required: { mfg: false, exp: true, machine: true },
  calendar: "CE",
  twoDigitBase: 2000,
  shelfLife: null,
  shelfUnit: "days",
  checkExpired: false,
  checkMfgToday: false,
  machines: [],
  enabled: true,
  revision: 1,
  updatedAt: "2026-11-01T00:00:00.000Z",
};
export const CODE_STANDARDS: Standard[] = [
  {
    ...common,
    id: "d7dbd04d-b294-4cd3-96cd-4a725aa10102",
    name: "Code สองบรรทัด · วัน / เวลาและเครื่อง",
    sku: "CODE-2LINE",
    dateFormat: "DD/MM/YYYY",
    codeRule: {
      lines: 2,
      timeFormat: "HH:MM:SS",
      yearOffset: 1,
      machinePolicy: "presence",
      minConfidence: 85,
    },
  },
  {
    ...common,
    id: "d7dbd04d-b294-4cd3-96cd-4a725aa10101",
    name: "Code หนึ่งบรรทัด · วัน เวลา เครื่อง",
    sku: "CODE-1LINE",
    dateFormat: "DDMMYYYY",
    codeRule: {
      lines: 1,
      timeFormat: "HH:MM",
      yearOffset: 1,
      machinePolicy: "presence",
      minConfidence: 85,
    },
  },
];
