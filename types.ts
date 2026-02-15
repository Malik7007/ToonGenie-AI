
export enum AgeGroup {
  TODDLER = '3-5',
  KIDS = '6-8',
  TWEENS = '9-12'
}

export enum AnimationStyle {
  TWO_D = '2D Cartoon',
  ANIME = 'Anime',
  STORYBOOK = 'Storybook',
  THREE_D = '3D Render',
  CLAYMATION = 'Claymation',
  PIXEL_ART = 'Pixel Art'
}

export enum StoryTone {
  WHIMSICAL = 'Whimsical',
  ADVENTUROUS = 'Adventurous',
  EDUCATIONAL = 'Educational',
  SPOOKY = 'Spooky',
  MYSTERIOUS = 'Mysterious',
  HILARIOUS = 'Hilarious'
}

export enum CameraAngle {
  WIDE = 'Wide Shot',
  MEDIUM = 'Medium Shot',
  CLOSE_UP = 'Close Up',
  BIRD_EYE = 'Bird\'s Eye',
  LOW_ANGLE = 'Low Angle'
}

export enum Language {
  ENGLISH = 'English',
  URDU = 'Urdu',
  ARABIC = 'Arabic',
  SPANISH = 'Spanish',
  HINDI = 'Hindi',
  FRENCH = 'French',
  JAPANESE = 'Japanese'
}

export enum AIProvider {
  GEMINI = 'GEMINI',
  OPENROUTER = 'OPENROUTER',
  GROQ = 'GROQ',
  OLLAMA = 'OLLAMA',
  OPENAI = 'OPENAI'
}

export interface AIServiceConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  modelId: string;
}

export interface AIAssignments {
  scripting: AIServiceConfig;
  visuals: AIServiceConfig;
  audio: AIServiceConfig;
  motion: AIServiceConfig;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  visualPrompt: string;
  seed: number;
  imageUrl?: string;
  voiceId: string;
  traits: string[]; // Added for consistency
}

export interface Scene {
  id: number;
  description: string;
  dialogue: string;
  narration: string;
  imagePrompt: string;
  cameraAngle: CameraAngle; // Added for cinematography
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  duration: number;
}

export interface Story {
  title: string;
  summary: string;
  tone: StoryTone;
  characters: Character[];
  scenes: Scene[];
  musicUrl?: string;
  themeColor?: string; // For UI theme sync
}

export enum GenerationStage {
  IDLE = 'IDLE',
  WRITING_STORY = 'WRITING_STORY',
  AWAITING_SCRIPT_APPROVAL = 'AWAITING_SCRIPT_APPROVAL',
  DESIGNING_CHARACTERS = 'DESIGNING_CHARACTERS',
  AWAITING_CHAR_APPROVAL = 'AWAITING_CHAR_APPROVAL',
  GENERATING_SCENES = 'GENERATING_SCENES',
  CREATING_AUDIO = 'CREATING_AUDIO',
  COMPOSING_MUSIC = 'COMPOSING_MUSIC',
  RENDERING = 'RENDERING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface AIModel {
  id: string;
  name: string;
}
