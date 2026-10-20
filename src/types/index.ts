export type FileType = 'text' | 'markdown' | 'pdf' | 'audio' | 'notes';

export interface UploadedFile {
  id: string;
  name: string;
  folderId: string;
  type: FileType;
  size: number; // in bytes
  content: string; // text content for reading and AI context
  audioUrl?: string; // audio source URL if native audio or cached speech
  duration: number; // in seconds (estimated or audio duration)
  estimatedDuration?: number;
  tags?: string[];
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  createdAt: number;
}

export interface QueueItem {
  id: string; // queue item unique id
  fileId: string;
  fileName: string;
  folderId: string;
  folderName: string;
  type: FileType;
  content: string;
  audioUrl?: string;
  duration: number;
}

export type VoiceEngine = 'gemini' | 'browser';

export interface VoiceOption {
  id: string;
  name: string;
  engine: VoiceEngine;
  description: string;
  lang?: string;
  gender?: string;
  accent?: string;
}

export interface PlaybackSettings {
  speed: number; // 0.5 to 2.5
  voiceId: string;
  voiceEngine: VoiceEngine;
  voiceName: string;
  loopMode: 'off' | 'all' | 'one';
  autoPlayNext: boolean;
  volume: number; // 0 to 1
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'open-ended';
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  relatedFile?: string;
}

export interface FolderQuiz {
  folderId: string;
  folderTitle: string;
  folderSummary: string;
  questions: QuizQuestion[];
}

export interface AnswerEvaluation {
  score: number;
  verdict: string;
  feedback: string;
  keyPointsCovered: string[];
  keyPointsMissed?: string[];
}
