"use client";

import { useState, useEffect } from "react";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, any>>({});
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", date: "" });

  // Fetch data
  const fetchData = async () => {
    try {
      const [imgsRes, descRes] = await Promise.all([
        fetch("/api/images?type=all"),
        fetch("/api/data")
      ]);
      const imgs = await imgsRes.json();
      const desc = await descRes.json();
      setImages(imgs);
      setDescriptions(desc);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "shyabid00") {
      setIsAuthenticated(true);
    } else {
      alert("Incorrect password");
    }
  };

  // Upload handler
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFiles || uploadFiles.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    
    for (let i = 0; i < uploadFiles.length; i++) {
      formData.append("files", uploadFiles[i]);
    }
    formData.append("type", "all");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        setUploadFiles(null);
        // Reset file input
        const fileInput = document.getElementById("file-upload") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        fetchData(); // Refresh list
      } else {
        alert("Upload failed");
      }
    } catch (error) {
      console.error("Upload error", error);
      alert("Upload error");
    } finally {
      setIsUploading(false);
    }
  };

  // Edit handler
  const startEdit = (image: string) => {
    setEditingId(image);
    const info = descriptions[image] || {};
    setEditForm({
      title: info.title || image.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
      description: info.description || "",
      date: info.date || ""
    });
  };

  // Save handler
  const handleSave = async () => {
    if (!editingId) return;

    const newDescriptions = {
      ...descriptions,
      [editingId]: {
        title: editForm.title,
        description: editForm.description,
        date: editForm.date
      }
    };

    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDescriptions),
      });

      if (res.ok) {
        setDescriptions(newDescriptions);
        setEditingId(null);
      } else {
        alert("Failed to save");
      }
    } catch (error) {
      console.error("Save error", error);
      alert("Save error");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl flex flex-col gap-4 w-full max-w-md">
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
        <header className="flex justify-between items-center mb-10">
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="text-sm opacity-50 hover:opacity-100"
          >
            Logout
          </button>
        </header>

        {/* Upload Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm mb-8">
          <h2 className="text-lg font-medium mb-4">Upload New Artwork</h2>
          <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-start md:items-center">
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

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <div key={image} className="bg-white p-4 rounded-2xl shadow-sm flex flex-col gap-4">
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={`/imgs/${image}`}
                  alt={image}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {editingId === image ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    placeholder="Title"
                    className="p-2 border rounded text-sm"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    placeholder="Description"
                    className="p-2 border rounded text-sm h-24 resize-none"
                  />
                  <input
                    type="text"
                    value={editForm.date}
                    onChange={(e) => setEditForm({...editForm, date: e.target.value})}
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
                      {descriptions[image]?.title || image}
                    </h3>
                    <button
                      onClick={() => startEdit(image)}
                      className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {descriptions[image]?.description || "No description"}
                  </p>
                  <p className="text-xs text-gray-400 mt-auto">
                    {descriptions[image]?.date || "-"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
