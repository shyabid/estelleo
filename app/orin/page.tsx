"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Collection = { id: string; name: string; order: number };
type ImageInfo = {
  title?: string;
  description?: string;
  date?: string;
  order?: number;
  color?: string;
  blurDataUrl?: string;
  collections?: string[];
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, ImageInfo>>({});
  const [collections, setCollections] = useState<Collection[]>([]);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", date: "" });
  const [activeTab, setActiveTab] = useState<"all" | "featured" | "collections">("all");
  const [filterCollection, setFilterCollection] = useState<string>("__all__");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [tagPopoverId, setTagPopoverId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const fetchData = async () => {
    try {
      const type = activeTab === "collections" ? "all" : activeTab;
      const [imgsRes, descRes, collRes] = await Promise.all([
        fetch(`/api/images?type=${type}`),
        fetch("/api/data"),
        fetch("/api/collections"),
      ]);
      const imgs = await imgsRes.json();
      const desc = await descRes.json();
      const coll = await collRes.json();
      setImages(imgs);
      setDescriptions(desc);
      setCollections(Array.isArray(coll) ? coll.sort((a, b) => a.order - b.order) : []);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeTab]);

  // Close popover on outside click
  useEffect(() => {
    if (!tagPopoverId) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setTagPopoverId(null);
      }
    };
    setTimeout(() => window.addEventListener("click", handler), 0);
    return () => window.removeEventListener("click", handler);
  }, [tagPopoverId]);

  // Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "shyabid00") setIsAuthenticated(true);
    else alert("Incorrect password");
  };

  // Upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFiles || uploadFiles.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < uploadFiles.length; i++) formData.append("files", uploadFiles[i]);
    formData.append("type", activeTab === "collections" ? "all" : activeTab);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        setUploadFiles(null);
        const fileInput = document.getElementById("file-upload") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        fetchData();
      } else alert("Upload failed");
    } catch (error) {
      console.error("Upload error", error);
      alert("Upload error");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete
  const handleDelete = async (filename: string) => {
    if (!confirm("Delete this image?")) return;
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, type: activeTab === "collections" ? "all" : activeTab }),
      });
      if (res.ok) {
        setImages(images.filter((img) => img !== filename));
        const newDesc = { ...descriptions };
        delete newDesc[filename];
        setDescriptions(newDesc);
      } else alert("Failed to delete");
    } catch (error) {
      console.error("Delete error", error);
    }
  };

  // Reorder
  const handleMove = async (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === images.length - 1) return;
    const newImages = [...images];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setImages(newImages);
    const newDesc = { ...descriptions };
    newImages.forEach((img, idx) => {
      if (!newDesc[img]) newDesc[img] = {};
      newDesc[img].order = idx;
    });
    setDescriptions(newDesc);
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDesc),
      });
    } catch (error) {
      console.error("Failed to save order", error);
    }
  };

  // Edit
  const startEdit = (image: string) => {
    setEditingId(image);
    const info = descriptions[image] || {};
    setEditForm({
      title: info.title || image.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
      description: info.description || "",
      date: info.date || "",
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    const newDesc = {
      ...descriptions,
      [editingId]: {
        ...descriptions[editingId],
        title: editForm.title,
        description: editForm.description,
        date: editForm.date,
      },
    };
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDesc),
      });
      if (res.ok) {
        setDescriptions(newDesc);
        setEditingId(null);
      } else alert("Failed to save");
    } catch (error) {
      console.error("Save error", error);
    }
  };

  // ===== Collections CRUD =====
  const saveCollections = async (next: Collection[]) => {
    setCollections(next);
    try {
      await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch (error) {
      console.error("Collections save error", error);
    }
  };

  const addCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const next = [...collections, { id, name, order: collections.length }];
    setNewCollectionName("");
    await saveCollections(next);
  };

  const deleteCollection = async (id: string) => {
    if (!confirm("Delete this collection? Images will stay but lose this tag.")) return;
    const next = collections.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i }));
    await saveCollections(next);

    // Also strip this collection id from every image's collections array
    const newDesc = { ...descriptions };
    let changed = false;
    for (const key of Object.keys(newDesc)) {
      const cur = newDesc[key]?.collections || [];
      if (cur.includes(id)) {
        newDesc[key] = { ...newDesc[key], collections: cur.filter((x) => x !== id) };
        changed = true;
      }
    }
    if (changed) {
      setDescriptions(newDesc);
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDesc),
      });
    }
  };

  const renameCollection = async (id: string, name: string) => {
    const next = collections.map((c) => (c.id === id ? { ...c, name } : c));
    await saveCollections(next);
    setRenamingId(null);
  };

  const moveCollection = async (id: string, direction: "up" | "down") => {
    const idx = collections.findIndex((c) => c.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === collections.length - 1) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    const next = [...collections];
    [next[idx], next[target]] = [next[target], next[idx]];
    await saveCollections(next.map((c, i) => ({ ...c, order: i })));
  };

  // Toggle collection membership on an image
  const toggleImageCollection = async (image: string, collId: string) => {
    const current = descriptions[image]?.collections || [];
    const nextList = current.includes(collId)
      ? current.filter((x) => x !== collId)
      : [...current, collId];
    const newDesc = {
      ...descriptions,
      [image]: { ...descriptions[image], collections: nextList },
    };
    setDescriptions(newDesc);
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDesc),
      });
    } catch (error) {
      console.error("Tag toggle error", error);
    }
  };

  // Filtered images list (respects activeTab + filterCollection)
  const visibleImages =
    filterCollection === "__all__" || activeTab !== "all"
      ? images
      : images.filter((img) => (descriptions[img]?.collections || []).includes(filterCollection));

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <form
          onSubmit={handleLogin}
          className="bg-white p-8 rounded-2xl shadow-xl flex flex-col gap-4 w-full max-w-md"
        >
          <h1 className="text-2xl font-light text-center mb-4">ACCESS</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-400 transition-colors"
          />
          <button
            type="submit"
            className="bg-pink-300 text-white p-3 rounded-lg hover:bg-pink-200 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50/50 p-4 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header tabs */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex gap-6">
            {(["all", "featured", "collections"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setFilterCollection("__all__");
                }}
                className={`text-lg font-medium transition-colors relative ${
                  activeTab === tab ? "text-black" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab === "all" ? "Gallery" : tab === "featured" ? "Featured" : "Collections"}
                {activeTab === tab && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute left-0 right-0 -bottom-1 h-[2px] bg-black rounded-full"
                    transition={{ duration: 0.4, ease: EASE }}
                  />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="text-sm opacity-50 hover:opacity-100"
          >
            Logout
          </button>
        </header>

        {/* ====================== COLLECTIONS TAB ====================== */}
        {activeTab === "collections" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="bg-white p-6 md:p-8 rounded-2xl shadow-sm"
          >
            <h2 className="text-lg font-medium mb-6">Manage collections</h2>

            <div className="flex gap-3 mb-8">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCollection();
                  }
                }}
                placeholder="New collection name (e.g. Chibi, Realistic)"
                className="flex-1 p-3 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-pink-400 transition-colors"
              />
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={addCollection}
                disabled={!newCollectionName.trim()}
                className="px-6 py-3 bg-black text-white rounded-full text-sm disabled:opacity-40 transition-opacity"
              >
                Add
              </motion.button>
            </div>

            <div className="flex flex-wrap gap-3">
              <AnimatePresence>
                {collections.length === 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-gray-400 italic"
                  >
                    No collections yet — add one above.
                  </motion.p>
                )}
                {collections.map((c, i) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -6 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="group flex items-center gap-2 px-4 py-2 bg-pink-50 border border-pink-100 rounded-full text-sm"
                  >
                    {renamingId === c.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => renameCollection(c.id, renameValue.trim() || c.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameCollection(c.id, renameValue.trim() || c.name);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="bg-transparent outline-none w-28"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setRenamingId(c.id);
                          setRenameValue(c.name);
                        }}
                        className="font-medium"
                      >
                        {c.name}
                      </button>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveCollection(c.id, "up")}
                        disabled={i === 0}
                        className="p-1 hover:bg-pink-100 rounded disabled:opacity-30"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveCollection(c.id, "down")}
                        disabled={i === collections.length - 1}
                        className="p-1 hover:bg-pink-100 rounded disabled:opacity-30"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => deleteCollection(c.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <p className="text-xs text-gray-400 mt-8">
              Tip: click a collection pill to rename. Hover to reorder or delete. Images can belong to multiple collections — assign them from the Gallery tab.
            </p>
          </motion.div>
        )}

        {/* ====================== UPLOAD + FILTER (gallery/featured) ====================== */}
        {activeTab !== "collections" && (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
              <h2 className="text-lg font-medium mb-4">
                Upload to {activeTab === "all" ? "Gallery" : "Featured"}
              </h2>
              <form
                onSubmit={handleUpload}
                className="flex flex-col md:flex-row gap-4 items-start md:items-center"
              >
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setUploadFiles(e.target.files)}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-pink-50 file:text-pink-700
                    hover:file:bg-pink-100"
                />
                <button
                  type="submit"
                  disabled={!uploadFiles || isUploading}
                  className="w-full md:w-auto px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              </form>
            </div>

            {/* Filter pills (gallery only) */}
            {activeTab === "all" && collections.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8 items-center">
                <span className="text-xs uppercase tracking-widest text-gray-400 mr-1">
                  Filter:
                </span>
                <FilterPill
                  label="All"
                  active={filterCollection === "__all__"}
                  onClick={() => setFilterCollection("__all__")}
                />
                {collections.map((c) => (
                  <FilterPill
                    key={c.id}
                    label={c.name}
                    active={filterCollection === c.id}
                    onClick={() => setFilterCollection(c.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ====================== GALLERY GRID ====================== */}
        {activeTab !== "collections" && (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {visibleImages.map((image) => {
                const info = descriptions[image] || {};
                const imageCollections = info.collections || [];
                return (
                  <motion.div
                    key={image}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="bg-white p-4 rounded-2xl shadow-sm flex flex-col gap-4 relative"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                      <img
                        src={`/imgs/${activeTab === "featured" ? "featured/" : ""}${image}`}
                        alt={image}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {editingId === image ? (
                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          placeholder="Title"
                          className="p-2 border rounded text-sm"
                        />
                        <textarea
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm({ ...editForm, description: e.target.value })
                          }
                          placeholder="Description"
                          className="p-2 border rounded text-sm h-24 resize-none"
                        />
                        <input
                          type="text"
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          placeholder="Date (e.g. September 2024)"
                          className="p-2 border rounded text-sm"
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleSave}
                            className="flex-1 bg-green-500 text-white py-1.5 rounded text-sm hover:bg-green-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded text-sm hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium truncate pr-2">
                            {info.title || image}
                          </h3>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(image)}
                              className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(image)}
                              className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {info.description || "No description"}
                        </p>

                        {/* Collection chips (gallery tab only) */}
                        {activeTab === "all" && (
                          <div className="flex flex-wrap gap-1.5 items-center mt-1 relative">
                            <AnimatePresence>
                              {imageCollections.map((collId) => {
                                const coll = collections.find((c) => c.id === collId);
                                if (!coll) return null;
                                return (
                                  <motion.span
                                    key={collId}
                                    layout
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.25, ease: EASE }}
                                    className="text-[10px] uppercase tracking-widest bg-black text-white px-2 py-0.5 rounded-full"
                                  >
                                    {coll.name}
                                  </motion.span>
                                );
                              })}
                            </AnimatePresence>
                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              transition={{ type: "tween", duration: 0.12, ease: "easeOut" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTagPopoverId(tagPopoverId === image ? null : image);
                              }}
                              className="text-[10px] uppercase tracking-widest border border-dashed border-gray-300 text-black hover:border-black px-2 py-0.5 rounded-full transition-colors"
                            >
                              + tag
                            </motion.button>

                            <AnimatePresence>
                              {tagPopoverId === image && (
                                <motion.div
                                  ref={popoverRef}
                                  initial={{ opacity: 0, scale: 0.92, y: 6 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.92, y: 6 }}
                                  transition={{ duration: 0.25, ease: EASE }}
                                  className="absolute z-20 top-full left-0 mt-2 bg-white border border-gray-100 shadow-xl rounded-xl p-3 min-w-[180px] flex flex-col gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {collections.length === 0 ? (
                                    <p className="text-xs text-gray-400 p-1">
                                      Create a collection first.
                                    </p>
                                  ) : (
                                    collections.map((c) => {
                                      const checked = imageCollections.includes(c.id);
                                      return (
                                        <button
                                          key={c.id}
                                          onClick={() => toggleImageCollection(image, c.id)}
                                          className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-gray-50 text-left"
                                        >
                                          <span
                                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                              checked ? "bg-black border-black" : "border-gray-300"
                                            }`}
                                          >
                                            {checked && (
                                              <motion.span
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="text-white text-[10px]"
                                              >
                                                ✓
                                              </motion.span>
                                            )}
                                          </span>
                                          <span>{c.name}</span>
                                        </button>
                                      );
                                    })
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        <div className="mt-auto flex justify-between items-end pt-2">
                          <p className="text-xs text-gray-400">{info.date || "-"}</p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMove(images.indexOf(image), "up")}
                              disabled={images.indexOf(image) === 0}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleMove(images.indexOf(image), "down")}
                              disabled={images.indexOf(image) === images.length - 1}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                            >
                              ↓
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative text-xs uppercase tracking-widest px-4 py-1.5 rounded-full transition-colors ${
        active ? "text-white" : "text-gray-600 hover:text-black"
      }`}
    >
      {active && (
        <motion.span
          layoutId="admin-filter-active"
          className="absolute inset-0 bg-black rounded-full"
          transition={{ duration: 0.45, ease: EASE }}
        />
      )}
      <span className="relative">{label}</span>
    </motion.button>
  );
}
