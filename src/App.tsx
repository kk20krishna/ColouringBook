/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Sparkles, 
  Download, 
  BookOpen, 
  Paintbrush, 
  User, 
  Palette, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';

// --- Types ---
interface GeneratedPage {
  id: number;
  base64: string;
  prompt: string;
}

interface CoverTemplate {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
}

// --- Constants ---
const MODEL_NAME = "gemini-2.5-flash-image";
const PAGE_COUNT = 5;

const TEMPLATES: CoverTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    bgColor: '#f5f5f0',
    textColor: '#282828',
    accentColor: '#f97316'
  },
  {
    id: 'sunshine',
    name: 'Sunshine',
    bgColor: '#fffbeb',
    textColor: '#92400e',
    accentColor: '#f59e0b'
  },
  {
    id: 'sky',
    name: 'Sky',
    bgColor: '#f0f9ff',
    textColor: '#075985',
    accentColor: '#0ea5e9'
  },
  {
    id: 'berry',
    name: 'Berry',
    bgColor: '#fdf2f8',
    textColor: '#9d174d',
    accentColor: '#ec4899'
  }
];

const hexToRgb = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const FireworksBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: any[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
      gravity: number;
      friction: number;

      constructor(x: number, y: number, color: string) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.color = color;
        this.gravity = 0.05;
        this.friction = 0.98;
      }

      update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.01;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F43', '#A29BFE'];

    const createFirework = () => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * (canvas.height * 0.5);
      const color = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < 30; i++) {
        particles.push(new Particle(x, y, color));
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (Math.random() < 0.02) {
        createFirework();
      }

      particles = particles.filter(p => p.alpha > 0);
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0 opacity-40"
    />
  );
};

const PRESET_THEMES = [
  "Barbie",
  "Peppa Pig",
  "Mowgli",
  "Like Nastya",
  "Paw Patrol",
  "Frozen",
  "Spider-Man",
  "Bluey",
  "Cocomelon",
  "Pokémon"
];

export default function App() {
  const [childName, setChildName] = useState('');
  const [theme, setTheme] = useState('');
  const [pageCount, setPageCount] = useState(5);
  const [bgColor, setBgColor] = useState(TEMPLATES[0].bgColor);
  const [textColor, setTextColor] = useState(TEMPLATES[0].textColor);
  const [accentColor, setAccentColor] = useState(TEMPLATES[0].accentColor);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  const generateSinglePage = async (pageIndex: number, userTheme: string): Promise<GeneratedPage> => {
    // Variety in prompts
    const variations = [
      `A main character ${userTheme} coloring page`,
      `A scenic background of ${userTheme} coloring page`,
      `An action scene with ${userTheme} coloring page`,
      `A close up detail of ${userTheme} coloring page`,
      `A group of characters in ${userTheme} coloring page`
    ];

    const prompt = `Black and white coloring book page for children. Simple line art, thick black outlines, no shading, no gradients, white background. Subject: ${variations[pageIndex % variations.length]}. High contrast, easy to color.`;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      let base64 = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64 = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!base64) throw new Error("No image data received from AI");

      return {
        id: pageIndex,
        base64,
        prompt
      };
    } catch (err) {
      console.error(`Error generating page ${pageIndex}:`, err);
      throw err;
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName || !theme) return;

    setIsGenerating(true);
    setProgress(0);
    setPages([]);
    setError(null);

    const newPages: GeneratedPage[] = [];
    
    try {
      // Generate pages one by one to show progress and avoid hitting rate limits too hard
      for (let i = 0; i < pageCount; i++) {
        const page = await generateSinglePage(i, theme);
        newPages.push(page);
        setPages([...newPages]);
        setProgress(((i + 1) / pageCount) * 100);
      }
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C']
      });
    } catch (err) {
      setError("Oops! Something went wrong while generating the coloring book. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const bgRgb = hexToRgb(bgColor);
    const textRgb = hexToRgb(textColor);

    // --- Cover Page ---
    doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
    doc.setFontSize(32);
    doc.text(`${childName}'s`, pageWidth / 2, 80, { align: 'center' });
    
    doc.setFontSize(48);
    doc.text("Coloring Book", pageWidth / 2, 105, { align: 'center' });
    
    doc.setFontSize(18);
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2], 0.7);
    doc.text(`Theme: ${theme}`, pageWidth / 2, 130, { align: 'center' });

    // Add a decorative border or simple illustration if we had one, 
    // but for now let's use the first generated image as a small preview on cover
    if (pages.length > 0) {
      doc.addImage(pages[0].base64, 'PNG', pageWidth / 4, 150, pageWidth / 2, pageWidth / 2);
    }

    doc.setFontSize(12);
    doc.setTextColor(textRgb[0], textRgb[1], textRgb[2], 0.5);
    doc.text("Generated with AI Magic", pageWidth / 2, pageHeight - 20, { align: 'center' });

    // --- Coloring Pages ---
    pages.forEach((page) => {
      doc.addPage();
      // Add a simple border
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
      
      // Add the image
      // We want to maintain aspect ratio. Our images are 1:1.
      const imgSize = pageWidth - 40;
      const x = 20;
      const y = (pageHeight - imgSize) / 2;
      
      doc.addImage(page.base64, 'PNG', x, y, imgSize, imgSize);
      
      // Footer on each page
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page for ${childName}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
    });

    doc.save(`${childName}_Coloring_Book.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-slate-900 font-sans selection:bg-orange-100 relative overflow-x-hidden">
      <FireworksBackground />
      
      {/* Header */}
      <header className="max-w-4xl mx-auto pt-12 px-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 text-orange-600 text-sm font-medium mb-6"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI-Powered Creativity</span>
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 mb-4">
          <motion.span
            animate={{ 
              y: [0, -8, 0],
              color: ["#0f172a", "#f97316", "#0f172a"]
            }}
            transition={{ 
              duration: 5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="inline-block"
          >
            Aaru & Aadhvi's
          </motion.span> <br />
          <span className="text-orange-500">Coloring Book</span> Generator
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
          Turn any imagination into a personalized coloring adventure for your little ones.
        </p>
      </header>

      <main className="max-w-4xl mx-auto py-12 px-6">
        {/* Input Section */}
        <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-100 p-8 md:p-10 mb-12 relative z-10">
          <form onSubmit={handleGenerate} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  <User className="w-4 h-4 text-orange-500" />
                  Child's Name
                </label>
                <input 
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="e.g. Aaru"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-orange-200 focus:ring-4 focus:ring-orange-50 transition-all outline-none text-lg"
                  required
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-orange-500" />
                  Number of Pages
                </label>
                <select
                  value={pageCount}
                  onChange={(e) => setPageCount(Number(e.target.value))}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-orange-200 focus:ring-4 focus:ring-orange-50 transition-all outline-none text-lg appearance-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num}>{num} Page{num > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  <Palette className="w-4 h-4 text-orange-500" />
                  Book Theme
                </label>
                <input 
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="e.g. Space Dinosaurs"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-orange-200 focus:ring-4 focus:ring-orange-50 transition-all outline-none text-lg"
                  required
                />
                <div className="flex flex-wrap gap-2 pt-2">
                  {PRESET_THEMES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTheme(preset)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        theme === preset 
                          ? 'bg-orange-500 text-white shadow-sm' 
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

            {/* Template Selection */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-orange-500" />
                  Customize Cover
                </label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Presets */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Presets</span>
                  <div className="grid grid-cols-2 gap-3">
                    {TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setBgColor(template.bgColor);
                          setTextColor(template.textColor);
                          setAccentColor(template.accentColor);
                        }}
                        className={`p-3 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                          bgColor === template.bgColor && textColor === template.textColor
                            ? 'border-orange-500 bg-orange-50/30' 
                            : 'border-slate-100 hover:border-slate-200 bg-white'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg border border-slate-200 shrink-0" style={{ backgroundColor: template.bgColor }} />
                        <span className={`text-sm font-bold ${bgColor === template.bgColor ? 'text-orange-600' : 'text-slate-600'}`}>
                          {template.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Pickers */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custom Palette</span>
                  <div className="flex gap-6">
                    <div className="flex flex-col gap-2 items-center">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                        <input 
                          type="color" 
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Background</span>
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                        <input 
                          type="color" 
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Text</span>
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                        <input 
                          type="color" 
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Accent</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isGenerating}
              className="w-full py-5 rounded-2xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center gap-3 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Generating Magic...
                </>
              ) : (
                <>
                  <Paintbrush className="w-6 h-6" />
                  Create My Coloring Book
                </>
              )}
            </button>
          </form>
        </section>

        {/* Progress & Error */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-12 space-y-4"
            >
              <div className="flex justify-between items-end mb-2">
                <span className="text-slate-600 font-medium">Drawing page {Math.min(Math.floor(progress / (100 / pageCount)) + 1, pageCount)} of {pageCount}...</span>
                <span className="text-orange-600 font-bold">{Math.round(progress)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-orange-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-center text-slate-400 text-sm italic">
                "Our AI artists are working hard on your thick lines!"
              </p>
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-12 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="font-medium">{error}</p>
              <button 
                onClick={() => handleGenerate({ preventDefault: () => {} } as any)}
                className="ml-auto p-2 hover:bg-red-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        {pages.length > 0 && (
          <motion.section 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-10"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Your Coloring Book is Ready!</h2>
                <p className="text-slate-500">Preview the pages below before downloading.</p>
              </div>
              <button 
                onClick={downloadPDF}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-orange-500 text-white font-bold rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 active:scale-[0.98]"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {pages.map((page, idx) => (
                <motion.div 
                  key={page.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group relative aspect-square bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <img 
                    src={page.base64} 
                    alt={`Coloring page ${idx + 1}`}
                    className="w-full h-full object-contain p-4"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-white/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Page {idx + 1}</span>
                  </div>
                </motion.div>
              ))}
              
              {/* Cover Preview Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="aspect-square rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-xl border border-slate-100"
                style={{ backgroundColor: bgColor }}
              >
                <BookOpen className="w-12 h-12 mb-4" style={{ color: accentColor }} />
                <h3 className="text-xl font-bold mb-1" style={{ color: textColor }}>{childName}'s</h3>
                <p className="text-sm uppercase tracking-widest font-medium opacity-60" style={{ color: textColor }}>Coloring Book</p>
                <div className={`mt-6 flex items-center gap-2 text-xs font-mono bg-white/50 px-3 py-1 rounded-full`} style={{ color: accentColor }}>
                  <CheckCircle2 className="w-3 h-3" />
                  {pages.length} CUSTOM PAGES
                </div>
              </motion.div>
            </div>
          </motion.section>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto py-12 px-6 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-sm">
          Made with ❤️ for Aaru & Aadhvi. <br />
          Powered by Gemini 2.5 Flash Image.
        </p>
      </footer>
    </div>
  );
}
