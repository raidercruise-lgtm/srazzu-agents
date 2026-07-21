// srazzu-sync/agents/baseAgent.js
export class BaseAgent {
  constructor(id, role, focus) {
    this.id = id;
    this.role = role;
    this.focus = focus;
  }

  /**
   * Main execution thread for the node.
   * @param {string} text - Cleaned ingress customer text message
   * @param {Object} tokens - Active runtime token dictionary matching UI bindings
   * @param {string} lang - Isolate language code (en, es, ru, ar)
   * @returns {Promise<string>} Translated or interpolated node string response
   */
  async process(text, tokens, lang) {
    throw new Error(`Process loop not implemented in node: ${this.id}`);
  }

  /**
   * Helper utility to safely run dynamic regex fallback token extraction
   */
  interpolateTokens(template, tokens) {
    return template.replace(/__([A-Z0-9_]+)__/g, (match, key) => {
      const lowerKey = key.toLowerCase();
      return tokens[lowerKey] !== undefined ? tokens[lowerKey] : match;
    });
  }
}