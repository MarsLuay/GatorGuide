// services/ai.service.ts
// AI chat assistant service (Gemini API)
// Currently returns stub responses, will connect to Firebase Function + Gemini later

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, isStubMode } from './config';

const AI_LAST_RESPONSE_KEY = 'ai:lastResponse';
const AI_LAST_ROADMAP_KEY = 'ai:lastRoadmap';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  source?: 'live' | 'cached' | 'stub';
};

class AIService {
  /**
   * Send message to AI assistant and get response
   * STUB: Returns canned responses
   * TODO: Replace with Firebase Function that calls Gemini API
   */
  async chat(message: string, context?: string): Promise<ChatMessage> {
    if (isStubMode() || API_CONFIG.gemini.apiKey === 'STUB') {
      // Simulate thinking delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Return stub response based on message keywords
      let response = this.getStubResponse(message);

      return {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        source: 'stub',
      };
    }

    try {
      const response = await fetch(
        `${API_CONFIG.gemini.baseUrl}/models/gemini-1.5-flash:generateContent?key=${API_CONFIG.gemini.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: context ? `${context}\n\n${message}` : message }],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Gemini API request failed');
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "I'm here to help with your college journey. What would you like to know?";

      const payload: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: text,
        timestamp: new Date(),
        source: 'live',
      };

      await AsyncStorage.setItem(AI_LAST_RESPONSE_KEY, JSON.stringify(payload));
      return payload;
    } catch (error) {
      const cached = await AsyncStorage.getItem(AI_LAST_RESPONSE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ChatMessage;
        return { ...parsed, id: `msg-${Date.now()}`, source: 'cached' };
      }
      throw error;
    }
  }

  /**
   * Generate stub responses based on message content
   */
  private getStubResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('deadline') || lowerMessage.includes('application')) {
      return "Most colleges have application deadlines between November and January. Early Action/Early Decision deadlines are typically in November, while Regular Decision deadlines are in January. I recommend starting your applications at least 2 months before the deadline.";
    }

    if (lowerMessage.includes('essay') || lowerMessage.includes('personal statement')) {
      return "For college essays, focus on showing who you are rather than just listing achievements. Start with a compelling hook, share a specific story or experience, and reflect on what you learned. Most essays are 500-650 words. Would you like tips on brainstorming topics?";
    }

    if (lowerMessage.includes('recommendation') || lowerMessage.includes('letter')) {
      return "Ask teachers who know you well and can speak to your strengths. Approach them at least 4-6 weeks before the deadline. Provide them with your resume, goals, and specific things you'd like them to highlight. Don't forget to send a thank-you note!";
    }

    if (lowerMessage.includes('test') || lowerMessage.includes('sat') || lowerMessage.includes('act')) {
      return "Many colleges are now test-optional, but strong scores can still help your application. The SAT is scored out of 1600 and the ACT out of 36. Consider which format suits your strengths better. Most students take them in junior year with time for a retake if needed.";
    }

    if (lowerMessage.includes('financial aid') || lowerMessage.includes('scholarship')) {
      return "Fill out the FAFSA (Free Application for Federal Student Aid) as soon as possible after October 1st. Many colleges also require the CSS Profile. Look into merit scholarships at your target schools and search for external scholarships through sites like Fastweb and Scholarships.com.";
    }

    // Default response
    return "I'm here to help with your college transfer journey! I can assist with application deadlines, essay tips, recommendation letters, test prep, financial aid, and more. What specific questions do you have?";
  }

  /**
   * Generate personalized roadmap tasks based on user profile
   * STUB: Returns generic tasks
   * TODO: Use Gemini to generate personalized tasks
   */
  async generateRoadmap(userProfile: any): Promise<string[]> {
    if (isStubMode() || API_CONFIG.gemini.apiKey === 'STUB') {
      await new Promise((resolve) => setTimeout(resolve, 800));

      return [
        'Research colleges that offer your major',
        'Request transcripts from current institution',
        'Draft personal statement about transfer reasons',
        'Identify 2-3 professors for recommendation letters',
        'Create spreadsheet tracking application deadlines',
        'Review transfer credit policies at target schools',
      ];
    }

    try {
      const response = await fetch(
        `${API_CONFIG.gemini.baseUrl}/models/gemini-1.5-flash:generateContent?key=${API_CONFIG.gemini.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{
                  text: `Generate 6 concise roadmap tasks for a student with this profile: ${JSON.stringify(userProfile)}`,
                }],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Gemini API request failed');
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const lines = text
        .split('\n')
        .map((line: string) => line.replace(/^[-*\d.\s]+/, '').trim())
        .filter(Boolean);

      const tasks = lines.length ? lines.slice(0, 6) : [
        'Research colleges that offer your major',
        'Request transcripts from current institution',
        'Draft personal statement about transfer reasons',
        'Identify 2-3 professors for recommendation letters',
        'Create spreadsheet tracking application deadlines',
        'Review transfer credit policies at target schools',
      ];

      await AsyncStorage.setItem(AI_LAST_ROADMAP_KEY, JSON.stringify(tasks));
      return tasks;
    } catch (error) {
      const cached = await AsyncStorage.getItem(AI_LAST_ROADMAP_KEY);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
      throw error;
    }
  }
}

export const aiService = new AIService();
