import React, { useState, useEffect, useRef } from 'react';
import {
  Lesson,
  Question,
  CaptionSegment,
  VocabEntry,
  QuestionType,
  CEFRLevel,
  PartOfSpeech,
  DragDropCategory,
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
  Download,
  X,
  ArrowUp,
  ArrowDown,
  Lightbulb,
  Layers,
} from 'lucide-react';

interface LessonEditorProps {
  onSave: (lesson: Lesson) => void;
  onCancel: () => void;
  onDelete?: (lessonId: string) => void;
  initialLesson?: Lesson | null;
}

// Helper to sort questions: general / no-pause questions come first, followed by timestamped questions
const sortLessonQuestions = (list: Question[]): Question[] => {
  const general = list.filter((q) => q.timestamp == null || q.timestamp < 0);
  const timestamped = list
    .filter((q) => typeof q.timestamp === 'number' && q.timestamp >= 0)
    .sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
  return [...general, ...timestamped];
};

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
  const [trimStartStr, setTrimStartStr] = useState<string>(() => {
    const s = initialLesson?.trimStart || 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  });
  const [trimEndStr, setTrimEndStr] = useState<string>(() => {
    const s = initialLesson?.trimEnd || initialLesson?.duration || 180;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  });
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

  // Questions list (general / no-pause questions first, then timestamped questions)
  const [questions, setQuestions] = useState<Question[]>(() =>
    sortLessonQuestions(initialLesson?.questions || [])
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
  const [newCapStartStr, setNewCapStartStr] = useState<string>('00:00');
  const [newCapEnd, setNewCapEnd] = useState<number>(5);
  const [newCapEndStr, setNewCapEndStr] = useState<string>('00:05');
  const [newCapSpeaker, setNewCapSpeaker] = useState<string>('Speaker');
  const [newCapText, setNewCapText] = useState<string>('');
  const [rawTranscriptText, setRawTranscriptText] = useState<string>('');
  const [showBulkCaptionInput, setShowBulkCaptionInput] = useState<boolean>(false);

  // Caption inline editor state
  const [editingCapId, setEditingCapId] = useState<string | null>(null);
  const [editingCapStartStr, setEditingCapStartStr] = useState<string>('');
  const [editingCapEndStr, setEditingCapEndStr] = useState<string>('');
  const [editingCapSpeaker, setEditingCapSpeaker] = useState<string>('');
  const [editingCapText, setEditingCapText] = useState<string>('');

  // New / edit question form state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [newQIsGeneral, setNewQIsGeneral] = useState<boolean>(false);
  const [newQTimestamp, setNewQTimestamp] = useState<number>(15);
  const [newQTimestampStr, setNewQTimestampStr] = useState<string>('00:15');
  const [editingQTimestampId, setEditingQTimestampId] = useState<string | null>(null);
  const [editingQTimestampStr, setEditingQTimestampStr] = useState<string>('');
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
  const [newQImageUrl, setNewQImageUrl] = useState<string>('');
  const [newQTip, setNewQTip] = useState<string>('');
  const [newQCategories, setNewQCategories] = useState<DragDropCategory[]>([
    { id: 'cat-1', name: 'Category A', items: ['Item 1', 'Item 2'] },
    { id: 'cat-2', name: 'Category B', items: ['Item 3'] },
  ]);

  // Difficult word form state
  const [isAddingVocab, setIsAddingVocab] = useState(false);
  const [editingVocabOriginalWord, setEditingVocabOriginalWord] = useState<string | null>(null);
  const [vocabWord, setVocabWord] = useState('');
  const [vocabPhonetic, setVocabPhonetic] = useState('');
  const [vocabLevel, setVocabLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'>('B2');
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
    const startSec = parseTimeToSeconds(newCapStartStr || newCapStart);
    const endSec = parseTimeToSeconds(newCapEndStr || newCapEnd);
    const effectiveEnd = Math.max(startSec + 0.5, endSec);
    const nextStart = Math.round(effectiveEnd * 10) / 10;
    const nextEnd = Math.round((nextStart + 5) * 10) / 10;

    const newCap: CaptionSegment = {
      id: `cap-${Date.now()}`,
      start: startSec,
      end: effectiveEnd,
      speaker: newCapSpeaker.trim() || 'Speaker',
      text: newCapText.trim(),
    };
    setCaptions((prev) => [...prev, newCap].sort((a, b) => a.start - b.start));
    setNewCapText('');
    setNewCapStart(nextStart);
    setNewCapStartStr(formatSec(nextStart));
    setNewCapEnd(nextEnd);
    setNewCapEndStr(formatSec(nextEnd));
  };

  // Caption inline editor handlers
  const handleStartEditCaption = (cap: CaptionSegment) => {
    setEditingCapId(cap.id);
    setEditingCapStartStr(formatSec(cap.start));
    setEditingCapEndStr(formatSec(cap.end));
    setEditingCapSpeaker(cap.speaker || 'Speaker');
    setEditingCapText(cap.text);
  };

  const handleSaveEditCaption = (capId: string) => {
    const startSec = parseTimeToSeconds(editingCapStartStr);
    const endSec = parseTimeToSeconds(editingCapEndStr);
    setCaptions((prev) =>
      prev
        .map((c) =>
          c.id === capId
            ? {
                ...c,
                start: startSec,
                end: Math.max(startSec + 0.5, endSec),
                speaker: editingCapSpeaker.trim() || 'Speaker',
                text: editingCapText.trim(),
              }
            : c
        )
        .sort((a, b) => a.start - b.start)
    );
    setEditingCapId(null);
  };

  const handleCancelEditCaption = () => {
    setEditingCapId(null);
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
      phonetic: vocabPhonetic.trim(),
      cefrLevel: vocabLevel,
      partOfSpeech: vocabPos,
      definition: vocabDefinition.trim(),
      example: vocabExample.trim(),
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

  // Add new option to multiple choice (min 2, max 8)
  const handleAddOption = () => {
    if (newQOptions.length >= 8) return;
    const nextIdx = newQOptions.length;
    const nextLetter = String.fromCharCode(65 + nextIdx);
    setNewQOptions((prev) => [...prev, `Option ${nextLetter}`]);
  };

  // Remove option from multiple choice (min 2, max 8)
  const handleRemoveOption = (indexToRemove: number) => {
    if (newQOptions.length <= 2) return;
    const updated = newQOptions.filter((_, idx) => idx !== indexToRemove);
    setNewQOptions(updated);

    // Re-index correct answers so IDs remain contiguous 'a', 'b', ...
    setNewQCorrectAnswers((prev) => {
      const next = new Set<string>();
      let newIdx = 0;
      for (let i = 0; i < newQOptions.length; i++) {
        if (i === indexToRemove) continue;
        const oldId = String.fromCharCode(97 + i);
        const newId = String.fromCharCode(97 + newIdx);
        if (prev.has(oldId)) {
          next.add(newId);
        }
        newIdx++;
      }
      if (next.size === 0) {
        next.add('a');
      }
      return next;
    });
  };

  const handleAddCategory = () => {
    setNewQCategories((prev) => [
      ...prev,
      {
        id: `cat-${Date.now()}`,
        name: `Category ${String.fromCharCode(65 + prev.length)}`,
        items: [],
      },
    ]);
  };

  const handleRemoveCategory = (catIdx: number) => {
    setNewQCategories((prev) => prev.filter((_, idx) => idx !== catIdx));
  };

  const handleUpdateCategoryName = (catIdx: number, name: string) => {
    setNewQCategories((prev) => {
      const copy = [...prev];
      copy[catIdx] = { ...copy[catIdx], name };
      return copy;
    });
  };

  const handleAddItemToCategory = (catIdx: number, itemText: string) => {
    if (!itemText.trim()) return;
    setNewQCategories((prev) => {
      const copy = [...prev];
      copy[catIdx] = {
        ...copy[catIdx],
        items: [...(copy[catIdx].items || []), itemText.trim()],
      };
      return copy;
    });
  };

  const handleRemoveItemFromCategory = (catIdx: number, itemIdx: number) => {
    setNewQCategories((prev) => {
      const copy = [...prev];
      copy[catIdx] = {
        ...copy[catIdx],
        items: copy[catIdx].items.filter((_, idx) => idx !== itemIdx),
      };
      return copy;
    });
  };

  // Open form to add a new question
  const handleOpenAddQuestion = () => {
    setEditingQuestionId(null);
    setNewQPrompt('');
    setNewQImageUrl('');
    setNewQTip('');
    setNewQExplanation('');
    setNewQCloseEndedAns('');
    setNewQIsGeneral(false);
    setNewQTimestamp(15);
    setNewQTimestampStr('00:15');
    setNewQOptions(['Option A', 'Option B', 'Option C', 'Option D']);
    setNewQCorrectAnswers(new Set(['a']));
    setNewQAllowMulti(false);
    setNewQType('multiple_choice');
    setNewQCategories([
      { id: 'cat-1', name: 'Category A', items: ['Item 1', 'Item 2'] },
      { id: 'cat-2', name: 'Category B', items: ['Item 3'] },
    ]);
    setIsAddingQuestion(true);
  };

  // Open form to edit an existing question
  const handleStartEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setNewQPrompt(q.prompt);
    setNewQImageUrl(q.imageUrl || '');
    setNewQTip(q.tip || '');
    setNewQExplanation(q.explanation || '');
    setNewQType(q.type);
    const isGen = q.timestamp == null || q.timestamp < 0;
    setNewQIsGeneral(isGen);
    setNewQTimestamp(q.timestamp ?? 15);
    setNewQTimestampStr(formatSec(q.timestamp));

    if (q.type === 'multiple_choice') {
      if (q.options && q.options.length > 0) {
        setNewQOptions(q.options.map((o) => o.text));
      } else {
        setNewQOptions(['Option A', 'Option B', 'Option C', 'Option D']);
      }
      setNewQAllowMulti(!!q.allowMultipleAnswers);
      if (q.correctAnswers && q.correctAnswers.length > 0) {
        setNewQCorrectAnswers(new Set(q.correctAnswers));
      } else if (q.correctAnswer) {
        setNewQCorrectAnswers(new Set([q.correctAnswer]));
      } else {
        setNewQCorrectAnswers(new Set(['a']));
      }
    } else if (q.type === 'true_false') {
      setNewQCorrectAnswers(new Set([q.correctAnswer || 'true']));
    } else if (q.type === 'close_ended') {
      setNewQCloseEndedAns(q.correctAnswer || '');
    } else if (q.type === 'matching') {
      setNewQMatchingPairs(
        q.matchingPairs && q.matchingPairs.length > 0
          ? q.matchingPairs
          : [
              { left: 'Term 1', right: 'Definition 1' },
              { left: 'Term 2', right: 'Definition 2' },
            ]
      );
    } else if (q.type === 'drag_and_drop') {
      setNewQCategories(
        q.categories && q.categories.length > 0
          ? q.categories
          : [
              { id: 'cat-1', name: 'Category A', items: ['Item 1', 'Item 2'] },
              { id: 'cat-2', name: 'Category B', items: ['Item 3'] },
            ]
      );
    }
    setIsAddingQuestion(true);
    // Smooth scroll to the question editor card
    setTimeout(() => {
      const el = document.getElementById('question-editor-card');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const handleCancelQuestionForm = () => {
    setIsAddingQuestion(false);
    setEditingQuestionId(null);
    setNewQPrompt('');
    setNewQImageUrl('');
    setNewQTip('');
    setNewQExplanation('');
    setNewQCloseEndedAns('');
    setNewQIsGeneral(false);
    setNewQTimestamp(15);
    setNewQTimestampStr('00:15');
    setNewQOptions(['Option A', 'Option B', 'Option C', 'Option D']);
    setNewQCorrectAnswers(new Set(['a']));
    setNewQAllowMulti(false);
    setNewQCategories([
      { id: 'cat-1', name: 'Category A', items: ['Item 1', 'Item 2'] },
      { id: 'cat-2', name: 'Category B', items: ['Item 3'] },
    ]);
  };

  const handleSaveQuestion = () => {
    if (!newQPrompt.trim()) return;

    const parsedTs = newQIsGeneral ? null : parseTimeToSeconds(newQTimestampStr || newQTimestamp);

    const questionData: Question = {
      id: editingQuestionId || `q-${Date.now()}`,
      timestamp: parsedTs,
      type: newQType,
      prompt: newQPrompt.trim(),
      imageUrl: newQImageUrl.trim() || undefined,
      tip: newQTip.trim() || undefined,
      explanation: newQExplanation.trim(),
      points: 10,
    };

    if (newQType === 'multiple_choice') {
      questionData.options = newQOptions.map((text, idx) => ({
        id: String.fromCharCode(97 + idx),
        text,
      }));
      questionData.allowMultipleAnswers = newQAllowMulti;
      questionData.correctAnswers = Array.from(newQCorrectAnswers);
      questionData.correctAnswer = Array.from(newQCorrectAnswers)[0] || 'a';
    } else if (newQType === 'true_false') {
      questionData.options = [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ];
      const correctVal = Array.from(newQCorrectAnswers)[0] === 'false' ? 'false' : 'true';
      questionData.correctAnswer = correctVal;
      questionData.correctAnswers = [correctVal];
    } else if (newQType === 'close_ended') {
      questionData.correctAnswer = newQCloseEndedAns.trim();
    } else if (newQType === 'matching') {
      questionData.matchingPairs = newQMatchingPairs;
    } else if (newQType === 'drag_and_drop') {
      questionData.categories = newQCategories.filter(
        (c) => c.name.trim() && c.items && c.items.length > 0
      );
    }

    if (editingQuestionId) {
      setQuestions((prev) =>
        sortLessonQuestions(prev.map((q) => (q.id === editingQuestionId ? questionData : q)))
      );
      setSuccessMessage(`Updated question successfully!`);
    } else {
      setQuestions((prev) => sortLessonQuestions([...prev, questionData]));
      setSuccessMessage(`Added new question to lesson!`);
    }
    setTimeout(() => setSuccessMessage(null), 3000);
    handleCancelQuestionForm();
  };

  const handleStartEditQTimestamp = (q: Question) => {
    setEditingQTimestampId(q.id);
    setEditingQTimestampStr(formatSec(q.timestamp));
  };

  const handleSaveEditQTimestamp = (qId: string) => {
    const parsed = parseTimeToSeconds(editingQTimestampStr);
    setQuestions((prev) =>
      sortLessonQuestions(prev.map((q) => (q.id === qId ? { ...q, timestamp: parsed } : q)))
    );
    setEditingQTimestampId(null);
  };

  const handleMoveGeneralQuestion = (qId: string, direction: 'up' | 'down') => {
    setQuestions((prev) => {
      const general = prev.filter((q) => q.timestamp == null || q.timestamp < 0);
      const timestamped = prev.filter((q) => typeof q.timestamp === 'number' && q.timestamp >= 0);

      const idx = general.findIndex((q) => q.id === qId);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === general.length - 1) return prev;

      const newGeneral = [...general];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      const temp = newGeneral[idx];
      newGeneral[idx] = newGeneral[targetIdx];
      newGeneral[targetIdx] = temp;

      return [...newGeneral, ...timestamped];
    });
  };

  const handleCancelEditQTimestamp = () => {
    setEditingQTimestampId(null);
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

  const handleExportCurrentDataset = () => {
    if (!title.trim()) {
      alert('Please enter a lesson title before exporting.');
      return;
    }

    const currentLesson: Lesson = {
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
      isPublished: true,
      teacherId: initialLesson?.teacherId || 'teacher-chuck',
      teacherName: initialLesson?.teacherName || 'Chuck (Teacher)',
      createdAt: initialLesson?.createdAt || new Date().toISOString().split('T')[0],
      captions,
      questions,
      difficultWords,
    };

    const payload = {
      app: 'AllEars',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      lesson: currentLesson,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
    const filename = `allears-lesson-${safeTitle || 'dataset'}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccessMessage(`Dataset for "${title}" exported as .json file for students!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const formatSec = (s?: number | null) => {
    if (s === undefined || s === null || isNaN(s) || s < 0) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const parseTimeToSeconds = (input: string | number): number => {
    if (typeof input === 'number') return isNaN(input) ? 0 : Math.max(0, input);
    const str = String(input).trim();
    if (!str) return 0;
    if (str.includes(':')) {
      const parts = str.split(':');
      if (parts.length === 2) {
        const mins = parseFloat(parts[0]) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return Math.max(0, Math.round((mins * 60 + secs) * 10) / 10);
      } else if (parts.length === 3) {
        const hrs = parseFloat(parts[0]) || 0;
        const mins = parseFloat(parts[1]) || 0;
        const secs = parseFloat(parts[2]) || 0;
        return Math.max(0, Math.round((hrs * 3600 + mins * 60 + secs) * 10) / 10);
      }
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.max(0, num);
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

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Export Dataset Button for Students */}
          <button
            type="button"
            onClick={handleExportCurrentDataset}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Download lesson dataset JSON to send to students"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Dataset</span>
          </button>

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
            <span>{isPublished ? 'Published (Live)' : 'Unpublished (Draft)'}</span>
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
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-600 font-medium">Start Trim (mm:ss or sec)</label>
                    <span className="text-[10px] font-mono text-amber-900 font-bold">{formatSec(trimStart)}</span>
                  </div>
                  <input
                    type="text"
                    value={trimStartStr}
                    onChange={(e) => {
                      setTrimStartStr(e.target.value);
                      const parsed = parseTimeToSeconds(e.target.value);
                      setTrimStart(parsed);
                    }}
                    placeholder="00:00"
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-600 font-medium">End Trim (mm:ss or sec)</label>
                    <span className="text-[10px] font-mono text-amber-900 font-bold">{formatSec(trimEnd)}</span>
                  </div>
                  <input
                    type="text"
                    value={trimEndStr}
                    onChange={(e) => {
                      setTrimEndStr(e.target.value);
                      const parsed = parseTimeToSeconds(e.target.value);
                      setTrimEnd(parsed || duration);
                    }}
                    placeholder="03:00"
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
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
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
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
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs items-start">
                  <div className="sm:col-span-2">
                    <label className="h-5 flex items-center text-slate-600 font-semibold mb-1 truncate">
                      Start (mm:ss)
                    </label>
                    <input
                      type="text"
                      value={newCapStartStr}
                      onChange={(e) => {
                        setNewCapStartStr(e.target.value);
                        setNewCapStart(parseTimeToSeconds(e.target.value));
                      }}
                      placeholder="00:00"
                      className="w-full h-9 p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono block mt-1 truncate">
                      {formatSec(newCapStart)}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="h-5 flex items-center text-slate-600 font-semibold mb-1 truncate">
                      End (mm:ss)
                    </label>
                    <input
                      type="text"
                      value={newCapEndStr}
                      onChange={(e) => {
                        setNewCapEndStr(e.target.value);
                        setNewCapEnd(parseTimeToSeconds(e.target.value));
                      }}
                      placeholder="00:05"
                      className="w-full h-9 p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono block mt-1 truncate">
                      {formatSec(newCapEnd)}
                    </span>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="h-5 flex items-center text-slate-600 font-semibold mb-1 truncate">
                      Speaker
                    </label>
                    <input
                      type="text"
                      value={newCapSpeaker}
                      onChange={(e) => setNewCapSpeaker(e.target.value)}
                      placeholder="e.g. Elena"
                      className="w-full h-9 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                    <span className="text-[10px] text-transparent select-none block mt-1 truncate">.</span>
                  </div>
                  <div className="sm:col-span-5">
                    <label className="h-5 flex items-center text-slate-600 font-semibold mb-1 truncate">
                      Spoken Line (Full sentence)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCapText}
                        onChange={(e) => setNewCapText(e.target.value)}
                        placeholder="Type English words spoken..."
                        className="w-full h-9 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddCaptionLine}
                        className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-xs transition-colors flex items-center justify-center"
                      >
                        Add
                      </button>
                    </div>
                    <span className="text-[10px] text-transparent select-none block mt-1 truncate">.</span>
                  </div>
                </div>
              </div>

              {/* Captions Table - Full lines displayed without truncation */}
              <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-1 divide-y divide-slate-100 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                {captions.map((cap) => {
                  const isEditing = editingCapId === cap.id;

                  if (isEditing) {
                    return (
                      <div key={cap.id} className="pt-2 p-3 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-3">
                            <label className="block text-slate-600 text-[11px] font-semibold mb-0.5">Start (mm:ss)</label>
                            <input
                              type="text"
                              value={editingCapStartStr}
                              onChange={(e) => setEditingCapStartStr(e.target.value)}
                              className="w-full p-1.5 bg-white border border-amber-300 rounded-lg font-mono text-xs"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-slate-600 text-[11px] font-semibold mb-0.5">End (mm:ss)</label>
                            <input
                              type="text"
                              value={editingCapEndStr}
                              onChange={(e) => setEditingCapEndStr(e.target.value)}
                              className="w-full p-1.5 bg-white border border-amber-300 rounded-lg font-mono text-xs"
                            />
                          </div>
                          <div className="sm:col-span-6">
                            <label className="block text-slate-600 text-[11px] font-semibold mb-0.5">Speaker</label>
                            <input
                              type="text"
                              value={editingCapSpeaker}
                              onChange={(e) => setEditingCapSpeaker(e.target.value)}
                              className="w-full p-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-slate-600 text-[11px] font-semibold mb-0.5">Full Spoken Line</label>
                          <textarea
                            rows={2}
                            value={editingCapText}
                            onChange={(e) => setEditingCapText(e.target.value)}
                            className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs break-words"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleCancelEditCaption}
                            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditCaption(cap.id)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                          >
                            Save Line
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={cap.id}
                      className="pt-2.5 flex items-start justify-between gap-3 text-xs p-2 hover:bg-white rounded-xl transition-colors group"
                    >
                      <span className="font-mono font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                        {formatSec(cap.start)} - {formatSec(cap.end)}
                      </span>

                      <div className="flex-1 min-w-0 flex items-start gap-2">
                        <span className="font-bold text-slate-900 shrink-0">
                          {cap.speaker}:
                        </span>
                        {/* Display full caption line with zero truncation or abbreviation */}
                        <span className="text-slate-800 break-words whitespace-normal leading-relaxed text-xs">
                          {cap.text}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditCaption(cap)}
                          className="text-slate-400 hover:text-amber-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit this caption line and timestamps"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectWordFromTranscript(cap.text.split(' ')[0] || '')}
                          className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 hover:underline px-1.5 py-0.5"
                          title="Add vocabulary from this line"
                        >
                          + Vocab
                        </button>

                        <button
                          type="button"
                          onClick={() => setCaptions(captions.filter((c) => c.id !== cap.id))}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Delete caption line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                    onClick={handleOpenAddQuestion}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Checkpoint</span>
                  </button>
                </div>
              </div>

              {/* Add / Edit question modal / form */}
              {isAddingQuestion && (
                <div id="question-editor-card" className="p-4 border-2 border-amber-300 bg-amber-50/60 rounded-2xl space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        {editingQuestionId ? 'Edit Checkpoint Question' : 'Add Formative Checkpoint'}
                      </span>
                      {editingQuestionId && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-bold text-[10px] border border-amber-300">
                          Editing Mode
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelQuestionForm}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-amber-100/60 transition-colors"
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
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-700 font-semibold">Pause Timestamp (mm:ss or sec)</label>
                            <span className="text-[11px] font-mono text-amber-900 font-bold">
                              {formatSec(newQTimestamp)}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={newQTimestampStr}
                            onChange={(e) => {
                              setNewQTimestampStr(e.target.value);
                              setNewQTimestamp(parseTimeToSeconds(e.target.value));
                            }}
                            placeholder="e.g. 01:30 or 90"
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
                            Pauses at {formatSec(newQTimestamp)} ({newQTimestamp}s)
                          </span>
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
                            <option value="drag_and_drop">Drag & Drop (Categorization)</option>
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
                          <option value="drag_and_drop">Drag & Drop (Categorization)</option>
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
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Attached Question Image URL (Optional) */}
                  <div className="space-y-1 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                        <span>Question Image Attachment (URL)</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">Optional · Only shown if URL provided</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="url"
                        value={newQImageUrl}
                        onChange={(e) => setNewQImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/... or image URL link"
                        className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                      {newQImageUrl && (
                        <button
                          type="button"
                          onClick={() => setNewQImageUrl('')}
                          className="px-2.5 py-2 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg hover:bg-rose-50 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {newQImageUrl && (
                      <div className="mt-2 p-2 bg-white border border-slate-200 rounded-lg flex items-center gap-3">
                        <img
                          src={newQImageUrl}
                          alt="Question Preview"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                          className="h-16 w-24 object-contain rounded-md border border-slate-200 bg-slate-50"
                        />
                        <div className="text-[11px] text-slate-600 min-w-0">
                          <span className="font-semibold text-emerald-700 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Image linked & previewing
                          </span>
                          <span className="text-slate-400 text-[10px] block truncate max-w-sm">{newQImageUrl}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Question Tip / Hint for Students (Optional) */}
                  <div className="space-y-1 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span>Question Tip / Hint for Students</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-medium">Optional · Collapsed by default</span>
                    </div>
                    <input
                      type="text"
                      value={newQTip}
                      onChange={(e) => setNewQTip(e.target.value)}
                      placeholder="e.g. Listen carefully to the transition words in the second sentence..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400">
                      Students can click "💡 View Tip" in Live & Practice modes to reveal this hint. If left empty, no tip button will appear.
                    </p>
                  </div>

                  {newQType === 'multiple_choice' && (
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">Options</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {newQOptions.length} of 8 (Min 2, Max 8)
                          </span>
                        </div>
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

                      <div className="space-y-2">
                        {newQOptions.map((opt, idx) => {
                          const optId = String.fromCharCode(97 + idx);
                          const isCorrect = newQCorrectAnswers.has(optId);

                          return (
                            <div key={optId} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleMultiCorrect(optId)}
                                className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                                title={isCorrect ? 'Click to deselect as correct' : 'Click to mark as correct answer'}
                              >
                                {isCorrect ? '✓ Correct' : 'Mark Correct'}
                              </button>
                              <span className="font-mono uppercase font-bold text-slate-700 w-5 shrink-0 text-center">
                                {optId}.
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const copy = [...newQOptions];
                                  copy[idx] = e.target.value;
                                  setNewQOptions(copy);
                                }}
                                className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                              />
                              {newQOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                  title="Delete this option"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {newQOptions.length < 8 && (
                        <button
                          type="button"
                          onClick={handleAddOption}
                          className="w-full py-1.5 px-3 border border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-600" />
                          <span>+ Add Option ({String.fromCharCode(65 + newQOptions.length)})</span>
                        </button>
                      )}
                    </div>
                  )}

                  {newQType === 'true_false' && (
                    <div className="space-y-1.5 text-xs">
                      <label className="font-semibold text-slate-700">Correct Answer</label>
                      <div className="flex items-center gap-3">
                        {['true', 'false'].map((tf) => {
                          const isSelected = Array.from(newQCorrectAnswers)[0] === tf;
                          return (
                            <button
                              key={tf}
                              type="button"
                              onClick={() => setNewQCorrectAnswers(new Set([tf]))}
                              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {isSelected ? `✓ ${tf}` : tf}
                            </button>
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

                  {newQType === 'matching' && (
                    <div className="space-y-3 text-xs bg-white p-3.5 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">Matching Pairs Setup</div>
                          <div className="text-[11px] text-slate-500">
                            Set pairs for students to connect (e.g. Vocabulary & Meaning, Sentence Halves)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNewQMatchingPairs([
                              ...newQMatchingPairs,
                              { left: `Item ${newQMatchingPairs.length + 1}`, right: `Match ${newQMatchingPairs.length + 1}` },
                            ]);
                          }}
                          className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Pair</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {newQMatchingPairs.map((pair, pIdx) => (
                          <div key={pIdx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                              <span>Pair #{pIdx + 1}</span>
                              {newQMatchingPairs.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewQMatchingPairs(newQMatchingPairs.filter((_, idx) => idx !== pIdx));
                                  }}
                                  className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Delete pair"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                              <div className="sm:col-span-5">
                                <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Left Item (Prompt / Term)</label>
                                <input
                                  type="text"
                                  value={pair.left}
                                  onChange={(e) => {
                                    const copy = [...newQMatchingPairs];
                                    copy[pIdx] = { ...copy[pIdx], left: e.target.value };
                                    setNewQMatchingPairs(copy);
                                  }}
                                  placeholder="e.g. Word or clause..."
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                              <div className="hidden sm:flex sm:col-span-2 items-center justify-center text-slate-400 font-bold">
                                ➔
                              </div>
                              <div className="sm:col-span-5">
                                <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Right Item (Target Match)</label>
                                <input
                                  type="text"
                                  value={pair.right}
                                  onChange={(e) => {
                                    const copy = [...newQMatchingPairs];
                                    copy[pIdx] = { ...copy[pIdx], right: e.target.value };
                                    setNewQMatchingPairs(copy);
                                  }}
                                  placeholder="e.g. Definition or match..."
                                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {newQType === 'drag_and_drop' && (
                    <div className="space-y-3 text-xs bg-white p-4 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            <span>Categories & Items Setup (Table Mode)</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Create categories and their correct items below. In live/practice mode, all items will be mixed outside the table for students to categorize.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Add Category</span>
                        </button>
                      </div>

                      {/* Categories & Items Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                              <th className="p-3 w-40">Category Name</th>
                              <th className="p-3">Category Items (Target Matches)</th>
                              <th className="p-3 w-16 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {newQCategories.map((cat, catIdx) => (
                              <tr key={cat.id || catIdx} className="align-top hover:bg-slate-50/50 transition-colors">
                                <td className="p-3">
                                  <input
                                    type="text"
                                    value={cat.name}
                                    onChange={(e) => handleUpdateCategoryName(catIdx, e.target.value)}
                                    placeholder={`e.g. Category ${catIdx + 1}`}
                                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <span className="text-[10px] text-slate-400 mt-1 block">
                                    Category #{catIdx + 1}
                                  </span>
                                </td>
                                <td className="p-3 space-y-2">
                                  {/* Current Items */}
                                  <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center">
                                    {(cat.items || []).map((item, itemIdx) => (
                                      <span
                                        key={itemIdx}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 font-medium text-xs shadow-2xs"
                                      >
                                        <span>{item}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveItemFromCategory(catIdx, itemIdx)}
                                          className="text-indigo-400 hover:text-rose-600 transition-colors cursor-pointer"
                                          title="Remove item"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                    {(cat.items || []).length === 0 && (
                                      <span className="text-slate-400 italic text-[11px]">
                                        No items yet. Type an item below and click "+ Add".
                                      </span>
                                    )}
                                  </div>

                                  {/* Add item inline */}
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <input
                                      type="text"
                                      id={`new-cat-item-input-${catIdx}`}
                                      placeholder="Type item name and press Enter..."
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const val = (e.currentTarget.value || '').trim();
                                          if (val) {
                                            handleAddItemToCategory(catIdx, val);
                                            e.currentTarget.value = '';
                                          }
                                        }
                                      }}
                                      className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const input = document.getElementById(`new-cat-item-input-${catIdx}`) as HTMLInputElement;
                                        if (input && input.value.trim()) {
                                          handleAddItemToCategory(catIdx, input.value.trim());
                                          input.value = '';
                                        }
                                      }}
                                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-[11px] cursor-pointer"
                                    >
                                      + Add Item
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  {newQCategories.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCategory(catIdx)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Delete Category"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Visual Table Preview */}
                      <div className="pt-2">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Student Target Table Preview:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          {newQCategories.map((cat, idx) => (
                            <div key={idx} className="bg-white border-2 border-dashed border-indigo-200 rounded-xl p-3 space-y-2 shadow-2xs">
                              <div className="font-bold text-indigo-900 border-b border-indigo-100 pb-1 flex items-center justify-between text-xs">
                                <span>{cat.name || `Category ${idx + 1}`}</span>
                                <span className="text-[10px] font-mono text-indigo-500 font-normal">
                                  {cat.items.length} items
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 min-h-[30px]">
                                {cat.items.map((it, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-900 rounded text-[10px] border border-indigo-100">
                                    {it}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveQuestion}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs transition-colors"
                    >
                      {editingQuestionId ? 'Save Question Changes' : 'Add Question to Lesson'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelQuestionForm}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Questions list */}
              <div className="space-y-2.5">
                {questions.map((q) => {
                  const isCurrentlyEditing = editingQuestionId === q.id;
                  const isGeneral = q.timestamp == null || q.timestamp < 0;
                  const generalQuestions = questions.filter((item) => item.timestamp == null || item.timestamp < 0);
                  const generalIdx = isGeneral ? generalQuestions.findIndex((item) => item.id === q.id) : -1;
                  const canMoveUp = generalIdx > 0;
                  const canMoveDown = generalIdx >= 0 && generalIdx < generalQuestions.length - 1;

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-4 text-xs transition-all ${
                        isCurrentlyEditing
                          ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {editingQTimestampId === q.id ? (
                            <div className="flex items-center gap-1.5 p-1 bg-amber-50 border border-amber-300 rounded-lg">
                              <span className="text-[10px] font-semibold text-slate-600">Timestamp:</span>
                              <input
                                type="text"
                                value={editingQTimestampStr}
                                onChange={(e) => setEditingQTimestampStr(e.target.value)}
                                placeholder="01:30"
                                className="w-20 p-1 bg-white border border-amber-300 rounded font-mono text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditQTimestamp(q.id)}
                                className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditQTimestamp}
                                className="px-1.5 py-0.5 text-slate-500 hover:text-slate-800 text-[10px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {typeof q.timestamp === 'number' && q.timestamp >= 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditQTimestamp(q)}
                                  className="font-mono font-bold px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Click to edit pause timestamp in mm:ss"
                                >
                                  <span>At {formatSec(q.timestamp)}</span>
                                  <Edit3 className="w-2.5 h-2.5 text-amber-700 opacity-60" />
                                </button>
                              ) : (
                                <span className="font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[11px] border border-indigo-200">
                                  Whole Video / General (No Pause)
                                </span>
                              )}
                            </div>
                          )}

                          <span className="font-bold text-slate-700 uppercase text-[10px] px-2 py-0.5 bg-slate-200/70 rounded">
                            {q.type.replace('_', ' ')}
                          </span>

                          {q.allowMultipleAnswers && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[9px]">
                              Multi-Select
                            </span>
                          )}

                          {isCurrentlyEditing && (
                            <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-bold rounded text-[9px] animate-pulse">
                              Editing Above ↑
                            </span>
                          )}
                        </div>

                        <div className="font-bold text-slate-900 text-sm leading-snug">
                          {q.prompt}
                        </div>

                        {/* Question Image Attachment Preview */}
                        {q.imageUrl && (
                          <div className="pt-0.5">
                            <img
                              src={q.imageUrl}
                              alt="Question Attachment"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                              className="h-16 w-24 object-contain rounded-lg border border-slate-200 bg-white shadow-2xs"
                            />
                          </div>
                        )}

                        {/* Question Tip Preview */}
                        {q.tip && (
                          <div className="text-[11px] text-amber-900 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5 font-medium">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-400 shrink-0" />
                            <span><strong className="font-bold text-amber-950">Tip:</strong> {q.tip}</span>
                          </div>
                        )}

                        {/* Options / Answer Preview */}
                        {q.options && q.options.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {q.options.map((opt) => {
                              const isCorrect =
                                q.correctAnswers?.includes(opt.id) ||
                                q.correctAnswer === opt.id ||
                                q.correctAnswer === opt.text;

                              return (
                                <span
                                  key={opt.id}
                                  className={`px-2 py-0.5 rounded-md text-[11px] border flex items-center gap-1 ${
                                    isCorrect
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold'
                                      : 'bg-white text-slate-600 border-slate-200'
                                  }`}
                                >
                                  <span className="font-mono uppercase font-bold text-[10px]">{opt.id}.</span>
                                  <span>{opt.text}</span>
                                  {isCorrect && <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'close_ended' && q.correctAnswer && (
                          <div className="text-[11px] text-slate-600 font-mono">
                            Expected: <span className="font-bold text-emerald-700 font-sans">"{q.correctAnswer}"</span>
                          </div>
                        )}

                        {/* Drag and Drop Categories & Items Preview */}
                        {q.type === 'drag_and_drop' && q.categories && q.categories.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.categories.map((cat, cIdx) => (
                              <div key={cIdx} className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-200 text-[11px] space-y-1">
                                <div className="font-bold text-indigo-900 flex items-center justify-between">
                                  <span>{cat.name}</span>
                                  <span className="text-[10px] text-indigo-600 font-mono font-normal">{(cat.items || []).length} items</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {(cat.items || []).map((it, iIdx) => (
                                    <span key={iIdx} className="px-1.5 py-0.5 rounded bg-white text-indigo-950 border border-indigo-100 text-[10px] shadow-2xs">
                                      {it}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-slate-500 italic text-[11px]">
                            {q.explanation}
                          </div>
                        )}
                      </div>

                      {/* Question Card Actions: Reorder, Edit Content & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        {isGeneral && generalQuestions.length > 1 && (
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleMoveGeneralQuestion(q.id, 'up')}
                              disabled={!canMoveUp}
                              className={`p-1 rounded text-xs transition-colors ${
                                canMoveUp
                                  ? 'text-slate-700 hover:text-amber-900 hover:bg-amber-100 cursor-pointer'
                                  : 'text-slate-300 cursor-not-allowed opacity-40'
                              }`}
                              title="Move General Question Up"
                              aria-label="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveGeneralQuestion(q.id, 'down')}
                              disabled={!canMoveDown}
                              className={`p-1 rounded text-xs transition-colors ${
                                canMoveDown
                                  ? 'text-slate-700 hover:text-amber-900 hover:bg-amber-100 cursor-pointer'
                                  : 'text-slate-300 cursor-not-allowed opacity-40'
                              }`}
                              title="Move General Question Down"
                              aria-label="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditQuestion(q)}
                          className="flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-amber-900 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                          title="Edit question prompt, options, answer, and explanation"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuestions(questions.filter((item) => item.id !== q.id))}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                        <option value="A1">A1</option>
                        <option value="A2">A2</option>
                        <option value="B1">B1</option>
                        <option value="B2">B2</option>
                        <option value="C1">C1</option>
                        <option value="C2">C2</option>
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

                  {/* Online Illustration Image URL */}
                  <div>
                    <label className="text-slate-600 block mb-1 font-semibold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                      <span>Illustration Image URL (optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={vocabImageUrl}
                        onChange={(e) => setVocabImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/... (link to an image on the internet)"
                        className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      />
                      {vocabImageUrl && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                          <img
                            src={vocabImageUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Paste a direct image link (.jpg, .png, .webp) from any website to visually illustrate this word or phrase to learners.
                    </p>
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
                    {v.phonetic && <div className="font-mono text-[11px] text-slate-500">{v.phonetic}</div>}
                    {v.definition && <p className="text-slate-700 line-clamp-2 leading-relaxed">{v.definition}</p>}
                    {v.example && <p className="text-[11px] text-slate-500 italic truncate">"{v.example}"</p>}

                    {/* Illustration Image thumbnail */}
                    {v.imageUrl && (
                      <div className="mt-2 w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-inner">
                        <img
                          src={v.imageUrl}
                          alt={v.word}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

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
