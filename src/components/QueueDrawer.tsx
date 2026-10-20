import React from 'react';
import {
  X,
  ListMusic,
  Trash2,
  Shuffle,
  Repeat,
  Repeat1,
  ArrowUp,
  ArrowDown,
  Play,
  Volume2,
  Clock,
} from 'lucide-react';
import { QueueItem, PlaybackSettings } from '../types';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: QueueItem[];
  currentIndex: number;
  onSelectTrack: (index: number) => void;
  onRemoveTrack: (id: string) => void;
  onMoveTrack: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  playbackSettings: PlaybackSettings;
  onUpdateSettings: (newSettings: Partial<PlaybackSettings>) => void;
  isPlaying: boolean;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  currentIndex,
  onSelectTrack,
  onRemoveTrack,
  onMoveTrack,
  onClearQueue,
  onShuffleQueue,
  playbackSettings,
  onUpdateSettings,
  isPlaying,
}) => {
  if (!isOpen) return null;

  const totalDuration = queue.reduce((acc, it) => acc + (it.duration || 60), 0);
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s > 0 ? `${s}s` : ''}`;
  };

  const cycleLoopMode = () => {
    const nextMode =
      playbackSettings.loopMode === 'off'
        ? 'all'
        : playbackSettings.loopMode === 'all'
        ? 'one'
        : 'off';
    onUpdateSettings({ loopMode: nextMode });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-left">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Playback Queue</h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {queue.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Playlist Controls (Loop, Shuffle, Clear) */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          {/* Loop Mode */}
          <button
            onClick={cycleLoopMode}
            className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
              playbackSettings.loopMode !== 'off'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
            title={`Loop Mode: ${playbackSettings.loopMode}`}
          >
            {playbackSettings.loopMode === 'one' ? (
              <Repeat1 className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <Repeat className="w-3.5 h-3.5" />
            )}
            <span className="capitalize text-[10px]">{playbackSettings.loopMode}</span>
          </button>

          {/* Shuffle */}
          <button
            onClick={onShuffleQueue}
            disabled={queue.length <= 1}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
            title="Shuffle queue"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{formatTime(totalDuration)}</span>
          </div>

          <button
            onClick={onClearQueue}
            disabled={queue.length === 0}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 disabled:opacity-40 transition-colors cursor-pointer"
            title="Clear Queue"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Queue Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {queue.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <ListMusic className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-xs text-slate-400">
              <p className="font-semibold text-slate-300">Your queue is empty</p>
              <p className="mt-1">Click "Play All" or add individual files from any folder.</p>
            </div>
          </div>
        ) : (
          queue.map((item, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={item.id}
                className={`group p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                  isCurrent
                    ? 'bg-indigo-950/40 border-indigo-500/50 ring-1 ring-indigo-500/30'
                    : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/50'
                }`}
              >
                {/* Track details & play trigger */}
                <div
                  onClick={() => onSelectTrack(idx)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      isCurrent
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300'
                    }`}
                  >
                    {isCurrent && isPlaying ? (
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-semibold truncate ${
                        isCurrent ? 'text-indigo-300' : 'text-slate-200'
                      }`}
                    >
                      {item.fileName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {item.folderName} • {formatTime(item.duration)}
                    </p>
                  </div>
                </div>

                {/* Reorder and Delete controls */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onMoveTrack(idx, idx - 1)}
                    disabled={idx === 0}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-700 transition-colors"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onMoveTrack(idx, idx + 1)}
                    disabled={idx === queue.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-700 transition-colors"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onRemoveTrack(item.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors ml-1"
                    title="Remove from queue"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
