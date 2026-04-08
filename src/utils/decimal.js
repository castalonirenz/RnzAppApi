function normalizeAmount(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error('Invalid numeric value.');
  }

  return (Math.round(numericValue * 100) / 100).toFixed(2);
}

function toCents(value) {
  return Math.round(Number(normalizeAmount(value)) * 100);
}

function fromCents(value) {
  return (value / 100).toFixed(2);
}

function addAmounts(...values) {
  return fromCents(values.reduce((sum, value) => sum + toCents(value), 0));
}

function subtractAmounts(minuend, subtrahend) {
  return fromCents(toCents(minuend) - toCents(subtrahend));
}

function calculateTotalReceivable(principal, interestRate, durationMonths) {
  const principalCents = toCents(principal);
  const rate = Number(interestRate);
  const duration = Number(durationMonths);

  if (!Number.isFinite(rate) || !Number.isFinite(duration)) {
    throw new Error('Invalid interest rate or duration.');
  }

  const interestCents = Math.round(principalCents * rate * duration);
  return fromCents(principalCents + interestCents);
}

module.exports = {
  normalizeAmount,
  toCents,
  fromCents,
  addAmounts,
  subtractAmounts,
  calculateTotalReceivable
};
