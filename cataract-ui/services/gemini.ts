import { GoogleGenAI, Type } from "@google/genai";
import { GeminiContentResponse } from '../types';

// Initialize the Gemini API client
// API_KEY is guaranteed to be present in the environment as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODULE_CONTENT_MODEL = 'gemini-1.5-flash';
const FAQ_MODEL = 'gemini-1.5-flash';

export const generateModuleContent = async (moduleTitle: string): Promise<GeminiContentResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: MODULE_CONTENT_MODEL,
      contents: `Provide a patient-friendly education summary for the cataract surgery topic: "${moduleTitle}".
      Target audience: Elderly patients. Tone: Reassuring, clear, and professional.
      Return the response in JSON format with the following schema:
      - title: string (The title of the section)
      - summary: string (A 2-3 sentence overview)
      - details: array of strings (3-5 key bullet points explaining the topic in depth)
      - videoScriptSuggestion: string (A short description of what a video explaining this topic would show visually)
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            details: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            videoScriptSuggestion: { type: Type.STRING }
          },
          required: ["title", "summary", "details", "videoScriptSuggestion"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No content generated");

    return JSON.parse(text) as GeminiContentResponse;
  } catch (error) {
    console.error("Gemini generation error:", error);
    // Fallback content in case of error
    return {
      title: moduleTitle,
      summary: "We are currently unable to retrieve the AI-generated details for this section.",
      details: ["Please consult with your surgeon for more information.", "Check your internet connection."],
      videoScriptSuggestion: "Standard medical disclaimer video."
    };
  }
};

export const answerPatientQuestion = async (question: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: FAQ_MODEL,
      contents: `You are a helpful surgical counselor for a cataract surgery clinic. Answer the following patient question concisely and clearly: "${question}"`,
    });
    return response.text || "I'm sorry, I couldn't process that question right now.";
  } catch (error) {
    console.error("Gemini FAQ error:", error);
    return "Service temporarily unavailable. Please ask a staff member.";
  }
};
