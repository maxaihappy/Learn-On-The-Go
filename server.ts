import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { cleanMarkdownForSpeech } from './src/utils/cleanMarkdownForSpeech';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser (allow up to 50mb for audio/documents)
app.use(express.json({ limit: '50mb' }));

// Server-side Gemini initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// ==========================================
// CENTRAL SERVER DATA STORE (Sync across PC & Mobile)
// ==========================================
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const INITIAL_FOLDERS: any[] = [];
const INITIAL_FILES: any[] = [];

const SAMPLE_FOLDER_IDS = new Set(['folder-bio', 'folder-history', 'folder-tech']);
const SAMPLE_FILE_IDS = new Set([
  'file-bio-1',
  'file-bio-2',
  'file-hist-1',
  'file-hist-2',
  'file-tech-1',
  'file-tech-2',
]);

interface ServerStore {
  folders: any[];
  files: any[];
  playbackSettings: any;
  lastUpdated: number;
}

function loadStore(): ServerStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.folders) && Array.isArray(parsed.files)) {
        // Purge old sample folders and sample files if present
        const cleanedFolders = parsed.folders.filter((f: any) => !SAMPLE_FOLDER_IDS.has(f.id));
        const cleanedFiles = parsed.files.filter((f: any) => !SAMPLE_FILE_IDS.has(f.id));
        
        // Ensure any files with folderIds have their folder represented
        const folderIds = new Set(cleanedFolders.map((f: any) => f.id));
        cleanedFiles.forEach((file: any) => {
          if (file.folderId && !folderIds.has(file.folderId)) {
            cleanedFolders.push({
              id: file.folderId,
              name: 'My Uploads',
              color: '#6366F1',
              icon: 'Folder',
              description: 'Uploaded user files',
              createdAt: file.createdAt || Date.now(),
            });
            folderIds.add(file.folderId);
          }
        });

        parsed.folders = cleanedFolders;
        parsed.files = cleanedFiles;
        saveStore(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading store file, initializing default:', err);
  }

  const defaultStore: ServerStore = {
    folders: INITIAL_FOLDERS,
    files: INITIAL_FILES,
    playbackSettings: {
      speed: 1.0,
      voiceId: 'gemini-Kore',
      voiceEngine: 'gemini',
      voiceName: 'Kore (Studio Neural)',
      loopMode: 'off',
      autoPlayNext: true,
      volume: 1.0,
    },
    lastUpdated: Date.now(),
  };

  saveStore(defaultStore);
  return defaultStore;
}

function saveStore(store: ServerStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Purge any sample items before writing to disk
    store.folders = store.folders.filter((f: any) => !SAMPLE_FOLDER_IDS.has(f.id));
    store.files = store.files.filter((f: any) => !SAMPLE_FILE_IDS.has(f.id));
    store.lastUpdated = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store to disk:', err);
  }
}

// In-memory cache synced with disk
let serverStore = loadStore();

// ==========================================
// SYNC API ENDPOINTS (PC <-> Mobile Sharing)
// ==========================================

// Get all files & folders
app.get('/api/data', (req, res) => {
  serverStore.folders = serverStore.folders.filter((f: any) => !SAMPLE_FOLDER_IDS.has(f.id));
  serverStore.files = serverStore.files.filter((f: any) => !SAMPLE_FILE_IDS.has(f.id));
  res.json({
    folders: serverStore.folders,
    files: serverStore.files,
    playbackSettings: serverStore.playbackSettings,
    lastUpdated: serverStore.lastUpdated,
  });
});

// Bidirectional merge endpoint (automatically re-synchronizes browser localStorage files after server redeployments)
app.post('/api/sync/merge', (req, res) => {
  try {
    const { clientFolders = [], clientFiles = [] } = req.body;
    let changed = false;

    // Filter out any default sample folders/files that client might have cached
    const cleanClientFolders = (Array.isArray(clientFolders) ? clientFolders : []).filter(
      (f: any) => f && f.id && !SAMPLE_FOLDER_IDS.has(f.id)
    );
    const cleanClientFiles = (Array.isArray(clientFiles) ? clientFiles : []).filter(
      (f: any) => f && f.id && !SAMPLE_FILE_IDS.has(f.id)
    );

    if (cleanClientFolders.length > 0) {
      const folderMap = new Map();
      serverStore.folders.forEach((f) => {
        if (!SAMPLE_FOLDER_IDS.has(f.id)) folderMap.set(f.id, f);
      });
      cleanClientFolders.forEach((f: any) => {
        if (f && f.id && !folderMap.has(f.id)) {
          folderMap.set(f.id, f);
          changed = true;
        }
      });
      serverStore.folders = Array.from(folderMap.values());
    }

    if (cleanClientFiles.length > 0) {
      const fileMap = new Map();
      serverStore.files.forEach((f) => {
        if (!SAMPLE_FILE_IDS.has(f.id)) fileMap.set(f.id, f);
      });
      cleanClientFiles.forEach((f: any) => {
        if (f && f.id && !fileMap.has(f.id)) {
          fileMap.set(f.id, f);
          changed = true;
        }
      });
      serverStore.files = Array.from(fileMap.values());
    }

    // Always ensure samples are stripped
    serverStore.folders = serverStore.folders.filter((f: any) => !SAMPLE_FOLDER_IDS.has(f.id));
    serverStore.files = serverStore.files.filter((f: any) => !SAMPLE_FILE_IDS.has(f.id));

    if (changed) {
      saveStore(serverStore);
    }

    res.json({
      success: true,
      folders: serverStore.folders,
      files: serverStore.files,
      lastUpdated: serverStore.lastUpdated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to merge client sync store' });
  }
});

// Upload new files
app.post('/api/files', (req, res) => {
  const { newFiles } = req.body;
  if (!newFiles || !Array.isArray(newFiles)) {
    return res.status(400).json({ error: 'newFiles array is required' });
  }

  serverStore.files = [...newFiles, ...serverStore.files];
  saveStore(serverStore);

  res.json({
    success: true,
    count: newFiles.length,
    totalFiles: serverStore.files.length,
    lastUpdated: serverStore.lastUpdated,
  });
});

// Delete a file
app.delete('/api/files/:id', (req, res) => {
  const { id } = req.params;
  serverStore.files = serverStore.files.filter((f) => f.id !== id);
  saveStore(serverStore);
  res.json({ success: true, lastUpdated: serverStore.lastUpdated });
});

// Move a file to another folder
app.put('/api/files/:id/folder', (req, res) => {
  const { id } = req.params;
  const { targetFolderId } = req.body;
  serverStore.files = serverStore.files.map((f) =>
    f.id === id ? { ...f, folderId: targetFolderId } : f
  );
  saveStore(serverStore);
  res.json({ success: true, lastUpdated: serverStore.lastUpdated });
});

// Create folder
app.post('/api/folders', (req, res) => {
  const { folder } = req.body;
  if (!folder || !folder.name) {
    return res.status(400).json({ error: 'folder with name is required' });
  }

  serverStore.folders.push(folder);
  saveStore(serverStore);
  res.json({ success: true, folder, lastUpdated: serverStore.lastUpdated });
});

// Delete folder and its files
app.delete('/api/folders/:id', (req, res) => {
  const { id } = req.params;
  serverStore.folders = serverStore.folders.filter((f) => f.id !== id);
  serverStore.files = serverStore.files.filter((f) => f.folderId !== id);
  saveStore(serverStore);
  res.json({ success: true, lastUpdated: serverStore.lastUpdated });
});

// Update global playback settings
app.put('/api/settings', (req, res) => {
  const { settings } = req.body;
  if (settings) {
    serverStore.playbackSettings = { ...serverStore.playbackSettings, ...settings };
    saveStore(serverStore);
  }
  res.json({ success: true, settings: serverStore.playbackSettings });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    fileCount: serverStore.files.length,
    folderCount: serverStore.folders.length,
  });
});

// Text-To-Speech endpoint via Gemini 3.8 Flash Lite TTS
app.post('/api/ai/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Kore' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text string is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        fallback: true,
        message: 'No GEMINI_API_KEY configured on server; fallback to browser speech synthesis.',
      });
    }

    // Clean markdown formatting symbols (#, |, *, _, links, tables)
    const cleanText = cleanMarkdownForSpeech(text).slice(0, 2000);

    if (!cleanText || cleanText.trim().length === 0) {
      return res.status(200).json({
        fallback: true,
        message: 'Text is empty after stripping markdown syntax; fallback to browser speech.',
      });
    }

    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Read the following text aloud verbatim. Do not add any introductory or transitional words, commentary, or conversational filler:\n\n${cleanText}`,
              speechMetadata: {
                style: 'Natural, articulate, engaging educational narrator',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(200).json({
        fallback: true,
        message: 'No audio returned from Gemini TTS; fallback to browser speech synthesis.',
      });
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voice: chosenVoice,
    });
  } catch (err: any) {
    console.error('Error generating speech with Gemini:', err?.message || err);
    return res.status(200).json({
      fallback: true,
      error: err?.message || 'Gemini TTS request failed',
    });
  }
});

// AI Question Generator for Folder Content
app.post('/api/ai/folder-questions', async (req, res) => {
  try {
    const { folderTitle, files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      const sampleFile = files[0];
      return res.json({
        folderSummary: `Overview of ${folderTitle} covering key principles from ${files.map(f => f.name).join(', ')}.`,
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: `Based on "${sampleFile.name}", what is the primary takeaway or fundamental mechanism described?`,
            options: [
              'It provides structured methodology for deep comprehension and application',
              'It replaces systematic study with passive listening only',
              'It focuses exclusively on unrelated historical dates without context',
              'None of the above',
            ],
            correctOptionIndex: 0,
            explanation: 'The materials focus on core foundational comprehension and retention.',
            relatedFile: sampleFile.name,
          },
          {
            id: 'q2',
            type: 'open-ended',
            question: `In your own words, summarize how the core themes in "${folderTitle}" connect to practical real-world problems.`,
            options: [],
            correctOptionIndex: -1,
            explanation: 'A strong answer connects key concepts from the uploaded text to real applications.',
            relatedFile: sampleFile.name,
          },
        ],
      });
    }

    const fileSnippets = files
      .map((f: { name: string; content?: string }, idx: number) => {
        const text = (f.content || '').slice(0, 4000);
        return `--- File ${idx + 1}: ${f.name} ---\n${text}\n`;
      })
      .join('\n');

    const prompt = `You are an expert tutor creating an interactive study & comprehension session for the folder "${folderTitle}".
Analyze the following uploaded files carefully and produce a comprehensive set of 3 to 5 engaging learning questions to test and deepen the student's understanding.

Uploaded Materials:
${fileSnippets}

Instructions:
1. Provide a concise 2-sentence study summary of what this folder is about.
2. Formulate 3 to 5 high-quality questions:
   - Include 2 or 3 'multiple-choice' questions (each with exactly 4 options, a 0-indexed correctOptionIndex, and a clear explanation).
   - Include 1 or 2 'open-ended' conceptual questions that prompt the student to explain or synthesize concepts in their own words. For open-ended questions, provide an empty options array and correctOptionIndex -1, but give a thorough guideline explanation of what a great answer covers.
3. Identify which file each question is most directly based upon.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            folderSummary: {
              type: Type.STRING,
              description: 'A brief 1-2 sentence overview of the folder subject matter.',
            },
            questions: {
              type: Type.ARRAY,
              description: 'List of interactive quiz questions based on the folder files.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    description: "'multiple-choice' or 'open-ended'",
                  },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Four choices for multiple choice, or empty for open-ended',
                  },
                  correctOptionIndex: {
                    type: Type.INTEGER,
                    description: '0-3 for multiple choice, or -1 for open-ended',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Educational rationale and explanation',
                  },
                  relatedFile: {
                    type: Type.STRING,
                    description: 'Name of the source file',
                  },
                },
                required: ['id', 'type', 'question', 'explanation'],
              },
            },
          },
          required: ['folderSummary', 'questions'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error generating folder questions:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to generate study questions.',
      details: err?.message,
    });
  }
});

// Convert uploaded PDF into clean structured Markdown for audio text-to-speech reading & Firestore
app.post('/api/convert-pdf', async (req, res) => {
  try {
    const { pdfBase64, filename } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: 'pdfBase64 is required.' });
    }

    // Clean base64 header if included (e.g. data:application/pdf;base64,...)
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: cleanBase64,
                  },
                },
                {
                  text: `You are an expert document-to-audio converter. Convert this entire document into clean, natural Markdown text optimized for text-to-speech listening:
1. Preserve all substantive text, headings, bullet lists, and section structure.
2. Omit distracting repetitive header/footer page numbers and copyright boilerplate that break listening flow.
3. Transcribe tables into bullet points or conversational narrative so it is easy to listen to.
4. Output purely the converted Markdown text with no conversational preamble or meta-commentary.`,
                },
              ],
            },
          ],
        });

        const markdown = response.text?.trim();
        if (markdown && markdown.length > 20) {
          return res.json({
            success: true,
            markdown,
            method: 'gemini-multimodal',
            wordCount: markdown.split(/\s+/).length,
          });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini PDF conversion fallback:', geminiErr?.message || geminiErr);
      }
    }

    // Fallback: decode raw stream text from PDF buffer
    const buffer = Buffer.from(cleanBase64, 'base64');
    const rawPdf = buffer.toString('binary');
    const textPieces: string[] = [];

    // Extract text in PDF parentheses: (Text) Tj or [(T) (ext)] TJ
    const textMatch = rawPdf.match(/\(([^)]+)\)\s*Tj/g);
    if (textMatch && textMatch.length > 0) {
      for (const m of textMatch) {
        const cleaned = m
          .replace(/^\(/, '')
          .replace(/\)\s*Tj$/, '')
          .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          .replace(/\\([()\\])/g, '$1')
          .trim();
        if (cleaned.length > 0) {
          textPieces.push(cleaned);
        }
      }
    }

    let extractedText = textPieces.join(' ').replace(/\s+/g, ' ').trim();
    if (!extractedText || extractedText.length < 30) {
      extractedText = `# ${filename || 'Converted PDF Document'}\n\n*Note: This PDF was imported into AudioLearner.*`;
    } else {
      extractedText = `# ${filename || 'Document'}\n\n${extractedText}`;
    }

    return res.json({
      success: true,
      markdown: extractedText,
      method: 'buffer-extract',
      wordCount: extractedText.split(/\s+/).length,
    });
  } catch (err: any) {
    console.error('Error converting PDF:', err);
    return res.status(500).json({
      error: 'Failed to convert PDF file.',
      details: err?.message,
    });
  }
});


// Evaluate user's open-ended answer
app.post('/api/ai/evaluate-answer', async (req, res) => {
  try {
    const { question, userAnswer, explanation, folderTitle } = req.body;

    if (!userAnswer || !question) {
      return res.status(400).json({ error: 'Question and userAnswer are required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        score: 85,
        verdict: 'Good understanding!',
        feedback:
          'Your answer captures the core concept nicely. Review the source file for further details.',
        keyPointsCovered: ['Key concept identified', 'Relevant practical reasoning'],
        keyPointsMissed: ['Specific terminology mentioned in the file'],
      });
    }

    const prompt = `You are a supportive, encouraging academic tutor. A student is studying the folder "${folderTitle}".
Question asked: "${question}"
Guideline answer/rubric: "${explanation}"
Student's response: "${userAnswer}"

Evaluate the student's answer fairly and constructively.
Rate their understanding on a scale of 0 to 100, give a short 1-line verdict, specific encouraging feedback, bullet points of key points they covered, and any nuances they missed.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.INTEGER,
              description: 'Score from 0 to 100 representing comprehension quality',
            },
            verdict: {
              type: Type.STRING,
              description: "Short punchy status like 'Spot on!', 'Strong effort!', or 'Needs review'",
            },
            feedback: {
              type: Type.STRING,
              description: 'Constructive 2-3 sentence personalized feedback',
            },
            keyPointsCovered: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            keyPointsMissed: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['score', 'verdict', 'feedback', 'keyPointsCovered'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error evaluating answer:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to evaluate answer',
      details: err?.message,
    });
  }
});

// Setup Vite or static serving
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AudioLearner server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
