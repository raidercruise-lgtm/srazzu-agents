export const PolicyEngine = {
  evaluate(rule, payload) {
    const { field, operator, value, trueResult, falseResult } = rule;
    
    // Safety check: drill down into nested objects if needed (e.g. "customer.spend")
    const actualValue = field.split('.').reduce((obj, key) => obj?.[key], payload);

    let isMatch = false;
    switch (operator) {
      case 'gt':  isMatch = actualValue > value; break;
      case 'lt':  isMatch = actualValue < value; break;
      case 'eq':  isMatch = actualValue === value; break;
      case 'contains': isMatch = actualValue?.includes?.(value); break;
      default: isMatch = false;
    }

    const finalResult = isMatch ? trueResult : falseResult;
    console.log(`⚖️ [POLICY] Evaluated "${field}" (${actualValue}) ${operator} ${value} -> ${finalResult}`);
    return finalResult;
  }
};