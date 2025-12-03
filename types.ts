

export enum LayoutMode {
  PORTRAIT = '9:16',
  LANDSCAPE = '16:9'
}

export enum OverlayType {
  FULL = 'full',
  SPLIT = 'split'
}

export interface AudioClip {
  id: string;
  text: string;
  audioUrl: string; // Blob URL
  duration: number;
  createdAt: number;
}

export interface BRollSettings {
  x: number; // percentage -50 to 50
  y: number; // percentage -50 to 50
  scale: number; // multiplier 0.5 to 3
  height: number; // percentage 20 to 80 (for split mode)
  aRollOffsetY?: number; // percentage 0 to 100 (for split mode vertical pan of A-roll)
}

export interface BeatStyleConfig {
  themePrompt?: string;
  imageCount?: number;
  referenceImage?: string;
  avatarImage?: string;
}

export interface Beat {
  id: string;
  startTime: number;
  endTime: number;
  textSegment: string;
  visualPrompt: string;
  bRollImage?: string; // Base64 or URL
  overlayType: OverlayType;
  isEnabled: boolean; // Toggle for B-Roll visibility
  bRollSettings: BRollSettings; // Positioning and Scale
  bRollOptions?: string[]; // Array of generated/uploaded images for this beat
  styleConfig?: BeatStyleConfig; // Individual override settings
}

export interface StyleSettings {
  themePrompt: string;
  imageCount: number;
  referenceImage?: string;
  avatarImage?: string;
}

export interface ScriptBlock {
  id: string;
  content: string; // HTML string
  align: 'left' | 'center' | 'right';
  type: 'p' | 'h1' | 'h2' | 'blockquote';
}

export interface VideoCommentReply {
  id: string;
  text: string;
  author: string;
  createdAt: number;
}

export interface VideoComment {
  id: string;
  videoTimestamp: number;
  text: string;
  author: string;
  createdAt: number;
  replies: VideoCommentReply[];
  isResolved?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastUpdated: number;
}

export interface ProjectState {
  textContent: string; // Deprecated
  scriptBlocks: ScriptBlock[];
  videoTranscript: string; 
  audioClips: AudioClip[];
  selectedAudioIds: string[];
  aRollVideoUrl?: string;
  isGeneratingVideo: boolean;
  beats: Beat[];
  layoutMode: LayoutMode;
  styleSettings: StyleSettings;
  videoComments: VideoComment[];
  chatSessions: ChatSession[];
  currentChatSessionId: string | null;
}

export interface UserSelection {
  text: string;
  start: number;
  end: number;
}

export interface Comment {
  id: string;
  author: string;
  role: 'Editor' | 'Director' | 'Client';
  text: string;
  timestamp: number;
  replies: Comment[];
}