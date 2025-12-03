export interface ModuleItem {
  id: string;
  title: string;
  iconName: string; // We'll map this to Lucide icons
  shortDescription: string;
}

export interface FAQItem {
  question: string;
  answer?: string; // Can be populated by Gemini
  videoUrl?: string; // Placeholder for video link
}

export interface GeminiContentResponse {
  title: string;
  summary: string;
  details: string[];
  videoScriptSuggestion: string;
}
