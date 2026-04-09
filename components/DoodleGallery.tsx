"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const LOCAL_KEY = "estelleo:drawings";

type LocalDrawing = { id: string; dataUrl: string; createdAt: number };

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DoodleGallery({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [localList, setLocalList] = useState<LocalDrawing[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const arr = raw ? (JSON.parse(raw) as LocalDrawing[]) : [];
      if (Array.isArray(arr)) {
        arr.sort((a, b) => b.createdAt - a.createdAt);
        setLocalList(arr);
      } else {
        setLocalList([]);
      }
    } catch {
      setLocalList([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshLocal();
  }, [open, refreshLocal]);

  // Escape to close (preview first, then modal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (preview) setPreview(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, preview, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const deleteLocal = (id: string) => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const arr = raw ? (JSON.parse(raw) as LocalDrawing[]) : [];
      const next = arr.filter((d) => d.id !== id);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      next.sort((a, b) => b.createdAt - a.createdAt);
      setLocalList(next);
    } catch {}
  };

  const downloadLocal = (d: LocalDrawing) => {
    const a = document.createElement("a");
    a.href = d.dataUrl;
    a.download = `doodle-${d.id}.png`;
    a.click();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="gallery"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed inset-0 z-[60] flex flex-col bg-pink-50/95 backdrop-blur-md"
          onClick={onClose}
        >
          {/* Header */}
          <div
            className="flex flex-col items-center px-4 md:px-10 pt-6 md:pt-10 pb-4 md:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] opacity-50 font-mono">
                𔓐𑇓 your doodles ({localList.length}) 𔓐𑇓
              </span>
            </div>
          </div>

          {/* Close button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            className="absolute top-5 md:top-8 right-5 md:right-8 text-black/50 hover:text-black transition-colors text-xl md:text-2xl z-10"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="close"
          >
            ✕
          </motion.button>

          {/* Grid */}
          <div
            className="flex-1 overflow-y-auto px-4 md:px-10 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            {localList.length === 0 ? (
              <EmptyState />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5 max-w-6xl mx-auto"
              >
                {localList.map((d) => (
                  <motion.div
                    key={d.id}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className="group relative bg-white rounded-2xl md:rounded-3xl p-2 md:p-3 border border-pink-200/50 cursor-pointer overflow-hidden"
                    onClick={() => setPreview(d.dataUrl)}
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-xl md:rounded-2xl bg-pink-50">
                      <img
                        src={d.dataUrl}
                        alt="doodle"
                        className="w-full h-full object-contain"
                        draggable={false}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 px-1">
                      <span className="text-[9px] md:text-[10px] uppercase tracking-widest opacity-40 font-mono">
                        {formatDate(d.createdAt)}
                      </span>
                    </div>

                    {/* Hover action overlay */}
                    <div className="absolute inset-2 md:inset-3 rounded-xl md:rounded-2xl flex items-start justify-end gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <IconButton
                        label="↓"
                        title="download"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadLocal(d);
                        }}
                      />
                      <IconButton
                        label="✕"
                        title="delete"
                        tone="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLocal(d.id);
                        }}
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Preview overlay */}
          <AnimatePresence>
            {preview && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 md:p-16"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(null);
                }}
              >
                <motion.img
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  src={preview}
                  alt="doodle preview"
                  className="max-w-full max-h-full object-contain rounded-2xl md:rounded-3xl bg-white"
                  draggable={false}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="absolute top-5 md:top-8 right-5 md:right-8 text-white/70 hover:text-white transition-colors text-xl md:text-2xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreview(null);
                  }}
                  aria-label="close preview"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function IconButton({
  label,
  title,
  onClick,
  tone = "default",
}: {
  label: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  tone?: "default" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "bg-white/95 text-rose-500 hover:bg-rose-50 border border-rose-200"
      : "bg-white/95 text-black/70 hover:text-black border border-pink-200/60";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-7 h-7 md:w-8 md:h-8 rounded-full text-xs md:text-sm flex items-center justify-center pointer-events-auto ${cls}`}
    >
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40 text-center">
      <span className="text-3xl md:text-4xl">𔓐𑇓</span>
      <span className="text-[11px] md:text-xs font-mono tracking-widest uppercase">
        no doodles yet
      </span>
    </div>
  );
}
