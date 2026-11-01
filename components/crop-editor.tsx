"use client";
import { useRef, useState } from "react";
import type { Box } from "@/lib/types";
import { Modal } from "./editors";
import { Crop } from "lucide-react";
export function CropEditor({
  source,
  initial,
  onClose,
  onSave,
}: {
  source: string;
  initial?: Box;
  onClose: () => void;
  onSave: (box: Box) => void;
}) {
  const img = useRef<HTMLImageElement>(null),
    start = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [ready, setReady] = useState(false);
  const point = (e: React.PointerEvent) => {
    const b = img.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)),
    };
  };
  return (
    <Modal title="ครอบเฉพาะบริเวณ Code" onClose={onClose}>
      <p className="muted small-copy">
        ลากกรอบให้ครอบวันที่ เวลา และรหัสครบทุกบรรทัด โดยเว้นขอบเล็กน้อย
      </p>
      <div
        className="crop-stage"
        onPointerDown={(e) => {
          if (!ready) return;
          const p = point(e);
          start.current = p;
          e.currentTarget.setPointerCapture(e.pointerId);
          setRect({ x: p.x, y: p.y, w: 0, h: 0 });
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const p = point(e),
            a = start.current;
          setRect({
            x: Math.min(a.x, p.x),
            y: Math.min(a.y, p.y),
            w: Math.abs(a.x - p.x),
            h: Math.abs(a.y - p.y),
          });
        }}
        onPointerUp={() => {
          start.current = null;
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
      >
        <img
          ref={img}
          src={source}
          draggable={false}
          alt="ลากกรอบเลือกบริเวณโค้ด"
          onLoad={() => {
            setReady(true);
            if (initial && img.current)
              setRect({
                x: initial.x0 / img.current.naturalWidth,
                y: initial.y0 / img.current.naturalHeight,
                w: (initial.x1 - initial.x0) / img.current.naturalWidth,
                h: (initial.y1 - initial.y0) / img.current.naturalHeight,
              });
          }}
        />
        <div
          className="crop-selection"
          style={{
            left: rect.x * 100 + "%",
            top: rect.y * 100 + "%",
            width: rect.w * 100 + "%",
            height: rect.h * 100 + "%",
          }}
        />
      </div>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className="button primary"
          disabled={!ready || rect.w < 0.02 || rect.h < 0.02}
          onClick={() => {
            const i = img.current!;
            onSave({
              x0: rect.x * i.naturalWidth,
              y0: rect.y * i.naturalHeight,
              x1: (rect.x + rect.w) * i.naturalWidth,
              y1: (rect.y + rect.h) * i.naturalHeight,
            });
          }}
        >
          <Crop size={17} />
          ใช้บริเวณนี้
        </button>
      </div>
    </Modal>
  );
}
