'use client';

import { useState } from 'react';
import jsPDF from 'jspdf';
import sampleTranscript from '@/data/sample-transcript.json';

interface Course {
  courseCode: string;
  courseTitle: string;
  credits: number;
  grade: string;
}

interface Match {
  studentCourse: Course;
  uwEquivalent: string;
  uwTitle: string;
  transferCredits: number;
  category: string;
  matchType: 'exact' | 'semantic' | 'elective' | 'review';
  reasoning: string;
}

interface MatchResult {
  matches: Match[];
  summary: {
    totalCreditsAttempted: number;
    totalCreditsTransferred: number;
    directTransfers: number;
    electiveCredits: number;
    needsReview: number;
    degreeApplicable?: number;
    unappliedCredits?: number;
  };
}

export default function Home() {
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [studentName, setStudentName] = useState('');
  const [major, setMajor] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'report'>('input');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [advisorEmail, setAdvisorEmail] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('file');
  const [logs, setLogs] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');

  const buildSummary = (result: MatchResult) => {
    const exact = result.matches.filter((m) => m.matchType === 'exact');
    const electives = result.matches.filter((m) => m.matchType === 'elective');
    const reviews = result.matches.filter((m) => m.matchType === 'review');
    const semantic = result.matches.filter((m) => m.matchType === 'semantic');
    const applied = Math.min(result.summary.totalCreditsTransferred, 90);
    const reviewCourses = reviews.slice(0, 4).map((m) => m.studentCourse.courseCode).join(', ');
    const exactCourses = exact.slice(0, 4).map((m) => m.studentCourse.courseCode).join(', ');
    return [
      `${applied} credits will apply toward UW (max 90).`,
      exact.length ? `Exact: ${exact.length}${exactCourses ? ` (e.g., ${exactCourses})` : ''}.` : '',
      semantic.length ? `Semantic matches: ${semantic.length}.` : '',
      electives.length ? `Electives: ${electives.length}.` : '',
      reviews.length ? `Needs review: ${reviews.length}${reviewCourses ? ` (e.g., ${reviewCourses})` : ''}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  const isSubmitDisabled =
    loading || (inputMode === 'file' ? !transcriptFile : !transcriptText);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 8));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTranscriptFile(e.target.files[0]);
    }
  };

  const useDemoData = async () => {
    setLoading(true);
    addLog('Starting demo flow with sample Bellevue transcript.');
    try {
      const courses = (sampleTranscript as { courses: Course[] }).courses;

      // Match courses
      const matchRes = await fetch('/api/match-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses, major: major || 'Computer Science' }),
      });
      const result = await matchRes.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setMatchResult(result);
      setStep('report');
      addLog(`Matched ${result.matches.length} courses from demo data.`);
    } catch (error) {
      console.error('Error:', error);
      addLog('Demo flow failed.');
      alert('Failed to process demo data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    addLog('Uploading transcript and starting parsing...');
    try {
      let courses;

      if (inputMode === 'file' && transcriptFile) {
        // Parse uploaded file
        const formData = new FormData();
        formData.append('file', transcriptFile);

        const parseRes = await fetch('/api/parse-transcript-file', {
          method: 'POST',
          body: formData,
        });
        const data = await parseRes.json();
        courses = data.courses;
      } else {
        // Parse text input
        const parseRes = await fetch('/api/parse-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcriptText }),
        });
        const data = await parseRes.json();
        courses = data.courses;
      }

      addLog(`Parsed ${courses?.length || 0} courses. Matching with UW equivalencies...`);

      // Step 2: Match courses
      const matchRes = await fetch('/api/match-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses, major }),
      });
      const result = await matchRes.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setMatchResult(result);
      setAiSummary(buildSummary(result));
      setStep('report');
      addLog(`Matched ${result.matches.length} courses. Credits transferable: ${result.summary.totalCreditsTransferred}.`);
    } catch (error) {
      console.error('Error:', error);
      addLog('Processing failed. Check network/API key.');
      alert('Failed to process transcript. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateAdvisorRequest = async () => {
    if (!matchResult) return;

    setLoading(true);
    addLog('Generating advisor email draft...');
    try {
      const res = await fetch('/api/generate-advisor-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matches: matchResult.matches,
          studentName,
          major,
        }),
      });
      const { emailBody } = await res.json();
      setAdvisorEmail(emailBody);
      addLog('Advisor email draft ready.');
    } catch (error) {
      console.error('Error:', error);
      addLog('Failed to generate advisor email.');
      alert('Failed to generate advisor request.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!matchResult) return;

    const doc = new jsPDF();
    let y = 16;

    doc.setFontSize(18);
    doc.text('UW Transfer Credit Evaluation Report', 14, y);
    y += 10;

    doc.setFontSize(11);
    doc.text(`Student: ${studentName || 'N/A'}`, 14, y);
    y += 6;
    doc.text(`Intended Major: ${major || 'Undeclared'}`, 14, y);
    y += 10;

    const summary = [
      ['Attempted', `${matchResult.summary.totalCreditsAttempted}`],
      ['Transferred', `${matchResult.summary.totalCreditsTransferred}`],
      ['Direct Transfers', `${matchResult.summary.directTransfers}`],
      ['Elective Credits', `${matchResult.summary.electiveCredits}`],
      ['Needs Review', `${matchResult.summary.needsReview}`],
      ['Applicable (max 90)', `${Math.min(matchResult.summary.totalCreditsTransferred, 90)}`],
      ['Exceeds 90-Cap', `${Math.max(matchResult.summary.totalCreditsTransferred - 90, 0)}`],
    ];

    doc.setFontSize(12);
    doc.text('Summary', 14, y);
    y += 6;
    doc.setFontSize(10);
    summary.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`, 16, y);
      y += 6;
    });

    y += 4;
    doc.setFontSize(12);
    doc.text('Course Matches', 14, y);
    y += 6;
    doc.setFontSize(10);

    matchResult.matches.forEach((match, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        doc.setFontSize(10);
      }
      doc.text(`${idx + 1}. ${match.studentCourse.courseCode} - ${match.studentCourse.courseTitle}`, 16, y);
      y += 5;
      doc.text(`   UW: ${match.uwEquivalent} — ${match.uwTitle}`, 16, y);
      y += 5;
      doc.text(`   Credits: ${match.transferCredits} | Type: ${match.matchType.toUpperCase()} | Grade: ${match.studentCourse.grade}`, 16, y);
      y += 5;
      doc.text(`   Reason: ${match.reasoning}`, 16, y);
      y += 8;
    });

    doc.save('uw-transfer-evaluation.pdf');
  };

  if (step === 'input') {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#b7a57a]">
                University of Washington
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Transfer Evaluation Portal
              </h1>
              <p className="text-slate-300 max-w-2xl">
                Upload your transcript to instantly map your credits to UW equivalents.
                Get a clean report and an advisor-ready email in minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-100">
                Private upload • PDF or image
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-300">Step 1</p>
                  <h2 className="text-2xl font-semibold text-white">Upload transcript &amp; details</h2>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-[#4b2e83]/30 text-[#f0e6ff] border border-[#4b2e83]/50">
                  Secure
                </span>
              </div>

              <div className="grid lg:grid-cols-[0.9fr,1.1fr] gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-100">Your Name</label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#b7a57a]/60 focus:border-transparent transition"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-100">Intended Major</label>
                    <input
                      type="text"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#b7a57a]/60 focus:border-transparent transition"
                      placeholder="Computer Science"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setInputMode('file')}
                      className={`flex-1 py-3 rounded-xl font-semibold transition border ${
                        inputMode === 'file'
                          ? 'bg-[#4b2e83] border-[#b7a57a]/60 text-white shadow-lg shadow-[#4b2e83]/40'
                          : 'bg-white/5 border-white/10 text-slate-200 hover:border-[#b7a57a]/40'
                      }`}
                    >
                      Upload File
                    </button>
                    <button
                      onClick={() => setInputMode('text')}
                      className={`flex-1 py-3 rounded-xl font-semibold transition border ${
                        inputMode === 'text'
                          ? 'bg-[#4b2e83] border-[#b7a57a]/60 text-white shadow-lg shadow-[#4b2e83]/40'
                          : 'bg-white/5 border-white/10 text-slate-200 hover:border-[#b7a57a]/40'
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    className="w-full bg-gradient-to-r from-[#4b2e83] via-[#5c3ca3] to-[#b7a57a] hover:brightness-110 disabled:from-slate-600 disabled:via-slate-600 disabled:to-slate-600 text-white font-semibold py-3 rounded-xl transition duration-200 shadow-lg shadow-[#4b2e83]/40"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-3">
                        <svg
                          className="animate-spin h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Analyzing...</span>
                      </div>
                    ) : (
                      'Evaluate Transfer Credits'
                    )}
                  </button>

                  {loading && (
                    <div className="space-y-2">
                      <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#4b2e83] to-[#b7a57a] h-2.5 rounded-full animate-pulse" style={{ width: '90%' }}></div>
                      </div>
                      <p className="text-sm text-slate-300 text-center">
                        AI is parsing your transcript and matching courses...
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {inputMode === 'file' ? (
                    <div className="relative border border-white/10 rounded-2xl p-6 text-center bg-gradient-to-br from-[#101530] to-[#0b0f21] shadow-inner">
                      <input
                        type="file"
                        id="transcript-upload"
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label htmlFor="transcript-upload" className="cursor-pointer block">
                        <div className="text-slate-200 space-y-2">
                          <div className="flex items-center justify-center">
                            <div className="h-12 w-12 rounded-full bg-[#4b2e83]/30 border border-[#b7a57a]/30 flex items-center justify-center text-[#b7a57a] text-2xl">
                              +
                            </div>
                          </div>
                          <p className="text-lg font-semibold">
                            {transcriptFile ? transcriptFile.name : 'Drop or click to upload your transcript'}
                          </p>
                          <p className="text-sm text-slate-400">
                            PDF (preferred) or image (PNG, JPG, WebP, GIF)
                          </p>
                        </div>
                        <div className="mt-4 grid grid-cols-3 text-xs text-slate-500 border-t border-white/5 pt-3">
                          <div>Max 20MB</div>
                          <div className="text-center">Secure upload</div>
                          <div className="text-right">Auto-detect format</div>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <textarea
                      value={transcriptText}
                      onChange={(e) => setTranscriptText(e.target.value)}
                      className="w-full h-full min-h-[280px] px-4 py-3 rounded-xl bg-[#0f1325]/80 border border-white/10 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#b7a57a]/60 focus:border-transparent font-mono text-sm transition"
                      placeholder="Paste your unofficial transcript here...&#10;&#10;MATH& 151 - Calculus I - 5 credits - Grade: A&#10;ENGL& 101 - English Composition - 5 credits - Grade: B+&#10;CS& 141 - Computer Science I - 4 credits - Grade: A"
                    />
                  )}
                </div>
              </div>
            </div>

          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold text-white">What you get</h3>
                <span className="text-xs px-3 py-1 rounded-full bg-[#b7a57a]/20 text-[#f0e6d5] border border-[#b7a57a]/40">
                    Instant
                  </span>
                </div>
                <ul className="space-y-2.5 text-slate-200">
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#b7a57a]"></span>
                    <div>
                      <p className="font-semibold text-white">UW-aligned course matches</p>
                      <p className="text-sm text-slate-400">Exact, semantic, elective, or review flags with reasoning.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#b7a57a]"></span>
                    <div>
                      <p className="font-semibold text-white">Advisor-ready output</p>
                      <p className="text-sm text-slate-400">PDF report plus email draft for courses needing review.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="bg-[#0f1325]/80 border border-white/10 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Activity log</h3>
                  <span className="text-xs text-slate-400">Latest</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {logs.length === 0 ? (
                    <p className="text-sm text-slate-400">Actions will appear here while we parse and match.</p>
                  ) : (
                    logs.map((log, idx) => (
                      <p key={idx} className="text-sm text-slate-200">
                        {log}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10">
      {loading && (
        <div className="fixed top-4 right-4 z-50 pointer-events-none">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-[#0f1325]/90 border border-white/10 shadow-xl text-slate-100">
            <svg
              className="animate-spin h-4 w-4 text-[#b7a57a]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-sm">Parsing transcript and matching courses...</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#b7a57a]">Evaluation Ready</p>
            <h1 className="text-4xl font-bold text-white">Transfer Evaluation Report</h1>
            <p className="text-slate-300">
              {studentName || 'Student'} • {major || 'Undeclared'}
            </p>
            {aiSummary && (
              <p className="text-sm text-slate-200 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                {aiSummary}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={downloadPDF}
              className="px-5 py-3 rounded-full bg-gradient-to-r from-[#4b2e83] to-[#5c3ca3] text-white font-semibold border border-[#b7a57a]/40 hover:brightness-110 transition shadow-lg shadow-[#4b2e83]/30"
            >
              Download PDF
            </button>
            <button
              onClick={() => {
                setStep('input');
                setMatchResult(null);
                setAdvisorEmail('');
                setTranscriptFile(null);
                setTranscriptText('');
              }}
              className="px-5 py-3 rounded-full bg-white/10 text-white font-semibold border border-white/15 hover:border-[#b7a57a]/50 transition"
            >
              New Evaluation
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#4b2e83]/30 border border-[#b7a57a]/40 rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-[#e5ddc5]">Credits Attempted</p>
            <div className="text-4xl font-bold text-white">
              {matchResult?.summary.totalCreditsAttempted}
            </div>
          </div>
          <div className="bg-green-400/15 border border-green-400/40 rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-green-200">Credits Transferred</p>
            <div className="text-4xl font-bold text-green-100">
              {matchResult?.summary.totalCreditsTransferred}
            </div>
          </div>
          <div className="bg-blue-400/15 border border-blue-400/40 rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-blue-100">Direct Transfers</p>
            <div className="text-4xl font-bold text-blue-100">
              {matchResult?.summary.directTransfers}
            </div>
          </div>
          <div className="bg-rose-400/15 border border-rose-300/50 rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-rose-100">Needs Review</p>
            <div className="text-4xl font-bold text-rose-50">
              {matchResult?.summary.needsReview}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-amber-400/15 border border-amber-300/50 rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-amber-100">Elective Credits</p>
            <div className="text-4xl font-bold text-amber-50">
              {matchResult?.summary.electiveCredits}
            </div>
          </div>
          <div className="bg-emerald-400/15 border border-emerald-300/50 rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-emerald-100">Applicable to Degree (max 90)</p>
            <div className="text-4xl font-bold text-emerald-50">
              {Math.min(matchResult?.summary.totalCreditsTransferred || 0, 90)}
            </div>
          </div>
          <div className="bg-rose-400/15 border border-rose-300/50 rounded-2xl p-5 shadow-xl">
            <p className="text-sm text-rose-100">Exceeds 90-Credit Cap</p>
            <div className="text-4xl font-bold text-rose-50">
              {Math.max((matchResult?.summary.totalCreditsTransferred || 0) - 90, 0)}
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-7 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Course Matches</h2>
              <p className="text-sm text-slate-400">Mapped using UW Bellevue College equivalency guide.</p>
            </div>
            <div className="flex gap-2 text-xs text-slate-300">
              <span className="px-3 py-1 rounded-full bg-green-400/20 text-green-100">Exact</span>
              <span className="px-3 py-1 rounded-full bg-blue-400/20 text-blue-100">Semantic</span>
              <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-50">Elective</span>
              <span className="px-3 py-1 rounded-full bg-rose-400/20 text-rose-50">Review</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {matchResult?.matches.map((match, idx) => {
              const badgeStyles =
                match.matchType === 'exact'
                  ? 'bg-green-400/15 border-green-300/40 text-green-50'
                  : match.matchType === 'semantic'
                  ? 'bg-blue-400/15 border-blue-300/40 text-blue-50'
                  : match.matchType === 'elective'
                  ? 'bg-amber-400/20 border-amber-300/40 text-amber-50'
                  : 'bg-rose-400/15 border-rose-300/40 text-rose-50';

              return (
                <div
                  key={idx}
                  className={`border rounded-xl p-4 bg-white/5 border-white/10`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm text-slate-400">#{idx + 1}</div>
                        <div className="px-3 py-1 rounded-full border border-white/15 bg-white/5 text-xs text-slate-200">
                          {match.studentCourse.credits} credits
                        </div>
                        <div className="px-3 py-1 rounded-full border border-white/15 bg-white/5 text-xs text-slate-200">
                          Grade: {match.studentCourse.grade}
                        </div>
                      </div>
                      <div className="text-lg font-semibold text-white">
                        {match.studentCourse.courseCode} • {match.studentCourse.courseTitle}
                      </div>
                      <div className="text-sm text-[#b7a57a] font-semibold">
                        → {match.uwEquivalent}: {match.uwTitle}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{match.reasoning}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${badgeStyles}`}
                    >
                      {match.matchType.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <button
            onClick={generateAdvisorRequest}
            disabled={loading || matchResult?.summary.needsReview === 0}
            className="flex-1 bg-[#4b2e83] hover:brightness-110 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition border border-[#b7a57a]/50 shadow-lg shadow-[#4b2e83]/30"
          >
            {loading ? 'Generating advisor email...' : 'Generate Advisor Request'}
          </button>
          <button
            onClick={() => {
              setStep('input');
              setMatchResult(null);
              setAdvisorEmail('');
              setTranscriptFile(null);
              setTranscriptText('');
              setAiSummary('');
            }}
            className="flex-1 bg-white/10 hover:border-[#b7a57a]/50 text-white font-semibold py-3 px-6 rounded-xl transition border border-white/15"
          >
            Start New Evaluation
          </button>
        </div>

        {advisorEmail && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">Advisor Request Email</h2>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(advisorEmail);
                  alert('Email copied to clipboard!');
                }}
                className="px-4 py-2 rounded-xl bg-[#b7a57a]/20 text-[#f0e6d5] border border-[#b7a57a]/40 hover:bg-[#b7a57a]/30 transition font-semibold"
              >
                Copy to Clipboard
              </button>
            </div>
            <div className="bg-[#0f1325]/80 p-5 rounded-xl border border-white/10 whitespace-pre-wrap font-mono text-sm text-slate-100">
              {advisorEmail}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
