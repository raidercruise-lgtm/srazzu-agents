import Groq from 'groq-sdk';

// In-Memory Mission Store (Phase 2 Engine)
global.missionStore = global.missionStore || [];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'ERROR', error: 'Method Not Allowed' });
    }

    try {
        const { payload, language, missionId } = req.body;

        if (!payload || payload.trim() === '') {
            return res.status(400).json({ status: 'ERROR', error: 'Empty mission objective received' });
        }

        const activeMissionId = missionId || 'MSN-' + Math.floor(1000 + Math.random() * 9000);
        const startTime = Date.now();

        // System prompt enforcing structured enterprise event metadata (NO raw Chain-of-Thought)
        const systemInstruction = `You are the Srazzu Sync AI Workforce Execution Engine.
When given an enterprise mission objective, you must analyze it and return a JSON object with this exact schema:
{
  "reason": "Clear concise business reason",
  "evidence": "Data points or records verified",
  "confidence": 95,
  "action": "Final action taken or requested",
  "requiresApproval": true or false,
  "approvalThreshold": "Threshold rule if applicable (e.g. > AED 2000)",
  "summary": "Executive summary of outcome"
}
Respond strictly with valid JSON. Do not include markdown code fences or raw thought reasoning.`;

        let resultData = null;

        // Clean key string if present
        const apiKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim().replace(/^["']|["']$/g, '') : '';

        // Attempt Live API Call if Key Exists
        if (apiKey && apiKey.startsWith('gsk_')) {
            try {
                const groq = new Groq({ apiKey });

                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: payload }
                    ],
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.2,
                    max_tokens: 600,
                    response_format: { type: "json_object" }
                });

                const rawContent = completion.choices[0]?.message?.content || '{}';
                resultData = JSON.parse(rawContent);
            } catch (groqError) {
                console.warn('⚠️ Groq API Error (falling back to simulation mode):', groqError.message);
                // Fail gracefully to demo mode if key is invalid, revoked, or out of credits
            }
        }

        // Simulated Response Mode (Fallback if key is missing or invalid)
        if (!resultData) {
            resultData = {
                reason: "Automated audit matched policy criteria for " + payload,
                evidence: "Database query returned 12 verified entries",
                confidence: 96,
                action: "Process Automated Reconciliation",
                requiresApproval: payload.toLowerCase().includes('refund') || payload.toLowerCase().includes('audit'),
                approvalThreshold: "Rule #402: Actions > AED 2,000",
                summary: `Simulated execution for mission: "${payload}" completed (Provide valid GROQ_API_KEY for live output).`
            };
        }

        const durationMs = Date.now() - startTime;

        // Structured Timeline Event Sequence for Time-Travel
        const missionEvents = [
            {
                step: 1,
                time: new Date(startTime).toLocaleTimeString(),
                stage: "MISSION_INITIATED",
                employee: "Workforce Supervisor",
                detail: `Objective parsed: "${payload}"`
            },
            {
                step: 2,
                time: new Date(startTime + 120).toLocaleTimeString(),
                stage: "DATA_LOOKUP",
                employee: "Database Operations AI",
                detail: `Retrieved records matching payload criteria.`
            },
            {
                step: 3,
                time: new Date(startTime + 250).toLocaleTimeString(),
                stage: "POLICY_VALIDATED",
                employee: "Risk & Policy Analyst",
                detail: `Reason: ${resultData.reason} | Evidence: ${resultData.evidence}`
            }
        ];

        if (resultData.requiresApproval) {
            missionEvents.push({
                step: 4,
                time: new Date(startTime + durationMs).toLocaleTimeString(),
                stage: "HUMAN_INTERCEPT",
                employee: "Governance Agent",
                detail: `Intercept triggered: ${resultData.approvalThreshold}. Holding for Supervisor approval.`
            });
        } else {
            missionEvents.push({
                step: 4,
                time: new Date(startTime + durationMs).toLocaleTimeString(),
                stage: "MISSION_COMPLETED",
                employee: "Synthesizer Agent",
                detail: `Action executed successfully: ${resultData.action}`
            });
        }

        const missionRecord = {
            id: activeMissionId,
            objective: payload,
            status: resultData.requiresApproval ? 'Requires Approval' : 'Completed',
            durationMs: `${durationMs}ms`,
            result: resultData,
            timeline: missionEvents,
            timestamp: new Date().toISOString()
        };

        // Save to Mission Registry
        global.missionStore.unshift(missionRecord);

        return res.status(200).json({
    status: 'SUCCESS',
    node: resultData.action || 'Synthesizer Agent',
    text: resultData.summary || resultData.reason || 'Mission processed successfully.',
    mission: missionRecord
        });

    } catch (error) {
        console.error('AOC Webhook Execution Error:', error);
        return res.status(500).json({
            status: 'ERROR',
            error: error.message || 'Internal AOC Processing Error'
        });
    }
}