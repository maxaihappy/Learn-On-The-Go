import React, { useState, useRef } from 'react';
import {
  Play,
  Sparkles,
  Folder as FolderIcon,
  Clock,
  FileText,
  Plus,
  Trash2,
  Leaf,
  Compass,
  Cpu,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Volume2,
  Eye,
  FileCode,
  Music,
  Upload,
} from 'lucide-react';
import { Folder, UploadedFile, FileType } from '../types';

interface FolderCardProps {
  folder: Folder;
  files: UploadedFile[];
  isSelected: boolean;
  onSelect: () => void;
  onPlayFolder: () => void;
  onOpenAiQuiz: () => void;
  onUploadToFolder: () => void;
  onDeleteFolder: () => void;
  onPlayFile?: (file: UploadedFile) => void;
  onViewFile?: (file: UploadedFile) => void;
  onDeleteFile?: (fileId: string) => void;
  onAddDirectFiles?: (files: UploadedFile[]) => void;
  activeTrackFileId?: string;
  isPlaying?: boolean;
}

export const FolderCard: React.FC<FolderCardProps> = ({
  folder,
  files,
  isSelected,
  onSelect,
  onPlayFolder,
  onOpenAiQuiz,
  onUploadToFolder,
  onDeleteFolder,
  onPlayFile,
  onViewFile,
  onDeleteFile,
  onAddDirectFiles,
  activeTrackFileId,
  isPlaying,
}) => {
  const [isFilesExpanded, setIsFilesExpanded] = useState(true);
  const directInputRef = useRef<HTMLInputElement>(null);

  const totalDurationSecs = files.reduce((acc, f) => acc + (f.duration || 60), 0);
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s > 0 ? `${s}s` : ''}`;
  };

  const getFolderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Leaf':
        return <Leaf className="w-4 h-4 text-emerald-400" />;
      case 'Compass':
        return <Compass className="w-4 h-4 text-amber-400" />;
      case 'Cpu':
        return <Cpu className="w-4 h-4 text-indigo-400" />;
      case 'Bookmark':
        return <Bookmark className="w-4 h-4 text-pink-400" />;
      default:
        return <FolderIcon className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
      case 'markdown':
        return <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
  };

  // Direct fast upload handler right from the folder card
  const handleDirectFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const processedFiles: UploadedFile[] = [];

    for (const f of Array.from(selectedFiles)) {
      const isAudio = f.type.startsWith('audio/');
      let textContent = '';
      let audioUrl: string | undefined = undefined;

      if (isAudio) {
        audioUrl = URL.createObjectURL(f);
        textContent = `Audio recording: ${f.name}. File size: ${(f.size / 1024).toFixed(1)} KB.`;
      } else {
        try {
          textContent = await f.text();
        } catch (err) {
          console.error('Error reading file text:', err);
        }
      }

      const words = textContent.split(/\s+/).filter(Boolean).length;
      const estDuration = isAudio ? 120 : Math.max(15, Math.round((words / 140) * 60));

      let type: FileType = 'text';
      if (isAudio) type = 'audio';
      else if (f.name.endsWith('.md') || f.name.endsWith('.markdown')) type = 'markdown';
      else if (f.name.endsWith('.pdf')) type = 'pdf';

      processedFiles.push({
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: f.name,
        folderId: folder.id,
        type,
        size: f.size,
        content: textContent,
        audioUrl,
        duration: estDuration,
        createdAt: Date.now(),
      });
    }

    if (processedFiles.length > 0) {
      if (onAddDirectFiles) {
        onAddDirectFiles(processedFiles);
      }
      setIsFilesExpanded(true);
    }

    e.target.value = '';
  };

  return (
    <div
      className={`rounded-2xl border transition-all flex flex-col justify-between group relative overflow-hidden ${
        isSelected
          ? 'bg-slate-900 border-indigo-500/80 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/40'
          : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800 hover:border-slate-700/80'
      }`}
    >
      {/* Hidden file input for direct folder upload */}
      <input
        ref={directInputRef}
        type="file"
        multiple
        accept=".txt,.md,.markdown,.pdf,.csv,.json,.doc,.docx,.mp3,.wav,.ogg,.m4a"
        onChange={handleDirectFileSelect}
        className="hidden"
      />

      {/* Top Section: Folder Details & Actions */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div
            onClick={onSelect}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{
                backgroundColor: `${folder.color}20`,
                borderColor: `${folder.color}40`,
                borderWidth: '1px',
              }}
            >
              {getFolderIcon(folder.icon)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                {folder.name}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-300">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {formatTime(totalDurationSecs)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Direct Upload button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                directInputRef.current?.click();
              }}
              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors cursor-pointer"
              title="Upload files directly to this folder"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder();
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-70 hover:opacity-100 transition-opacity"
              title="Delete Folder"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {folder.description || 'Collection of documents and study materials.'}
        </p>

        {/* Action Buttons Row */}
        <div className="pt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* Play Folder */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayFolder();
              }}
              disabled={files.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Play all files in this folder in queue"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Play All ({files.length})</span>
            </button>

            {/* Toggle show/hide files */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFilesExpanded((prev) => !prev);
              }}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
              title="Toggle files list in this folder"
            >
              <span className="text-[11px] font-medium hidden sm:inline">Files</span>
              {isFilesExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* AI Study Quiz Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAiQuiz();
            }}
            disabled={files.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 hover:from-indigo-500/30 hover:to-pink-500/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-medium transition-all shadow-sm cursor-pointer disabled:opacity-40"
            title="Interactive AI Comprehension Quiz for this folder"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>AI Quiz</span>
          </button>
        </div>
      </div>

      {/* Embedded Files List inside the Folder */}
      {isFilesExpanded && (
        <div className="border-t border-slate-800/90 bg-slate-950/40 p-3 space-y-1.5 animate-fade-in">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Files in this folder ({files.length})
            </span>
            <div className="flex items-center gap-1.5">
              {/* Direct file pick button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  directInputRef.current?.click();
                }}
                className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md text-[11px] transition-colors"
                title={`Upload files directly to ${folder.name}`}
              >
                <Plus className="w-3 h-3" />
                <span>Upload</span>
              </button>

              {/* Modal / Note button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadToFolder();
                }}
                className="text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1 cursor-pointer bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md text-[11px] transition-colors"
                title={`Paste text or open upload window for ${folder.name}`}
              >
                <span>+ Note</span>
              </button>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center space-y-2">
              <p className="text-xs text-slate-400">No files in this folder yet.</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    directInputRef.current?.click();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Choose file to upload</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUploadToFolder();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Paste Note</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
              {files.map((file) => {
                const isCurrentFile = activeTrackFileId === file.id;

                return (
                  <div
                    key={file.id}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                      isCurrentFile
                        ? 'bg-indigo-950/60 border-indigo-500/70 text-indigo-200'
                        : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/90 text-slate-200'
                    }`}
                  >
                    <div
                      onClick={() => onPlayFile && onPlayFile(file)}
                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                    >
                      <button
                        type="button"
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          isCurrentFile && isPlaying
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white'
                        }`}
                        title="Play file"
                      >
                        {isCurrentFile && isPlaying ? (
                          <Volume2 className="w-3 h-3 animate-pulse" />
                        ) : (
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate text-[11px] leading-tight">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {formatTime(file.duration)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {onViewFile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewFile(file);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View text"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteFile && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFile(file.id);
                          }}
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
