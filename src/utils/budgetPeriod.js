function normalizePeriodType(periodType) {
  const normalized = String(periodType || '').toLowerCase();

  if (!['daily', 'monthly', 'yearly'].includes(normalized)) {
    throw new Error('Invalid period type.');
  }

  return normalized;
}

function getPeriodStart(date, periodType) {
  const normalizedPeriod = normalizePeriodType(periodType);
  const source = new Date(date);

  if (Number.isNaN(source.getTime())) {
    throw new Error('Invalid date value.');
  }

  if (normalizedPeriod === 'daily') {
    return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  }

  if (normalizedPeriod === 'yearly') {
    return new Date(Date.UTC(source.getUTCFullYear(), 0, 1));
  }

  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), 1));
}

function derivePeriodEnd(startDate, periodType) {
  const normalizedPeriod = normalizePeriodType(periodType);
  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid start date.');
  }

  if (normalizedPeriod === 'daily') {
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1) - 1);
  }

  if (normalizedPeriod === 'yearly') {
    return new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1) - 1);
  }

  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1);
}

function resolveBudgetWindow({ startDate, endDate, periodType }) {
  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid budget start date.');
  }

  const normalizedPeriod = normalizePeriodType(periodType);
  const derivedEnd = endDate ? new Date(endDate) : derivePeriodEnd(start, normalizedPeriod);

  if (Number.isNaN(derivedEnd.getTime())) {
    throw new Error('Invalid budget end date.');
  }

  return {
    start,
    end: derivedEnd
  };
}

function isDateInsideWindow(dateValue, window) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value.');
  }

  return date >= window.start && date <= window.end;
}

module.exports = {
  normalizePeriodType,
  getPeriodStart,
  derivePeriodEnd,
  resolveBudgetWindow,
  isDateInsideWindow
};
