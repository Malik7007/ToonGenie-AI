
import { GoogleGenAI, Type, Modality } from "@google/genai";
import {
    AIProvider,
    AIServiceConfig,
    Story,
    AgeGroup,
    AnimationStyle,
    Character,
    Scene,
    AIModel,
    Language,
    StoryTone,
    CameraAngle
} from "./types";

/**
 * Universal AI Orchestrator.
 * Delegates tasks to ToonGenie Core, OpenRouter, Groq, or Ollama.
 */

const getToonGenieCore = (apiKey: string) => new GoogleGenAI({ apiKey });

/**
 * Executuion wrapper with retry logic for robustness.
 * @param fn - The async function to execute
 * @param retries - Number of retries
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
    try {
        return await fn();
    } catch (e) {
        if (retries > 0) {
            console.warn(`Retrying... ${retries} attempts left.`);
            await new Promise(r => setTimeout(r, 1000));
            return withRetry(fn, retries - 1);
        }
        throw e;
    }
};

/**
 * Calls a text-based AI model and returns structured or plain text.
 */
export const callTextAI = async (
    config: AIServiceConfig,
    systemPrompt: string,
    userPrompt: string,
    jsonSchema?: any
): Promise<string> => {
    return withRetry(async () => {
        switch (config.provider) {
            case AIProvider.TOONGENIE_CORE:
                const genAI = getToonGenieCore(config.apiKey || "");
                const result = await genAI.models.generateContent({
                    model: config.modelId,
                    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nTask: ${userPrompt}` }] }],
                    config: jsonSchema ? {
                        responseMimeType: "application/json",
                        responseSchema: jsonSchema
                    } : undefined
                } as any);
                return result.text;

            case AIProvider.OPENROUTER:
            case AIProvider.GROQ:
            case AIProvider.OPENAI:
                let endpoint = "";
                if (config.provider === AIProvider.OPENROUTER) endpoint = "https://openrouter.ai/api/v1/chat/completions";
                else if (config.provider === AIProvider.GROQ) endpoint = "https://api.groq.com/openai/v1/chat/completions";
                else if (config.provider === AIProvider.OPENAI) endpoint = "https://api.openai.com/v1/chat/completions";

                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${config.apiKey}`,
                        "Content-Type": "application/json",
                        ...(config.provider === AIProvider.OPENROUTER ? { "HTTP-Referer": window.location.origin, "X-Title": "ToonGenie" } : {})
                    },
                    body: JSON.stringify({
                        model: config.modelId,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ],
                        response_format: jsonSchema ? { type: "json_object" } : undefined
                    })
                });
                const data = await response.json();
                return data.choices?.[0]?.message?.content || "";

            case AIProvider.OLLAMA:
                const ollamaEndpoint = `${config.baseUrl || "http://localhost:11434"}/api/chat`;
                const ollamaRes = await fetch(ollamaEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: config.modelId,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ],
                        stream: false,
                        format: jsonSchema ? "json" : undefined
                    })
                });
                const ollamaData = await ollamaRes.json();
                return ollamaData.message?.content || "";

            default:
                throw new Error(`Provider ${config.provider} not supported for text tasks.`);
        }
    });
};

/**
 * Fetches models from the provider's API.
 */
export const fetchAvailableModels = async (provider: AIProvider, apiKey: string, baseUrl?: string): Promise<AIModel[]> => {
    try {
        switch (provider) {
            case AIProvider.OPENROUTER:
                const orRes = await fetch("https://openrouter.ai/api/v1/models");
                const orData = await orRes.json();
                return orData.data.map((m: any) => ({ id: m.id, name: m.name }));

            case AIProvider.GROQ:
                const groqRes = await fetch("https://api.groq.com/openai/v1/models", {
                    headers: { "Authorization": `Bearer ${apiKey}` }
                });
                const groqData = await groqRes.json();
                return groqData.data.map((m: any) => ({ id: m.id, name: m.id }));

            case AIProvider.OPENAI:
                const openaiRes = await fetch("https://api.openai.com/v1/models", {
                    headers: { "Authorization": `Bearer ${apiKey}` }
                });
                const openaiData = await openaiRes.json();
                // Filter for chat models to keep it clean
                return openaiData.data
                    .filter((m: any) => m.id.includes("gpt"))
                    .map((m: any) => ({ id: m.id, name: m.id }));

            case AIProvider.OLLAMA:
                const ollamaUrl = `${baseUrl || "http://localhost:11434"}/api/tags`;
                const ollamaRes = await fetch(ollamaUrl).catch(() => null);
                if (!ollamaRes) return [];
                const ollamaData = await ollamaRes.json();
                return (ollamaData.models || []).map((m: any) => ({
                    id: m.model || m.name,
                    name: m.name || m.model
                }));

            case AIProvider.TOONGENIE_CORE:
                return [
                    { id: "gemini-2.0-flash-exp", name: "ToonGenie Turbo (Extreme)" },
                    { id: "gemini-1.5-pro", name: "ToonGenie Pro (Creative Brain)" },
                    { id: "gemini-2.5-flash-preview-audio", name: "ToonGenie Audio FX" },
                    { id: "veo-3.1-fast-generate-preview", name: "ToonGenie Motion Synthesis" }
                ];

            default: return [];
        }
    } catch (e) {
        console.error("Model fetch failed:", e);
        return [];
    }
};

/**
 * Higher-level function to generate the screenplay.
 */
export const generateStoryScript = async (
    prompt: string,
    ageGroup: AgeGroup,
    style: AnimationStyle,
    tone: StoryTone,
    language: Language,
    config: AIServiceConfig
): Promise<Story> => {
    const systemPrompt = `Act as a senior animation showrunner and director. 
    Create a professional cartoon script with high visual and narrative consistency.
    Tone: ${tone}. Target Age: ${ageGroup}. Style: ${style}.
    - Title/Summary in English. 
    - Dialogue/Narration in ${language}.`;

    const userPrompt = `Production Prompt: "${prompt}". 
  1. Define 2-3 characters. For each, provide "traits" (3 specific personality adjectives) and a "visualPrompt" that acts as a definitive visual DNA.
  2. Create 3-5 scenes. For each scene, specify a "cameraAngle" (WIDE, MEDIUM, CLOSE_UP, BIRD_EYE, LOW_ANGLE).
  3. Ensure "imagePrompt" for each scene includes the specific traits of the characters present.
  Return JSON following this EXACT structure: { title, summary, tone, characters: [{id, name, description, traits, visualPrompt, voiceId}], scenes: [{id, description, dialogue, narration, cameraAngle, imagePrompt, duration}] }`;

    const schema = {
        type: "object",
        properties: {
            title: { type: "string" },
            summary: { type: "string" },
            tone: { type: "string", enum: Object.values(StoryTone) },
            characters: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        description: { type: "string" },
                        traits: { type: "array", items: { type: "string" } },
                        visualPrompt: { type: "string" },
                        voiceId: { type: "string" }
                    },
                    required: ["id", "name", "description", "traits", "visualPrompt", "voiceId"]
                }
            },
            scenes: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "number" },
                        description: { type: "string" },
                        dialogue: { type: "string" },
                        narration: { type: "string" },
                        cameraAngle: { type: "string", enum: Object.values(CameraAngle) },
                        imagePrompt: { type: "string" },
                        duration: { type: "number" }
                    },
                    required: ["id", "description", "cameraAngle", "imagePrompt", "duration"]
                }
            }
        },
        required: ["title", "summary", "tone", "characters", "scenes"]
    };

    const text = await callTextAI(config, systemPrompt, userPrompt, schema);
    const story = JSON.parse(text) as Story;

    // Assign seeds for consistency
    story.characters = story.characters.map(c => ({
        ...c,
        seed: Math.floor(Math.random() * 2147483647)
    }));

    return story;
};

/**
 * Generates background music.
 */
export const generateBackgroundMusic = async (story: Story, config: AIServiceConfig): Promise<string> => {
    if (config.provider === AIProvider.TOONGENIE_CORE) {
        const genAI = getToonGenieCore(config.apiKey || "");
        const response = await genAI.models.generateContent({
            model: config.modelId,
            contents: [{
                parts: [{
                    text: `Compose a high-fidelity 45-second background instrumental soundtrack. 
                    Title: "${story.title}". Tone: ${story.tone}. Mood: ${story.summary}. 
                    Style: Looping-friendly, high-end animation production value.`
                }]
            }],
            config: { responseModalities: [Modality.AUDIO] } as any
        } as any);
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
    }
    return ''; // Default fallback
};

/**
 * Generates character master image with higher consistency tokens.
 */
export const generateCharacterImage = async (character: Character, style: AnimationStyle, config: AIServiceConfig): Promise<string> => {
    return withRetry(async () => {
        if (config.provider === AIProvider.TOONGENIE_CORE) {
            const genAI = getToonGenieCore(config.apiKey || "");
            const traits = character.traits.join(", ");
            const prompt = `MASTER TURNAROUND DESIGN: ${character.name}. Style: ${style}. Traits: ${traits}. DNA: ${character.visualPrompt}. Plain neutral background, T-pose or neutral pose, consistent lighting, 8k, detailed cartoon textures.`;

            const response = await (genAI as any).models.generateImages({
                model: config.modelId,
                prompt,
                config: {
                    seed: character.seed,
                    aspectRatio: "1:1",
                    outputSize: "1024x1024"
                }
            });
            const img = response.generatedImages?.[0];
            return img?.imageUri || img?.inlineData?.data ? `data:image/png;base64,${img.inlineData.data}` : 'https://picsum.photos/400/400';
        }
        return 'https://picsum.photos/400/400';
    });
};

/**
 * Generates scene keyframes with Cinematography controls.
 */
export const generateSceneImage = async (scene: Scene, characters: Character[], style: AnimationStyle, config: AIServiceConfig): Promise<string> => {
    return withRetry(async () => {
        if (config.provider === AIProvider.TOONGENIE_CORE) {
            const genAI = getToonGenieCore(config.apiKey || "");
            const characterAppearances = characters.map(c => `${c.name} (${c.traits.join(", ")}) DNA: ${c.visualPrompt}`).join("; ");
            const prompt = `CINEMATOGRAPHY: ${scene.cameraAngle}. Art Style: ${style}. Scene: ${scene.description}. Action: ${scene.imagePrompt}. CAST: ${characterAppearances}. High visual consistency, cinematic lighting, 8k render.`;

            const response = await (genAI as any).models.generateImages({
                model: config.modelId,
                prompt,
                config: {
                    seed: (characters[0]?.seed || 0) + scene.id,
                    aspectRatio: "16:9"
                }
            });
            const img = response.generatedImages?.[0];
            return img?.imageUri || img?.inlineData?.data ? `data:image/png;base64,${img.inlineData.data}` : 'https://picsum.photos/1280/720';
        }
        return 'https://picsum.photos/1280/720';
    });
};

/**
 * Animates a keyframe (Veo Pipeline).
 */
export const animateScene = async (imageB64: string, description: string, config: AIServiceConfig): Promise<string> => {
    if (config.provider === AIProvider.TOONGENIE_CORE) {
        const genAI = getToonGenieCore(config.apiKey || "");
        const base64Clean = imageB64.split(',')[1] || imageB64;

        let operation = await (genAI as any).models.generateVideos({
            model: config.modelId,
            prompt: `Professional Animation: ${description}. Smooth motion, fluid character movement, maintain visual DNA.`,
            image: { imageBytes: base64Clean, mimeType: 'image/png' },
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await (genAI as any).operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return '';
        const separator = downloadLink.includes('?') ? '&' : '?';
        const response = await fetch(`${downloadLink}${separator}key=${config.apiKey}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }
    return '';
};

/**
 * Generates character voiceover.
 */
export const generateVoiceover = async (text: string, config: AIServiceConfig, voiceName: string = 'Kore'): Promise<string> => {
    if (config.provider === AIProvider.TOONGENIE_CORE) {
        const genAI = getToonGenieCore(config.apiKey || "");
        const response = await genAI.models.generateContent({
            model: config.modelId,
            contents: [{ parts: [{ text: `Perform character dialogue with emotion: ${text}` }] }],
            generationConfig: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
            } as any
        } as any);
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
    }
    return '';
};

/**
 * Universal PCM Decoder.
 */
export const decodePCM = async (base64: string): Promise<AudioBuffer> => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
};
