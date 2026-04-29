const {
  normalizePeriodType: normalizePeriodTypeValue,
  isSupportedPeriodType,
  getPeriodTypeConfig
} = require('./periodTypes');

function normalizePeriodType(periodType) {
  const normalized = normalizePeriodTypeValue(periodType);

  if (!isSupportedPeriodType(normalized)) {
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

  const periodConfig = getPeriodTypeConfig(normalizedPeriod);
  return periodConfig.getStart(source);
}

function derivePeriodEnd(startDate, periodType) {
  const normalizedPeriod = normalizePeriodType(periodType);
  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid start date.');
  }

  const periodConfig = getPeriodTypeConfig(normalizedPeriod);
  return periodConfig.getEnd(start);
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
