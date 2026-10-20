import React, { useState, useEffect } from 'react';
import { X, Mic, Volume2, Sparkles, Check, Gauge, Info, Square } from 'lucide-react';
import { PlaybackSettings, VoiceOption } from '../types';
import { audioEngine } from '../services/audioEngine';

interface VoiceSpeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PlaybackSettings;
  onUpdateSettings: (newSettings: Partial<PlaybackSettings>) => void;
  availableVoices: VoiceOption[];
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5];

export const VoiceSpeedModal: React.FC<VoiceSpeedModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  availableVoices,
}) => {
  const [selectedVoiceId, setSelectedVoiceId] = useState(settings.voiceId);
  const [selectedSpeed, setSelectedSpeed] = useState(settings.speed);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'neural' | 'browser'>('neural');

  // Stop preview whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setSelectedVoiceId(settings.voiceId);
      setSelectedSpeed(settings.speed);
    }
    return () => {
      audioEngine.stopPreview();
      setPreviewingVoiceId(null);
    };
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const neuralVoices = availableVoices.filter((v) => v.engine === 'gemini');
  const browserVoices = availableVoices.filter((v) => v.engine === 'browser');

  const handlePreview = (voiceId: string) => {
    if (previewingVoiceId === voiceId) {
      // Toggle off if clicking the currently playing voice preview
      audioEngine.stopPreview();
      setPreviewingVoiceId(null);
      return;
    }

    // Immediately stop 1st voice and start 2nd voice
    audioEngine.stopPreview();
    setPreviewingVoiceId(voiceId);

    audioEngine.previewVoice(voiceId, selectedSpeed, () => {
      setPreviewingVoiceId((current) => (current === voiceId ? null : current));
    });
  };

  const handleClose = () => {
    audioEngine.stopPreview();
    setPreviewingVoiceId(null);
    onClose();
  };

  const handleApply = () => {
    audioEngine.stopPreview();
    setPreviewingVoiceId(null);

    const selectedVoiceObj =
      availableVoices.find((v) => v.id === selectedVoiceId) || neuralVoices[0];
    onUpdateSettings({
      voiceId: selectedVoiceId,
      voiceEngine: selectedVoiceObj.engine,
      voiceName: selectedVoiceObj.name,
      speed: selectedSpeed,
    });
    audioEngine.setVoice(selectedVoiceId);
    audioEngine.setSpeed(selectedSpeed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh]">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Global Voice & Playback Speed</h2>
              <p className="text-xs text-slate-400">
                Applied globally to all text-to-speech files and audio playback
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Section 1: Playback Speed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                Playback Speed: <span className="text-amber-400 font-bold ml-1">{selectedSpeed}x</span>
              </label>
              <span className="text-[11px] text-slate-400">Applies to speech & audio</span>
            </div>

            {/* Speed Presets */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {SPEED_PRESETS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    setSelectedSpeed(spd);
                    // If preview is playing, restart preview at new speed
                    if (previewingVoiceId) {
                      audioEngine.previewVoice(previewingVoiceId, spd, () =>
                        setPreviewingVoiceId(null)
                      );
                    }
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedSpeed === spd
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 ring-2 ring-amber-400/30'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.05"
              value={selectedSpeed}
              onChange={(e) => setSelectedSpeed(parseFloat(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Section 2: Choose Voice */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Text-to-Speech Voice
              </label>
              <div className="flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700/60 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab('neural')}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                    activeTab === 'neural'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Gemini Neural (5)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('browser')}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                    activeTab === 'browser'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  System Voices ({browserVoices.length})
                </button>
              </div>
            </div>

            {/* Voice Cards */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(activeTab === 'neural' ? neuralVoices : browserVoices).map((voice) => {
                const isSelected = selectedVoiceId === voice.id;
                const isThisVoicePreviewing = previewingVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    onClick={() => setSelectedVoiceId(voice.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-500 text-white'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {voice.name}
                          </span>
                          {voice.engine === 'gemini' && (
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-medium px-1.5 py-0.2 rounded shrink-0">
                              AI Studio
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {voice.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(voice.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
                        isThisVoicePreviewing
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                          : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title={isThisVoicePreviewing ? 'Stop preview' : 'Listen to preview'}
                    >
                      {isThisVoicePreviewing ? (
                        <>
                          <Square className="w-3 h-3 fill-current text-amber-400" />
                          <span className="text-amber-300 font-bold">Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info pill */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p>
              Voice and playback speed are applied across the entire app for all text-to-speech reading and audio playback.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            Apply to App
          </button>
        </div>
      </div>
    </div>
  );
};
