import React, { useState, useRef, useEffect } from 'react';

// Simple countdown timer for the UI
const CountdownTimer = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expiresAt.getTime() - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('EXPIRED');
        setIsUrgent(true);
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      setIsUrgent(hours < 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className={`font-mono text-sm ${isUrgent ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`}>
      {timeLeft}
    </span>
  );
};

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [vaultedFiles, setVaultedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Download states
  const [downloadFileId, setDownloadFileId] = useState('');
  const [downloadKey, setDownloadKey] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  const fileInputRef = useRef(null);

  // --- CORE UPLOAD LOGIC ---
  const uploadFileToVault = async (file) => {
    if (!apiKey) {
      alert("System Alert: API Key is required to vault files.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
        },
        body: formData,
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Access Denied: Invalid API Key");
      }
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const data = await response.json();
      
      setVaultedFiles(prev => [{
        name: file.name,
        fileId: data.file_id,
        decryptionKey: data.decryption_key,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }, ...prev]);

    } catch (error) {
      console.error("Upload error:", error.message);
      alert(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // --- CORE DOWNLOAD LOGIC ---
  const handleDownload = async (e) => {
    e.preventDefault();
    if (!downloadFileId || !downloadKey) {
      alert("Please provide both the File ID and Decryption Key.");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(`http://localhost:8000/download/${downloadFileId.trim()}?decryption_key=${encodeURIComponent(downloadKey.trim())}`, {
        method: "POST",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Download failed with status: ${response.status}`);
      }

      // Extract original filename from Content-Disposition header if available
      const disposition = response.headers.get("Content-Disposition");
      let filename = "decrypted_file";
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // Clear fields after successful download/burn
      setDownloadFileId('');
      setDownloadKey('');
      alert("File successfully decrypted and burned from the vault!");

    } catch (error) {
      console.error("Download error:", error);
      alert(error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // --- COPY HELPER ---
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* HEADER & API KEY INPUT */}
        <header className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-emerald-400 tracking-tight">Ephemeral Vault</h1>
            <p className="text-slate-500 text-sm mt-1">Secure, auto-destructing file storage</p>
          </div>
          <div className="flex items-center gap-3 relative">
            <div className={`w-2 h-2 rounded-full ${apiKey.length > 5 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
            <input 
              type="password" 
              placeholder="Enter API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-emerald-100 placeholder-slate-600"
            />
          </div>
        </header>

        {/* UPLOAD ZONE */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.[0]) uploadFileToVault(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[160px]
            ${isDragging ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]' : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'}
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && uploadFileToVault(e.target.files[0])} className="hidden" />
          {isUploading ? (
            <p className="text-emerald-400 animate-pulse font-mono">Encrypting & Vaulting...</p>
          ) : (
            <>
              <svg className="w-8 h-8 mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-slate-300 font-medium text-sm">Click to browse or drag a file here</p>
              <p className="text-slate-500 text-xs mt-1">Encrypted locally. 24-hour expiration.</p>
            </>
          )}
        </div>

        {/* DOWNLOAD & BURN SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Retrieve & Burn File</h2>
          <form onSubmit={handleDownload} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input 
                type="text" 
                placeholder="Enter File ID"
                value={downloadFileId}
                onChange={(e) => setDownloadFileId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
              <input 
                type="text" 
                placeholder="Enter Decryption Key"
                value={downloadKey}
                onChange={(e) => setDownloadKey(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button 
              type="submit" 
              disabled={isDownloading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold py-2 rounded text-sm transition-all disabled:opacity-50"
            >
              {isDownloading ? "Decrypting & Burning..." : "Download & Destroy File"}
            </button>
          </form>
        </div>

        {/* VAULTED FILES DASHBOARD WITH COPY BUTTONS */}
        {vaultedFiles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Active Vaults (This Session)</h2>
            <div className="space-y-3">
              {vaultedFiles.map((file, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-200 truncate pr-4 text-sm">{file.name}</span>
                    <CountdownTimer expiresAt={file.expiresAt} />
                  </div>
                  
                  <div className="bg-slate-950 p-3 rounded border border-slate-800/50 font-mono text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">File ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400/80">{file.fileId}</span>
                        <button 
                          onClick={() => copyToClipboard(file.fileId, "File ID")}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Decryption Key:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 truncate max-w-[200px]">{file.decryptionKey}</span>
                        <button 
                          onClick={() => copyToClipboard(file.decryptionKey, "Decryption Key")}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px]"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

