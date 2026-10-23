import React, { useState, useRef, useEffect, useCallback } from 'react';

// --- Countdown Timer Component ---
const CountdownTimer = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const distance = expiresAt.getTime() - Date.now();
      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('EXPIRED');
        setIsUrgent(true);
        return;
      }
      const h = Math.floor(distance / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
      setIsUrgent(h < 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className={`font-mono text-sm ${isUrgent ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`}>
      {timeLeft}
    </span>
  );
};

// --- Toast Component ---
const Toast = ({ message, type, onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const colors = {
    success: 'bg-emerald-900 border-emerald-600 text-emerald-200',
    error: 'bg-red-900 border-red-600 text-red-200',
    info: 'bg-slate-800 border-slate-600 text-slate-200',
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 border rounded-lg px-4 py-3 text-sm max-w-sm shadow-xl ${colors[type] || colors.info}`}>
      {message}
    </div>
  );
};

// --- Copy Button ---
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] transition-colors min-w-[44px]"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
};

// --- Main App ---
export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [vaultedFiles, setVaultedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const [downloadFileId, setDownloadFileId] = useState('');
  const [downloadKey, setDownloadKey] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  // --- UPLOAD ---
  const uploadFileToVault = async (file) => {
    if (!apiKey) {
      showToast('API Key is required to vault files.', 'error');
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: formData,
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('Access Denied: Invalid API Key.');
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (${response.status})`);
      }

      const data = await response.json();
      setVaultedFiles((prev) => [
        {
          name: file.name,
          fileId: data.file_id,
          decryptionKey: data.decryption_key,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        ...prev,
      ]);
      showToast(`"${file.name}" encrypted and vaulted successfully!`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // --- DOWNLOAD & BURN ---
  const handleDownload = async (e) => {
    e.preventDefault();
    if (!downloadFileId || !downloadKey) {
      showToast('Please provide both the File ID and Decryption Key.', 'error');
      return;
    }
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/download/${downloadFileId.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decryption_key: downloadKey.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Download failed (${response.status})`);
      }

      const disposition = response.headers.get('Content-Disposition');
      let filename = 'decrypted_file';
      if (disposition && disposition.includes('filename=')) {
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

      setDownloadFileId('');
      setDownloadKey('');
      showToast('File decrypted and permanently destroyed from the vault!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-emerald-500/30">
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      <div className="max-w-3xl mx-auto space-y-8">
        {/* HEADER */}
        <header className="flex justify-between items-end border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-emerald-400 tracking-tight">Ephemeral Vault</h1>
            <p className="text-slate-500 text-sm mt-1">Secure, auto-destructing file storage</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${apiKey.length > 5 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
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
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) uploadFileToVault(f);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[160px]
            ${isDragging ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]' : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'}
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFileToVault(f); }}
            className="hidden"
          />
          {isUploading ? (
            <p className="text-emerald-400 animate-pulse font-mono">Encrypting &amp; Vaulting...</p>
          ) : (
            <>
              <svg className="w-8 h-8 mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-slate-300 font-medium text-sm">Click to browse or drag a file here</p>
              <p className="text-slate-500 text-xs mt-1">Server-side encryption. 24-hour auto-expiration.</p>
            </>
          )}
        </div>

        {/* DOWNLOAD & BURN */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Retrieve &amp; Burn File</h2>
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
              {isDownloading ? 'Decrypting & Burning...' : 'Download & Destroy File'}
            </button>
          </form>
        </div>

        {/* VAULTED FILES LIST */}
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
                        <span className="text-emerald-400/80 truncate max-w-[180px]">{file.fileId}</span>
                        <CopyButton text={file.fileId} />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Decryption Key:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 truncate max-w-[180px]">{file.decryptionKey}</span>
                        <CopyButton text={file.decryptionKey} />
                      </div>
                    </div>
                  </div>
                  <p className="text-amber-500/80 text-[10px]">⚠ Save the decryption key now — it cannot be recovered after you leave this page.</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
