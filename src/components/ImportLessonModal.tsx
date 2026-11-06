import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Play,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Clock,
  HelpCircle,
  FileUp,
  Sparkles,
  ArrowRight,
  Globe,
  Shield,
} from 'lucide-react';
import { Lesson, CEFRLevel } from '../types';

interface ImportLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (lesson: Lesson, practiceImmediately: boolean) => void;
  existingLessonIds: string[];
  isTeacher?: boolean;
}

export const ImportLessonModal: React.FC<ImportLessonModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingLessonIds,
  isTeacher = false,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [parsedLesson, setParsedLesson] = useState<Lesson | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper to extract YouTube ID
  const extractYtId = (url?: string): string | null => {
    if (!url) return null;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    return match && match[1] ? match[1] : null;
  };

  // Validate and parse raw object into a complete Lesson
  const processRawData = (rawObj: any) => {
    try {
      setErrorMessage(null);
      // Support wrapper: { lesson: { ... } } or direct { ... }
      const data = rawObj.lesson || rawObj;

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON structure. Missing lesson data.');
      }

      if (!data.title || typeof data.title !== 'string') {
        throw new Error('Lesson dataset must include a valid "title".');
      }

      if (!data.mediaUrl || typeof data.mediaUrl !== 'string') {
        throw new Error('Lesson dataset must include a "mediaUrl" (e.g. YouTube video URL).');
      }

      // Check if ID is duplicated; if so, generate unique ID for this device
      let lessonId = data.id || `imported-lesson-${Date.now()}`;
      if (existingLessonIds.includes(lessonId)) {
        lessonId = `${lessonId}-imported-${Date.now().toString().slice(-4)}`;
      }

      // Auto-resolve thumbnail if YouTube
      const ytId = extractYtId(data.mediaUrl);
      let thumb = data.thumbnailUrl;
      if (!thumb || thumb.startsWith('/src/assets/images/')) {
        thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined;
      }

      const validatedLesson: Lesson = {
        id: lessonId,
        title: data.title.trim(),
        description: data.description || 'Imported lesson for independent listening study.',
        level: (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(data.level)
          ? data.level
          : 'B1') as CEFRLevel,
        mediaType: data.mediaType || (ytId ? 'youtube' : 'audio'),
        mediaUrl: data.mediaUrl.trim(),
        duration: Number(data.duration) || 180,
        trimStart: typeof data.trimStart === 'number' ? data.trimStart : 0,
        trimEnd:
          typeof data.trimEnd === 'number'
            ? data.trimEnd
            : Number(data.duration) || 180,
        preventSkipping: !!data.preventSkipping,
        thumbnailUrl: thumb,
        teacherId: data.teacherId || 'teacher-import',
        teacherName: data.teacherName || 'Instructor Share',
        captions: Array.isArray(data.captions) ? data.captions : [],
        questions: Array.isArray(data.questions) ? data.questions : [],
        difficultWords: Array.isArray(data.difficultWords) ? data.difficultWords : [],
        isPublished: isTeacher ? (data.isPublished !== false) : false,
        isLocalStudentOnly: !isTeacher,
        createdAt: data.createdAt || new Date().toISOString().split('T')[0],
      };

      setParsedLesson(validatedLesson);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse lesson dataset.');
      setParsedLesson(null);
    }
  };

  // Handle uploaded file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readJsonFile(file);
  };

  const readJsonFile = (file: File) => {
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        processRawData(parsed);
      } catch {
        setErrorMessage('Could not parse file as JSON. Please ensure it is a valid .json dataset file.');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  // Handle text paste
  const handleParsePastedText = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste the lesson dataset JSON code.');
      return;
    }
    try {
      const parsed = JSON.parse(pastedText);
      processRawData(parsed);
    } catch {
      setErrorMessage('Invalid JSON format. Please verify you copied the entire dataset code.');
    }
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readJsonFile(file);
    }
  };

  // Trigger import
  const handleFinalImport = (practiceImmediately: boolean) => {
    if (!parsedLesson) return;
    onImport(parsedLesson, practiceImmediately);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Upload className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Import Lesson Dataset</h3>
              <p className="text-xs text-slate-500">
                {isTeacher
                  ? 'Import dataset to your curriculum and publish to all students'
                  : 'Import dataset for personal self-study on this device'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {!parsedLesson ? (
            <>
              {/* Tab Selector */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Upload .JSON File</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'paste'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Paste Dataset Code</span>
                </button>
              </div>

              {/* Upload Tab */}
              {activeTab === 'upload' && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-3 ${
                    isDragging
                      ? 'border-amber-500 bg-amber-50/50'
                      : 'border-slate-300 hover:border-amber-500 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json,application/json"
                    className="hidden"
                  />
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <FileUp className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Click to choose a dataset file, or drag and drop
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Accepts .json and .allears.json files exported from All Ears
                    </p>
                  </div>
                </div>
              )}

              {/* Paste Tab */}
              {activeTab === 'paste' && (
                <div className="space-y-3">
                  <textarea
                    rows={6}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste the lesson dataset JSON code here..."
                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Parse and Verify Dataset
                  </button>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Did your teacher send you a lesson dataset file or code? Importing it creates a local copy on this device with full interactive checkpoints, video captions, and vocabulary cards for independent self-study.
                </p>
              </div>
            </>
          ) : (
            /* Parsed Lesson Preview Card */
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">Dataset verified! Ready to import to your device.</span>
              </div>

              {/* Verified Lesson Card */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                {parsedLesson.thumbnailUrl && (
                  <div className="aspect-video bg-slate-900 relative">
                    <img
                      src={parsedLesson.thumbnailUrl}
                      alt={parsedLesson.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-950/80 text-amber-400 font-mono text-[11px] font-bold">
                      {parsedLesson.level}
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-2">
                  <h4 className="text-sm font-bold text-slate-900">{parsedLesson.title}</h4>
                  <p className="text-xs text-slate-600 line-clamp-2">{parsedLesson.description}</p>

                  <div className="flex items-center gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                      {parsedLesson.questions.length} Checkpoints
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                      {parsedLesson.difficultWords.length} Vocab Cards
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      {Math.floor(parsedLesson.duration / 60)}:{(parsedLesson.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scope & Privacy Banner */}
              {isTeacher ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                  <Globe className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span><strong>Teacher Import:</strong> This lesson will be saved to the central database and can be published to all your students.</span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
                  <Shield className="w-4 h-4 shrink-0 text-amber-700" />
                  <span><strong>Private Self-Study:</strong> This lesson is saved to this device only. It will NOT be uploaded to the server or visible to your teacher or other students.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleFinalImport(true)}
                  className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Import & Start Self-Study Practice Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFinalImport(false)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {isTeacher ? 'Save to Central Curriculum' : 'Save to My Device (Self-Study)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setParsedLesson(null);
                    setPastedText('');
                  }}
                  className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  Choose a different file or dataset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
