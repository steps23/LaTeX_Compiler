import { test, expect } from 'vitest';

test('parses basic error lines', () => {
  const sampleLog = `This is pdfTeX, Version 3.141592653-2.6-1.40.24 (TeX Live 2022)
entering extended mode
! Undefined control sequence.
l.12 \badcommand

? `;

  const errors = [];
  const lines = sampleLog.split('\n');
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z0-9_\-\.]+):(\d+):(.*)$/) || line.match(/l\.(\d+)\s(.*)/);
    if (match) {
        errors.push({ line: parseInt(match[1], 10), message: match[2].trim() });
    }
  }

  expect(errors.length).toBe(1);
  expect(errors[0].line).toBe(12);
  expect(errors[0].message).toBe('\\badcommand');
});
