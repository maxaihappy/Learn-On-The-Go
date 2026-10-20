import { VoiceEngine, VoiceOption } from '../types';
import { cleanMarkdownForSpeech } from '../utils/cleanMarkdownForSpeech';

export const GEMINI_VOICES: VoiceOption[] = [
  {
    id: 'gemini-Kore',
    name: 'Kore (Studio Neural)',
    engine: 'gemini',
    description: 'Warm, calm, and soothing educator voice',
    lang: 'en-US',
    accent: 'American',
  },
  {
    id: 'gemini-Puck',
    name: 'Puck (Studio Neural)',
    engine: 'gemini',
    description: 'Crisp, energetic, and engaging narrator',
    lang: 'en-US',
    accent: 'American',
  },
  {
    id: 'gemini-Charon',
    name: 'Charon (Studio Neural)',
    engine: 'gemini',
    description: 'Deep, resonant, and authoritative tone',
    lang: 'en-US',
    accent: 'American',
  },
  {
    id: 'gemini-Fenrir',
    name: 'Fenrir (Studio Neural)',
    engine: 'gemini',
    description: 'Dynamic, clear, and articulate presence',
    lang: 'en-US',
    accent: 'American',
  },
  {
    id: 'gemini-Zephyr',
    name: 'Zephyr (Studio Neural)',
    engine: 'gemini',
    description: 'Bright, cheerful, and friendly tone',
    lang: 'en-US',
    accent: 'American',
  },
];

class AudioEngine {
  private audioElement: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speed: number = 1.0;
  private volume: number = 1.0;
  private activeVoiceId: string = 'gemini-Kore';
  private activeVoiceEngine: VoiceEngine = 'gemini';
  private isSpeakingBrowser: boolean = false;
  private isPlayingAudio: boolean = false;
  private timerInterval: any = null;
  private textChunks: string[] = [];
  private currentChunkIndex: number = 0;
  private cachedBrowserVoices: SpeechSynthesisVoice[] = [];
  private onVoicesChangedCallbacks: (() => void)[] = [];
  private previewAudioElement: HTMLAudioElement | null = null;
  private previewRequestId: number = 0;
  private currentSessionId: number = 0;

  // Listeners
  private onTimeUpdateCallback?: (currentTime: number, duration: number, progress: number) => void;
  private onEndedCallback?: () => void;
  private onStateChangeCallback?: (isPlaying: boolean) => void;
  private onSentenceChangeCallback?: (chunk: string, index: number, total: number) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.addEventListener('ended', this.handleAudioEnded);
      this.audioElement.addEventListener('timeupdate', this.handleAudioTimeUpdate);
      this.audioElement.addEventListener('play', () => this.notifyStateChange(true));
      this.audioElement.addEventListener('pause', () => this.notifyStateChange(false));

      // Load browser voices
      this.loadBrowserVoices();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.loadBrowserVoices();
          this.onVoicesChangedCallbacks.forEach(cb => cb());
        };
      }
    }
  }

  public registerVoicesListener(cb: () => void) {
    this.onVoicesChangedCallbacks.push(cb);
    return () => {
      this.onVoicesChangedCallbacks = this.onVoicesChangedCallbacks.filter(c => c !== cb);
    };
  }

  private loadBrowserVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.cachedBrowserVoices = window.speechSynthesis.getVoices();
    }
  }

  public getAvailableVoices(): VoiceOption[] {
    const list: VoiceOption[] = [...GEMINI_VOICES];

    const browserOptions: VoiceOption[] = this.cachedBrowserVoices
      .filter(v => v.lang.startsWith('en') || v.default)
      .slice(0, 15)
      .map(v => ({
        id: `browser-${v.voiceURI || v.name}`,
        name: `${v.name} (${v.lang})`,
        engine: 'browser' as VoiceEngine,
        description: v.localService ? 'Offline system voice' : 'Natural browser voice',
        lang: v.lang,
      }));

    return [...list, ...browserOptions];
  }

  public setCallbacks(callbacks: {
    onTimeUpdate?: (currentTime: number, duration: number, progress: number) => void;
    onEnded?: () => void;
    onStateChange?: (isPlaying: boolean) => void;
    onSentenceChange?: (chunk: string, index: number, total: number) => void;
  }) {
    this.onTimeUpdateCallback = callbacks.onTimeUpdate;
    this.onEndedCallback = callbacks.onEnded;
    this.onStateChangeCallback = callbacks.onStateChange;
    this.onSentenceChangeCallback = callbacks.onSentenceChange;
  }

  public setSpeed(speed: number) {
    this.speed = Math.max(0.5, Math.min(2.5, speed));
    if (this.audioElement) {
      this.audioElement.playbackRate = this.speed;
    }
    // If currently speaking via browser speech, update rate for subsequent utterances
    if (this.currentUtterance) {
      this.currentUtterance.rate = this.speed;
    }
  }

  public getSpeed() {
    return this.speed;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  public setVoice(voiceId: string) {
    this.activeVoiceId = voiceId;
    if (voiceId.startsWith('gemini-')) {
      this.activeVoiceEngine = 'gemini';
    } else {
      this.activeVoiceEngine = 'browser';
    }
  }

  public getActiveVoice(): { id: string; engine: VoiceEngine } {
    return {
      id: this.activeVoiceId,
      engine: this.activeVoiceEngine,
    };
  }

  public isPlaying(): boolean {
    return this.isPlayingAudio || this.isSpeakingBrowser;
  }

  // Play direct audio file (mp3, wav, etc.)
  public async playAudioUrl(url: string, startingTime: number = 0, expectedSessionId?: number) {
    if (expectedSessionId !== undefined && this.currentSessionId !== expectedSessionId) {
      return;
    }

    this.stop();
    this.currentSessionId++;
    const thisSession = this.currentSessionId;

    if (!this.audioElement) return;

    this.audioElement.src = url;
    this.audioElement.currentTime = startingTime;
    this.audioElement.playbackRate = this.speed;
    this.audioElement.volume = this.volume;

    try {
      await this.audioElement.play();
      if (this.currentSessionId === thisSession) {
        this.isPlayingAudio = true;
        this.notifyStateChange(true);
      } else {
        this.audioElement.pause();
      }
    } catch (e) {
      if (this.currentSessionId === thisSession) {
        console.error('Audio play failed:', e);
        this.notifyStateChange(false);
      }
    }
  }

  // Play text using current voice settings (Gemini Neural or Browser TTS)
  public async playText(text: string, estimatedDuration: number = 60) {
    // 1. Immediately kill any current playing audio or browser speech
    this.stop();

    // 2. Assign unique session id for this playback request
    this.currentSessionId++;
    const thisSession = this.currentSessionId;

    // 3. Clean markdown format characters (#, |, *, _, links, tables, code backticks)
    const spokenText = cleanMarkdownForSpeech(text);

    if (!spokenText || spokenText.trim().length === 0) {
      this.handleAudioEnded();
      return;
    }

    // 4. Split text into natural spoken sentences (only split on . ! ? or double newlines, NOT on : or ;)
    // Colons and semicolons are natural breathing pauses within a sentence, splitting on them caused jarring restarts
    const rawChunks = spokenText
      .split(/(?<=[.?!])\s+|\n{2,}/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    this.textChunks = rawChunks.length > 0 ? rawChunks : [spokenText];
    this.currentChunkIndex = 0;

    // Check if user selected Gemini Neural Voice
    if (this.activeVoiceEngine === 'gemini') {
      const voiceRawName = this.activeVoiceId.replace('gemini-', '');
      try {
        const response = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: spokenText.slice(0, 2000),
            voiceName: voiceRawName,
          }),
        });

        // If user already clicked another file or stopped while fetching, abort immediately!
        if (this.currentSessionId !== thisSession) {
          return;
        }

        const data = await response.json();
        if (this.currentSessionId !== thisSession) {
          return;
        }

        if (data.success && data.audioBase64) {
          const wavUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
          await this.playAudioUrl(wavUrl, 0, thisSession);
          return;
        }
      } catch (err) {
        if (this.currentSessionId !== thisSession) return;
        console.warn('Gemini TTS failed or offline, falling back to browser synthesis', err);
      }
    }

    if (this.currentSessionId !== thisSession) return;

    // Fallback or explicit Browser SpeechSynthesis
    this.playWithBrowserSpeech(this.textChunks, estimatedDuration, thisSession);
  }

  private playWithBrowserSpeech(chunks: string[], estimatedTotalSecs: number, sessionId: number) {
    if (!('speechSynthesis' in window)) {
      console.warn('Browser SpeechSynthesis not supported');
      return;
    }

    if (this.currentSessionId !== sessionId) {
      return;
    }

    // Cancel any previous utterances
    window.speechSynthesis.cancel();
    this.isSpeakingBrowser = true;
    this.notifyStateChange(true);

    let totalDuration = Math.max(5, estimatedTotalSecs / this.speed);
    let startTime = Date.now();

    // Start progress timer
    this.startProgressTicker(totalDuration, startTime);

    const speakChunk = (index: number) => {
      // Abort if session changed, or stopped
      if (this.currentSessionId !== sessionId || !this.isSpeakingBrowser) {
        return;
      }

      if (index >= chunks.length) {
        this.stopProgressTicker();
        this.isSpeakingBrowser = false;
        this.notifyStateChange(false);
        this.handleAudioEnded();
        return;
      }

      this.currentChunkIndex = index;
      const currentSentence = chunks[index];

      if (this.onSentenceChangeCallback && this.currentSessionId === sessionId) {
        this.onSentenceChangeCallback(currentSentence, index, chunks.length);
      }

      const utterance = new SpeechSynthesisUtterance(currentSentence);
      this.currentUtterance = utterance;
      utterance.rate = this.speed;
      utterance.volume = this.volume;

      // Match voice
      const targetVoiceURI = this.activeVoiceId.replace('browser-', '');
      const voice = this.cachedBrowserVoices.find(
        v => v.voiceURI === targetVoiceURI || v.name === targetVoiceURI
      );
      if (voice) {
        utterance.voice = voice;
      } else if (this.cachedBrowserVoices.length > 0) {
        const enVoice = this.cachedBrowserVoices.find(v => v.lang.startsWith('en'));
        if (enVoice) utterance.voice = enVoice;
      }

      utterance.onend = () => {
        if (this.currentSessionId === sessionId && this.isSpeakingBrowser) {
          speakChunk(index + 1);
        }
      };

      utterance.onerror = (e) => {
        // If canceled or interrupted by user starting a new file or stopping, do NOT continue speaking!
        if (
          e.error === 'canceled' ||
          e.error === 'interrupted' ||
          this.currentSessionId !== sessionId ||
          !this.isSpeakingBrowser
        ) {
          return;
        }
        console.warn('SpeechSynthesis error:', e);
        speakChunk(index + 1);
      };

      if (this.currentSessionId === sessionId && this.isSpeakingBrowser) {
        window.speechSynthesis.speak(utterance);
      }
    };

    // Small timeout ensures browser speech engine has processed previous cancel()
    setTimeout(() => {
      if (this.currentSessionId === sessionId && this.isSpeakingBrowser) {
        speakChunk(0);
      }
    }, 40);
  }

  private startProgressTicker(totalDuration: number, startTime: number) {
    this.stopProgressTicker();
    this.timerInterval = setInterval(() => {
      if (!this.isSpeakingBrowser) {
        this.stopProgressTicker();
        return;
      }
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(1, elapsed / totalDuration);
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(elapsed, totalDuration, progress);
      }
    }, 250);
  }

  private stopProgressTicker() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public pause() {
    if (this.audioElement && this.isPlayingAudio) {
      this.audioElement.pause();
      this.isPlayingAudio = false;
      this.notifyStateChange(false);
    } else if (this.isSpeakingBrowser && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      this.isSpeakingBrowser = false;
      this.notifyStateChange(false);
    }
  }

  public resume() {
    if (this.audioElement && this.audioElement.src) {
      this.audioElement.play().catch(console.error);
      this.isPlayingAudio = true;
      this.notifyStateChange(true);
    } else if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.isSpeakingBrowser = true;
      this.notifyStateChange(true);
    }
  }

  public stop() {
    this.currentSessionId++;
    this.stopProgressTicker();
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
      } catch (e) {
        console.warn('Error unloading audio element', e);
      }
    }
    this.isPlayingAudio = false;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('Error cancelling speech synthesis', e);
      }
    }
    this.isSpeakingBrowser = false;
    this.currentUtterance = null;
    this.notifyStateChange(false);
  }

  public seek(targetSeconds: number) {
    if (this.audioElement && this.audioElement.src && !Number.isNaN(this.audioElement.duration)) {
      this.audioElement.currentTime = Math.max(0, Math.min(targetSeconds, this.audioElement.duration));
    }
  }

  public skipSeconds(delta: number) {
    if (this.audioElement && this.audioElement.src) {
      const cur = this.audioElement.currentTime;
      const target = Math.max(0, Math.min(cur + delta, this.audioElement.duration || cur + delta));
      this.audioElement.currentTime = target;
    }
  }

  private handleAudioEnded = () => {
    this.isPlayingAudio = false;
    this.notifyStateChange(false);
    if (this.onEndedCallback) {
      this.onEndedCallback();
    }
  };

  private handleAudioTimeUpdate = () => {
    if (!this.audioElement) return;
    const current = this.audioElement.currentTime;
    const dur = this.audioElement.duration || 1;
    const progress = Math.min(1, current / dur);
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(current, dur, progress);
    }
  };

  private notifyStateChange(isPlaying: boolean) {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(isPlaying);
    }
  }

  // Stop any active voice preview immediately
  public stopPreview() {
    this.previewRequestId++;
    if (this.previewAudioElement) {
      try {
        this.previewAudioElement.pause();
        this.previewAudioElement.currentTime = 0;
        this.previewAudioElement.removeAttribute('src');
        this.previewAudioElement.load();
      } catch (e) {
        console.warn('Error unloading preview audio', e);
      }
      this.previewAudioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('Error cancelling speech synthesis', e);
      }
    }
  }

  // One-off speech preview for voice testing (stops any previously playing preview)
  public async previewVoice(
    voiceId: string,
    speed: number = 1.0,
    onEnded?: () => void
  ) {
    // 1. Pause any background document track that was playing
    this.pause();

    // 2. Stop any existing preview voice completely
    this.stopPreview();

    this.previewRequestId++;
    const currentReqId = this.previewRequestId;

    if (voiceId.startsWith('gemini-')) {
      const name = voiceId.replace('gemini-', '');
      try {
        const response = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `Hello! I am ${name}, your AI voice for AudioLearner. Ready to read at ${speed}x speed.`,
            voiceName: name,
          }),
        });

        // If user switched voices while the server TTS was in-flight, immediately discard
        if (this.previewRequestId !== currentReqId) {
          return;
        }

        const data = await response.json();
        if (this.previewRequestId !== currentReqId) {
          return;
        }

        if (data.success && data.audioBase64) {
          const testAudio = new Audio(
            `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
          );
          testAudio.playbackRate = speed;
          this.previewAudioElement = testAudio;

          testAudio.onended = () => {
            if (this.previewAudioElement === testAudio) {
              this.previewAudioElement = null;
            }
            if (this.previewRequestId === currentReqId && onEnded) onEnded();
          };

          testAudio.onerror = () => {
            if (this.previewAudioElement === testAudio) {
              this.previewAudioElement = null;
            }
            if (this.previewRequestId === currentReqId && onEnded) onEnded();
          };

          try {
            await testAudio.play();
          } catch (e) {
            // Expected if user clicked another voice immediately
            console.debug('Preview audio playback interrupted by user', e);
          }
          return;
        }
      } catch (err) {
        console.warn('Voice preview fallback to browser speech', err);
      }
    }

    if (this.previewRequestId !== currentReqId) {
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      // Brief tick allows browser speech engine to completely unbind previous utterance
      setTimeout(() => {
        if (this.previewRequestId !== currentReqId) {
          return;
        }

        const utt = new SpeechSynthesisUtterance(
          `Hello! This is a test of your selected voice on AudioLearner running at ${speed}x speed.`
        );
        utt.rate = speed;
        const voiceURI = voiceId.replace('browser-', '');
        const voice = this.cachedBrowserVoices.find(
          (v) => v.voiceURI === voiceURI || v.name === voiceURI
        );
        if (voice) utt.voice = voice;

        utt.onend = () => {
          if (this.previewRequestId === currentReqId && onEnded) onEnded();
        };
        utt.onerror = () => {
          if (this.previewRequestId === currentReqId && onEnded) onEnded();
        };

        window.speechSynthesis.speak(utt);
      }, 50);
    }
  }
}

export const audioEngine = new AudioEngine();
