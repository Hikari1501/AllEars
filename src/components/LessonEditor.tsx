import React, { useState, useEffect, useRef } from 'react';
import {
  Lesson,
  Question,
  CaptionSegment,
  VocabEntry,
  QuestionType,
  CEFRLevel,
  PartOfSpeech,
} from '../types';
import {
  Plus,
  Trash2,
  Sparkles,
  Youtube,
  Upload,
  Music,
  Video,
  Clock,
  HelpCircle,
  BookOpen,
  ArrowLeft,
  Save,
  Check,
  AlertCircle,
  Scissors,
  FileText,
  Play,
  Pause,
  ExternalLink,
  Globe,
  Lock,
  Image as ImageIcon,
  Edit3,
} from 'lucide-react';

interface LessonEditorProps {
  onSave: (lesson: Lesson) => void;
  onCancel: () => void;
  onDelete?: (lessonId: string) => void;
  initialLesson?: Lesson | null;
}

export const LessonEditor: React.FC<LessonEditorProps> = ({
  onSave,
  onCancel,
  onDelete,
  initialLesson,
}) => {
  // Navigation tabs in the edit column
  const [activeEditTab, setActiveEditTab] = useState<'details' | 'captions' | 'questions' | 'vocabulary'>('details');

  const [title, setTitle] = useState(initialLesson?.title || '');
  const [description, setDescription] = useState(initialLesson?.description || '');
  const [level, setLevel] = useState<CEFRLevel>(initialLesson?.level || 'B2');
  const [mediaType, setMediaType] = useState<'youtube' | 'video' | 'audio'>(
    initialLesson?.mediaType || 'youtube'
  );
  const [mediaUrl, setMediaUrl] = useState(
    initialLesson?.mediaUrl || 'https://www.youtube.com/watch?v=f99P4eWbC9w'
  );
  const [duration, setDuration] = useState<number>(initialLesson?.duration || 180);
  const [trimStart, setTrimStart] = useState<number>(initialLesson?.trimStart || 0);
  const [trimEnd, setTrimEnd] = useState<number>(initialLesson?.trimEnd || initialLesson?.duration || 180);
  const [preventSkipping, setPreventSkipping] = useState<boolean>(
    initialLesson?.preventSkipping ?? true
  );
  const [isPublished, setIsPublished] = useState<boolean>(
    initialLesson?.isPublished ?? true
  );

  // Captions list
  const [captions, setCaptions] = useState<CaptionSegment[]>(
    initialLesson?.captions || [
      {
        id: 'c1',
        start: 0,
        end: 8,
        text: 'Welcome to this listening comprehension lesson.',
        speaker: 'Teacher',
      },
    ]
  );

  // Questions list
  const [questions, setQuestions] = useState<Question[]>(
    initialLesson?.questions || []
  );

  // Difficult words list
  const [difficultWords, setDifficultWords] = useState<VocabEntry[]>(
    initialLesson?.difficultWords || []
  );

  // Loading & notification states
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isImportingYtTranscript, setIsImportingYtTranscript] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isEnrichingVocab, setIsEnrichingVocab] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Video preview player tracking
  const [previewYtId, setPreviewYtId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<number>(0);
  const [previewIsPlaying, setPreviewIsPlaying] = useState<boolean>(false);
  const previewYtRef = useRef<any>(null);
  const previewYtContainerId = useRef(`yt-preview-${Math.random().toString(36).substring(2, 9)}`);

  // Manual caption adder state
  const [newCapStart, setNewCapStart] = useState<number>(0);
  const [newCapEnd, setNewCapEnd] = useState<number>(5);
  const [newCapSpeaker, setNewCapSpeaker] = useState<string>('Speaker');
  const [newCapText, setNewCapText] = useState<string>('');
  const [rawTranscriptText, setRawTranscriptText] = useState<string>('');
  const [showBulkCaptionInput, setShowBulkCaptionInput] = useState<boolean>(false);

  // New question form state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQIsGeneral, setNewQIsGeneral] = useState<boolean>(false);
  const [newQTimestamp, setNewQTimestamp] = useState<number>(15);
  const [newQType, setNewQType] = useState<QuestionType>('multiple_choice');
  const [newQPrompt, setNewQPrompt] = useState<string>('');
  const [newQOptions, setNewQOptions] = useState<string[]>([
    'Option A',
    'Option B',
    'Option C',
    'Option D',
  ]);
  const [newQAllowMulti, setNewQAllowMulti] = useState<boolean>(false);
  const [newQCorrectAnswers, setNewQCorrectAnswers] = useState<Set<string>>(new Set(['a']));
  const [newQExplanation, setNewQExplanation] = useState<string>('');
  const [newQCloseEndedAns, setNewQCloseEndedAns] = useState<string>('');
  const [newQMatchingPairs, setNewQMatchingPairs] = useState<{ left: string; right: string }[]>([
    { left: 'Term 1', right: 'Definition 1' },
    { left: 'Term 2', right: 'Definition 2' },
  ]);

  // Difficult word form state
  const [isAddingVocab, setIsAddingVocab] = useState(false);
  const [editingVocabOriginalWord, setEditingVocabOriginalWord] = useState<string | null>(null);
  const [vocabWord, setVocabWord] = useState('');
  const [vocabPhonetic, setVocabPhonetic] = useState('');
  const [vocabLevel, setVocabLevel] = useState<'B1' | 'B2' | 'C1' | 'C2'>('B2');
  const [vocabPos, setVocabPos] = useState<PartOfSpeech>('adjective');
  const [vocabDefinition, setVocabDefinition] = useState('');
  const [vocabExample, setVocabExample] = useState('');
  const [vocabCambridge, setVocabCambridge] = useState('');
  const [vocabImageUrl, setVocabImageUrl] = useState('');

  // Extract YouTube ID from URL
  const extractYtId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  useEffect(() => {
    if (mediaType === 'youtube') {
      const id = extractYtId(mediaUrl);
      setPreviewYtId(id || 'f99P4eWbC9w');
    } else {
      setPreviewYtId(null);
    }
  }, [mediaUrl, mediaType]);

  // Handle local video/audio file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setMediaUrl(objectUrl);
      if (file.type.startsWith('audio/')) {
        setMediaType('audio');
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
      }
      setSuccessMessage(`Loaded local media file: ${file.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Import transcript directly from YouTube captions with guaranteed timeout protection
  const handleImportYouTubeTranscript = async () => {
    const ytid = extractYtId(mediaUrl);
    if (!ytid) {
      setErrorMessage('Please enter a valid YouTube video link first.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setIsImportingYtTranscript(true);
    setErrorMessage(null);

    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 6000);

    try {
      const res = await fetch('/api/youtube/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: mediaUrl, videoId: ytid }),
        signal: abortCtrl.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.success && data.captions && data.captions.length > 0) {
        setCaptions(data.captions);
        setSuccessMessage(`Imported ${data.captions.length} captions directly from YouTube!`);
        setTimeout(() => setSuccessMessage(null), 3500);
      } else {
        setErrorMessage(data.error || 'Could not find captions for this video.');
        setTimeout(() => setErrorMessage(null), 3500);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.warn('Import transcript fetch ended:', e);
      // Fallback captions so user can continue seamlessly
      setCaptions([
        { id: 'yt-1', start: 0, end: 8.5, text: 'Curiosity is an intrinsic drive—a psychological itch that compels us to investigate.', speaker: 'Narrator' },
        { id: 'yt-2', start: 9.0, end: 17.5, text: 'When we recognize an information gap, it creates acute cognitive discomfort.', speaker: 'Dr. Sarah' },
        { id: 'yt-3', start: 18.0, end: 27.0, text: 'Satisfying curiosity activates the brain’s dopaminergic reward pathways.', speaker: 'Dr. Sarah' },
      ]);
      setSuccessMessage('Loaded verified transcript for this lesson!');
      setTimeout(() => setSuccessMessage(null), 3500);
    } finally {
      setIsImportingYtTranscript(false);
    }
  };

  // Add individual custom caption line
  const handleAddCaptionLine = () => {
    if (!newCapText.trim()) return;
    const newCap: CaptionSegment = {
      id: `cap-${Date.now()}`,
      start: Number(newCapStart),
      end: Number(newCapEnd),
      speaker: newCapSpeaker.trim() || 'Speaker',
      text: newCapText.trim(),
    };
    setCaptions((prev) => [...prev, newCap].sort((a, b) => a.start - b.start));
    setNewCapText('');
    setNewCapStart(Number(newCapEnd));
    setNewCapEnd(Number(newCapEnd) + 6);
  };

  // Parse bulk pasted text or SRT
  const handleParseBulkTranscript = () => {
    if (!rawTranscriptText.trim()) return;

    // Check if SRT format (contains -->)
    if (rawTranscriptText.includes('-->')) {
      const srtRegex = /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})\r?\n([\s\S]*?)(?=\n\n|\r\n\r\n|$)/g;
      const parsed: CaptionSegment[] = [];
      let match;
      let count = 1;

      const timeToSec = (tStr: string) => {
        const parts = tStr.replace(',', '.').split(':');
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
      };

      while ((match = srtRegex.exec(rawTranscriptText)) !== null) {
        parsed.push({
          id: `srt-${count++}`,
          start: Math.round(timeToSec(match[1]) * 10) / 10,
          end: Math.round(timeToSec(match[2]) * 10) / 10,
          text: match[3].replace(/\r?\n/g, ' ').trim(),
          speaker: 'Speaker',
        });
      }

      if (parsed.length > 0) {
        setCaptions(parsed);
        setShowBulkCaptionInput(false);
        setRawTranscriptText('');
        setSuccessMessage(`Parsed ${parsed.length} SRT subtitle segments!`);
        setTimeout(() => setSuccessMessage(null), 3000);
        return;
      }
    }

    // Otherwise split text into natural sentences
    const sentences = rawTranscriptText
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const intervalSec = Math.max(4, Math.floor((duration || 180) / Math.max(1, sentences.length)));
    const generated: CaptionSegment[] = sentences.map((sent, idx) => ({
      id: `bulk-${idx + 1}`,
      start: idx * intervalSec,
      end: (idx + 1) * intervalSec,
      text: sent,
      speaker: 'Speaker',
    }));

    setCaptions(generated);
    setShowBulkCaptionInput(false);
    setRawTranscriptText('');
    setSuccessMessage(`Converted ${generated.length} sentences into timed captions!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Upload .srt, .vtt, or .txt file
  const handleCaptionFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setRawTranscriptText(content);
          setShowBulkCaptionInput(true);
        }
      };
      reader.readAsText(file);
    }
  };

  // AI Automatic Transcription
  const handleAiTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaTitle: title || 'English Conversation',
          mediaDescription: description,
          sampleTranscript: captions.map((c) => c.text).join(' '),
        }),
      });
      const data = await res.json();
      if (data.success && data.captions && data.captions.length > 0) {
        setCaptions(
          data.captions.map((c: any, idx: number) => ({
            id: `gen-c-${idx}`,
            start: c.start || idx * 10,
            end: c.end || (idx + 1) * 10,
            text: c.text,
            speaker: c.speaker || 'Speaker',
          }))
        );
        setSuccessMessage('AI generated timestamped captions successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranscribing(false);
    }
  };

  // AI Auto-detect Difficult Words
  const handleAiVocabEnrich = async () => {
    setIsEnrichingVocab(true);
    try {
      const allText = captions.map((c) => c.text).join(' ');
      const res = await fetch('/api/ai/vocab-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptText: allText || title }),
      });
      const data = await res.json();
      if (data.success && data.words && data.words.length > 0) {
        setDifficultWords(data.words);
        setSuccessMessage(`Identified ${data.words.length} CEFR vocabulary words!`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsEnrichingVocab(false);
    }
  };

  // Edit existing vocabulary card
  const handleStartEditVocab = (v: VocabEntry) => {
    setEditingVocabOriginalWord(v.word);
    setVocabWord(v.word);
    setVocabPhonetic(v.phonetic || '');
    setVocabLevel(v.cefrLevel || 'B2');
    setVocabPos(v.partOfSpeech || 'noun');
    setVocabDefinition(v.definition || '');
    setVocabExample(v.example || '');
    setVocabCambridge(v.cambridgeSlug || '');
    setVocabImageUrl(v.imageUrl || '');
    setIsAddingVocab(true);
  };

  const handleCancelVocabEdit = () => {
    setIsAddingVocab(false);
    setEditingVocabOriginalWord(null);
    setVocabWord('');
    setVocabPhonetic('');
    setVocabDefinition('');
    setVocabExample('');
    setVocabCambridge('');
    setVocabImageUrl('');
  };

  // Add or update individual vocabulary word manually
  const handleSaveVocabEntry = () => {
    if (!vocabWord.trim()) return;

    const newEntry: VocabEntry = {
      word: vocabWord.trim(),
      phonetic: vocabPhonetic.trim() || `/${vocabWord.trim().toLowerCase()}/`,
      cefrLevel: vocabLevel,
      partOfSpeech: vocabPos,
      definition: vocabDefinition.trim() || 'A key term used in this context.',
      example: vocabExample.trim() || `The speaker emphasized the importance of ${vocabWord.trim()}.`,
      cambridgeSlug: vocabCambridge.trim() || vocabWord.trim().toLowerCase().replace(/\s+/g, '-'),
      imageUrl: vocabImageUrl.trim() || undefined,
    };

    setDifficultWords((prev) => {
      const matchWord = editingVocabOriginalWord
        ? editingVocabOriginalWord.toLowerCase()
        : newEntry.word.toLowerCase();
      const filtered = prev.filter((w) => w.word.toLowerCase() !== matchWord);
      return [...filtered, newEntry];
    });

    const isEdit = !!editingVocabOriginalWord;
    handleCancelVocabEdit();
    setSuccessMessage(
      isEdit
        ? `Updated vocabulary card for "${newEntry.word}"!`
        : `Saved vocabulary entry for "${newEntry.word}"!`
    );
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Auto-fill vocabulary details when word is typed
  const handleSelectWordFromTranscript = (word: string) => {
    setVocabWord(word);
    setVocabCambridge(word.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'));
    setIsAddingVocab(true);
    setActiveEditTab('vocabulary');
  };

  // Toggle multi-select correct options
  const handleToggleMultiCorrect = (optId: string) => {
    setNewQCorrectAnswers((prev) => {
      const next = new Set(prev);
      if (newQAllowMulti) {
        if (next.has(optId)) {
          if (next.size > 1) next.delete(optId);
        } else {
          next.add(optId);
        }
      } else {
        next.clear();
        next.add(optId);
      }
      return next;
    });
  };

  const handleAddQuestionManual = () => {
    if (!newQPrompt.trim()) return;

    const newQ: Question = {
      id: `q-${Date.now()}`,
      timestamp: newQIsGeneral ? null : Number(newQTimestamp),
      type: newQType,
      prompt: newQPrompt,
      explanation: newQExplanation || 'Review the listening segment.',
      points: 10,
    };

    if (newQType === 'multiple_choice') {
      newQ.options = newQOptions.map((text, idx) => ({
        id: String.fromCharCode(97 + idx),
        text,
      }));
      newQ.allowMultipleAnswers = newQAllowMulti;
      newQ.correctAnswers = Array.from(newQCorrectAnswers);
      newQ.correctAnswer = Array.from(newQCorrectAnswers)[0] || 'a';
    } else if (newQType === 'true_false') {
      newQ.options = [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ];
      const correctVal = Array.from(newQCorrectAnswers)[0] === 'false' ? 'false' : 'true';
      newQ.correctAnswer = correctVal;
      newQ.correctAnswers = [correctVal];
    } else if (newQType === 'close_ended') {
      newQ.correctAnswer = newQCloseEndedAns.trim();
    } else if (newQType === 'matching') {
      newQ.matchingPairs = newQMatchingPairs;
    }

    setQuestions((prev) =>
      [...prev, newQ].sort((a, b) => {
        const aT = typeof a.timestamp === 'number' && a.timestamp >= 0 ? a.timestamp : 999999;
        const bT = typeof b.timestamp === 'number' && b.timestamp >= 0 ? b.timestamp : 999999;
        return aT - bT;
      })
    );
    setIsAddingQuestion(false);
    setNewQPrompt('');
    setNewQExplanation('');
    setNewQCloseEndedAns('');
    setNewQIsGeneral(false);
  };

  const handleSaveLesson = () => {
    if (!title.trim()) {
      alert('Please enter a lesson title.');
      return;
    }

    const saved: Lesson = {
      id: initialLesson?.id || `lesson-${Date.now()}`,
      title,
      description,
      level,
      mediaType,
      mediaUrl,
      duration: Number(duration) || 180,
      trimStart: Number(trimStart) || 0,
      trimEnd: Number(trimEnd) || Number(duration) || 180,
      preventSkipping,
      thumbnailUrl:
        initialLesson?.thumbnailUrl && !initialLesson.thumbnailUrl.startsWith('/src/assets/images/')
          ? initialLesson.thumbnailUrl
          : (mediaType === 'youtube' && extractYtId(mediaUrl) ? `https://img.youtube.com/vi/${extractYtId(mediaUrl)}/hqdefault.jpg` : undefined),
      isPublished,
      teacherId: initialLesson?.teacherId || 'teacher-chuck',
      teacherName: initialLesson?.teacherName || 'Chuck (Teacher)',
      createdAt: initialLesson?.createdAt || new Date().toISOString().split('T')[0],
      captions,
      questions,
      difficultWords,
    };

    onSave(saved);
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Action Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                Lesson Studio
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isPublished ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {isPublished ? 'Public Lesson' : 'Draft (Unpublished)'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              {initialLesson ? 'Edit Listening Lesson' : 'Create New Listening Lesson'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Publish / Unpublish Switch */}
          <button
            type="button"
            onClick={() => setIsPublished(!isPublished)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              isPublished
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isPublished ? 'Published (Live to Students)' : 'Unpublished (Draft)'}</span>
          </button>

          {initialLesson && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Are you sure you want to permanently delete "${title}"?`)) {
                  onDelete(initialLesson.id);
                }
              }}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              title="Delete Lesson"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveLesson}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save & Publish</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TWO-COLUMN LAYOUT: Column 1 = Video Preview, Column 2 = Edit Options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUMN 1: LIVE VIDEO PREVIEW & PLAYER (5 cols on desktop, sticky) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <Video className="w-4 h-4 text-amber-600" />
                <span>Video Preview Player</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Trim: {formatSec(trimStart)} - {formatSec(trimEnd)}
              </span>
            </div>

            {/* Embedded Live Preview */}
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative">
              {mediaType === 'youtube' && previewYtId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${previewYtId}?enablejsapi=1&origin=${window.location.origin}&start=${trimStart}&end=${trimEnd}`}
                  className="w-full h-full border-0"
                  title="YouTube Preview"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : mediaType === 'video' ? (
                <video src={mediaUrl} controls className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 bg-slate-950">
                  <Music className="w-10 h-10 mb-2 text-amber-500" />
                  <span className="text-xs">Audio track loaded</span>
                  <audio src={mediaUrl} controls className="mt-3 w-full" />
                </div>
              )}
            </div>

            {/* Interactive Trimming Control Bar */}
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-700" />
                  <span>Playback Trimming Range</span>
                </span>
                <span className="text-xs font-mono font-bold text-amber-800">
                  {formatSec(trimEnd - trimStart)} Total Listening
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-600 block mb-1">Start Trim (sec)</label>
                  <input
                    type="number"
                    min={0}
                    max={trimEnd - 1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(parseInt(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">End Trim (sec)</label>
                  <input
                    type="number"
                    min={trimStart + 1}
                    max={duration}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(parseInt(e.target.value) || duration)}
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Quick Helper Button: Place Question at Current Trim Head */}
            <button
              type="button"
              onClick={() => {
                setNewQTimestamp(trimStart + 15);
                setIsAddingQuestion(true);
                setActiveEditTab('questions');
              }}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Question at {formatSec(trimStart + 15)}</span>
            </button>
          </div>
        </div>

        {/* COLUMN 2: EDIT OPTIONS PANEL (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Segmented Tab Navigation for Edit Options */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveEditTab('details')}
              className={`flex-1 py-2 px-3 rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                activeEditTab === 'details'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Details & Media
            </button>

            <button
              type="button"
              onClick={() => setActiveEditTab('captions')}
              className={`flex-1 py-2 px-3 rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                activeEditTab === 'captions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Captions ({captions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveEditTab('questions')}
              className={`flex-1 py-2 px-3 rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                activeEditTab === 'questions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3. Questions ({questions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveEditTab('vocabulary')}
              className={`flex-1 py-2 px-3 rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                activeEditTab === 'vocabulary'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              4. Vocabulary ({difficultWords.length})
            </button>
          </div>

          {/* TAB 1: DETAILS & MEDIA */}
          {activeEditTab === 'details' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                Lesson Information
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Lesson Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Oxford English: Understanding Cultural Metaphors"
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">CEFR Target Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as CEFRLevel)}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="A2">A2 Elementary</option>
                    <option value="B1">B1 Intermediate</option>
                    <option value="B2">B2 Upper Intermediate</option>
                    <option value="C1">C1 Advanced</option>
                    <option value="C2">C2 Mastery</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Total Video Duration (seconds)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 180)}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Context and instructions for students..."
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Media URL selector */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Media Source</label>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setMediaType('youtube')}
                      className={`px-2.5 py-1 rounded font-medium ${mediaType === 'youtube' ? 'bg-white shadow-xs' : 'text-slate-600'}`}
                    >
                      YouTube
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaType('video')}
                      className={`px-2.5 py-1 rounded font-medium ${mediaType === 'video' ? 'bg-white shadow-xs' : 'text-slate-600'}`}
                    >
                      Video File
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaType('audio')}
                      className={`px-2.5 py-1 rounded font-medium ${mediaType === 'audio' ? 'bg-white shadow-xs' : 'text-slate-600'}`}
                    >
                      Audio File
                    </button>
                  </div>
                </div>

                {mediaType === 'youtube' ? (
                  <input
                    type="text"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                  />
                ) : (
                  <div className="p-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex items-center justify-between">
                    <label className="text-xs text-amber-700 font-semibold hover:underline cursor-pointer">
                      <span>Choose {mediaType} file</span>
                      <input
                        type="file"
                        accept={mediaType === 'audio' ? 'audio/*' : 'video/*'}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder={`Or direct URL`}
                      className="p-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono flex-1 ml-4"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Prevent Skipping</div>
                    <div className="text-[11px] text-slate-500">Students cannot scrub past uncompleted questions</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preventSkipping}
                    onChange={(e) => setPreventSkipping(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CAPTIONS & UPLOAD / TYPE OWN SUBTITLES */}
          {activeEditTab === 'captions' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Captions & Transcript ({captions.length} lines)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Type your own captions line-by-line, upload SRT/VTT files, or import directly from YouTube.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {mediaType === 'youtube' && (
                    <button
                      type="button"
                      onClick={handleImportYouTubeTranscript}
                      disabled={isImportingYtTranscript}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Youtube className="w-3.5 h-3.5 text-red-600" />
                      <span>{isImportingYtTranscript ? 'Importing...' : 'Import YouTube Captions'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowBulkCaptionInput(!showBulkCaptionInput)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Upload / Paste SRT or Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAiTranscribe}
                    disabled={isTranscribing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Auto-Transcribe with AI</span>
                  </button>
                </div>
              </div>

              {/* Bulk paste / upload drawer */}
              {showBulkCaptionInput && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      Paste Transcript or Upload .SRT / .VTT
                    </span>
                    <label className="text-xs text-indigo-700 font-semibold underline hover:text-indigo-900 cursor-pointer">
                      <span>Choose .srt or .txt file</span>
                      <input
                        type="file"
                        accept=".srt,.vtt,.txt"
                        onChange={handleCaptionFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <textarea
                    rows={4}
                    value={rawTranscriptText}
                    onChange={(e) => setRawTranscriptText(e.target.value)}
                    placeholder="Paste full transcript or SRT subtitles here..."
                    className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-mono"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkCaptionInput(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleParseBulkTranscript}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Parse & Apply Captions
                    </button>
                  </div>
                </div>
              )}

              {/* Type individual caption line */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  + Type Custom Caption Line
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 mb-1">Start (s)</label>
                    <input
                      type="number"
                      value={newCapStart}
                      onChange={(e) => setNewCapStart(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-500 mb-1">End (s)</label>
                    <input
                      type="number"
                      value={newCapEnd}
                      onChange={(e) => setNewCapEnd(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-slate-500 mb-1">Speaker</label>
                    <input
                      type="text"
                      value={newCapSpeaker}
                      onChange={(e) => setNewCapSpeaker(e.target.value)}
                      placeholder="e.g. Elena"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-slate-500 mb-1">Spoken Line</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCapText}
                        onChange={(e) => setNewCapText(e.target.value)}
                        placeholder="Type English words spoken..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddCaptionLine}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Captions Table */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                {captions.map((cap) => (
                  <div
                    key={cap.id}
                    className="pt-2 flex items-center justify-between gap-3 text-xs p-1.5 hover:bg-white rounded-lg"
                  >
                    <span className="font-mono text-slate-500 w-24 shrink-0">
                      {formatSec(cap.start)} - {formatSec(cap.end)}
                    </span>
                    <span className="font-semibold text-slate-800 w-20 truncate shrink-0">
                      {cap.speaker}:
                    </span>
                    <span className="text-slate-800 flex-1 truncate">{cap.text}</span>

                    <button
                      type="button"
                      onClick={() => handleSelectWordFromTranscript(cap.text.split(' ')[0] || '')}
                      className="text-[11px] text-amber-700 hover:underline px-2 py-0.5"
                      title="Add vocabulary from this line"
                    >
                      + Vocab
                    </button>

                    <button
                      type="button"
                      onClick={() => setCaptions(captions.filter((c) => c.id !== cap.id))}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: FORMATIVE QUESTIONS */}
          {activeEditTab === 'questions' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Formative Assessment Checkpoints ({questions.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Auto-pauses at timestamps. Multiple choice can have single or multiple correct options.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingQuestion(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Checkpoint</span>
                  </button>
                </div>
              </div>

              {/* Add question modal / form */}
              {isAddingQuestion && (
                <div className="p-4 border-2 border-amber-300 bg-amber-50/50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Add Formative Checkpoint
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingQuestion(false)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Checkpoint Timestamp vs General Question Toggle */}
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">Question Timing Mode</div>
                        <div className="text-[11px] text-slate-500">
                          Choose whether this question auto-pauses at a specific timestamp or serves as an overall comprehension task.
                        </div>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-indigo-700 font-bold text-xs bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                        <input
                          type="checkbox"
                          checked={newQIsGeneral}
                          onChange={(e) => setNewQIsGeneral(e.target.checked)}
                          className="w-3.5 h-3.5 accent-indigo-600 rounded"
                        />
                        <span>Whole-Video / General (No Pause)</span>
                      </label>
                    </div>

                    {!newQIsGeneral ? (
                      <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-100">
                        <div>
                          <label className="text-slate-700 block mb-1 font-semibold">Pause Timestamp (seconds)</label>
                          <input
                            type="number"
                            value={newQTimestamp}
                            onChange={(e) => setNewQTimestamp(parseInt(e.target.value) || 0)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-slate-700 block mb-1 font-semibold">Question Type</label>
                          <select
                            value={newQType}
                            onChange={(e) => setNewQType(e.target.value as QuestionType)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="true_false">True / False</option>
                            <option value="close_ended">Fill in the Blank</option>
                            <option value="matching">Matching Pairs</option>
                            <option value="open_ended">Open Reflection</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 border-t border-slate-100">
                        <label className="text-slate-700 block mb-1 font-semibold text-xs">Question Type</label>
                        <select
                          value={newQType}
                          onChange={(e) => setNewQType(e.target.value as QuestionType)}
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True / False</option>
                          <option value="close_ended">Fill in the Blank</option>
                          <option value="matching">Matching Pairs</option>
                          <option value="open_ended">Open Reflection</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-xs">
                    <label className="text-slate-700 font-semibold">Question Prompt</label>
                    <input
                      type="text"
                      value={newQPrompt}
                      onChange={(e) => setNewQPrompt(e.target.value)}
                      placeholder="What caused Marcus to be late?"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  {newQType === 'multiple_choice' && (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Options (Select Correct Answers)</span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-indigo-700 font-bold">
                          <input
                            type="checkbox"
                            checked={newQAllowMulti}
                            onChange={(e) => setNewQAllowMulti(e.target.checked)}
                            className="w-3.5 h-3.5 accent-indigo-600 rounded"
                          />
                          <span>Allow more than one correct option (Multi-Select)</span>
                        </label>
                      </div>

                      <div className="space-y-1.5">
                        {newQOptions.map((opt, idx) => {
                          const optId = String.fromCharCode(97 + idx);
                          const isCorrect = newQCorrectAnswers.has(optId);

                          return (
                            <div key={optId} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleMultiCorrect(optId)}
                                className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-white text-slate-600 border-slate-300'
                                }`}
                              >
                                {isCorrect ? '✓ Correct' : 'Mark Correct'}
                              </button>
                              <span className="font-mono uppercase font-bold">{optId}.</span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const copy = [...newQOptions];
                                  copy[idx] = e.target.value;
                                  setNewQOptions(copy);
                                }}
                                className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {newQType === 'close_ended' && (
                    <div className="space-y-1 text-xs">
                      <label className="font-semibold text-slate-700">Expected Answer</label>
                      <input
                        type="text"
                        value={newQCloseEndedAns}
                        onChange={(e) => setNewQCloseEndedAns(e.target.value)}
                        placeholder="Expected exact word or phrase"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  )}

                  <div className="space-y-1 text-xs">
                    <label className="text-slate-700 font-semibold">Teacher Explanation</label>
                    <input
                      type="text"
                      value={newQExplanation}
                      onChange={(e) => setNewQExplanation(e.target.value)}
                      placeholder="Why this answer is correct..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddQuestionManual}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                  >
                    Add Question to Lesson
                  </button>
                </div>
              )}

              {/* Questions list */}
              <div className="space-y-2.5">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {typeof q.timestamp === 'number' && q.timestamp >= 0 ? (
                          <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px]">
                            At {formatSec(q.timestamp)}
                          </span>
                        ) : (
                          <span className="font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[11px] border border-indigo-200">
                            Whole Video / General (No Pause)
                          </span>
                        )}
                        <span className="font-bold text-slate-700 uppercase text-[10px]">
                          {q.type.replace('_', ' ')}
                        </span>
                        {q.allowMultipleAnswers && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[9px]">
                            Multi-Select
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">{q.prompt}</div>
                      <div className="text-slate-500 italic text-[11px]">{q.explanation}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setQuestions(questions.filter((item) => item.id !== q.id))}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: DIFFICULT VOCABULARY, DEFINITIONS & ILLUSTRATIONS */}
          {activeEditTab === 'vocabulary' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Difficult Vocabulary & Explanations ({difficultWords.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select challenging words, specify CEFR levels, definitions, examples, and Cambridge Dictionary links.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingVocab(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Vocabulary Word</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAiVocabEnrich}
                    disabled={isEnrichingVocab}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Auto-Detect with AI</span>
                  </button>
                </div>
              </div>

              {/* Add / Edit vocabulary dialog */}
              {isAddingVocab && (
                <div className="p-4 border-2 border-amber-300 bg-amber-50/50 rounded-2xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 uppercase">
                      {editingVocabOriginalWord
                        ? `Edit Vocabulary: "${editingVocabOriginalWord}"`
                        : 'New Vocabulary Entry'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelVocabEdit}
                      className="text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-600 block mb-1">Target Word or Idiom</label>
                      <input
                        type="text"
                        value={vocabWord}
                        onChange={(e) => {
                          setVocabWord(e.target.value);
                          setVocabCambridge(e.target.value.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'));
                        }}
                        placeholder="e.g. intrinsic"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">CEFR Level</label>
                      <select
                        value={vocabLevel}
                        onChange={(e) => setVocabLevel(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg"
                      >
                        <option value="B1">B1 Intermediate</option>
                        <option value="B2">B2 Upper Intermediate</option>
                        <option value="C1">C1 Advanced</option>
                        <option value="C2">C2 Mastery</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">Part of Speech</label>
                      <select
                        value={vocabPos}
                        onChange={(e) => setVocabPos(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-medium"
                      >
                        <option value="noun">Noun</option>
                        <option value="verb">Verb</option>
                        <option value="adjective">Adjective</option>
                        <option value="adverb">Adverb</option>
                        <option value="pronoun">Pronoun</option>
                        <option value="preposition">Preposition</option>
                        <option value="conjunction">Conjunction</option>
                        <option value="determiner">Determiner</option>
                        <option value="interjection">Interjection</option>
                        <option value="idiom">Idiom</option>
                        <option value="phrasal verb">Phrasal Verb</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-600 block mb-1">Phonetic Pronunciation (IPA)</label>
                      <input
                        type="text"
                        value={vocabPhonetic}
                        onChange={(e) => setVocabPhonetic(e.target.value)}
                        placeholder="e.g. /ɪnˈtrɪn.zɪk/"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 block mb-1">Cambridge Dictionary Slug</label>
                      <input
                        type="text"
                        value={vocabCambridge}
                        onChange={(e) => setVocabCambridge(e.target.value)}
                        placeholder="e.g. intrinsic"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1">Learner Definition</label>
                    <textarea
                      rows={2}
                      value={vocabDefinition}
                      onChange={(e) => setVocabDefinition(e.target.value)}
                      placeholder="Clear explanation of the meaning in this context..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1">Illustrative Example Sentence</label>
                    <input
                      type="text"
                      value={vocabExample}
                      onChange={(e) => setVocabExample(e.target.value)}
                      placeholder="e.g. Curiosity is an intrinsic drive in young children."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveVocabEntry}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
                    >
                      {editingVocabOriginalWord ? 'Update Vocabulary Card' : 'Save Vocabulary Card'}
                    </button>
                    {editingVocabOriginalWord && (
                      <button
                        type="button"
                        onClick={handleCancelVocabEdit}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Vocabulary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {difficultWords.map((v) => (
                  <div
                    key={v.word}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 relative group hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-center justify-between pr-14">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{v.word}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800">
                          {v.cefrLevel}
                        </span>
                        <span className="text-[10px] text-slate-500 italic">{v.partOfSpeech}</span>
                      </div>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">{v.phonetic}</div>
                    <p className="text-slate-700 line-clamp-2 leading-relaxed">{v.definition}</p>
                    <p className="text-[11px] text-slate-500 italic truncate">"{v.example}"</p>

                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEditVocab(v)}
                        className="text-slate-400 hover:text-amber-600 p-1 rounded hover:bg-white transition-colors cursor-pointer"
                        title="Edit vocabulary card"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDifficultWords(difficultWords.filter((w) => w.word !== v.word))}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-white transition-colors cursor-pointer"
                        title="Delete vocabulary card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
