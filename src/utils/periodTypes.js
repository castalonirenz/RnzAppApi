function toUtcDateStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toUtcMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function toUtcYearStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function addUtcMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function addUtcYears(date, years) {
  return new Date(Date.UTC(date.getUTCFullYear() + years, 0, 1));
}

function getWeeklyStart(date) {
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return addUtcDays(date, -daysFromMonday);
}

const PERIOD_TYPES = Object.freeze({
  daily: Object.freeze({
    summaryFormat: '%Y-%m-%d',
    getStart: toUtcDateStart,
    getEnd: (start) => new Date(addUtcDays(start, 1).getTime() - 1)
  }),
  weekly: Object.freeze({
    summaryFormat: '%G-W%V',
    getStart: getWeeklyStart,
    getEnd: (start) => new Date(addUtcDays(start, 7).getTime() - 1)
  }),
  monthly: Object.freeze({
    summaryFormat: '%Y-%m',
    getStart: toUtcMonthStart,
    getEnd: (start) => new Date(addUtcMonths(start, 1).getTime() - 1)
  }),
  yearly: Object.freeze({
    summaryFormat: '%Y',
    getStart: toUtcYearStart,
    getEnd: (start) => new Date(addUtcYears(start, 1).getTime() - 1)
  })
});

const SUPPORTED_PERIOD_TYPES = Object.freeze(Object.keys(PERIOD_TYPES));

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

function normalizePeriodType(value) {
  return String(value || '').trim().toLowerCase();
}

function getPeriodTypeConfig(periodType) {
  const normalized = normalizePeriodType(periodType);
  const periodConfig = PERIOD_TYPES[normalized];

  if (!periodConfig) {
    throw new Error('Invalid period type.');
  }

  return periodConfig;
}

function isSupportedPeriodType(value) {
  return SUPPORTED_PERIOD_TYPES.includes(normalizePeriodType(value));
}

function buildPeriodTypeValidationMessage(fieldName = 'period_type') {
  return `${fieldName} must be ${formatList(SUPPORTED_PERIOD_TYPES)}.`;
}

function buildSummaryDateExpression(periodType) {
  const periodConfig = getPeriodTypeConfig(periodType);
  return { $dateToString: { format: periodConfig.summaryFormat, date: '$expenseDate' } };
}

module.exports = {
  PERIOD_TYPES,
  SUPPORTED_PERIOD_TYPES,
  normalizePeriodType,
  getPeriodTypeConfig,
  isSupportedPeriodType,
  buildPeriodTypeValidationMessage,
  buildSummaryDateExpression
};
