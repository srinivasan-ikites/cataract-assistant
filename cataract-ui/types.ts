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

export interface EyeDetails {
  condition: string;
  description: string;
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

  // Diagnosis module specific fields (LLM-generated)
  primary_diagnosis_type?: string;      // "Combined form of senile cataract"
  cataract_types?: string[];            // ["Nuclear sclerosis", "Cortical"]
  eyes_same_condition?: boolean;        // true if both eyes have same condition
  right_eye?: EyeDetails;               // Right eye details when conditions differ
  left_eye?: EyeDetails;                // Left eye details when conditions differ
  additional_conditions?: string[];     // ["Dry Eye Syndrome", "Myopia"]
}
