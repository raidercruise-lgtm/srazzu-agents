// srazzu-sync/agents/reception.js
import { BaseAgent } from './baseAgent.js';

export class ReceptionAgent extends BaseAgent {
  constructor() {
    super('NODE_RECEPTION', 'Infiltrator', 'First-contact intake greeting & triage');
  }

  async process(text, tokens, lang) {
    const templates = {
      en: "System intake confirmed for client __CLIENT_NAME__. Initial parsing array online.",
      es: "Ingreso de sistema confirmado para el cliente __CLIENT_NAME__. Matriz de análisis en línea.",
      ru: "Прием системы подтвержден для клиента __CLIENT_NAME__. Аналитическая матрица в сети.",
      ar: "تم تأكيد استقبال النظام للعميل __CLIENT_NAME__. مصفوفة التحليل المبدئية متصلة بالشبكة."
    };
    return this.interpolateTokens(templates[lang] || templates.en, tokens);
  }
}