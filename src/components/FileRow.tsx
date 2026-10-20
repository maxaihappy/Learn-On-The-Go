import React, { useState } from 'react';
import {
  Play,
  Volume2,
  FileText,
  FileCode,
  Music,
  Clock,
  PlusCircle,
  Eye,
  Trash2,
  FolderInput,
  MoreVertical,
} from 'lucide-react';
import { UploadedFile, Folder } from '../types';

interface FileRowProps {
  file: UploadedFile;
  folder?: Folder;
  allFolders: Folder[];
  isPlaying: boolean;
  isCurrentInQueue: boolean;
  onPlayFile: () => void;
  onAddToQueue: () => void;
  onViewDoc: () => void;
  onMoveToFolder: (targetFolderId: string) => void;
  onDeleteFile: () => void;
}

export const FileRow: React.FC<FileRowProps> = ({
  file,
  folder,
  allFolders,
  isPlaying,
  isCurrentInQueue,
  onPlayFile,
  onAddToQueue,
  onViewDoc,
  onMoveToFolder,
  onDeleteFile,
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s > 0 ? `${s}s` : ''}`;
  };

  const getFileIcon = () => {
    switch (file.type) {
      case 'audio':
        return <Music className="w-4 h-4 text-pink-400" />;
      case 'markdown':
        return <FileCode className="w-4 h-4 text-indigo-400" />;
      default:
        return <FileText className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div
      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
        isCurrentInQueue
          ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/90 hover:border-slate-700/80'
      }`}
    >
      {/* File Info & Play Trigger */}
      <div
        onClick={onPlayFile}
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-90 ${
            isCurrentInQueue && isPlaying
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white'
          }`}
          title="Play this file"
        >
          {isCurrentInQueue && isPlaying ? (
            <Volume2 className="w-4 h-4 animate-pulse" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs sm:text-sm font-semibold text-white truncate hover:text-indigo-300 transition-colors">
              {file.name}
            </h4>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
            {folder && (
              <span
                className="font-medium px-1.5 py-0.2 rounded text-[10px] truncate max-w-[120px]"
                style={{
                  backgroundColor: `${folder.color}15`,
                  color: folder.color,
                  border: `1px solid ${folder.color}30`,
                }}
              >
                {folder.name}
              </span>
            )}
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
              <Clock className="w-3 h-3 text-slate-500" />
              {formatTime(file.duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop Inline Actions */}
      <div className="hidden sm:flex items-center justify-end gap-1 shrink-0">
        <button
          type="button"
          onClick={onPlayFile}
          className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          title="Play now"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Play</span>
        </button>

        <button
          type="button"
          onClick={onAddToQueue}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Add to Queue"
        >
          <PlusCircle className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onViewDoc}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Read document"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Move dropdown */}
        <div className="relative group/folder">
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Move to folder"
          >
            <FolderInput className="w-4 h-4" />
          </button>
          <div className="absolute right-0 bottom-full mb-1 hidden group-hover/folder:block w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-30 text-xs">
            <div className="px-3 py-1 font-semibold text-slate-400 text-[10px] uppercase tracking-wider">
              Move to folder:
            </div>
            {allFolders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onMoveToFolder(f.id)}
                className={`w-full px-3 py-1.5 text-left text-xs truncate flex items-center gap-1.5 hover:bg-slate-700 transition-colors cursor-pointer ${
                  f.id === file.folderId ? 'text-indigo-400 font-bold' : 'text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: f.color }}
                />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onDeleteFile}
          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
          title="Delete file"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile Simplified 3-Dot Menu */}
      <div className="sm:hidden relative">
        <button
          type="button"
          onClick={() => setShowMobileMenu((prev) => !prev)}
          className="p-2 -mr-1 rounded-xl text-slate-400 hover:text-white active:bg-slate-800"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {showMobileMenu && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              onClick={() => {
                setShowMobileMenu(false);
                setShowMoveSubmenu(false);
              }}
            />
            <div className="absolute right-0 top-full mt-1 w-52 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50 animate-fade-in text-xs space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  onPlayFile();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 text-left"
              >
                <Play className="w-4 h-4 text-indigo-400 fill-current" />
                <span>Play Now</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  onAddToQueue();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-slate-200 hover:bg-slate-800 text-left"
              >
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Add to Queue</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  onViewDoc();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-slate-200 hover:bg-slate-800 text-left"
              >
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Read Full Text</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMoveSubmenu((prev) => !prev)}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-slate-200 hover:bg-slate-800 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <FolderInput className="w-4 h-4 text-amber-400" />
                  <span>Move Folder</span>
                </span>
                <span className="text-[10px] text-slate-500">▸</span>
              </button>

              {showMoveSubmenu && (
                <div className="pl-6 pr-1 py-1 space-y-1 bg-slate-950/60 rounded-xl">
                  {allFolders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setShowMobileMenu(false);
                        setShowMoveSubmenu(false);
                        onMoveToFolder(f.id);
                      }}
                      className="w-full py-1 text-left text-xs truncate flex items-center gap-2 text-slate-300 hover:text-white"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="h-px bg-slate-800 my-1" />

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  onDeleteFile();
                }}
                className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-rose-400 hover:bg-rose-500/20 text-left"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete File</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
