// srazzu-sync/orchestrator.js
import { readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';

export class Orchestrator {
  constructor() {
    this.agents = new Map();
    this.logs = [];
    this.departmentBinds = {};
    
    // Default structural settings matching your UI state variables
    this.config = {
      verbosityStyle: 'standard',
      localizationLang: 'en',
      variantSplitter: 'A',
      tokens: {
        invoice_amount: '$1,450.00',
        eta_days: '3 Days',
        client_name: 'Acme Corp',
        ticket_id: 'TK-8840',
        carrier_name: 'FedEx Express'
      }
    };
  }

  /**
   * Scans directory, auto-discovers agent modules, and constructs matching node instances
   */
  async initializeAgents() {
    const agentsDir = path.join(process.cwd(), 'agents');
    const files = readdirSync(agentsDir).filter(f => f !== 'baseAgent.js' && f.endsWith('.js'));

    for (const file of files) {
      const fileUrl = pathToFileURL(path.join(agentsDir, file)).href;
      const module = await import(fileUrl);
      
      // Extract the class constructor dynamically from the file export profile
      const KeyClass = Object.values(module)[0];
      if (KeyClass && typeof KeyClass === 'function') {
        const instance = new KeyClass();
        this.agents.set(instance.id, instance);
        
        // Map topology bonds to interface targets
        this.departmentBinds[instance.id] = instance.id === 'NODE_RECEPTION' ? 'LIVE_CUSTOMER_FEED' : 'ENTERPRISE_LEDGER_DB';
      }
    }
    this.log('SYS_CORE', 'success', `Successfully bound ${this.agents.size} modular worker node pipelines.`);
  }

  /**
   * Pushes execution status notifications into telemetry queues
   */
  log(source, type, text) {
    const frame = { timestamp: Date.now(), source, type, text };
    this.logs.push(frame);
    if (this.logs.length > 100) this.logs.shift(); // Evict historical leaks
    console.log(`[${source}] [${type.toUpperCase()}] ${text}`);
  }

  /**
   * Regex parsing array to evaluate input multi-lingual context criteria
   */
  detectLanguageContext(text) {
    const low = text.toLowerCase();
    if (/[а-яё]/i.test(low)) return 'ru';
    if (/[\u0600-\u06FF]/i.test(low)) return 'ar';
    if (low.includes('hola') || low.includes('gracias') || low.includes('factura')) return 'es';
    return 'en';
  }

  /**
   * Logical index classification mapper to target keyword variables down channels
   */
  routeIntentNode(text) {
    const low = text.toLowerCase();
    if (low.includes('buy') || low.includes('price') || low.includes('sales') || low.includes('quote')) return 'NODE_SALES';
    if (low.includes('invoice') || low.includes('pay') || low.includes('billing') || low.includes('ledger')) return 'NODE_ACCOUNTS';
    if (low.includes('shipping') || low.includes('delivery') || low.includes('track') || low.includes('carrier')) return 'NODE_LOGISTICS';
    if (low.includes('law') || low.includes('contract') || low.includes('compliance') || low.includes('legal')) return 'NODE_LEGAL';
    if (low.includes('profit') || low.includes('budget') || low.includes('investment') || low.includes('finance')) return 'NODE_FINANCE';
    if (low.includes('marketing') || low.includes('campaign') || low.includes('ad ')) return 'NODE_MARKETING';
    
    // Catch-all fallback router target
    return 'NODE_SUPPORT';
  }

  /**
   * Central processor ingestion pipeline point
   */
  async ingestPacket(text) {
    const detectedLang = this.detectLanguageContext(text);
    this.log('INGRESS', 'info', `Ingressing payload packet. Isolated language target constraint context: [${detectedLang.toUpperCase()}]`);

    const targetNodeId = this.routeIntentNode(text);
    const workerNode = this.agents.get(targetNodeId);

    if (!workerNode) {
      this.log('ORCHESTRATOR', 'error', `Target processing node ${targetNodeId} structural link dead.`);
      return;
    }

    this.log('ORCHESTRATOR', 'info', `Routing frame variables to worker entity node execution stack: ${targetNodeId}`);
    
    try {
      const resultText = await workerNode.process(text, this.config.tokens, detectedLang);
      this.log(targetNodeId, 'success', resultText);
    } catch (err) {
      this.log(targetNodeId, 'error', `Thread collapse: ${err.message}`);
    }
  }
}