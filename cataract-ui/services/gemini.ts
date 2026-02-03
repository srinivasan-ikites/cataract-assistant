import { GeminiContentResponse } from '../types';

 const API_BASE = 'http://localhost:8000'; // align with backend
//const API_BASE = 'https://cataract-assistant.ikites.ai/api';//
// const API_BASE = 'http://35.244.44.106:8000';
// const API_BASE = 'http://172.16.0.158:8000'; // align with backend
// const API_BASE = 'https://cataract-assistant.onrender.com'; // Adjust if your backend port differs

export const generateModuleContent = async (moduleTitle: string, patientId: string, clinicId?: string): Promise<GeminiContentResponse> => {
  try {
    const res = await fetch(`${API_BASE}/module-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, module_title: moduleTitle, clinic_id: clinicId }),
    });
    if (!res.ok) throw new Error('Failed to fetch module content');
    return await res.json();
  } catch (error) {
    console.error("Module content fetch error:", error);
    // Fallback content in case of error
    return {
      title: moduleTitle,
      summary: "We are currently unable to retrieve the personalized details for this section.",
      details: ["Please consult with your surgeon for more information.", "Try again later."],
      faqs: [],
      videoScriptSuggestion: "Standard medical disclaimer video.",
      botStarterPrompt: "Can you tell me more about this?"
    };
  }
};
