import express from 'express';
import { WorkflowEngine } from '../engines/workflowEngine.js';
import { supabase } from '../db.js';

const router = express.Router();

// 1. Run a workflow on-demand with custom input
router.post('/run', async (req, res) => {
  try {
    const { workflow, context } = req.body;

    if (!workflow || !context) {
      return res.status(400).json({ error: "Missing workflow definition or payload context." });
    }

    const result = await WorkflowEngine.execute(workflow, context);
    res.json({ success: true, finalState: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Fetch all registered AI Employees
router.get('/agents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_employees')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Fetch historical system events
router.get('/events', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Always keep this at the very bottom
export default router;