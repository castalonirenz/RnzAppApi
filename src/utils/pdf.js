function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfFromLines(lines) {
  const safeLines = Array.isArray(lines) ? lines.filter((line) => line !== null && line !== undefined) : [];
  const contentBody = [
    'BT',
    '/F1 11 Tf',
    '40 780 Td',
    '14 TL',
    ...safeLines.map((line, index) => (index === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`)),
    'ET'
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentBody, 'utf8')} >>\nstream\n${contentBody}\nendstream\nendobj\n`
  ];

  let output = '%PDF-1.4\n';
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += object;
  }

  const xrefOffset = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';

  for (let i = 1; i < offsets.length; i += 1) {
    output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'utf8');
}

module.exports = {
  buildPdfFromLines
};
