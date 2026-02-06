export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'voice' | 'image';
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
  metadata?: {
    voiceDuration?: number; // seconds
    imageUrl?: string;
  };
}

export interface ChatSuggestion {
  label: string;
  value: string;
  type: 'symptom' | 'action';
}
