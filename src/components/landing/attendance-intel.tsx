"use client";

import { useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useRef } from "react";
import { NucleusName } from "@/components/nucleus-wordmark";

type Mode = "device" | "photo" | "video" | "cctv";

const modes: { id: Mode; label: string }[] = [
  { id: "photo",  label: "Class Photo" },
  { id: "video",  label: "Video" },
  { id: "cctv",   label: "CCTV" },
  { id: "device", label: "On Device" },
];

const descriptions: Record<Mode, React.ReactNode> = {
  device: "Student opens the app, takes a selfie. AI verifies their face in under 3 seconds. Location confirms they're on campus.",
  photo:  "Professor takes one photo of the class. AI detects every face, matches against enrolled students, bulk-marks attendance.",
  video:  <><NucleusName /> scans every frame of the uploaded video, identifies students, and generates a complete attendance log.</>,
  cctv:   "Connect existing CCTV. Continuous detection and matching runs in the background. Attendance marks itself.",
};

/* ─── On-Device animation ─────────────────────────────────── */
function DeviceAnimation() {
  const statusRows = [
    { label: "Location: On Campus", delay: 0.9 },
    { label: "Device: Recognised",  delay: 1.1 },
    { label: "Face: Matched ✓",     delay: 1.8 },
  ];

  return (
    <motion.div
      key="device"
      className="w-full flex items-center justify-center py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <svg viewBox="0 0 380 230" className="w-full max-w-md h-auto" aria-hidden>

        {/* ── LEFT: status panel ── */}
        <motion.rect
          x={10} y={15} width={188} height={200} rx={12}
          fill="#f8f7ff" stroke="#e0e7ff" strokeWidth={1.5}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        />
        <motion.text x={104} y={42} textAnchor="middle" fill="#3730a3" fontSize={10} fontWeight={700}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          Verification Status
        </motion.text>

        {statusRows.map((row, i) => (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: row.delay }}>
            <circle cx={30} cy={74 + i * 30} r={6} fill="#22c55e" />
            <text x={44} y={78 + i * 30} fill="#374151" fontSize={9}>{row.label}</text>
          </motion.g>
        ))}

        <motion.text x={104} y={188} textAnchor="middle" fill="#9ca3af" fontSize={9}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 }}>
          Marked at 9:02 AM
        </motion.text>

        {/* ── RIGHT: phone ── */}
        <motion.rect
          x={220} y={12} width={148} height={206} rx={18}
          fill="none" stroke="#4f46e5" strokeWidth={2}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <rect x={272} y={12} width={44} height={9} rx={4.5} fill="#e0e7ff" />
        <rect x={228} y={27} width={132} height={172} rx={5} fill="#f8f7ff" />
        <rect x={275} y={202} width={38} height={4} rx={2} fill="#c7d2fe" />

        <motion.circle
          cx={294} cy={108} r={38}
          fill="#e0e7ff" stroke="#4f46e5" strokeWidth={1.5}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4, type: "spring", stiffness: 200 }}
          style={{ transformOrigin: "294px 108px" }}
        />
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}>
          <circle cx={283} cy={101} r={4} fill="#4f46e5" fillOpacity={0.5} />
          <circle cx={305} cy={101} r={4} fill="#4f46e5" fillOpacity={0.5} />
          <path d="M281,117 Q294,127 307,117" fill="none" stroke="#4f46e5" strokeWidth={1.5} strokeLinecap="round" />
        </motion.g>

        <motion.circle
          cx={294} cy={108} r={48}
          fill="none" stroke="#22c55e" strokeWidth={2.5}
          strokeDasharray={`${2 * Math.PI * 48}`}
          initial={{ strokeDashoffset: 2 * Math.PI * 48, opacity: 0 }}
          animate={{ strokeDashoffset: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.7, ease: "easeOut" }}
          style={{ rotate: -90, transformOrigin: "294px 108px" }}
        />
        <motion.path
          d="M278,108 L291,121 L312,94"
          fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1.65, duration: 0.35 }}
        />
        <motion.text
          x={294} y={170} textAnchor="middle" fill="#16a34a" fontSize={10} fontWeight={700}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }}
        >
          Verified ✓
        </motion.text>
      </svg>
    </motion.div>
  );
}

/* ─── Class Photo animation ───────────────────────────────── */
const facePositions = [
  { x: 55,  y: 70  }, { x: 115, y: 65  }, { x: 175, y: 72  }, { x: 235, y: 67  },
  { x: 60,  y: 135 }, { x: 120, y: 138 }, { x: 180, y: 132 }, { x: 240, y: 137 },
];

function PhotoAnimation() {
  return (
    <motion.div
      key="photo"
      className="flex items-center justify-center py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <svg viewBox="0 0 300 200" className="w-full max-w-[440px] h-auto" aria-hidden>
        {/* Viewfinder frame */}
        <motion.rect
          x={8} y={8} width={284} height={152} rx={8}
          fill="#f8f7ff" stroke="#4f46e5" strokeWidth={1.5}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
          style={{ transformOrigin: "150px 84px" }}
        />
        {/* Corner brackets */}
        {[
          [8, 8, "M8,28 L8,8 L28,8"],
          [292, 8, "M272,8 L292,8 L292,28"],
          [8, 160, "M8,140 L8,160 L28,160"],
          [292, 160, "M272,160 L292,160 L292,140"],
        ].map(([,, d], i) => (
          <motion.path
            key={i}
            d={d as string}
            fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          />
        ))}

        {/* Face circles */}
        {facePositions.map((pos, i) => (
          <motion.g key={i}>
            <motion.circle
              cx={pos.x} cy={pos.y} r={20}
              fill="#e0e7ff" stroke="#4f46e5" strokeWidth={1}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.1, type: "spring", stiffness: 280, damping: 20 }}
              style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
            />
            {/* Green check badge */}
            <motion.circle
              cx={pos.x + 13} cy={pos.y - 13} r={8}
              fill="#22c55e"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.0 + i * 0.08, type: "spring", stiffness: 300 }}
              style={{ transformOrigin: `${pos.x + 13}px ${pos.y - 13}px` }}
            />
            <motion.path
              d={`M${pos.x + 9},${pos.y - 13} L${pos.x + 12},${pos.y - 10} L${pos.x + 17},${pos.y - 17}`}
              fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 1.1 + i * 0.08, duration: 0.2 }}
            />
          </motion.g>
        ))}

        {/* Counter */}
        <motion.rect
          x={8} y={160} width={284} height={32} rx={0}
          fill="#4f46e5" fillOpacity={0.08}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.9 }}
        />
        <motion.text
          x={150} y={181}
          textAnchor="middle" fill="#4338ca" fontSize={10} fontWeight={700}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.0 }}
        >
          8/8 matched · Attendance recorded
        </motion.text>
      </svg>
    </motion.div>
  );
}

/* ─── Video animation ─────────────────────────────────────── */
function VideoAnimation() {
  const detectionBoxes = [
    { x: 40,  y: 50, w: 60, h: 70, delay: 0.6 },
    { x: 130, y: 45, w: 55, h: 75, delay: 1.1 },
    { x: 220, y: 55, w: 58, h: 68, delay: 1.5 },
  ];

  return (
    <motion.div
      key="video"
      className="flex items-center justify-center py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <svg viewBox="0 0 320 200" className="w-full max-w-md h-auto" aria-hidden>
        {/* Player frame */}
        <motion.rect
          x={10} y={10} width={300} height={140} rx={10}
          fill="#1e1b4b" stroke="#4f46e5" strokeWidth={1.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
        {/* Film strips at top */}
        {[10, 30, 50, 70, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290].map((x) => (
          <rect key={x} x={x} y={10} width={14} height={8} rx={1} fill="#312e81" />
        ))}

        {/* Detection boxes */}
        {detectionBoxes.map((box, i) => (
          <motion.rect
            key={i}
            x={box.x} y={box.y} width={box.w} height={box.h}
            fill="none" stroke="#22c55e" strokeWidth={1.5}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: box.delay, type: "spring", stiffness: 250 }}
            style={{ transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px` }}
          />
        ))}
        {detectionBoxes.map((box, i) => (
          <motion.text
            key={`label-${i}`}
            x={box.x + box.w / 2} y={box.y - 3}
            textAnchor="middle" fill="#22c55e" fontSize={7} fontWeight={600}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: box.delay + 0.2 }}
          >
            Student {i + 1}
          </motion.text>
        ))}

        {/* Progress bar */}
        <rect x={10} y={148} width={300} height={6} rx={3} fill="#312e81" />
        <motion.rect
          x={10} y={148} width={0} height={6} rx={3} fill="#6366f1"
          animate={{ width: 300 }}
          transition={{ delay: 0.2, duration: 2.2, ease: "linear" }}
        />

        {/* Counter */}
        <motion.text
          x={265} y={125}
          textAnchor="end" fill="#6366f1" fontSize={9} fontWeight={700}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Detected: 3
        </motion.text>

        {/* Result banner */}
        <motion.rect
          x={10} y={158} width={300} height={32} rx={0}
          fill="#22c55e" fillOpacity={0.1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
        />
        <motion.text
          x={160} y={179}
          textAnchor="middle" fill="#16a34a" fontSize={10} fontWeight={700}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.3 }}
        >
          Video processed ✓ — 3 students logged
        </motion.text>
      </svg>
    </motion.div>
  );
}

/* ─── CCTV animation ──────────────────────────────────────── */
const logLines = [
  "10:01 – Arjun R.  ✓",
  "10:01 – Priya M.  ✓",
  "10:02 – Rahul G.  ✓",
];

function CCTVAnimation() {
  return (
    <motion.div
      key="cctv"
      className="flex items-center justify-center py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <svg viewBox="0 0 320 220" className="w-full max-w-md h-auto" aria-hidden>
        {/* Feed rectangle */}
        <motion.rect
          x={10} y={10} width={300} height={148} rx={8}
          fill="#0f0d24" stroke="#4f46e5" strokeWidth={1.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
        {/* LIVE badge */}
        <motion.rect
          x={18} y={18} width={36} height={14} rx={3}
          fill="#ef4444"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        />
        <motion.text
          x={36} y={28}
          textAnchor="middle" fill="white" fontSize={7} fontWeight={800}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >LIVE</motion.text>

        {/* Person silhouettes */}
        {[{ x: 70, y: 60 }, { x: 200, y: 55 }].map((p, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.2 }}
          >
            {/* Head */}
            <ellipse cx={p.x} cy={p.y} rx={16} ry={18} fill="#4f46e5" fillOpacity={0.25} />
            {/* Body */}
            <rect x={p.x - 20} y={p.y + 16} width={40} height={42} rx={4} fill="#4f46e5" fillOpacity={0.2} />
          </motion.g>
        ))}

        {/* Bounding boxes */}
        {[{ x: 48, y: 38, w: 44, h: 82 }, { x: 178, y: 33, w: 44, h: 82 }].map((box, i) => (
          <motion.rect
            key={i}
            x={box.x} y={box.y} width={box.w} height={box.h}
            fill="none" stroke="#22c55e" strokeWidth={1.5}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 + i * 0.2, type: "spring", stiffness: 200 }}
            style={{ transformOrigin: `${box.x + box.w / 2}px ${box.y + box.h / 2}px` }}
          />
        ))}

        {/* Scan line */}
        <motion.line
          x1={10} y1={10} x2={310} y2={10}
          stroke="#6366f1" strokeWidth={2} strokeOpacity={0.5}
          animate={{ y1: [10, 158], y2: [10, 158] }}
          transition={{ delay: 0.4, duration: 1.4, ease: "linear" }}
        />

        {/* Log lines */}
        {logLines.map((line, i) => (
          <motion.text
            key={i}
            x={18} y={168 + i * 16}
            fill="#22c55e" fontSize={9} fontWeight={600} fontFamily="monospace"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.5 + i * 0.35, duration: 0.25 }}
          >
            {line}
          </motion.text>
        ))}
      </svg>
    </motion.div>
  );
}

/* ─── Exported section ────────────────────────────────────── */
export function AttendanceIntel() {
  const [mode, setMode] = useState<Mode>("photo");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <section id="attendance" className="section-lg bg-background isolate overflow-hidden">
      <div className="container-tight">
        {/* Header */}
        <motion.div
          ref={ref}
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow">Attendance Intelligence</p>
          <h2
            className="font-display font-bold text-foreground tracking-tight mb-3"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            Automate attendance.
            <br />
            Any way you want.
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            On-device selfie. Classroom photo. Video recording. CCTV feed.
            Pick the mode that fits — <NucleusName /> handles the rest.
          </p>
        </motion.div>

        {/* Mode switcher + animation area */}
        <motion.div
          className="max-w-lg mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          {/* Mode buttons */}
          <div className="flex gap-2 justify-center mb-6 flex-wrap">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                  mode === m.id
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Description */}
          <AnimatePresence mode="wait">
            <motion.p
              key={`desc-${mode}`}
              className="text-sm text-muted-foreground text-center mb-6 min-h-[2.5rem]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {descriptions[mode]}
            </motion.p>
          </AnimatePresence>

          {/* Animation box */}
          <div className="relative rounded-2xl border border-border bg-card overflow-hidden min-h-[260px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {mode === "device" && <DeviceAnimation key="device" />}
              {mode === "photo"  && <PhotoAnimation  key="photo" />}
              {mode === "video"  && <VideoAnimation  key="video" />}
              {mode === "cctv"   && <CCTVAnimation   key="cctv" />}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Compliance footnote */}
        <motion.p
          className="mt-8 text-center text-xs text-muted-foreground/50"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6 }}
        >
          Face data is encrypted, never shared, and students can withdraw consent anytime.
          DPDP Act 2023 compliant.
        </motion.p>
      </div>
    </section>
  );
}
