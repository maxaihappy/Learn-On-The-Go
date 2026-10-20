import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus,
  Play,
  Layers,
  Sparkles,
  FileText,
  Volume2,
  Plus,
  Upload,
  ListMusic,
  ArrowLeft,
  ChevronRight,
  Folder as FolderIcon,
} from 'lucide-react';
import {
  Folder,
  UploadedFile,
  QueueItem,
  PlaybackSettings,
  VoiceOption,
} from './types';
import { INITIAL_FOLDERS, INITIAL_FILES } from './data/initialData';
import { audioEngine } from './services/audioEngine';
import { AppHeader } from './components/AppHeader';
import { FolderCard } from './components/FolderCard';
import { FileRow } from './components/FileRow';
import { BottomPlayerBar } from './components/BottomPlayerBar';
import { QueueDrawer } from './components/QueueDrawer';
import { VoiceSpeedModal } from './components/VoiceSpeedModal';
import { FileUploadModal } from './components/FileUploadModal';
import { NewFolderModal } from './components/NewFolderModal';
import { FolderAiQuizModal } from './components/FolderAiQuizModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  saveFolderToFirestore,
  deleteFolderFromFirestore,
  saveFileToFirestore,
  updateFileFolderInFirestore,
  deleteFileFromFirestore,
  savePlaybackSettingsToFirestore,
  db,
  handleFirestoreError,
  OperationType,
} from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';

const SETTINGS_STORAGE_KEY = 'audiolearner_settings_v1';
const FOLDERS_STORAGE_KEY = 'audiolearner_folders_v1';
const FILES_STORAGE_KEY = 'audiolearner_files_v1';

const SAMPLE_FOLDER_IDS = new Set(['folder-bio', 'folder-history', 'folder-tech']);
const SAMPLE_FILE_IDS = new Set([
  'file-bio-1',
  'file-bio-2',
  'file-hist-1',
  'file-hist-2',
  'file-tech-1',
  'file-tech-2',
]);

export default function App() {
  // Persistence initialization: purge old mock samples so only real user files & folders persist
  const [folders, setFolders] = useState<Folder[]>(() => {
    try {
      const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((f) => !SAMPLE_FOLDER_IDS.has(f.id));
        }
      }
      return INITIAL_FOLDERS;
    } catch {
      return INITIAL_FOLDERS;
    }
  });

  const [files, setFiles] = useState<UploadedFile[]>(() => {
    try {
      const saved = localStorage.getItem(FILES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((f) => !SAMPLE_FILE_IDS.has(f.id));
        }
      }
      return INITIAL_FILES;
    } catch {
      return INITIAL_FILES;
    }
  });

  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      speed: 1.0,
      voiceId: 'gemini-Kore',
      voiceEngine: 'gemini',
      voiceName: 'Kore (Studio Neural)',
      loopMode: 'off',
      autoPlayNext: true,
      volume: 1.0,
    };
  });

  // Cloud Sync status
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const lastSyncTimestampRef = useRef<number>(0);
  const isUploadingRef = useRef<boolean>(false);
  const lastUploadTimeRef = useRef<number>(0);

  // Firebase User & Cloud Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Mobile navigation tab: 'folders' | 'files' | 'queue'
  const [mobileTab, setMobileTab] = useState<'folders' | 'files' | 'queue'>('folders');

  // Active folder view: null means overview of all folders, or a folderId
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Queue & Player State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(100);
  const [progress, setProgress] = useState<number>(0);
  const [currentSpokenSentence, setCurrentSpokenSentence] = useState<string>('');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFolderTargetId, setUploadFolderTargetId] = useState<string | undefined>();
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [aiQuizFolder, setAiQuizFolder] = useState<Folder | null>(null);
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null);

  // Available voices
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>(() =>
    audioEngine.getAvailableVoices()
  );

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const currentIndexRef = useRef(currentQueueIndex);
  currentIndexRef.current = currentQueueIndex;
  const settingsRef = useRef(playbackSettings);
  settingsRef.current = playbackSettings;

  // Persist folders and files locally for offline resilience
  useEffect(() => {
    try {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    } catch (e) {
      console.error(e);
    }
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
    } catch (e) {
      console.error(e);
    }
  }, [files]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(playbackSettings));
    } catch (e) {
      console.error(e);
    }
    audioEngine.setVoice(playbackSettings.voiceId);
    audioEngine.setSpeed(playbackSettings.speed);
  }, [playbackSettings]);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Firestore Real-Time Subscriptions when authenticated
  useEffect(() => {
    if (!currentUser) return;

    setSyncStatus('syncing');

    // Folders listener
    const foldersQuery = query(
      collection(db, 'folders'),
      where('ownerId', '==', currentUser.uid)
    );
    const unsubFolders = onSnapshot(
      foldersQuery,
      (snapshot) => {
        const loadedFolders: Folder[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (!SAMPLE_FOLDER_IDS.has(d.id)) {
            loadedFolders.push({
              id: d.id,
              name: d.name,
              color: d.color,
              icon: d.icon,
              description: d.description || '',
              createdAt: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
            });
          }
        });
        setFolders(loadedFolders);
        setSyncStatus('synced');
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'folders');
      }
    );

    // Files listener
    const filesQuery = query(
      collection(db, 'files'),
      where('ownerId', '==', currentUser.uid)
    );
    const unsubFiles = onSnapshot(
      filesQuery,
      (snapshot) => {
        const loadedFiles: UploadedFile[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (!SAMPLE_FILE_IDS.has(d.id)) {
            loadedFiles.push({
              id: d.id,
              name: d.name,
              type: d.type,
              size: d.size,
              content: d.content,
              folderId: d.folderId || '',
              duration: d.duration || d.estimatedDuration || 100,
              tags: d.tags || [],
              estimatedDuration: d.estimatedDuration,
              createdAt: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
            });
          }
        });
        loadedFiles.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setFiles(loadedFiles);
        setSyncStatus('synced');
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'files');
      }
    );

    // Settings listener
    const settingsDocRef = doc(db, 'settings', currentUser.uid);
    const unsubSettings = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          if (d.voiceId) {
            setPlaybackSettings((prev) => ({
              ...prev,
              speed: d.speed ?? prev.speed,
              voiceId: d.voiceId ?? prev.voiceId,
              voiceEngine: d.voiceEngine ?? prev.voiceEngine,
              voiceName: d.voiceName ?? prev.voiceName,
              loopMode: d.loopMode ?? prev.loopMode,
              autoPlayNext: d.autoPlayNext ?? prev.autoPlayNext,
              volume: d.volume ?? prev.volume,
            }));
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `settings/${currentUser.uid}`);
      }
    );

    // Auto-migrate any pre-existing local folders/files to Firestore
    try {
      const rawFolders = localStorage.getItem(FOLDERS_STORAGE_KEY);
      const rawFiles = localStorage.getItem(FILES_STORAGE_KEY);
      if (rawFolders) {
        const parsed = JSON.parse(rawFolders);
        if (Array.isArray(parsed)) {
          parsed
            .filter((f) => !SAMPLE_FOLDER_IDS.has(f.id))
            .forEach((f) => {
              saveFolderToFirestore(f, currentUser.uid).catch(console.error);
            });
        }
      }
      if (rawFiles) {
        const parsed = JSON.parse(rawFiles);
        if (Array.isArray(parsed)) {
          parsed
            .filter((f) => !SAMPLE_FILE_IDS.has(f.id))
            .forEach((f) => {
              saveFileToFirestore(f, currentUser.uid).catch(console.error);
            });
        }
      }
    } catch (e) {
      console.warn('Initial local migration to Firestore error:', e);
    }

    return () => {
      unsubFolders();
      unsubFiles();
      unsubSettings();
    };
  }, [currentUser]);

  // ==========================================
  // SERVER SYNC (Ensures PC & Mobile Stay in Sync)
  // ==========================================
  const fetchServerData = async (isBackground: boolean = false) => {
    // If an upload is currently occurring or completed within 2.5s, do not overwrite local state
    if (isUploadingRef.current || Date.now() - lastUploadTimeRef.current < 2500) {
      return;
    }

    if (!isBackground) setSyncStatus('syncing');
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        const serverTs = data.lastUpdated || 0;

        const serverFilesClean = (data.files || []).filter((f: UploadedFile) => !SAMPLE_FILE_IDS.has(f.id));
        const serverFoldersClean = (data.folders || []).filter((f: Folder) => !SAMPLE_FOLDER_IDS.has(f.id));

        const serverFileMap = new Map<string, UploadedFile>(
          serverFilesClean.map((f: UploadedFile) => [f.id, f])
        );
        const serverFolderMap = new Map<string, Folder>(
          serverFoldersClean.map((f: Folder) => [f.id, f])
        );

        // Check if browser localStorage has custom user files/folders that the server is missing
        // (e.g. after a fresh container deployment or server reboot)
        let localFiles: UploadedFile[] = [];
        let localFolders: Folder[] = [];
        try {
          const rawF = localStorage.getItem(FILES_STORAGE_KEY);
          if (rawF) {
            const parsed = JSON.parse(rawF);
            if (Array.isArray(parsed)) {
              localFiles = parsed.filter((f) => !SAMPLE_FILE_IDS.has(f.id));
            }
          }
        } catch {}
        try {
          const rawD = localStorage.getItem(FOLDERS_STORAGE_KEY);
          if (rawD) {
            const parsed = JSON.parse(rawD);
            if (Array.isArray(parsed)) {
              localFolders = parsed.filter((f) => !SAMPLE_FOLDER_IDS.has(f.id));
            }
          }
        } catch {}

        const missingFiles = localFiles.filter((f) => !serverFileMap.has(f.id));
        const missingFolders = localFolders.filter((f) => !serverFolderMap.has(f.id));

        if (missingFiles.length > 0 || missingFolders.length > 0) {
          // Auto-restore / push client library to server so it is immediately saved and available on mobile
          try {
            const mergeRes = await fetch('/api/sync/merge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientFolders: localFolders,
                clientFiles: localFiles,
              }),
            });
            if (mergeRes.ok) {
              const mergeData = await mergeRes.json();
              if (mergeData.folders) setFolders(mergeData.folders.filter((f: any) => !SAMPLE_FOLDER_IDS.has(f.id)));
              if (mergeData.files) setFiles(mergeData.files.filter((f: any) => !SAMPLE_FILE_IDS.has(f.id)));
              lastSyncTimestampRef.current = mergeData.lastUpdated;
              setSyncStatus('synced');
              return;
            }
          } catch (e) {
            console.warn('Auto-restore merge error', e);
          }
        }

        // Only update state if data has actually changed on the server.
        if (serverTs !== lastSyncTimestampRef.current) {
          lastSyncTimestampRef.current = serverTs;
          if (data.folders && Array.isArray(data.folders)) {
            setFolders(serverFoldersClean);
          }
          if (data.files && Array.isArray(data.files)) {
            // Deduplicate to ensure locally uploaded files are never lost
            setFiles((prev) => {
              const prevClean = prev.filter((f) => !SAMPLE_FILE_IDS.has(f.id));
              const merged = [...serverFilesClean];
              for (const pf of prevClean) {
                if (!serverFileMap.has(pf.id)) {
                  merged.unshift(pf);
                }
              }
              return merged;
            });
          }
          if (data.playbackSettings && data.playbackSettings.voiceId) {
            setPlaybackSettings(data.playbackSettings);
          }
        }
        setSyncStatus('synced');
      } else {
        setSyncStatus('offline');
      }
    } catch (err) {
      console.warn('Sync failed, using offline cache', err);
      setSyncStatus('offline');
    }
  };

  // Initial fetch and periodic polling for real-time PC <-> Mobile sync
  useEffect(() => {
    fetchServerData(false);

    // Poll every 6 seconds to capture changes uploaded from PC while viewing on mobile
    const pollInterval = setInterval(() => {
      fetchServerData(true);
    }, 6000);

    // Refresh when tab gains focus, but avoid flashing when closing OS file pickers
    const handleFocus = () => {
      if (isUploadingRef.current || Date.now() - lastUploadTimeRef.current < 2500) {
        return;
      }
      fetchServerData(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    });

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // AudioEngine callback hooks
  useEffect(() => {
    const unregisterVoices = audioEngine.registerVoicesListener(() => {
      setAvailableVoices(audioEngine.getAvailableVoices());
    });

    audioEngine.setCallbacks({
      onTimeUpdate: (cur, dur, prog) => {
        setCurrentTime(cur);
        setDuration(dur);
        setProgress(prog);
      },
      onStateChange: (playing) => {
        setIsPlaying(playing);
      },
      onSentenceChange: (chunk) => {
        setCurrentSpokenSentence(chunk);
      },
      onEnded: () => {
        handleTrackEnded();
      },
    });

    return () => {
      unregisterVoices();
      audioEngine.stop();
    };
  }, []);

  const handleTrackEnded = () => {
    const currentQ = queueRef.current;
    const curIdx = currentIndexRef.current;
    const settings = settingsRef.current;

    if (settings.loopMode === 'one' && curIdx >= 0 && curIdx < currentQ.length) {
      playTrackAtIndex(curIdx);
      return;
    }

    if (curIdx + 1 < currentQ.length) {
      playTrackAtIndex(curIdx + 1);
    } else if (settings.loopMode === 'all' && currentQ.length > 0) {
      playTrackAtIndex(0);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      setProgress(0);
    }
  };

  const playTrackAtIndex = (index: number) => {
    const item = queueRef.current[index];
    if (!item) return;

    // Completely stop and unload previous audio & cancel any speech utterances
    audioEngine.stop();
    audioEngine.stopPreview();

    setCurrentQueueIndex(index);
    setCurrentTime(0);
    setProgress(0);
    setCurrentSpokenSentence('');

    if (item.audioUrl && item.type === 'audio') {
      audioEngine.playAudioUrl(item.audioUrl, 0);
    } else {
      audioEngine.playText(item.content, item.duration);
    }
  };

  const fileToQueueItem = (file: UploadedFile): QueueItem => {
    const folder = folders.find((f) => f.id === file.folderId);
    return {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      fileId: file.id,
      fileName: file.name,
      folderId: file.folderId,
      folderName: folder?.name || 'Uncategorized',
      type: file.type,
      content: file.content,
      audioUrl: file.audioUrl,
      duration: file.duration,
    };
  };

  // 1. Play All Files
  const handlePlayAllFiles = () => {
    if (files.length === 0) return;
    audioEngine.stop();
    audioEngine.stopPreview();
    const newQueue: QueueItem[] = files.map(fileToQueueItem);
    setQueue(newQueue);
    setCurrentQueueIndex(0);
    queueRef.current = newQueue;
    currentIndexRef.current = 0;
    playTrackAtIndex(0);
  };

  // 2. Play All Files in Folder
  const handlePlayFolder = (folderId: string) => {
    const folderFiles = files.filter((f) => f.folderId === folderId);
    if (folderFiles.length === 0) return;
    audioEngine.stop();
    audioEngine.stopPreview();
    const newQueue: QueueItem[] = folderFiles.map(fileToQueueItem);
    setQueue(newQueue);
    setCurrentQueueIndex(0);
    queueRef.current = newQueue;
    currentIndexRef.current = 0;
    playTrackAtIndex(0);
  };

  // 3. Play individual file
  const handlePlayFile = (file: UploadedFile) => {
    // Immediately stop reading previous file
    audioEngine.stop();
    audioEngine.stopPreview();
    const item = fileToQueueItem(file);
    const newQueue = [item, ...queue.filter((q) => q.fileId !== file.id)];
    setQueue(newQueue);
    setCurrentQueueIndex(0);
    queueRef.current = newQueue;
    currentIndexRef.current = 0;
    playTrackAtIndex(0);
  };

  const handleAddToQueue = (file: UploadedFile) => {
    const item = fileToQueueItem(file);
    setQueue((prev) => [...prev, item]);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      if (currentQueueIndex >= 0 && currentQueueIndex < queue.length) {
        audioEngine.resume();
      } else if (queue.length > 0) {
        playTrackAtIndex(0);
      } else if (files.length > 0) {
        handlePlayAllFiles();
      }
    }
  };

  const handlePreviousTrack = () => {
    if (currentQueueIndex > 0) {
      playTrackAtIndex(currentQueueIndex - 1);
    } else {
      audioEngine.seek(0);
    }
  };

  const handleNextTrack = () => {
    if (currentQueueIndex + 1 < queue.length) {
      playTrackAtIndex(currentQueueIndex + 1);
    }
  };

  const handleSeek = (seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  const handleSkipSeconds = (delta: number) => {
    audioEngine.skipSeconds(delta);
  };

  const handleRemoveFromQueue = (queueItemId: string) => {
    const removedIdx = queue.findIndex((q) => q.id === queueItemId);
    const updated = queue.filter((q) => q.id !== queueItemId);
    setQueue(updated);

    if (removedIdx === currentQueueIndex) {
      if (updated.length > 0) {
        const nextIdx = Math.min(removedIdx, updated.length - 1);
        playTrackAtIndex(nextIdx);
      } else {
        audioEngine.stop();
        setCurrentQueueIndex(-1);
      }
    } else if (removedIdx < currentQueueIndex) {
      setCurrentQueueIndex((prev) => prev - 1);
    }
  };

  const handleMoveQueueTrack = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= queue.length) return;
    const reordered = [...queue];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setQueue(reordered);

    if (currentQueueIndex === fromIdx) {
      setCurrentQueueIndex(toIdx);
    } else if (fromIdx < currentQueueIndex && toIdx >= currentQueueIndex) {
      setCurrentQueueIndex((prev) => prev - 1);
    } else if (fromIdx > currentQueueIndex && toIdx <= currentQueueIndex) {
      setCurrentQueueIndex((prev) => prev + 1);
    }
  };

  const handleClearQueue = () => {
    audioEngine.stop();
    setQueue([]);
    setCurrentQueueIndex(-1);
    setIsPlaying(false);
  };

  const handleShuffleQueue = () => {
    if (queue.length <= 1) return;
    const currentTrack = currentQueueIndex >= 0 ? queue[currentQueueIndex] : null;
    const rest = queue.filter((_, idx) => idx !== currentQueueIndex);

    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    const shuffled = currentTrack ? [currentTrack, ...rest] : rest;
    setQueue(shuffled);
    setCurrentQueueIndex(currentTrack ? 0 : -1);
  };

  // Google Auth handlers
  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-In failed:', err?.message || err);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
    } catch (err: any) {
      console.error('Google Sign-Out failed:', err?.message || err);
    }
  };

  // Create folder: optimistic local update + Firestore & server persistence
  const handleCreateFolder = async (newF: Omit<Folder, 'id' | 'createdAt'>) => {
    const folder: Folder = {
      ...newF,
      id: `folder-${Date.now()}`,
      createdAt: Date.now(),
    };
    setFolders((prev) => [...prev, folder]);
    setActiveFolderId(folder.id);

    if (currentUser) {
      saveFolderToFirestore(folder, currentUser.uid).catch(console.error);
    }

    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder }),
      });
    } catch (e) {
      console.error('Failed to sync folder creation to server:', e);
    }
  };

  // Delete folder: optimistic local update + Firestore & server persistence
  const handleDeleteFolder = async (folderId: string) => {
    if (window.confirm('Delete this folder and its files?')) {
      const filesToDelete = files.filter((f) => f.folderId === folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setFiles((prev) => prev.filter((f) => f.folderId !== folderId));
      if (activeFolderId === folderId) {
        setActiveFolderId(null);
      }

      if (currentUser) {
        deleteFolderFromFirestore(folderId).catch(console.error);
        filesToDelete.forEach((f) => {
          deleteFileFromFirestore(f.id).catch(console.error);
        });
      }

      try {
        await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to sync folder deletion to server:', e);
      }
    }
  };

  // Add files: optimistic local update + Firestore & server persistence
  const handleAddFiles = async (newFiles: UploadedFile[]) => {
    if (!newFiles || newFiles.length === 0) return;

    isUploadingRef.current = true;
    lastUploadTimeRef.current = Date.now();
    setSyncStatus('syncing');

    // Optimistically prepend unique files so UI updates instantly
    setFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      const uniqueNew = newFiles.filter((f) => !existingIds.has(f.id));
      return [...uniqueNew, ...prev];
    });

    // Automatically focus into destination folder so user immediately sees their uploaded files
    if (newFiles.length > 0 && newFiles[0].folderId) {
      setActiveFolderId(newFiles[0].folderId);
    }

    // Persist to Firebase Firestore if logged in
    if (currentUser) {
      for (const f of newFiles) {
        if (f.folderId) {
          const matchingFolder = folders.find((fol) => fol.id === f.folderId);
          if (matchingFolder) {
            saveFolderToFirestore(matchingFolder, currentUser.uid).catch(console.error);
          }
        }
        saveFileToFirestore(f, currentUser.uid).catch(console.error);
      }
    }

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newFiles }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lastUpdated) {
          lastSyncTimestampRef.current = data.lastUpdated;
        }
        setSyncStatus('synced');
      } else {
        setSyncStatus('offline');
      }
    } catch (e) {
      console.error('Failed to upload files to server:', e);
      setSyncStatus('offline');
    } finally {
      setTimeout(() => {
        isUploadingRef.current = false;
      }, 500);
    }
  };

  // Delete file: optimistic local update + Firestore & server persistence
  const handleDeleteFile = async (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setQueue((prev) => prev.filter((q) => q.fileId !== fileId));

    if (currentUser) {
      deleteFileFromFirestore(fileId).catch(console.error);
    }

    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete file from server:', e);
    }
  };

  // Move file: optimistic local update + Firestore & server persistence
  const handleMoveFileToFolder = async (fileId: string, targetFolderId: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, folderId: targetFolderId } : f))
    );

    if (currentUser) {
      updateFileFolderInFirestore(fileId, targetFolderId).catch(console.error);
    }

    try {
      await fetch(`/api/files/${fileId}/folder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFolderId }),
      });
    } catch (e) {
      console.error('Failed to update file folder on server:', e);
    }
  };

  // Update settings and sync to Firestore and server
  const handleUpdateSettings = async (newSt: Partial<PlaybackSettings>) => {
    const updated = { ...playbackSettings, ...newSt };
    setPlaybackSettings(updated);

    if (currentUser) {
      savePlaybackSettingsToFirestore(updated, currentUser.uid).catch(console.error);
    }

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updated }),
      });
    } catch (e) {
      console.error('Failed to sync settings to server:', e);
    }
  };

  // Export entire library as JSON backup
  const handleExportLibrary = () => {
    const dataToExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      folders,
      files,
      playbackSettings,
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audiolearner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import entire library from JSON backup
  const handleImportLibrary = async (importedJson: string) => {
    try {
      const parsed = JSON.parse(importedJson);
      if (parsed && Array.isArray(parsed.folders) && Array.isArray(parsed.files)) {
        const mergeRes = await fetch('/api/sync/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientFolders: parsed.folders,
            clientFiles: parsed.files,
          }),
        });
        if (mergeRes.ok) {
          const mergeData = await mergeRes.json();
          if (mergeData.folders) setFolders(mergeData.folders);
          if (mergeData.files) setFiles(mergeData.files);
          lastSyncTimestampRef.current = mergeData.lastUpdated;
          setSyncStatus('synced');
        } else {
          setFolders((prev) => [...parsed.folders, ...prev]);
          setFiles((prev) => [...parsed.files, ...prev]);
        }
      }
    } catch (e) {
      console.error('Failed to parse imported backup:', e);
    }
  };

  // Active folder object if focused
  const currentActiveFolder = folders.find((f) => f.id === activeFolderId);

  // Filtered files based on active folder & search
  const visibleFiles = files.filter((f) => {
    const matchesFolder = activeFolderId ? f.folderId === activeFolderId : true;
    const matchesSearch =
      searchQuery.trim() === '' ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const activeTrack = currentQueueIndex >= 0 ? queue[currentQueueIndex] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-32 md:pb-24">
      {/* Clean Mobile & Desktop Header with Cloud Sync & Backups */}
      <AppHeader
        totalFilesCount={files.length}
        onPlayAll={handlePlayAllFiles}
        onOpenUpload={() => {
          setUploadFolderTargetId(activeFolderId || undefined);
          setIsUploadOpen(true);
        }}
        onOpenNewFolder={() => setIsNewFolderOpen(true)}
        onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
        playbackSettings={playbackSettings}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        syncStatus={syncStatus}
        onRefreshSync={() => fetchServerData(false)}
        onExportBackup={handleExportLibrary}
        onImportBackup={handleImportLibrary}
        user={currentUser}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 flex-1 w-full space-y-4 sm:space-y-6">
        {/* Firestore Cloud Persistence Banner */}
        {!currentUser && !isAuthLoading && (
          <div className="rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/60 border border-indigo-500/30 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-white">
                  Permanent Firebase Firestore Cloud Available
                </p>
                <p className="text-[11px] sm:text-xs text-slate-300">
                  Sign in with Google to permanently store your folders, converted PDF & Markdown files in Firestore, and sync seamlessly between PC and mobile.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>Connect Google Account</span>
            </button>
          </div>
        )}
        {/* Mobile Navigation Tabs (Folders, All Files, Queue) */}
        <div className="md:hidden flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMobileTab('folders');
              setActiveFolderId(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'folders' && !activeFolderId
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Folders ({folders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileTab('files');
              setActiveFolderId(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === 'files'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>All Files ({files.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsQueueOpen(true)}
            className="flex-1 py-2 rounded-xl text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ListMusic className="w-3.5 h-3.5 text-indigo-400" />
            <span>Queue ({queue.length})</span>
          </button>
        </div>

        {/* Focused Folder View (when user selects a folder on mobile or desktop) */}
        {activeFolderId && currentActiveFolder ? (
          <div className="space-y-4 animate-fade-in">
            {/* Back button & Folder Header */}
            <div className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <button
                type="button"
                onClick={() => setActiveFolderId(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 py-1 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to All Folders</span>
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: currentActiveFolder.color }}
                    />
                    <h2 className="text-lg sm:text-2xl font-bold text-white">
                      {currentActiveFolder.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    {currentActiveFolder.description}
                  </p>
                </div>

                {/* Big Touch-Friendly Folder Actions */}
                <div className="flex items-center gap-2 pt-1 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handlePlayFolder(currentActiveFolder.id)}
                    disabled={visibleFiles.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play Folder ({visibleFiles.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiQuizFolder(currentActiveFolder)}
                    disabled={visibleFiles.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>AI Study Quiz</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Folder Files */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-300">
                  Files ({visibleFiles.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUploadFolderTargetId(currentActiveFolder.id);
                    setIsUploadOpen(true);
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add File</span>
                </button>
              </div>

              {visibleFiles.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400">This folder is empty.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFolderTargetId(currentActiveFolder.id);
                      setIsUploadOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload First File</span>
                  </button>
                </div>
              ) : (
                visibleFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    folder={currentActiveFolder}
                    allFolders={folders}
                    isPlaying={isPlaying && activeTrack?.fileId === file.id}
                    isCurrentInQueue={activeTrack?.fileId === file.id}
                    onPlayFile={() => handlePlayFile(file)}
                    onAddToQueue={() => handleAddToQueue(file)}
                    onViewDoc={() => setViewingFile(file)}
                    onMoveToFolder={(target) => handleMoveFileToFolder(file.id, target)}
                    onDeleteFile={() => handleDeleteFile(file.id)}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          /* Normal Overview Mode */
          <>
            {/* Desktop Hero Banner (Hidden on small mobile screens to keep UI lean) */}
            <div className="hidden sm:block relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 shadow-xl">
              <div className="relative z-10 max-w-xl space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Smart Document Audio & AI Quiz</span>
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  Listen, learn, and test your comprehension on the go
                </h2>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlayAllFiles}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play All Files ({files.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* View: FOLDERS (Default on mobile when tab is folders, and desktop) */}
            {(mobileTab === 'folders' || window.innerWidth >= 768) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Folders ({folders.length})
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsNewFolderOpen(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Folder</span>
                  </button>
                </div>

                {folders.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">No folders created yet</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Organize your study files into custom folders or upload files directly
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsNewFolderOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create First Folder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFolderTargetId(undefined);
                          setIsUploadOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-all"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Upload Files</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {folders.map((folder) => {
                      const folderFiles = files.filter((f) => f.folderId === folder.id);

                      return (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          files={folderFiles}
                          isSelected={activeFolderId === folder.id}
                          onSelect={() => setActiveFolderId(folder.id)}
                          onPlayFolder={() => handlePlayFolder(folder.id)}
                          onOpenAiQuiz={() => setAiQuizFolder(folder)}
                          onUploadToFolder={() => {
                            setUploadFolderTargetId(folder.id);
                            setIsUploadOpen(true);
                          }}
                          onDeleteFolder={() => handleDeleteFolder(folder.id)}
                          onPlayFile={(f) => handlePlayFile(f)}
                          onViewFile={(f) => setViewingFile(f)}
                          onDeleteFile={(id) => handleDeleteFile(id)}
                          onAddDirectFiles={handleAddFiles}
                          activeTrackFileId={activeTrack?.fileId}
                          isPlaying={isPlaying}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* View: ALL FILES */}
            {(mobileTab === 'files' || window.innerWidth >= 768) && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      All Files ({visibleFiles.length})
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePlayAllFiles}
                      disabled={files.length === 0}
                      className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Play All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadFolderTargetId(activeFolderId || undefined);
                        setIsUploadOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {visibleFiles.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">No stored files found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchQuery
                            ? `No files match "${searchQuery}". Clear your search query.`
                            : 'Upload markdown, text notes, or documents to listen to natural TTS audio.'}
                        </p>
                      </div>
                      {!searchQuery && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setUploadFolderTargetId(undefined);
                              setIsUploadOpen(true);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Upload Document / Notes</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    visibleFiles.map((file) => {
                      const folder = folders.find((f) => f.id === file.folderId);
                      const isCurrentInQueue = activeTrack?.fileId === file.id;

                      return (
                        <FileRow
                          key={file.id}
                          file={file}
                          folder={folder}
                          allFolders={folders}
                          isPlaying={isPlaying && isCurrentInQueue}
                          isCurrentInQueue={isCurrentInQueue}
                          onPlayFile={() => handlePlayFile(file)}
                          onAddToQueue={() => handleAddToQueue(file)}
                          onViewDoc={() => setViewingFile(file)}
                          onMoveToFolder={(target) =>
                            handleMoveFileToFolder(file.id, target)
                          }
                          onDeleteFile={() => handleDeleteFile(file.id)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Bottom Audio Player Bar with Mobile Mini-Player */}
      <BottomPlayerBar
        currentTrack={activeTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        progress={progress}
        onPlayPause={handlePlayPause}
        onPrevious={handlePreviousTrack}
        onNext={handleNextTrack}
        onSeek={handleSeek}
        onSkipSeconds={handleSkipSeconds}
        onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
        queueCount={queue.length}
        isQueueOpen={isQueueOpen}
        onOpenVoiceSettings={() => setIsVoiceSettingsOpen(true)}
        playbackSettings={playbackSettings}
        currentSpokenSentence={currentSpokenSentence}
        onOpenDocViewer={() => {
          if (activeTrack) {
            const f = files.find((item) => item.id === activeTrack.fileId);
            if (f) setViewingFile(f);
          }
        }}
      />

      {/* Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={queue}
        currentIndex={currentQueueIndex}
        onSelectTrack={(idx) => playTrackAtIndex(idx)}
        onRemoveTrack={handleRemoveFromQueue}
        onMoveTrack={handleMoveQueueTrack}
        onClearQueue={handleClearQueue}
        onShuffleQueue={handleShuffleQueue}
        playbackSettings={playbackSettings}
        onUpdateSettings={handleUpdateSettings}
        isPlaying={isPlaying}
      />

      {/* Voice & Speed Settings Modal */}
      <VoiceSpeedModal
        isOpen={isVoiceSettingsOpen}
        onClose={() => setIsVoiceSettingsOpen(false)}
        settings={playbackSettings}
        onUpdateSettings={handleUpdateSettings}
        availableVoices={availableVoices}
      />

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setUploadFolderTargetId(undefined);
        }}
        folders={folders}
        initialFolderId={uploadFolderTargetId}
        onAddFiles={handleAddFiles}
      />

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      {/* AI Folder Comprehension Quiz Modal */}
      {aiQuizFolder && (
        <FolderAiQuizModal
          isOpen={Boolean(aiQuizFolder)}
          onClose={() => setAiQuizFolder(null)}
          folder={aiQuizFolder}
          folderFiles={files.filter((f) => f.folderId === aiQuizFolder.id)}
        />
      )}

      {/* Document Viewer Modal */}
      {viewingFile && (
        <DocumentViewerModal
          isOpen={Boolean(viewingFile)}
          onClose={() => setViewingFile(null)}
          file={viewingFile}
          folder={folders.find((f) => f.id === viewingFile.folderId)}
          onPlayFile={() => handlePlayFile(viewingFile)}
          isPlaying={isPlaying && activeTrack?.fileId === viewingFile.id}
        />
      )}
    </div>
  );
}
