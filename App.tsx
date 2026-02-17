import React, { useState, useEffect, useRef } from 'react';
import { extractContentFromFile } from './services/fileParser';
import { analyzeResume } from './services/geminiService';
import { ResumeAnalysisResult, AnalysisStatus } from './types';
import { ThemeToggle } from './components/ThemeToggle';
import { ScoreGauge } from './components/ScoreGauge';
import { FolderUpload } from './components/FolderUpload';
import Silk from './components/Silk';
import resumeIcon from './assets/Resume.png';
import logo from './assets/logo.png';

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [result, setResult] = useState<ResumeAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize theme
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [isDark]);

  // Countdown timer effect
  useEffect(() => {
    if (retryCountdown === null) return;
    
    if (retryCountdown <= 0) {
      setRetryCountdown(null);
      setShowErrorModal(false);
      return;
    }

    const timer = setInterval(() => {
      setRetryCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [retryCountdown]);

  // Back-to-top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      // Reset status if re-selecting after an error or completion
      if (status === 'error' || status === 'success') {
        setStatus('idle');
        setResult(null);
        setErrorMsg(null);
      }
    }
  };

  const startAnalysis = async () => {
    if (!selectedFile) {
        setErrorMsg("Please select a file to analyze.");
        setShowErrorModal(true);
        return;
    }

    try {
      setStatus('parsing');
      setErrorMsg(null);
      
      const content = await extractContentFromFile(selectedFile);

      if (content.type === 'text' && content.content.length < 200) {
        throw new Error("Document is too short to be a valid resume. Please upload a complete resume or CV.");
      }

      setStatus('analyzing');
      const analysis = await analyzeResume(content);

      if (analysis.overallScore === 0 && analysis.overallJustification.startsWith("INVALID_RESUME")) {
        throw new Error("The uploaded document does not appear to be a valid resume or CV. Please upload a professional resume containing sections like Education, Skills, Experience, or Projects.");
      }

      setResult(analysis);
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      
      // Default generic message
      let msg = "An error occurred during analysis.";
      let rawMsg = err.message || "";
      let retrySeconds = 0;

      // Try parsing if it's a JSON string error
      try {
        if (rawMsg.startsWith('{') || rawMsg.startsWith('[')) {
          const parsed = JSON.parse(rawMsg);
          rawMsg = parsed?.error?.message || parsed?.message || rawMsg;
        }
      } catch (_) { /* ignore parse error */ }

      // Check for retry time in the message (e.g. "Please retry in 18.6s")
      const retryMatch = rawMsg.match(/retry in ([0-9.]+)s/i);
      if (retryMatch && retryMatch[1]) {
        retrySeconds = Math.ceil(parseFloat(retryMatch[1]));
      }

      // Categorize and simplify errors
      const lowerMsg = rawMsg.toLowerCase();
      
      if (lowerMsg.includes('quota') || lowerMsg.includes('429') || lowerMsg.includes('rate limit') || lowerMsg.includes('exceeded')) {
        // Quota / Rate Limit - specific short message
        msg = "Too many requests. Please wait a moment and try again.";
        if (retrySeconds > 0) {
            setRetryCountdown(retrySeconds);
        }
      } else if (rawMsg.includes('503') || lowerMsg.includes('unavailable') || lowerMsg.includes('high demand')) {
        msg = "The AI service is currently experiencing high demand. Please try again in a moment.";
      } else if (rawMsg.includes('API Key') || rawMsg.includes('api_key') || rawMsg.includes('401')) {
        msg = "Authentication error. Please check the API configuration.";
      } else if (lowerMsg.includes('network') || lowerMsg.includes('fetch') || lowerMsg.includes('failed to fetch')) {
        msg = "Network error. Please check your connection and try again.";
      } else {
        // Fallback for other errors - show the raw message to help debugging
        msg = rawMsg.slice(0, 500); 
      }

      setErrorMsg(msg);
      setShowErrorModal(true);
      setStatus('error');
      // If no retry time was found but it's a rate limit, we don't set a timer (or could default to 60s if desired)
    }
  };

  const handleDownloadSnapshot = async () => {
    if (!resultsRef.current || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
        const html2canvas = (window as any).html2canvas;
        const jspdf = (window as any).jspdf;
        
        if (!html2canvas || !jspdf) {
            throw new Error("Download libraries not loaded");
        }

        // For light mode, temporarily apply snapshot-light overrides
        const isLightMode = !isDark;
        if (isLightMode && resultsRef.current) {
          resultsRef.current.classList.add('snapshot-light');
        }

        const canvas = await html2canvas(resultsRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            ignoreElements: (element: Element) => element.classList.contains('no-print')
        });

        // Remove the temporary class immediately after capture
        if (isLightMode && resultsRef.current) {
          resultsRef.current.classList.remove('snapshot-light');
        }

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [imgWidth, imgHeight]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        
        // Create Blob URL instead of direct save
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Open new window with custom favicon
        const newWin = window.open('', '_blank');
        if (newWin) {
            newWin.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${fileName || 'Resume'} Analysis Report</title>
                    <link rel="icon" type="image/svg+xml" href="/report-favicon.svg">
                    <style>
                        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background-color: #525659; }
                    </style>
                </head>
                <body>
                    <iframe width="100%" height="100%" src="${pdfUrl}" type="application/pdf" style="border: none;"></iframe>
                </body>
                </html>
            `);
            newWin.document.close();
        } else {
             // Fallback if popup blocked
             const safeFileName = fileName.replace(/\.[^/.]+$/, "") || 'resume';
             pdf.save(`${safeFileName}_analysis_report.pdf`);
        }

    } catch (error) {
        console.error("Snapshot failed:", error);
        setErrorMsg("Failed to generate report. Please try again.");
        setShowErrorModal(true);
    } finally {
        // Always clean up the snapshot class
        if (resultsRef.current) {
          resultsRef.current.classList.remove('snapshot-light');
        }
        setIsDownloading(false);
    }
  };

  const resetAnalysis = () => {
    setStatus('idle');
    setResult(null);
    setFileName('');
    setSelectedFile(null);
  };

  return (
    <div className={`min-h-screen flex flex-col font-display transition-colors duration-[1200ms] ease-in-out ${isDark ? 'bg-gradient-hero-dark' : 'bg-gradient-hero-light'}`}>
      {/* Crossfade Backgrounds — both always mounted, opacity transitions handle the switch */}
      <div className={`silk-bg ${!isDark ? 'bg-active' : 'bg-inactive'}`}>
        <Silk
          speed={5}
          scale={1}
          color="#2B1CDB"
          noiseIntensity={1.5}
          rotation={0}
        />
      </div>
      <div className={`black-hole-bg ${isDark ? 'bg-active' : 'bg-inactive'}`}>
        <div className="black-hole">
          <div className="tunnel">
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
            <div className="ring"></div>
          </div>
          <div className="aura"></div>
          <div className="overlay"></div>
        </div>
      </div>

      {/* Logo - Fixed Top Left */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2 cursor-pointer" onClick={() => { resetAnalysis(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
        <img src={logo} alt="GetCheck.ai Logo" className="w-8 h-8 object-cover rounded-lg shadow-lg ring-1 ring-white/10" />
        <span className="font-bold text-2xl tracking-tighter text-white drop-shadow-md">GetCheck<span className="text-[#60A5FA]">.ai</span></span>
      </div>

      {/* Theme Toggle - Fixed Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle isDark={isDark} toggle={() => setIsDark(!isDark)} />
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16"></div>

      {/* Main Content Area */}
      <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 pb-12">
        
        {/* VIEW: IDLE / LANDING PAGE */}
        {(status === 'idle' || status === 'error') && (
            <div className="relative pt-6 sm:pt-12 lg:pt-20 pb-20 overflow-hidden">
                <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center text-center">

                    {/* Headlines */}
                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white drop-shadow-lg mb-8 max-w-4xl mx-auto leading-tight">
                        Is your resume <br/><span className="text-gradient">Future-Proof?</span>
                    </h1>
                    <p className="text-lg sm:text-xl leading-8 text-slate-200 max-w-2xl mx-auto mb-16 font-medium drop-shadow-md">
                        Our AI disassembles your Resume/ CV and rebuilds it with data-driven precision. Get a score out of 10 instantly. Beat the ATS algorithms and land your dream job faster.
                    </p>

                    {/* Error message is now shown in a modal overlay */}

                    {/* Upload Card */}
                    <div className="w-full max-w-3xl mx-auto perspective-1000">
                        <div className="relative group upload-zone rounded-[2rem] p-8 sm:p-16 transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl">
                             
                            <div className="flex flex-col items-center justify-center space-y-8 text-center relative z-10">
                                
                                {/* New Folder Animation Component */}
                                <FolderUpload onFileChange={handleFileSelection} />

                                <div className="space-y-2 mt-2">
                                    {selectedFile && (
                                        <p className="text-emerald-400 font-bold bg-emerald-950/30 px-4 py-2 rounded-full border border-emerald-500/30 animate-pulse">
                                            Selected: {selectedFile.name}
                                        </p>
                                    )}
                                    <p className="text-base font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                                        Supports multiple formats
                                    </p>
                                </div>
                                <div className="flex gap-6 pt-0 flex-wrap justify-center">
                                    <div className="flex flex-col items-center gap-2 transform transition-transform hover:-translate-y-1 hover:-rotate-3 duration-300">
                                        <div className="w-12 h-14 bg-vibrant-coral rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg relative overflow-hidden border-b-4 border-red-600">
                                           <div className="absolute top-0 right-0 w-4 h-4 bg-white/20 rounded-bl-lg"></div>
                                           PDF
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 transform transition-transform hover:-translate-y-1 hover:rotate-3 duration-300 delay-75">
                                        <div className="w-12 h-14 bg-electric-blue rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg relative overflow-hidden border-b-4 border-blue-700">
                                           <div className="absolute top-0 right-0 w-4 h-4 bg-white/20 rounded-bl-lg"></div>
                                           DOC
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 transform transition-transform hover:-translate-y-1 hover:-rotate-3 duration-300 delay-100">
                                        <div className="w-12 h-14 bg-citrus-yellow rounded-lg flex items-center justify-center text-slate-800 font-bold text-xs shadow-lg relative overflow-hidden border-b-4 border-yellow-500">
                                           <div className="absolute top-0 right-0 w-4 h-4 bg-white/40 rounded-bl-lg"></div>
                                           TXT
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 transform transition-transform hover:-translate-y-1 hover:rotate-3 duration-300 delay-150">
                                        <div className="w-12 h-14 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg relative overflow-hidden border-b-4 border-emerald-700">
                                           <div className="absolute top-0 right-0 w-4 h-4 bg-white/20 rounded-bl-lg"></div>
                                           IMG
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-12 flex flex-col items-center">
                            <button 
                                onClick={startAnalysis}
                                className={`w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 text-lg font-bold text-white transition-all glossy-button rounded-full group cursor-pointer ${!selectedFile ? 'opacity-80 grayscale-[0.3]' : ''}`}
                            >
                                <div className="analyze-icon">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="28" width="28">
                                    <path strokeLinecap="round" strokeWidth="1.5" stroke="currentColor" d="M19.25 9.25V5.25C19.25 4.42157 18.5784 3.75 17.75 3.75H6.25C5.42157 3.75 4.75 4.42157 4.75 5.25V18.75C4.75 19.5784 5.42157 20.25 6.25 20.25H12.25" className="board" />
                                    <path d="M9.18748 11.5066C9.12305 11.3324 8.87677 11.3324 8.81234 11.5066L8.49165 12.3732C8.47139 12.428 8.42823 12.4711 8.37348 12.4914L7.50681 12.8121C7.33269 12.8765 7.33269 13.1228 7.50681 13.1872L8.37348 13.5079C8.42823 13.5282 8.47139 13.5714 8.49165 13.6261L8.81234 14.4928C8.87677 14.6669 9.12305 14.6669 9.18748 14.4928L9.50818 13.6261C9.52844 13.5714 9.5716 13.5282 9.62634 13.5079L10.493 13.1872C10.6671 13.1228 10.6671 12.8765 10.493 12.8121L9.62634 12.4914C9.5716 12.4711 9.52844 12.428 9.50818 12.3732L9.18748 11.5066Z" className="star-2" />
                                    <path d="M11.7345 6.63394C11.654 6.41629 11.3461 6.41629 11.2656 6.63394L10.8647 7.71728C10.8394 7.78571 10.7855 7.83966 10.717 7.86498L9.6337 8.26585C9.41605 8.34639 9.41605 8.65424 9.6337 8.73478L10.717 9.13565C10.7855 9.16097 10.8394 9.21493 10.8647 9.28335L11.2656 10.3667C11.3461 10.5843 11.654 10.5843 11.7345 10.3667L12.1354 9.28335C12.1607 9.21493 12.2147 9.16097 12.2831 9.13565L13.3664 8.73478C13.5841 8.65424 13.5841 8.34639 13.3664 8.26585L12.2831 7.86498C12.2147 7.83966 12.1607 7.78571 12.1354 7.71728L11.7345 6.63394Z" className="star-1" />
                                    <path className="stick" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor" d="M17 14L21.2929 18.2929C21.6834 18.6834 21.6834 19.3166 21.2929 19.7071L20.7071 20.2929C20.3166 20.6834 19.6834 20.6834 19.2929 20.2929L15 16M17 14L15.7071 12.7071C15.3166 12.3166 14.6834 12.3166 14.2929 12.7071L13.7071 13.2929C13.3166 13.6834 13.3166 14.3166 13.7071 14.7071L15 16M17 14L15 16" />
                                  </svg>
                                </div>
                                Analyze My Resume
                            </button>
                            <p className="mt-6 text-xs font-semibold text-slate-300 tracking-wide uppercase flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">lock</span> Encrypted Protection
                            </p>
                        </div>
                    </div>

                    {/* --- WHY USE SECTION --- */}
                    <div className="w-full max-w-6xl mx-auto mt-28 mb-20 px-4">
                        <div className="text-center mb-16">
                            <p className="text-sm font-bold text-blue-400 uppercase tracking-[0.2em] mb-3 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]">Why Use GetCheck.AI?</p>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-lg">
                                Everything you need to <span className="text-gradient">get hired</span>
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Feature 1 — Instant Score */}
                            <div className="group bg-slate-800/60 backdrop-blur-xl border border-slate-600/40 rounded-2xl p-8 hover:border-blue-400/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-blue-500/30 transition-all mt-0.5">
                                        <span className="material-symbols-outlined text-blue-400 text-xl drop-shadow-[0_0_6px_rgba(96,165,250,0.4)]">speed</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-2 drop-shadow-md">Instant Score</h3>
                                        <p className="text-sm text-slate-300 leading-relaxed">Don't wait days for a response. Get a comprehensive score out of 10 within seconds of uploading.</p>
                                    </div>
                                </div>
                            </div>
                            {/* Feature 2 — Keyword Matching */}
                            <div className="group bg-slate-800/60 backdrop-blur-xl border border-slate-600/40 rounded-2xl p-8 hover:border-purple-400/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-purple-500/30 transition-all mt-0.5">
                                        <span className="material-symbols-outlined text-purple-400 text-xl drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]">tune</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-2 drop-shadow-md">Keyword Matching</h3>
                                        <p className="text-sm text-slate-300 leading-relaxed">We identify missing keywords and skills that recruiters and ATS bots are specifically looking for.</p>
                                    </div>
                                </div>
                            </div>
                            {/* Feature 3 — Actionable Fixes */}
                            <div className="group bg-slate-800/60 backdrop-blur-xl border border-slate-600/40 rounded-2xl p-8 hover:border-emerald-400/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-emerald-500/30 transition-all mt-0.5">
                                        <span className="material-symbols-outlined text-emerald-400 text-xl drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">auto_fix_high</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-2 drop-shadow-md">Actionable Fixes</h3>
                                        <p className="text-sm text-slate-300 leading-relaxed">Beyond just a score, we provide specific bullet-point suggestions to improve your wording and impact.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- LIVE DEMO SECTION --- */}
                    <div className="w-full max-w-6xl mx-auto mb-16 px-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                            {/* Left Column — Text */}
                            <div className="space-y-6">
                                <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight drop-shadow-lg">
                                    See the difference a <br/><span className="text-gradient">great resume</span> makes.
                                </h2>
                                <p className="text-base text-slate-300 leading-relaxed max-w-md">
                                    Most resumes get rejected by automated systems before a human ever sees them. We help you beat the bot.
                                </p>
                                <ul className="space-y-4 pt-2">
                                    <li className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-green-400 text-xl drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">check_circle</span>
                                        <span className="text-sm font-medium text-slate-200">Formatting that passes parsing algorithms</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-green-400 text-xl drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">check_circle</span>
                                        <span className="text-sm font-medium text-slate-200">Impact verbs that show leadership</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-green-400 text-xl drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">check_circle</span>
                                        <span className="text-sm font-medium text-slate-200">Quantifiable achievements highlighted</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Right Column — Live Demo Animation */}
                            <div className="relative">
                                <div className="demo-scanner relative rounded-2xl overflow-hidden bg-slate-900/80 backdrop-blur-xl border border-slate-600/30 shadow-2xl shadow-blue-500/5 p-6 sm:p-8 aspect-[4/3]">
                                    {/* Mock resume lines */}
                                    <div className="space-y-4 relative z-10">
                                        
                                        {/* HEADER ROW: Large Icon + Info */}
                                        <div className="flex items-end gap-5">
                                            {/* Large Resume Icon */}
                                            <img
                                              src={resumeIcon}
                                              alt="Resume"
                                              className="w-20 h-auto object-contain rounded-lg shadow-xl ring-1 ring-white/20"
                                              style={{ filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.4))' }}
                                            />
                                            
                                            {/* Right Info Column */}
                                            <div className="flex-1 space-y-3 pb-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="h-4 w-32 bg-white/20 rounded-full demo-shimmer" style={{animationDelay: '0s'}}></div>
                                                    <div className="demo-score-badge px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                                                        <span className="text-emerald-300 font-bold text-sm font-mono">Score: 9/10</span>
                                                    </div>
                                                </div>
                                                {/* Contact line */}
                                                <div className="h-2.5 w-48 bg-white/10 rounded-full demo-shimmer" style={{animationDelay: '0.1s'}}></div>
                                            </div>
                                        </div>
                                        {/* Divider */}
                                        <div className="h-px w-full bg-blue-400/30 demo-scan-line-glow"></div>
                                        {/* Section header */}
                                        <div className="h-3 w-24 bg-white/15 rounded-full demo-shimmer" style={{animationDelay: '0.2s'}}></div>
                                        {/* Content lines */}
                                        <div className="space-y-2.5">
                                            <div className="h-2.5 w-full bg-white/10 rounded-full demo-shimmer" style={{animationDelay: '0.3s'}}></div>
                                            <div className="h-2.5 w-11/12 bg-white/10 rounded-full demo-shimmer" style={{animationDelay: '0.4s'}}></div>
                                            <div className="h-2.5 w-4/5 bg-white/10 rounded-full demo-shimmer" style={{animationDelay: '0.5s'}}></div>
                                        </div>
                                        {/* Section header 2 */}
                                        <div className="h-3 w-28 bg-white/15 rounded-full demo-shimmer" style={{animationDelay: '0.6s'}}></div>
                                        {/* Content lines 2 */}
                                        <div className="space-y-2.5">
                                            <div className="h-2.5 w-full bg-white/10 rounded-full demo-shimmer" style={{animationDelay: '0.7s'}}></div>
                                            <div className="h-2.5 w-10/12 bg-white/10 rounded-full demo-shimmer" style={{animationDelay: '0.8s'}}></div>
                                            <div className="h-2.5 w-3/4 bg-white/10 rounded-full demo-shimmer" style={{animationDelay: '0.9s'}}></div>
                                        </div>
                                    </div>
                                    {/* Scan line sweep */}
                                    <div className="demo-scan-sweep absolute left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_rgba(96,165,250,0.6)]"></div>
                                    {/* Corner scan markers */}
                                    <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-blue-400/50 rounded-tl-sm demo-corner-pulse"></div>
                                    <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-blue-400/50 rounded-tr-sm demo-corner-pulse" style={{animationDelay: '0.5s'}}></div>
                                    <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-blue-400/50 rounded-bl-sm demo-corner-pulse" style={{animationDelay: '1s'}}></div>
                                    <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-blue-400/50 rounded-br-sm demo-corner-pulse" style={{animationDelay: '1.5s'}}></div>
                                </div>
                                {/* Ambient glow behind card */}
                                <div className="absolute -inset-4 bg-blue-500/5 rounded-3xl blur-2xl -z-10 pointer-events-none"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* VIEW: PARSING / ANALYZING (LOADING) */}
        {(status === 'parsing' || status === 'validating' || status === 'analyzing') && (
             <div className="py-24 max-w-7xl mx-auto">
                 <div className="flex flex-col lg:flex-row items-center gap-16 justify-center">
                    <div className="flex-1 space-y-8 max-w-lg">
                        <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                            Analyzing your <br/>
                            <span className="text-[#60A5FA] drop-shadow-[0_2px_8px_rgba(96,165,250,0.4)]">Resume DNA</span>
                        </h2>
                        <div className="space-y-8 bg-black/20 backdrop-blur-sm rounded-2xl p-6 -ml-6 -mr-6">
                           {/* Step 1: Extraction */}
                           <div className="flex items-center gap-6">
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${status === 'parsing' ? 'bg-blue-500 text-white animate-pulse' : 'bg-green-500 text-white'}`}>
                                   <span className="material-symbols-outlined text-2xl">{status === 'parsing' ? 'sync' : 'check'}</span>
                               </div>
                               <div>
                                   <p className="text-lg font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">Extraction</p>
                                   <p className="text-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">Parsing content structure...</p>
                               </div>
                           </div>
                           {/* Step 2: Validation */}
                           <div className="flex items-center gap-6">
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${
                                 status === 'validating' ? 'bg-blue-500 text-white animate-pulse' :
                                 (status === 'analyzing') ? 'bg-green-500 text-white' :
                                 'bg-white/10 backdrop-blur text-slate-400'
                               }`}>
                                   <span className="material-symbols-outlined text-2xl">verified</span>
                               </div>
                               <div>
                                   <p className="text-lg font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">Validation</p>
                                   <p className="text-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">Verifying document is a resume...</p>
                               </div>
                           </div>
                           {/* Step 3: Intelligence */}
                           <div className="flex items-center gap-6">
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${status === 'analyzing' ? 'bg-blue-500 text-white animate-pulse' : 'bg-white/10 backdrop-blur text-slate-400'}`}>
                                   <span className="material-symbols-outlined text-2xl">psychology</span>
                               </div>
                               <div>
                                   <p className="text-lg font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">Intelligence</p>
                                   <p className="text-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">Comparing against job standards...</p>
                               </div>
                           </div>
                           {/* Step 4: Optimization */}
                           <div className="flex items-center gap-6">
                               <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur text-slate-400 shadow-inner">
                                   <span className="material-symbols-outlined text-2xl">auto_fix_high</span>
                               </div>
                               <div>
                                   <p className="text-lg font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">Optimization</p>
                                   <p className="text-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">Generating actionable fixes...</p>
                               </div>
                           </div>
                        </div>
                    </div>
                    
                    {/* Scanning Animation */}
                    <div className="flex-1 w-full max-w-md relative">
                        <div className="relative rounded-[2rem] overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border-4 border-white/20 aspect-[4/5] flex items-center justify-center isolate">
                             <div className="absolute inset-0 bg-white/5 opacity-20"></div>
                             {/* Abstract doc lines */}
                             <div className="w-3/4 space-y-5 opacity-40">
                                 <div className="h-5 bg-white/30 rounded-full w-1/2"></div>
                                 <div className="h-3 bg-white/30 rounded-full w-full"></div>
                                 <div className="h-3 bg-white/30 rounded-full w-full"></div>
                                 <div className="h-32 bg-white/20 rounded-2xl w-full mt-8"></div>
                                 <div className="h-3 bg-white/30 rounded-full w-full"></div>
                                 <div className="h-3 bg-white/30 rounded-full w-5/6"></div>
                             </div>
                             {/* Scanner Bar */}
                             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-electric-blue to-transparent shadow-[0_0_20px_rgba(37,99,235,0.8)] animate-scan"></div>
                             
                             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl shadow-glossy border border-white/20 flex items-center gap-3 whitespace-nowrap">
                                <div className="w-2.5 h-2.5 rounded-full bg-vibrant-coral animate-ping"></div>
                                <span className="text-sm font-bold text-white">AI Processing...</span>
                             </div>
                        </div>
                    </div>
                 </div>
             </div>
        )}

        {/* VIEW: RESULTS DASHBOARD */}
        {status === 'success' && result && (
            <div ref={resultsRef} className="py-8 max-w-7xl mx-auto w-full space-y-12 animate-fade-in-up">
                
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 relative bg-black/15 backdrop-blur-sm rounded-3xl p-6 -mx-2">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-3">
                            <span className="px-4 py-1.5 bg-green-500/20 backdrop-blur text-green-300 text-xs font-bold uppercase tracking-widest rounded-full border border-green-400/30 shadow-sm">Analysis Complete</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">Results Overview</h1>
                        <p className="text-lg text-slate-200 font-light max-w-xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
                            Performance analysis for <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded-lg border-b-2 border-blue-400/40 break-all">{fileName}</span>
                        </p>
                    </div>
                    <div className="flex gap-4 relative z-10 no-print flex-wrap">
                        <button 
                            onClick={handleDownloadSnapshot} 
                            disabled={isDownloading}
                            className="px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full hover:bg-white/20 hover:shadow-md transition-all flex items-center gap-2 font-semibold shadow-sm group"
                        >
                             {isDownloading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">download</span>
                                    Export Report
                                </>
                            )}
                        </button>
                        <button onClick={resetAnalysis} className="px-6 py-3 bg-white text-black rounded-full hover:bg-gray-100 transition-all flex items-center gap-2 font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transform">
                            <span className="material-symbols-outlined text-[20px]">upload_file</span>
                            Re-upload
                        </button>
                    </div>
                </div>

                {/* Score + Verdict Row — compact horizontal layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Score Card — horizontal layout */}
                    <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/15 p-6 sm:p-8 relative overflow-hidden">
                        {/* Decorative Blobs — hidden from PDF export */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-b from-blue-500/10 to-transparent rounded-bl-full opacity-50 pointer-events-none no-print"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-500/10 rounded-tr-full opacity-50 pointer-events-none no-print"></div>
                        
                        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                            {/* Gauge — compact */}
                            <div className="shrink-0">
                                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest mb-3 text-center drop-shadow-md">Overall Score</h2>
                                <div className="w-32 h-32">
                                    <ScoreGauge score={result.overallScore} isDark={isDark} />
                                </div>
                            </div>
                            {/* Score details */}
                            <div className="flex-1 text-center sm:text-left">
                                <h3 className="text-2xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] mb-2">{result.overallScore >= 8 ? 'Excellent Potential' : result.overallScore >= 6 ? 'Good Potential' : 'Needs Improvement'}</h3>
                                <p className="text-sm text-slate-200 leading-relaxed font-light drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)] line-clamp-4">
                                    "{result.overallJustification}"
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Verdict Card — beside score */}
                    <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] shadow-lg border border-white/15 p-6 sm:p-8 flex flex-col justify-center">
                        <h3 className="text-xl font-bold text-white mb-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">Recruiter Verdict</h3>
                        <div className={`p-5 rounded-2xl flex flex-row items-start gap-4 ${
                            result.finalVerdict.strength === 'Strong' ? 'bg-green-500/15 text-green-300' :
                            result.finalVerdict.strength === 'Average' ? 'bg-orange-500/15 text-orange-300' :
                            'bg-red-500/15 text-red-300'
                        }`}>
                            <div className="bg-white/10 p-3 rounded-xl shrink-0">
                               <span className="material-symbols-outlined text-2xl">
                                   {result.finalVerdict.strength === 'Strong' ? 'thumb_up' : result.finalVerdict.strength === 'Average' ? 'thumbs_up_down' : 'thumb_down'}
                               </span>
                            </div>
                            <div>
                                <span className="font-extrabold block text-lg mb-1 uppercase tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">{result.finalVerdict.strength} Candidate</span>
                                <p className="text-base leading-relaxed font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">{result.finalVerdict.impression}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detailed Analysis — full width */}
                <div className="flex flex-col gap-8">
                        
                        {/* Cards Row: Strengths & Improvements */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                            {/* Strengths Card */}
                            <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] shadow-lg border border-white/15 flex flex-col h-full group hover:shadow-xl transition-all duration-300 overflow-hidden">
                                <div className="bg-gradient-card-1 p-6 relative">
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl">
                                            <span className="material-symbols-outlined text-white text-2xl">thumb_up</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">Key Strengths</h3>
                                    </div>
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl no-print"></div>
                                </div>
                                <div className="p-8 pt-6 flex-grow">
                                    <ul className="space-y-6">
                                        {result.sectionAnalysis.flatMap(s => s.strengths).slice(0, 3).map((str, i) => (
                                            <li key={i} className="flex gap-4 items-start">
                                                <div className="mt-1 min-w-[24px]">
                                                    <span className="material-symbols-outlined text-green-400 text-[24px] drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">check_circle</span>
                                                </div>
                                                <div>
                                                    <p className="text-base font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">{str}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            
                            {/* Improvements Card */}
                            <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] shadow-lg border border-white/15 flex flex-col h-full group hover:shadow-xl transition-all duration-300 overflow-hidden">
                                <div className="bg-gradient-card-2 p-6 relative">
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl">
                                            <span className="material-symbols-outlined text-white text-2xl">auto_fix_high</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">Improvements</h3>
                                    </div>
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl no-print"></div>
                                </div>
                                <div className="p-8 pt-6 flex-grow">
                                    <ul className="space-y-6">
                                        {result.sectionAnalysis.flatMap(s => s.weaknesses).slice(0, 3).map((weak, i) => (
                                            <li key={i} className="flex gap-4 items-start">
                                                <div className="mt-1 min-w-[24px]">
                                                    <span className="material-symbols-outlined text-amber-400 text-[24px] drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]">warning</span>
                                                </div>
                                                <div>
                                                    <p className="text-base font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">{weak}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Keyword Match Section */}
                        <div className="bg-white/10 backdrop-blur-xl rounded-[2.5rem] shadow-xl border border-white/15 p-8 lg:p-10 relative">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-50 rounded-t-[2.5rem] no-print"></div>
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-500/20 p-3 rounded-2xl">
                                        <span className="material-symbols-outlined text-purple-300 text-3xl">tag</span>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">Keyword Analysis</h3>
                                        {result.jobMatches?.[0] && (
                                            <p className="text-sm text-slate-300 font-mono mt-1">TARGET: {result.jobMatches[0].role.toUpperCase()}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                {/* Found Keywords */}
                                <div>
                                    <h4 className="font-mono text-sm font-bold text-slate-300 uppercase tracking-widest mb-6 border-b border-white/15 pb-2">Detected in Resume</h4>
                                    <div className="flex flex-wrap gap-3">
                                        {result.keywordAnalysis.found.map((kw, i) => (
                                            <span key={i} className="px-4 py-2 rounded-xl bg-green-500/15 border border-green-400/30 text-green-300 text-sm font-bold shadow-sm">
                                                {kw}
                                            </span>
                                        ))}
                                        {result.keywordAnalysis.found.length === 0 && <span className="text-sm text-slate-400 italic">No strong keywords detected.</span>}
                                    </div>
                                </div>
                                {/* Missing Keywords */}
                                <div>
                                    <h4 className="font-mono text-sm font-bold text-slate-300 uppercase tracking-widest mb-6 border-b border-white/15 pb-2">Recommended Additions</h4>
                                    <div className="flex flex-wrap gap-3">
                                        {result.keywordAnalysis.missing.map((kw, i) => (
                                            <span key={i} className="px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-300 text-sm font-bold shadow-sm">
                                                {kw}
                                            </span>
                                        ))}
                                        {result.keywordAnalysis.missing.length === 0 && <span className="text-sm text-slate-400 italic">No specific recommendations.</span>}
                                    </div>
                                    {result.keywordAnalysis.missing.length > 0 && (
                                        <div className="mt-4 flex items-center gap-2 text-xs text-blue-300 font-medium bg-blue-500/15 w-fit px-3 py-1 rounded-lg">
                                            <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                            Adding these increases match score by ~15%
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Job Role Suitability */}
                        <section>
                             <div className="flex items-center gap-3 mb-8">
                                <h2 className="text-3xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">Alternative Roles</h2>
                                <div className="h-px bg-white/20 flex-grow"></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {result.jobMatches.map((job, idx) => (
                                    <div key={idx} className="bg-white/10 backdrop-blur-xl p-6 rounded-[2rem] border border-white/15 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden">
                                        {/* Decorative Corner */}
                                        <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[4rem] -z-0 transition-colors no-print ${
                                            idx === 0 ? 'bg-blue-500/10 group-hover:bg-blue-500/20' : 
                                            idx === 1 ? 'bg-purple-500/10 group-hover:bg-purple-500/20' : 
                                            'bg-orange-500/10 group-hover:bg-orange-500/20'
                                        }`}></div>
                                        
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className={`p-3 rounded-2xl shadow-lg ${
                                                     idx === 0 ? 'bg-blue-600 text-white shadow-blue-500/30' : 
                                                     idx === 1 ? 'bg-purple-600 text-white shadow-purple-500/30' : 
                                                     'bg-orange-500 text-white shadow-orange-500/30'
                                                }`}>
                                                    <span className="material-symbols-outlined">
                                                        {idx === 0 ? 'design_services' : idx === 1 ? 'code' : 'manage_accounts'}
                                                    </span>
                                                </div>
                                                <span className="text-2xl font-black text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
                                                    {job.matchPercentage}%
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">{job.role}</h3>
                                            <p className="text-sm text-slate-200 leading-relaxed line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">{job.reason}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        
                        {/* Fixes List */}
                        <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] shadow-lg border border-white/15 p-8">
                             <h3 className="text-3xl font-extrabold text-white mb-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">Specific Improvements</h3>
                             <div className="space-y-8">
                                 {result.specificImprovements.map((imp, idx) => (
                                     <div key={idx} className="p-8 bg-white/5 rounded-2xl border border-white/10 hover:border-blue-400/30 transition-colors">
                                         <div className="flex justify-between mb-6">
                                             <span className="text-sm font-bold uppercase tracking-widest text-white bg-white/15 px-4 py-2 rounded-full border border-white/20 shadow-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]">{imp.section}</span>
                                         </div>
                                         <div className="grid lg:grid-cols-2 gap-10">
                                             <div>
                                                 <p className="text-lg font-bold text-red-400 mb-3 uppercase tracking-wider flex items-center gap-2 drop-shadow-[0_1px_4px_rgba(239,68,68,0.3)]">
                                                     <span className="material-symbols-outlined text-2xl drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]">error</span> Issue
                                                 </p>
                                                 <p className="text-lg text-slate-100 font-medium leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">{imp.problem}</p>
                                             </div>
                                             <div className="relative">
                                                 <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-white/15 -ml-5"></div>
                                                 <p className="text-lg font-bold text-emerald-400 mb-3 uppercase tracking-wider flex items-center gap-2 drop-shadow-[0_1px_4px_rgba(52,211,153,0.3)]">
                                                     <span className="material-symbols-outlined text-2xl drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">check_circle</span> Fix
                                                 </p>
                                                 <p className="text-lg text-slate-100 italic leading-relaxed bg-emerald-500/10 p-5 rounded-xl border border-emerald-400/20 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]">"{imp.suggestedRewrite}"</p>
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>

                    </div>
            </div>
        )}
        {/* Back to Top Button */}
        {status === 'success' && (
          <button
            className={`up-btn no-print ${showBackToTop ? 'visible' : ''}`}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Back to top"
          >
            <div className="btn-overlay"></div>
            <div className="icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="icon-main">
                <path d="m5 12 7-7 7 7"></path>
                <path d="M12 19V5"></path>
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="icon-hover">
                <path d="m5 12 7-7 7 7"></path>
                <path d="M12 19V5"></path>
              </svg>
            </div>
          </button>
        )}
      </main>

      {/* ── ERROR MODAL OVERLAY ── */}
      {showErrorModal && errorMsg && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => { setShowErrorModal(false); }}
        >
          <div
            className="relative w-full max-w-sm animate-[errorModalIn_0.35s_ease-out_forwards] overflow-hidden"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(30,20,40,0.92) 0%, rgba(15,23,42,0.96) 100%)'
                : 'linear-gradient(135deg, rgba(255,240,240,0.97) 0%, rgba(255,255,255,0.98) 100%)',
              borderRadius: '1.5rem',
              border: isDark ? '1px solid rgba(255,80,80,0.18)' : '1px solid rgba(255,120,120,0.25)',
              boxShadow: isDark
                ? '0 25px 60px -12px rgba(0,0,0,0.7), 0 0 40px -8px rgba(239,68,68,0.15)'
                : '0 25px 60px -12px rgba(0,0,0,0.15), 0 0 40px -8px rgba(239,68,68,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top accent bar */}
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444 0%, #f97316 50%, #ef4444 100%)' }} />

            <div className="flex flex-col items-center text-center px-8 pt-8 pb-6">
              {/* Error icon */}
              <div
                className="flex items-center justify-center mb-5"
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.08))'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                  border: isDark ? '1.5px solid rgba(239,68,68,0.25)' : '1.5px solid rgba(239,68,68,0.2)',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#ef4444" />
                  <path d="M15 9L9 15M9 9L15 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Title */}
              <h3
                className="text-xl font-bold mb-3"
                style={{ color: isDark ? '#fca5a5' : '#991b1b' }}
              >
                {errorMsg?.includes('does not appear to be a valid resume') || errorMsg?.includes('too short')
                  ? 'Invalid Document'
                  : 'Something went wrong'}
              </h3>

              {/* Message */}
              <div
                className="text-sm leading-relaxed mb-7 max-w-[280px] space-y-1.5"
                style={{ color: isDark ? 'rgba(226,232,240,0.85)' : 'rgba(71,85,105,0.9)' }}
              >
                {errorMsg?.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              {/* Retry Timer */}
              {retryCountdown !== null && retryCountdown > 0 && (
                <div className="mb-6 font-mono text-sm font-bold animate-pulse" style={{ color: isDark ? '#fca5a5' : '#dc2626' }}>
                   You can retry in {retryCountdown}s
                </div>
              )}

              {/* OK Button */}
              <button
                onClick={() => { setShowErrorModal(false); }}
                className="group relative px-10 py-2.5 rounded-full font-semibold text-sm tracking-wide transition-all duration-200"
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#fff',
                  boxShadow: '0 4px 14px -3px rgba(239,68,68,0.4)',
                  border: 'none',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px -3px rgba(239,68,68,0.5)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px -3px rgba(239,68,68,0.4)'; }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;