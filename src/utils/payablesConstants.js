const PAYABLE_STATUS_VALUES = Object.freeze(['pending', 'partially_paid', 'completed']);
const PAYABLE_FREQUENCY_VALUES = Object.freeze(['once', 'monthly', 'quarterly', 'yearly']);
const PAYABLE_PAYMENT_METHOD_VALUES = Object.freeze(['cash', 'transfer', 'check', 'other']);

function formatList(values) {
  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} or ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, or ${values[values.length - 1]}`;
}

module.exports = {
  PAYABLE_STATUS_VALUES,
  PAYABLE_FREQUENCY_VALUES,
  PAYABLE_PAYMENT_METHOD_VALUES,
  formatList
};
