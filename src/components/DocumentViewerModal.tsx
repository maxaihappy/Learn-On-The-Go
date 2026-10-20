import React from 'react';
import { X, Play, Clock, FileText, Copy, Check } from 'lucide-react';
import { UploadedFile, Folder } from '../types';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: UploadedFile | null;
  folder?: Folder;
  onPlayFile: () => void;
  isPlaying: boolean;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  file,
  folder,
  onPlayFile,
  isPlaying,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !file) return null;

  const wordCount = file.content.split(/\s+/).filter(Boolean).length;
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s > 0 ? `${s}s` : ''}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1" />
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{file.name}</h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                {folder && <span className="text-indigo-400 font-medium">{folder.name}</span>}
                <span>•</span>
                <span>{wordCount} words</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {formatTime(file.duration)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Copy text to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-950/40">
          <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap selection:bg-indigo-500/30">
            {file.content}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Text-to-speech engine ready with active voice
          </span>

          <button
            type="button"
            onClick={onPlayFile}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isPlaying ? 'Playing Document...' : 'Play Document'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
