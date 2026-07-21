import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function runAIEmployeeByName(employeeName, userMessage) {
  try {
    // 1. Fetch the employee details by NAME instead of ID
    const { data: employee, error: empError } = await supabase
      .from('ai_employees')
      .select('*')
      .eq('name', employeeName)
      .single();

    if (empError || !employee) {
      throw new Error(`Employee '${employeeName}' not found in database. Check your Supabase table rows!`);
    }

    // 2. Fetch capabilities linked to this employee
    const { data: links, error: linkError } = await supabase
      .from('employee_capabilities')
      .select('capabilities(system_prompt_patch)')
      .eq('employee_id', employee.id);

    if (linkError) throw new Error('Error fetching capabilities');

    // 3. Assemble the Master System Prompt
    let systemPrompt = `You are ${employee.name}, a professional AI workforce employee. Conduct your duties efficiently.\n`;
    
    if (links && links.length > 0) {
      systemPrompt += "\nYour specific capabilities and instructions are as follows:\n";
      links.forEach(link => {
        if (link.capabilities) {
          systemPrompt += `- ${link.capabilities.system_prompt_patch}\n`;
        }
      });
    }

    console.log(`\n🤖 [Orchestrator] Assembled system prompt for ${employee.name}...`);

    // 4. Send to Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.5
      })
    });

    const aiData = await response.json();
    
    if (aiData.error) {
      throw new Error(aiData.error.message);
    }

    return aiData.choices[0].message.content;

  } catch (error) {
    console.error('❌ Engine Error:', error.message);
    return 'System error occurred while routing to the AI workforce.';
  }
}

// --- TEST RUN ---
console.log("⚡ Starting Srazzu Sync Core Engine...");
const userIntent = "Hi! I'd like to book a deluxe suite for tomorrow night please.";

// We now call it by the exact name we put in the database seed!
const aiResponse = await runAIEmployeeByName('Sarah the Front Desk AI', userIntent);

console.log("\n💬 User:", userIntent);
console.log("\n🏢 AI Employee Response:\n", aiResponse);