import React, { useState } from 'react';
import { X, Download, Copy, Check, FileDown, Share2, Sparkles, BookOpen, Clock, HelpCircle } from 'lucide-react';
import { Lesson } from '../types';

interface ExportLessonModalProps {
  lesson: Lesson;
  onClose: () => void;
}

export const ExportLessonModal: React.FC<ExportLessonModalProps> = ({
  lesson,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  // Clean export payload
  const exportPayload = {
    app: 'AllEars',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    lesson: {
      ...lesson,
      // Ensure it is marked as published so students can immediately access it
      isPublished: true,
    },
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);

  // Trigger file download
  const handleDownloadFile = () => {
    try {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const safeTitle = lesson.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
      const filename = `allears-lesson-${safeTitle || 'dataset'}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download file:', e);
    }
  };

  // Copy JSON text to clipboard
  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for clipboard
      const textarea = document.createElement('textarea');
      textarea.value = jsonString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
              <Share2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Export Lesson Dataset</h3>
              <p className="text-xs text-slate-500">
                Share this package with students for self-study and offline homework
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
          {/* Lesson Overview Card */}
          <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-[11px] font-bold font-mono">
                CEFR {lesson.level}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {lesson.mediaType === 'youtube' ? 'YouTube Video' : 'Audio Track'}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              {lesson.title}
            </h4>
            <div className="flex items-center gap-3 text-xs text-slate-600 pt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                {lesson.questions.length} Checkpoints
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                {lesson.difficultWords?.length || 0} Vocab Cards
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                {Math.floor((lesson.trimEnd || lesson.duration) / 60)}:{((lesson.trimEnd || lesson.duration) % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Quick Sharing Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadFile}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Download .JSON File</span>
            </button>

            <button
              onClick={handleCopyClipboard}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span className="text-emerald-300">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Dataset Code</span>
                </>
              )}
            </button>
          </div>

          {/* Student Instructions Explainer */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              How your students use this:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
              <li>Send the downloaded <code className="px-1 py-0.5 bg-white border border-slate-200 rounded text-slate-800">.json</code> file or copied code to your student (via email, messaging, Google Classroom, etc.).</li>
              <li>Your student visits the website on their computer or mobile device.</li>
              <li>They click <strong className="text-slate-800">"Import Lesson"</strong> and upload the file or paste the code.</li>
              <li>The complete lesson, video, checkpoints, and vocabulary load immediately for self-study homework!</li>
            </ol>
          </div>

          {/* Collapsible Raw JSON Data Preview */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowJsonPreview(!showJsonPreview)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <span>{showJsonPreview ? 'Hide Raw Dataset JSON' : 'View Raw Dataset JSON'}</span>
            </button>

            {showJsonPreview && (
              <div className="relative">
                <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                  {jsonString}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
