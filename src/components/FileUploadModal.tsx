import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Music,
  Plus,
  Folder as FolderIcon,
  CheckCircle,
  FileCode,
  PenTool,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Folder, UploadedFile, FileType } from '../types';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  initialFolderId?: string;
  onAddFiles: (files: UploadedFile[]) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  folders,
  initialFolderId,
  onAddFiles,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'note'>('upload');
  const [selectedFolderId, setSelectedFolderId] = useState(
    initialFolderId || (folders[0]?.id ?? '')
  );

  // File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedQueue, setUploadedQueue] = useState<
    Array<{ file: File; textContent: string; audioUrl?: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Note State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [convertingFileName, setConvertingFileName] = useState('');

  // Sync target folder and reset queue whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      const targetId =
        initialFolderId && folders.some((f) => f.id === initialFolderId)
          ? initialFolderId
          : (folders[0]?.id ?? '');
      setSelectedFolderId(targetId);
      setUploadedQueue([]);
      setNoteTitle('');
      setNoteContent('');
      setIsConvertingPdf(false);
      setConvertingFileName('');
    }
  }, [isOpen, initialFolderId, folders]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // strip prefix data:...;base64,
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (files: File[]) => {
    const processed: Array<{ file: File; textContent: string; audioUrl?: string }> = [];

    for (const f of files) {
      if (f.type.startsWith('audio/')) {
        const audioUrl = URL.createObjectURL(f);
        processed.push({
          file: f,
          textContent: `Audio recording: ${f.name}. File size: ${(f.size / 1024).toFixed(1)} KB.`,
          audioUrl,
        });
      } else if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
        // PDF file: Convert to clean structured Markdown via /api/convert-pdf
        setIsConvertingPdf(true);
        setConvertingFileName(f.name);
        try {
          const base64 = await fileToBase64(f);
          const res = await fetch('/api/convert-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfBase64: base64,
              filename: f.name,
            }),
          });
          const data = await res.json();
          const markdown = data.markdown || `# ${f.name}\n\nConverted PDF text.`;
          processed.push({
            file: f,
            textContent: markdown,
          });
        } catch (pdfErr) {
          console.error('Error converting PDF to markdown:', pdfErr);
          processed.push({
            file: f,
            textContent: `# ${f.name}\n\n*Document uploaded into AudioLearner.*`,
          });
        } finally {
          setIsConvertingPdf(false);
          setConvertingFileName('');
        }
      } else {
        // Read text / markdown / json / csv
        try {
          const text = await f.text();
          processed.push({
            file: f,
            textContent: text,
          });
        } catch (e) {
          console.error('Error reading file:', e);
        }
      }
    }

    setUploadedQueue((prev) => [...prev, ...processed]);
  };


  const handleSaveUploaded = () => {
    if (uploadedQueue.length === 0) return;

    const targetFolder = selectedFolderId || initialFolderId || (folders.length > 0 ? folders[0].id : '');

    const newFiles: UploadedFile[] = uploadedQueue.map((item) => {
      const isAudio = item.file.type.startsWith('audio/');
      const words = item.textContent.split(/\s+/).length;
      // ~140 words per minute speaking rate
      const estDuration = isAudio ? 120 : Math.max(15, Math.round((words / 140) * 60));

      let type: FileType = 'text';
      if (isAudio) type = 'audio';
      else if (item.file.name.endsWith('.md') || item.file.name.endsWith('.markdown')) type = 'markdown';
      else if (item.file.name.endsWith('.pdf')) type = 'pdf';

      return {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: item.file.name,
        folderId: targetFolder,
        type,
        size: item.file.size,
        content: item.textContent,
        audioUrl: item.audioUrl,
        duration: estDuration,
        createdAt: Date.now(),
      };
    });

    onAddFiles(newFiles);
    setUploadedQueue([]);
    onClose();
  };

  const handleSaveNote = () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;

    const words = noteContent.split(/\s+/).length;
    const estDuration = Math.max(15, Math.round((words / 140) * 60));

    const newFile: UploadedFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: noteTitle.endsWith('.md') || noteTitle.endsWith('.txt') ? noteTitle : `${noteTitle}.txt`,
      folderId: selectedFolderId,
      type: 'notes',
      size: new Blob([noteContent]).size,
      content: noteContent,
      duration: estDuration,
      createdAt: Date.now(),
    };

    onAddFiles([newFile]);
    setNoteTitle('');
    setNoteContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1" />
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Add Materials to AudioLearner</h2>
              <p className="text-xs text-slate-400">
                Upload files or paste articles to listen and study
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Folder Select */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-800 border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Files</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('note')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'note'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Paste Text / Note</span>
            </button>
          </div>

          {/* Destination Folder Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold shrink-0">Upload to:</span>
            <div className="relative flex items-center">
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="bg-slate-800 border border-slate-700/80 rounded-lg pl-3 pr-7 py-1.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-xs font-semibold cursor-pointer appearance-none shadow-xs"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 pointer-events-none text-slate-400 text-[9px]">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'upload' ? (
            <div className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/10 scale-[0.99]'
                    : 'border-slate-700/80 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.markdown,.pdf,.csv,.json,.doc,.docx,.mp3,.wav,.ogg,.m4a"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-md">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Click to browse or drag and drop files here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports <span className="text-emerald-400 font-medium">Markdown (.md)</span>, <span className="text-indigo-400 font-medium">PDF (.pdf auto-converted to clean text)</span>, Text (.txt), JSON, & Audio (.mp3, .wav)
                  </p>
                </div>
              </div>

              {/* PDF Converting Status Banner */}
              {isConvertingPdf && (
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-3 animate-pulse text-xs">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Converting PDF to Clean Markdown...
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Extracting text from <span className="text-slate-200">{convertingFileName}</span> for natural speech listening and Firestore persistence.
                    </p>
                  </div>
                </div>
              )}

              {/* Uploaded items queue */}
              {uploadedQueue.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Files to upload ({uploadedQueue.length}):
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {uploadedQueue.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {it.file.type.startsWith('audio/') ? (
                            <Music className="w-4 h-4 text-pink-400 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          <span className="text-slate-200 truncate font-medium">{it.file.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({(it.file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setUploadedQueue((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Note / Text Paste Mode */
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Note Title</label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Key Takeaways from Lecture 4"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">Content / Article Text</label>
                  <span className="text-[11px] text-slate-400">
                    {noteContent.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Paste article text, study guide, lecture summary, or notes here..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 leading-relaxed font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              activeTab === 'upload'
                ? uploadedQueue.length === 0
                : !noteTitle.trim() || !noteContent.trim()
            }
            onClick={activeTab === 'upload' ? handleSaveUploaded : handleSaveNote}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            {activeTab === 'upload'
              ? `Upload ${uploadedQueue.length} ${uploadedQueue.length === 1 ? 'File' : 'Files'}`
              : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
};
