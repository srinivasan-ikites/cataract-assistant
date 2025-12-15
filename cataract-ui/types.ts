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

export interface TimelineItem {
  step: string;
  description: string;
}

export interface CostItem {
  category: string;
  amount: string;
  covered: boolean;
  note?: string;
}

export interface GeminiContentResponse {
  title: string;
  summary: string;
  details: string[]; // Can be used for checklist items
  videoScriptSuggestion: string;
  faqs?: { question: string; answer: string }[];
  botStarterPrompt?: string;
  
  // New structured fields for specialized modules
  checklist?: string[]; // For Pre-op / Post-op
  timeline?: TimelineItem[]; // For Day of Surgery
  risks?: { category: string; items: string[] }[]; // For Risks
  costBreakdown?: CostItem[]; // For Costs & Insurance
}
