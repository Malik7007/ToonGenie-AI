
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AgeGroup,
  AnimationStyle,
  GenerationStage,
  Story,
  Character,
  Scene,
  AIProvider,
  AIAssignments,
  AIModel,
  Language,
  StoryTone,
  CameraAngle
} from './types';
import {
  generateStoryScript,
  generateCharacterImage,
  generateSceneImage,
  animateScene,
  generateVoiceover,
  generateBackgroundMusic,
  decodePCM,
  fetchAvailableModels
} from './aiService';

const SAMPLES = [
  { title: "Milo's Magic Brush", prompt: "A boy finds a magic paintbrush...", icon: "🎨" },
  { title: "Space Penguin", prompt: "Pippin the Penguin on the Moon...", icon: "🚀" },
  { title: "Robot's Bakery", prompt: "Rusty the robot's funny bakery...", icon: "🍰" }
];

// --- Components ---

const Badge = ({ children, color = "indigo" }: { children: React.ReactNode, color?: string, [key: string]: any }) => (
  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-${color}-500/30 bg-${color}-500/10 text-${color}-400`}>
    {children}
  </span>
);

const SectionHeader = ({ icon, title, subtitle }: { icon: string, title: string, subtitle: string }) => (
  <div className="mb-10">
    <div className="flex items-center space-x-4 mb-2">
      <div className="w-12 h-12 glass-panel flex items-center justify-center text-2xl shadow-xl">{icon}</div>
      <h2 className="text-3xl font-black tracking-tighter text-white">{title}</h2>
    </div>
    <p className="text-slate-400 font-medium ml-16">{subtitle}</p>
  </div>
);

// --- Main App ---

export default function App() {
  // Config State
  const [prompt, setPrompt] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(AgeGroup.KIDS);
  const [style, setStyle] = useState<AnimationStyle>(AnimationStyle.TWO_D);
  const [tone, setTone] = useState<StoryTone>(StoryTone.WHIMSICAL);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [stage, setStage] = useState<GenerationStage>(GenerationStage.IDLE);
  const [progress, setProgress] = useState(0);
  const [story, setStory] = useState<Story | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showTheater, setShowTheater] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // API State
  const [apiKeys, setApiKeys] = useState({
    gemini: localStorage.getItem('toa_gemini_key') || "",
    openrouter: localStorage.getItem('toa_or_key') || "",
    groq: localStorage.getItem('toa_groq_key') || "",
    openai: localStorage.getItem('toa_openai_key') || "",
    ollamaBase: localStorage.getItem('toa_ollama_base') || "http://localhost:11434"
  });

  const [assignments, setAssignments] = useState<AIAssignments>({
    scripting: { provider: AIProvider.GEMINI, modelId: "gemini-1.5-pro" },
    visuals: { provider: AIProvider.GEMINI, modelId: "gemini-2.0-flash-exp" },
    audio: { provider: AIProvider.GEMINI, modelId: "gemini-2.5-flash-preview-audio" },
    motion: { provider: AIProvider.GEMINI, modelId: "veo-3.1-fast-generate-preview" }
  });

  const [availableModels, setAvailableModels] = useState<Partial<Record<AIProvider, AIModel[]>>>({});
  const [fetchingModels, setFetchingModels] = useState<Partial<Record<AIProvider, boolean>>>({});

  // --- Actions ---

  const refreshModels = async (provider: AIProvider) => {
    let key = apiKeys.gemini;
    if (provider === AIProvider.OPENROUTER) key = apiKeys.openrouter;
    if (provider === AIProvider.GROQ) key = apiKeys.groq;
    if (provider === AIProvider.OPENAI) key = apiKeys.openai;

    // For Ollama, we check the base URL instead of a key
    if (provider !== AIProvider.OLLAMA && !key) return;

    setFetchingModels(prev => ({ ...prev, [provider]: true }));
    try {
      const models = await fetchAvailableModels(provider, key, apiKeys.ollamaBase);
      setAvailableModels(prev => ({ ...prev, [provider]: models }));
    } catch (e) {
      console.error(`Failed to fetch models for ${provider}`);
    } finally {
      setFetchingModels(prev => ({ ...prev, [provider]: false }));
    }
  };

  useEffect(() => {
    if (showSettings) {
      Object.values(AIProvider).forEach(p => refreshModels(p));
    }
  }, [
    showSettings,
    apiKeys.gemini,
    apiKeys.openrouter,
    apiKeys.groq,
    apiKeys.openai,
    apiKeys.ollamaBase
  ]);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 5));

  const getProviderConfig = (task: keyof AIAssignments) => {
    const config = assignments[task];
    let apiKey = apiKeys.gemini;
    if (config.provider === AIProvider.OPENROUTER) apiKey = apiKeys.openrouter;
    if (config.provider === AIProvider.GROQ) apiKey = apiKeys.groq;
    if (config.provider === AIProvider.OPENAI) apiKey = apiKeys.openai;
    return { ...config, apiKey, baseUrl: apiKeys.ollamaBase };
  };

  /**
   * Phase 1: Scripting
   */
  const startScripting = async () => {
    if (!prompt) return;
    setStage(GenerationStage.WRITING_STORY);
    addLog("🔮 Consulting the Muse for a master script...");
    try {
      const script = await generateStoryScript(prompt, ageGroup, style, tone, language, getProviderConfig('scripting'));
      setStory(script);
      setStage(GenerationStage.AWAITING_SCRIPT_APPROVAL);
      addLog("✅ Script Drafted. Reviewing required...");
    } catch (e) {
      addLog("❌ Scripting failed. Check API key/connection.");
      setStage(GenerationStage.IDLE);
    }
  };

  /**
   * Phase 2: Character Design
   */
  const startCharacterDesign = async () => {
    if (!story) return;
    setStage(GenerationStage.DESIGNING_CHARACTERS);
    addLog("🎨 Synthesizing Visual DNA for characters...");
    try {
      const updatedChars = await Promise.all(story.characters.map(async (c) => {
        const url = await generateCharacterImage(c, style, getProviderConfig('visuals'));
        return { ...c, imageUrl: url };
      }));
      setStory({ ...story, characters: updatedChars });
      setStage(GenerationStage.AWAITING_CHAR_APPROVAL);
      addLog("✅ Characters designed. Verify consistency...");
    } catch (e) {
      addLog("❌ Character design failed.");
      setStage(GenerationStage.AWAITING_SCRIPT_APPROVAL);
    }
  };

  /**
   * Phase 3: Full Production
   */
  const startProduction = async () => {
    if (!story) return;
    setStage(GenerationStage.GENERATING_SCENES);
    addLog("🚀 Production Engaged. This will take a few minutes...");

    try {
      // 1. Music
      addLog("🎵 Composing thematic soundtrack...");
      const musicUrl = await generateBackgroundMusic(story, getProviderConfig('audio'));
      setStory(prev => prev ? { ...prev, musicUrl } : null);

      // 2. Scenes
      addLog("🎬 Painting DNA-mapped keyframes...");
      const scenesWithVisuals = await Promise.all(story.scenes.map(async (s) => {
        const url = await generateSceneImage(s, story.characters, style, getProviderConfig('visuals'));
        return { ...s, imageUrl: url };
      }));
      setStory(prev => prev ? { ...prev, scenes: scenesWithVisuals } : null);

      // 3. Audio & Motion
      setStage(GenerationStage.RENDERING);
      const finalScenes = [];
      for (let i = 0; i < scenesWithVisuals.length; i++) {
        addLog(`🎞️ Rendering Scene ${i + 1}/${scenesWithVisuals.length}...`);
        const audioUrl = await generateVoiceover(scenesWithVisuals[i].dialogue || scenesWithVisuals[i].narration, getProviderConfig('audio'));
        const videoUrl = await animateScene(scenesWithVisuals[i].imageUrl!, scenesWithVisuals[i].description, getProviderConfig('motion'));
        finalScenes.push({ ...scenesWithVisuals[i], audioUrl, videoUrl });
        setStory(prev => prev ? { ...prev, scenes: [...finalScenes, ...scenesWithVisuals.slice(i + 1)] } : null);
        setProgress(((i + 1) / scenesWithVisuals.length) * 100);
      }

      setStage(GenerationStage.COMPLETED);
      addLog("🎊 Masterpiece Complete. Ready for screening.");
    } catch (e) {
      addLog("❌ Production halted by an error.");
      setStage(GenerationStage.ERROR);
    }
  };

  // --- Render Helpers ---

  const renderScriptEditor = () => {
    if (!story) return null;
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="glass-panel p-10">
          <SectionHeader icon="✍️" title="Script Editor" subtitle="Refine the AI's logic before committing to production." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <input value={story.title} onChange={e => setStory({ ...story, title: e.target.value })} className="w-full text-4xl font-black bg-transparent border-none outline-none text-white focus:ring-0" placeholder="Title..." />
              <textarea value={story.summary} onChange={e => setStory({ ...story, summary: e.target.value })} className="w-full bg-black/20 p-6 rounded-2xl h-32 border border-white/10" placeholder="Summary..." />
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
              {story.scenes.map((s, idx) => (
                <div key={idx} className="bg-white/5 p-6 rounded-2xl border border-white/5 hover:border-indigo-500/50 transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <Badge>Scene {idx + 1}</Badge>
                    <select value={s.cameraAngle} onChange={e => {
                      const newScenes = [...story.scenes];
                      newScenes[idx].cameraAngle = e.target.value as CameraAngle;
                      setStory({ ...story, scenes: newScenes });
                    }} className="bg-transparent text-[10px] font-bold uppercase cursor-pointer">
                      {Object.values(CameraAngle).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <textarea value={s.description} onChange={e => {
                    const newScenes = [...story.scenes];
                    newScenes[idx].description = e.target.value;
                    setStory({ ...story, scenes: newScenes });
                  }} className="w-full bg-transparent text-sm mb-2 h-16" />
                  <div className="italic text-indigo-300 text-xs border-l-2 border-indigo-500/30 pl-3">
                    <textarea value={s.dialogue || s.narration} onChange={e => {
                      const newScenes = [...story.scenes];
                      if (s.dialogue) newScenes[idx].dialogue = e.target.value;
                      else newScenes[idx].narration = e.target.value;
                      setStory({ ...story, scenes: newScenes });
                    }} className="w-full bg-transparent h-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={startCharacterDesign} className="w-full mt-10 bg-indigo-600 py-6 rounded-3xl font-black text-xl hover:bg-indigo-500 transition-all shadow-[0_10px_40px_rgba(99,102,241,0.4)]">
            NEXT: DESIGN DNA 🎨
          </button>
        </div>
      </div>
    );
  };

  const renderCharacterConfirmation = () => {
    if (!story) return null;
    return (
      <div className="space-y-10 animate-fade-in">
        <div className="glass-panel p-10">
          <SectionHeader icon="🎭" title="Character DNA" subtitle="Ensure the visual consistency is perfect for your world." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {story.characters.map((c, i) => (
              <div key={i} className="glass-card p-6 rounded-[2.5rem] flex flex-col items-center">
                <div className="w-full aspect-square rounded-[2rem] overflow-hidden mb-6 border-4 border-white/5 shadow-2xl relative group">
                  {c.imageUrl ? <img src={c.imageUrl} className="w-full h-full object-cover" /> : <div className="loading-shimmer w-full h-full" />}
                  <button onClick={async () => {
                    const url = await generateCharacterImage(c, style, getProviderConfig('visuals'));
                    const newChars = [...story.characters];
                    newChars[i].imageUrl = url;
                    setStory({ ...story, characters: newChars });
                  }} className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all font-black text-2xl">RE-ROLL ♻️</button>
                </div>
                <h3 className="text-2xl font-black text-white mb-2">{c.name}</h3>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {c.traits.map(t => <Badge key={t} color="purple">{t}</Badge>)}
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center px-4">"{c.visualPrompt.slice(0, 80)}..."</p>
              </div>
            ))}
          </div>
          <div className="flex space-x-4 mt-12">
            <button onClick={() => setStage(GenerationStage.AWAITING_SCRIPT_APPROVAL)} className="flex-1 bg-white/5 py-6 rounded-3xl font-bold hover:bg-white/10">BACK TO SCRIPT</button>
            <button onClick={startProduction} className="flex-[2] bg-gradient-to-r from-indigo-600 to-purple-600 py-6 rounded-3xl font-black text-xl hover:scale-105 transition-all shadow-2xl">
              START FULL PRODUCTION 🎞️
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- Core Lifecycle ---

  useEffect(() => {
    localStorage.setItem('toa_gemini_key', apiKeys.gemini);
    localStorage.setItem('toa_or_key', apiKeys.openrouter);
    localStorage.setItem('toa_groq_key', apiKeys.groq);
    localStorage.setItem('toa_openai_key', apiKeys.openai);
    localStorage.setItem('toa_ollama_base', apiKeys.ollamaBase);
  }, [apiKeys]);

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-12">
      {/* Settings HUD */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 glass-panel flex items-center justify-center text-3xl animate-float">🧞‍♂️</div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white">ToonGenie Studio</h1>
            <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-indigo-400">Character Consistency Engine v4.0</p>
          </div>
        </div>
        <button onClick={() => setShowSettings(true)} className="glass-panel w-12 h-12 flex items-center justify-center hover:bg-white/10 transition-all">⚙️</button>
      </div>

      {/* Main Orchestrator */}
      {stage === GenerationStage.IDLE && (
        <div className="glass-panel p-12 space-y-10 animate-fade-in overflow-hidden relative">
          <div className="absolute top-0 right-0 p-20 opacity-10 text-9xl">🎬</div>
          <div className="max-w-2xl">
            <SectionHeader icon="🔥" title="Ignite the Toon" subtitle="Describe your world and watch it breathe." />

            <div className="flex space-x-4 mb-8">
              {SAMPLES.map(s => (
                <button key={s.title} onClick={() => setPrompt(s.prompt)} className="glass-card px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-white/10">
                  {s.icon} {s.title}
                </button>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="w-full h-48 rounded-[2rem] p-8 text-xl font-bold mb-8"
              placeholder="A magical forest where shadows are actually clumsy ninjas..."
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <select value={ageGroup} onChange={e => setAgeGroup(e.target.value as AgeGroup)} className="rounded-2xl p-4 font-bold text-xs uppercase">
                {Object.values(AgeGroup).map(a => <option key={a} value={a}>Age {a}</option>)}
              </select>
              <select value={style} onChange={e => setStyle(e.target.value as AnimationStyle)} className="rounded-2xl p-4 font-bold text-xs uppercase">
                {Object.values(AnimationStyle).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={tone} onChange={e => setTone(e.target.value as StoryTone)} className="rounded-2xl p-4 font-bold text-xs uppercase">
                {Object.values(StoryTone).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={language} onChange={e => setLanguage(e.target.value as Language)} className="rounded-2xl p-4 font-bold text-xs uppercase">
                {Object.values(Language).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <button onClick={startScripting} className="bg-indigo-600 px-12 py-6 rounded-3xl font-black text-2xl hover:scale-105 transition-all shadow-[0_0_50px_rgba(99,102,241,0.5)]">
              INITIATE STUDIO 🪄
            </button>
          </div>
        </div>
      )}

      {/* Phase Displays */}
      {(stage === GenerationStage.WRITING_STORY || stage === GenerationStage.IDLE === false) && (
        <div className="fixed bottom-10 right-10 left-10 flex items-center justify-between glass-panel p-6 z-50 animate-slide-up border-primary/50 border-t-2">
          <div className="flex items-center space-x-6">
            <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center animate-spin">☕</div>
            <div>
              <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">{stage.replace('_', ' ')}</p>
              <p className="text-sm font-bold text-white">{logs[0] || "Communicating with AI Cluster..."}</p>
            </div>
          </div>
          <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${progress || 5}%` }} />
          </div>
        </div>
      )}

      {stage === GenerationStage.AWAITING_SCRIPT_APPROVAL && renderScriptEditor()}
      {stage === GenerationStage.AWAITING_CHAR_APPROVAL && renderCharacterConfirmation()}

      {/* Production Result */}
      {stage === GenerationStage.COMPLETED && story && (
        <div className="animate-fade-in space-y-12">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-7xl font-black tracking-tighter mb-4 grad-text">{story.title}</h1>
              <p className="text-xl text-slate-400 font-medium max-w-3xl">{story.summary}</p>
            </div>
            <button onClick={() => setShowTheater(true)} className="bg-white text-black px-12 py-8 rounded-[3rem] font-black text-3xl hover:scale-110 transition-all shadow-[0_0_80px_white/20]">
              SCREEN FILM 🍿
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {story.scenes.map((s, i) => (
              <div key={i} className="glass-panel overflow-hidden border-white/5 hover:border-indigo-500/30 transition-all">
                <div className="aspect-video bg-black relative group">
                  {s.videoUrl ? <video src={s.videoUrl} poster={s.imageUrl} controls className="w-full h-full object-cover" /> : <img src={s.imageUrl} className="w-full h-full object-cover opacity-80" />}
                  <div className="absolute top-6 left-6"><Badge>{s.cameraAngle}</Badge></div>
                </div>
                <div className="p-10 space-y-6">
                  <h3 className="text-2xl font-black text-white">{s.description}</h3>
                  <div className="bg-indigo-500/10 p-8 rounded-3xl border-l-4 border-indigo-500 italic font-medium text-lg text-indigo-100">
                    {s.dialogue || s.narration}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Theater Overlay */}
      {showTheater && story && (
        <div className="fixed inset-0 z-[100] theater-overlay flex items-center justify-center p-10 animate-fade-in backdrop-blur-2xl">
          <button onClick={() => setShowTheater(false)} className="absolute top-10 right-10 text-4xl hover:scale-125 transition-all">✕</button>
          <div className="max-w-6xl w-full">
            <TheaterPlayer story={story} />
          </div>
        </div>
      )}

      {/* Settings Modal - Professional AI Matrix */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-[100] flex items-center justify-center p-4 md:p-12 overflow-y-auto">
          <div className="glass-panel p-8 md:p-16 max-w-5xl w-full border-primary/20 border-2 my-auto">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-4xl font-black tracking-tighter flex items-center">
                <span className="mr-4 text-5xl">⚡</span> AI Orchestration Matrix
              </h2>
              <button onClick={() => setShowSettings(false)} className="w-12 h-12 glass-panel flex items-center justify-center hover:bg-white/10 transition-all text-2xl">✕</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Keys Section */}
              <div className="space-y-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">Secure API Keys</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center justify-between">
                      Google Gemini API {apiKeys.gemini ? <span className="text-emerald-400">● Active</span> : <span className="text-amber-400">○ Pending</span>}
                    </label>
                    <input type="password" value={apiKeys.gemini} onChange={e => setApiKeys({ ...apiKeys, gemini: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-indigo-500/50 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center justify-between">
                      OpenAI (GPT-4o) {apiKeys.openai ? <span className="text-emerald-400">● Active</span> : <span className="text-amber-400">○ Pending</span>}
                    </label>
                    <input type="password" value={apiKeys.openai} onChange={e => setApiKeys({ ...apiKeys, openai: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-indigo-500/50 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center justify-between">
                      OpenRouter {apiKeys.openrouter ? <span className="text-emerald-400">● Active</span> : <span className="text-amber-400">○ Pending</span>}
                    </label>
                    <input type="password" value={apiKeys.openrouter} onChange={e => setApiKeys({ ...apiKeys, openrouter: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-indigo-500/50 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center justify-between">
                      Groq Cloud {apiKeys.groq ? <span className="text-emerald-400">● Active</span> : <span className="text-amber-400">○ Pending</span>}
                    </label>
                    <input type="password" value={apiKeys.groq} onChange={e => setApiKeys({ ...apiKeys, groq: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-indigo-500/50 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center justify-between">
                      Localhost (Ollama Base) {fetchingModels[AIProvider.OLLAMA] ? <span className="text-indigo-400 animate-pulse">● Syncing...</span> : availableModels[AIProvider.OLLAMA]?.length ? <span className="text-emerald-400">● {availableModels[AIProvider.OLLAMA].length} Models</span> : <span className="text-slate-600">○ Scanning</span>}
                    </label>
                    <input type="text" value={apiKeys.ollamaBase} onChange={e => setApiKeys({ ...apiKeys, ollamaBase: e.target.value })} className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-indigo-500/50 outline-none transition-all" />
                  </div>
                </div>
              </div>

              {/* Assignments Section */}
              <div className="space-y-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-purple-400">Task Assignments</h3>
                <div className="space-y-6">
                  {(Object.entries(assignments) as [keyof AIAssignments, any][]).map(([task, config]) => (
                    <div key={task} className="glass-card p-6 rounded-3xl border border-white/5">
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-4 block">{task} Engine</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <select
                          value={config.provider}
                          onChange={e => setAssignments({ ...assignments, [task]: { ...config, provider: e.target.value as AIProvider } })}
                          className="bg-black/40 p-3 rounded-xl text-[10px] font-bold uppercase transition-all"
                        >
                          {Object.values(AIProvider).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select
                          value={config.modelId}
                          onChange={e => setAssignments({ ...assignments, [task]: { ...config, modelId: e.target.value } })}
                          className="bg-black/40 p-3 rounded-xl text-[10px] font-bold transition-all"
                        >
                          {fetchingModels[config.provider as AIProvider] ? (
                            <option>Fetching Models...</option>
                          ) : (availableModels[config.provider as AIProvider] || []).length > 0 ? (
                            availableModels[config.provider as AIProvider]?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                          ) : (
                            <option value={config.modelId}>{config.modelId} (Fallback)</option>
                          )}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => setShowSettings(false)} className="w-full mt-12 bg-gradient-to-r from-indigo-600 to-purple-600 py-6 rounded-[2rem] font-black text-xl hover:scale-105 transition-all shadow-2xl">
              SAVE & SYNC CLUSTER 🌐
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Dynamic Theater Player ---

const TheaterPlayer = ({ story }: { story: Story }) => {
  const [idx, setIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  return (
    <div className="space-y-12">
      <div className="aspect-video glass-panel overflow-hidden border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative">
        {story.scenes[idx].videoUrl ? (
          <video
            src={story.scenes[idx].videoUrl}
            autoPlay
            onEnded={() => idx < story.scenes.length - 1 && setIdx(idx + 1)}
            className="w-full h-full object-contain"
          />
        ) : (
          <img src={story.scenes[idx].imageUrl} className="w-full h-full object-cover blur-md opacity-30" />
        )}

        <div className="absolute bottom-16 inset-x-0 text-center px-20">
          <div className="inline-block bg-black/60 backdrop-blur-3xl px-12 py-6 rounded-[3rem] border border-white/10">
            <p className="text-3xl font-black italic text-white leading-relaxed text-shadow-lg">
              {story.scenes[idx].dialogue || story.scenes[idx].narration}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center items-center space-x-10">
        <button onClick={() => idx > 0 && setIdx(idx - 1)} className="text-4xl opacity-50 hover:opacity-100 transition-all">◀</button>
        <div className="flex space-x-3">
          {story.scenes.map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full ${i === idx ? 'bg-indigo-500 w-10 animate-glow' : 'bg-white/20'} transition-all`} />
          ))}
        </div>
        <button onClick={() => idx < story.scenes.length - 1 && setIdx(idx + 1)} className="text-4xl opacity-50 hover:opacity-100 transition-all">▶</button>
      </div>
    </div>
  );
};
