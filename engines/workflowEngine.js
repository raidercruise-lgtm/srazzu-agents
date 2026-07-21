import { AIOrchestrator } from './aiOrchestrator.js';
import { PolicyEngine } from './policyEngine.js';
import { EventEngine } from './eventEngine.js';

export const WorkflowEngine = {
  async execute(workflowDefinition, context) {
    const workflowId = workflowDefinition.workflow_id;
    let currentContext = { ...context };

    await EventEngine.publish('workflow.started', 'workflow_engine', { workflowId, context });

    for (const step of workflowDefinition.steps) {
      console.log(`➡️ [WORKFLOW] Executing step: ${step.step_id}`);

      await EventEngine.publish('workflow.step.started', 'workflow_engine', { 
        workflowId, 
        stepId: step.step_id 
      });

      if (step.engine === 'policy_engine') {
        const policyResult = PolicyEngine.evaluate(step.rule, currentContext);
        currentContext[step.output_key] = policyResult;

      } else if (step.engine === 'ai_orchestrator') {
        const promptInstruction = `Evaluate this active customer dossier: ${JSON.stringify(currentContext)}. Complete the assignment.`;
        const responseText = await AIOrchestrator.executeTask(
          step.agent_role,
          step.system_instructions || "Resolve the user's issue concisely.",
          promptInstruction
        );

        currentContext[step.output_key] = {
          agent: step.agent_role,
          resolution: responseText,
          timestamp: new Date().toISOString()
        };
      }

      await EventEngine.publish('workflow.step.completed', 'workflow_engine', {
        workflowId,
        stepId: step.step_id,
        updatedContext: currentContext
      });
    }

    await EventEngine.publish('workflow.completed', 'workflow_engine', { workflowId, finalContext: currentContext });
    return currentContext;
  }
};