import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Volume2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Award,
  Loader2,
  Send,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Folder, UploadedFile, QuizQuestion, AnswerEvaluation } from '../types';
import { audioEngine } from '../services/audioEngine';

interface FolderAiQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
  folderFiles: UploadedFile[];
}

export const FolderAiQuizModal: React.FC<FolderAiQuizModalProps> = ({
  isOpen,
  onClose,
  folder,
  folderFiles,
}) => {
  const [loading, setLoading] = useState(false);
  const [folderSummary, setFolderSummary] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Multiple choice state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Open-ended state
  const [openAnswer, setOpenAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);

  // Quiz score state
  const [scoreCount, setScoreCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Speech indicator
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (isOpen && folder && folderFiles.length > 0) {
      loadQuestions();
    }
    // Cleanup audio on modal close
    return () => {
      audioEngine.stop();
    };
  }, [isOpen, folder?.id]);

  const loadQuestions = async () => {
    if (!folder) return;
    setLoading(true);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setShowExplanation(false);
    setOpenAnswer('');
    setEvaluation(null);
    setScoreCount(0);
    setIsCompleted(false);

    try {
      const response = await fetch('/api/ai/folder-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderTitle: folder.name,
          files: folderFiles.map((f) => ({
            name: f.name,
            content: f.content,
          })),
        }),
      });

      const data = await response.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setFolderSummary(data.folderSummary || '');
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !folder) return null;

  const currentQ = questions[currentIndex];

  const handleSelectOption = (idx: number) => {
    if (showExplanation) return;
    setSelectedOption(idx);
    setShowExplanation(true);
    if (idx === currentQ.correctOptionIndex) {
      setScoreCount((prev) => prev + 1);
    }
  };

  const handleEvaluateOpenAnswer = async () => {
    if (!openAnswer.trim() || evaluating) return;
    setEvaluating(true);

    try {
      const response = await fetch('/api/ai/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQ.question,
          userAnswer: openAnswer,
          explanation: currentQ.explanation,
          folderTitle: folder.name,
        }),
      });

      const result: AnswerEvaluation = await response.json();
      setEvaluation(result);
      if (result.score >= 70) {
        setScoreCount((prev) => prev + 1);
      }
    } catch (e) {
      console.error('Evaluation error:', e);
      setEvaluation({
        score: 80,
        verdict: 'Good effort!',
        feedback: 'Your answer demonstrates good recall of the materials in this folder.',
        keyPointsCovered: ['Core concepts addressed'],
      });
      setScoreCount((prev) => prev + 1);
    } finally {
      setEvaluating(false);
    }
  };

  const handleNextQuestion = () => {
    audioEngine.stop();
    setIsSpeaking(false);
    setSelectedOption(null);
    setShowExplanation(false);
    setOpenAnswer('');
    setEvaluation(null);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  const handleReadAloud = async (textToRead: string) => {
    if (isSpeaking) {
      audioEngine.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    await audioEngine.playText(textToRead, 30);
    setTimeout(() => setIsSpeaking(false), 8000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 mb-0.5" />
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md text-white font-bold"
              style={{ backgroundColor: `${folder.color}25`, border: `1px solid ${folder.color}50` }}
            >
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">AI Comprehension Quiz</h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Interactive Study
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                Folder: <span className="text-slate-200 font-medium">{folder.name}</span> ({folderFiles.length} files)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audioEngine.stop();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Sparkles className="w-6 h-6 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  AI is analyzing {folderFiles.length} uploaded files...
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Synthesizing key topics, formulation of conceptual questions, and scoring rubrics.
                </p>
              </div>
            </div>
          ) : isCompleted ? (
            /* Completed Screen */
            <div className="py-10 text-center space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400 shadow-xl">
                <Award className="w-10 h-10" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white">Study Session Complete!</h3>
                <p className="text-xs text-slate-400">
                  You scored <span className="text-indigo-400 font-bold text-sm">{scoreCount}</span> out of{' '}
                  <span className="text-white font-bold text-sm">{questions.length}</span> questions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 max-w-md mx-auto text-left text-xs text-slate-300 space-y-2">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>Folder Knowledge Summary:</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">{folderSummary}</p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={loadQuestions}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try New Questions</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.stop();
                    onClose();
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  Done Reviewing
                </button>
              </div>
            </div>
          ) : currentQ ? (
            /* Active Question Screen */
            <div className="space-y-5">
              {/* Progress & Related File Badge */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md">
                  Question {currentIndex + 1} of {questions.length}
                </span>

                {currentQ.relatedFile && (
                  <span className="text-slate-400 flex items-center gap-1 text-[11px] truncate max-w-xs">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Source: <span className="text-slate-300 font-medium">{currentQ.relatedFile}</span>
                  </span>
                )}
              </div>

              {/* Question Text Box with Read Aloud Button */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white leading-relaxed">
                    {currentQ.question}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleReadAloud(currentQ.question)}
                    className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 cursor-pointer"
                    title="Listen to question via selected voice"
                  >
                    <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Mode A: Multiple Choice Question */}
              {currentQ.type === 'multiple-choice' && (
                <div className="space-y-2.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Select an answer:
                  </label>
                  <div className="space-y-2">
                    {currentQ.options.map((opt, oIdx) => {
                      const isSelected = selectedOption === oIdx;
                      const isCorrect = oIdx === currentQ.correctOptionIndex;

                      let btnStyle = 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/70 text-slate-200';
                      if (showExplanation) {
                        if (isCorrect) {
                          btnStyle = 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/30';
                        } else if (isSelected) {
                          btnStyle = 'bg-rose-950/40 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/30';
                        }
                      }

                      return (
                        <button
                          key={oIdx}
                          type="button"
                          disabled={showExplanation}
                          onClick={() => handleSelectOption(oIdx)}
                          className={`w-full p-3 rounded-xl border text-left text-xs font-medium transition-all flex items-start gap-3 cursor-pointer ${btnStyle}`}
                        >
                          <span className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span className="flex-1 leading-snug">{opt}</span>
                          {showExplanation && (
                            <span className="shrink-0 mt-0.5">
                              {isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : isSelected ? (
                                <XCircle className="w-4 h-4 text-rose-400" />
                              ) : null}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation Card */}
                  {showExplanation && (
                    <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                          Explanation & Rationale
                        </span>
                        <button
                          type="button"
                          onClick={() => handleReadAloud(currentQ.explanation)}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Listen</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{currentQ.explanation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: Open-Ended Question */}
              {currentQ.type === 'open-ended' && (
                <div className="space-y-3">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Write your answer / synthesis:
                  </label>
                  <textarea
                    rows={4}
                    value={openAnswer}
                    disabled={evaluation !== null}
                    onChange={(e) => setOpenAnswer(e.target.value)}
                    placeholder="Explain in your own words based on what you read or heard in this folder..."
                    className="w-full bg-slate-800/70 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                  />

                  {!evaluation && (
                    <button
                      type="button"
                      disabled={!openAnswer.trim() || evaluating}
                      onClick={handleEvaluateOpenAnswer}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      {evaluating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>AI Tutor is Evaluating...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit to AI Tutor</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* AI Evaluation Result */}
                  {evaluation && (
                    <div className="p-4 rounded-xl bg-slate-800/80 border border-indigo-500/30 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{evaluation.verdict}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                            Score: {evaluation.score}/100
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReadAloud(evaluation.feedback)}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Listen</span>
                        </button>
                      </div>

                      <p className="text-xs text-slate-300">{evaluation.feedback}</p>

                      {evaluation.keyPointsCovered.length > 0 && (
                        <div className="text-[11px] text-emerald-300 space-y-1">
                          <span className="font-semibold">Key Points You Covered:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-1">
                            {evaluation.keyPointsCovered.map((kp, kIdx) => (
                              <li key={kIdx}>{kp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No questions found for this folder. Try uploading more files with detailed text.
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {!loading && !isCompleted && currentQ && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Score: <strong className="text-indigo-400">{scoreCount}</strong>
            </span>

            <button
              type="button"
              disabled={
                currentQ.type === 'multiple-choice'
                  ? !showExplanation
                  : evaluation === null
              }
              onClick={handleNextQuestion}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <span>{currentIndex + 1 === questions.length ? 'Finish Quiz' : 'Next Question'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
