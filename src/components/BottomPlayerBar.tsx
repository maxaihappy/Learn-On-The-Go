import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  ListMusic,
  Mic,
  Volume2,
  FileText,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Maximize2,
  X,
} from 'lucide-react';
import { QueueItem, PlaybackSettings } from '../types';

interface BottomPlayerBarProps {
  currentTrack: QueueItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onSkipSeconds: (delta: number) => void;
  onToggleQueue: () => void;
  queueCount: number;
  isQueueOpen: boolean;
  onOpenVoiceSettings: () => void;
  playbackSettings: PlaybackSettings;
  currentSpokenSentence?: string;
  onOpenDocViewer: () => void;
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  progress,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onSkipSeconds,
  onToggleQueue,
  queueCount,
  isQueueOpen,
  onOpenVoiceSettings,
  playbackSettings,
  currentSpokenSentence,
  onOpenDocViewer,
}) => {
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);
  const [showSpokenDrawer, setShowSpokenDrawer] = useState(false);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!currentTrack) {
    return null;
  }

  const percentProgress = Math.min(100, Math.max(0, (currentTime / (duration || 1)) * 100));

  return (
    <>
      {/* ============================================================ */}
      {/* MOBILE MINI-PLAYER (Floating dock, visible only on small screens) */}
      {/* ============================================================ */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-2 pb-safe bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden relative">
          {/* Progress hairline at top */}
          <div className="h-1 w-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${percentProgress}%` }}
            />
          </div>

          <div className="p-2.5 flex items-center justify-between gap-2.5">
            {/* Track Info (tap to expand full player) */}
            <div
              onClick={() => setIsExpandedMobile(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-900 to-slate-800 border border-indigo-500/30 flex items-center justify-center shrink-0">
                {isPlaying ? (
                  <div className="flex items-end gap-0.5 h-3.5">
                    <span className="w-1 bg-indigo-400 rounded-full animate-music-bar-1" />
                    <span className="w-1 bg-cyan-400 rounded-full animate-music-bar-2" />
                    <span className="w-1 bg-indigo-300 rounded-full animate-music-bar-3" />
                  </div>
                ) : (
                  <FileText className="w-4 h-4 text-indigo-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {currentTrack.fileName}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                  <span className="truncate max-w-[110px]">{currentTrack.folderName}</span>
                  <span>•</span>
                  <span className="font-mono text-indigo-300">{formatTime(currentTime)}</span>
                </div>
              </div>
            </div>

            {/* Quick Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Play / Pause (Generous 40px touch target) */}
              <button
                type="button"
                onClick={onPlayPause}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Next Track */}
              <button
                type="button"
                onClick={onNext}
                className="p-2 text-slate-300 hover:text-white active:scale-90 transition-transform cursor-pointer"
                title="Next"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              {/* Expand Sheet */}
              <button
                type="button"
                onClick={() => setIsExpandedMobile(true)}
                className="p-2 text-slate-400 hover:text-white"
                title="Open Player Controls"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MOBILE FULL-SCREEN / BOTTOM SHEET PLAYER */}
      {/* ============================================================ */}
      {isExpandedMobile && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-5 animate-slide-up overflow-y-auto">
          {/* Top Sheet Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsExpandedMobile(false)}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <div className="text-center">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                Playing from
              </span>
              <p className="text-xs font-bold text-white truncate max-w-[200px]">
                {currentTrack.folderName}
              </p>
            </div>
            <button
              onClick={() => {
                setIsExpandedMobile(false);
                onToggleQueue();
              }}
              className="p-2 -mr-2 rounded-xl text-slate-300 hover:text-white flex items-center gap-1"
            >
              <ListMusic className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-bold">{queueCount}</span>
            </button>
          </div>

          {/* Center: Track Illustration & Details */}
          <div className="my-auto py-6 flex flex-col items-center text-center space-y-5">
            <div className="relative w-48 h-48 rounded-3xl bg-gradient-to-tr from-indigo-900/60 via-slate-800 to-indigo-950 border border-indigo-500/40 shadow-2xl flex items-center justify-center">
              {isPlaying ? (
                <div className="flex items-end gap-1.5 h-14">
                  <span className="w-2.5 bg-indigo-400 rounded-full animate-music-bar-1" />
                  <span className="w-2.5 bg-cyan-400 rounded-full animate-music-bar-2" />
                  <span className="w-2.5 bg-indigo-300 rounded-full animate-music-bar-3" />
                  <span className="w-2.5 bg-purple-400 rounded-full animate-music-bar-1" />
                </div>
              ) : (
                <FileText className="w-16 h-16 text-indigo-400" />
              )}
            </div>

            <div className="space-y-1.5 max-w-xs">
              <h3 className="text-lg font-bold text-white leading-tight line-clamp-2">
                {currentTrack.fileName}
              </h3>
              <p className="text-xs text-indigo-300 font-medium">
                {currentTrack.folderName} • {currentTrack.type.toUpperCase()}
              </p>
            </div>

            {/* Spoken Text Follow-Along */}
            {currentSpokenSentence && (
              <div className="w-full max-w-sm p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-1.5 shadow-inner">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                  Live Reading:
                </span>
                <p className="text-xs text-slate-200 italic line-clamp-3 leading-relaxed">
                  "{currentSpokenSentence}"
                </p>
              </div>
            )}
          </div>

          {/* Bottom: Scrubber & Playback Controls */}
          <div className="space-y-5 pb-6">
            {/* Scrubber */}
            <div className="space-y-1.5">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                aria-label="Seek track position"
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center justify-between px-2">
              <button
                onClick={() => onSkipSeconds(-15)}
                className="p-3 text-slate-400 hover:text-white active:scale-90 transition-transform"
                title="-15s"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={onPrevious}
                className="p-3 text-slate-300 hover:text-white active:scale-90 transition-transform"
                title="Previous"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={onPlayPause}
                className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 active:scale-95 transition-transform"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current ml-1" />
                )}
              </button>

              <button
                onClick={onNext}
                className="p-3 text-slate-300 hover:text-white active:scale-90 transition-transform"
                title="Next"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              <button
                onClick={() => onSkipSeconds(15)}
                className="p-3 text-slate-400 hover:text-white active:scale-90 transition-transform"
                title="+15s"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>

            {/* Speed & Voice Switchers */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setIsExpandedMobile(false);
                  onOpenVoiceSettings();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2"
              >
                <Mic className="w-3.5 h-3.5 text-indigo-400" />
                <span>Voice: {playbackSettings.voiceName.split(' ')[0]}</span>
                <span className="text-amber-400">({playbackSettings.speed}x)</span>
              </button>

              <button
                onClick={() => {
                  setIsExpandedMobile(false);
                  onOpenDocViewer();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Read Doc</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DESKTOP PLAYER DOCK (Visible only on md screens and above) */}
      {/* ============================================================ */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 shadow-2xl transition-all">
        {/* Optional Spoken Sentence Follow-Along Drawer */}
        {showSpokenDrawer && currentSpokenSentence && (
          <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 py-2 max-w-4xl mx-auto flex items-center justify-between gap-3 text-xs animate-slide-up">
            <div className="flex items-center gap-2 text-indigo-300 flex-1 truncate">
              <span className="font-semibold text-slate-400 shrink-0 uppercase tracking-wider text-[10px]">
                Reading:
              </span>
              <p className="italic text-slate-200 truncate">{currentSpokenSentence}</p>
            </div>
            <button
              onClick={onOpenDocViewer}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Open Full Doc</span>
            </button>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Track Information */}
          <div className="flex items-center gap-3 min-w-0 w-1/4">
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-900/60 to-slate-800 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-md">
              {isPlaying ? (
                <div className="flex items-end gap-0.5 h-4">
                  <span className="w-1 bg-indigo-400 rounded-full animate-music-bar-1" />
                  <span className="w-1 bg-cyan-400 rounded-full animate-music-bar-2" />
                  <span className="w-1 bg-indigo-300 rounded-full animate-music-bar-3" />
                </div>
              ) : (
                <FileText className="w-5 h-5 text-indigo-400" />
              )}
            </div>

            <div className="min-w-0">
              <h4
                onClick={onOpenDocViewer}
                className="text-xs font-bold text-white truncate cursor-pointer hover:text-indigo-300 transition-colors"
                title="Click to view file"
              >
                {currentTrack.fileName}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                <span className="text-slate-400 truncate max-w-[120px]">{currentTrack.folderName}</span>
                <span className="text-slate-600">•</span>
                <span className="text-indigo-400 font-medium text-[10px] uppercase">
                  {currentTrack.type}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Controls & Scrubber */}
          <div className="flex-1 max-w-xl flex flex-col items-center gap-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSkipSeconds(-15)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Skip backward 15 seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={onPrevious}
                className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Previous file in queue"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={onPlayPause}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={onNext}
                className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Next file in queue"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={() => onSkipSeconds(15)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Skip forward 15 seconds"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full flex items-center gap-2.5 text-[11px] text-slate-400">
              <span className="w-9 text-right font-mono">{formatTime(currentTime)}</span>
              <div className="relative flex-1 group py-1 flex items-center">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => onSeek(parseFloat(e.target.value))}
                  aria-label="Seek track position"
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 group-hover:h-1.5 transition-all"
                />
              </div>
              <span className="w-9 font-mono">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Quick Settings */}
          <div className="flex items-center justify-end gap-2 w-1/4">
            <button
              onClick={() => setShowSpokenDrawer((prev) => !prev)}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                showSpokenDrawer
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle live read-along text"
            >
              <FileText className="w-3.5 h-3.5" />
              {showSpokenDrawer ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>

            <button
              onClick={onOpenVoiceSettings}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs flex items-center gap-1.5 text-slate-200 transition-colors cursor-pointer"
              title="Change voice or speed"
            >
              <span className="text-amber-400 font-bold text-[11px]">{playbackSettings.speed}x</span>
              <span className="text-slate-500">•</span>
              <span className="text-indigo-300 text-[11px] max-w-[70px] truncate">
                {playbackSettings.voiceName.split(' ')[0]}
              </span>
            </button>

            <button
              onClick={onToggleQueue}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isQueueOpen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title="Open Playback Queue"
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>{queueCount}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
