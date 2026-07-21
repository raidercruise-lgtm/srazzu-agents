import Groq from 'groq-sdk';
import { Ollama } from 'ollama';
import dotenv from 'dotenv';

dotenv.config();

const provider = process.env.AI_PROVIDER || 'ollama';
const groqClient = provider === 'groq' ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// Initialize Ollama only if it is the chosen provider
let ollamaClient = null;
if (provider === 'ollama') {
  try {
    ollamaClient = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
  } catch (e) {
    console.warn("⚠️ Ollama initialization warning (local model offline?):", e.message);
  }
}

export const AIOrchestrator = {
  async executeTask(role, systemPrompt, taskPrompt) {
    console.log(`🤖 [AI ORCHESTRATOR] Routing task to ${role} via ${provider.toUpperCase()}`);

    try {
      if (provider === 'groq') {
        const modelName = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
        const response = await groqClient.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: `You are Srazzu's ${role}. ${systemPrompt}` },
            { role: 'user', content: taskPrompt }
          ],
          temperature: 0.2,
        });
        return response.choices[0]?.message?.content;
      } 
      
      if (provider === 'ollama') {
        const modelName = process.env.OLLAMA_MODEL || 'llama3';
        const response = await ollamaClient.chat({
          model: modelName,
          messages: [
            { role: 'system', content: `You are Srazzu's ${role}. ${systemPrompt}` },
            { role: 'user', content: taskPrompt }
          ],
          options: { temperature: 0.2 }
        });
        return response.message.content;
      }
    } catch (error) {
      console.error(`❌ AI Orchestrator Error (${provider}):`, error.message);
      throw error;
    }
  }
};