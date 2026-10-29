import { classifyTabletLine, numeralValue } from '../tabletFrame';

// The same cases scripts/lib/__tests__/tabletFrame.test.mjs pins in the Immerse
// repo — the two copies must classify identically.
const CASES: Array<[string, ReturnType<typeof classifyTabletLine>]> = [
  ['هواللّه', 'invocation'],
  ['هُو الابهی', 'invocation'],
  ['بسـم اللّه العزيز المحبوب', 'invocation'],
  ['( و به نستعین خ )', 'invocation'],
  ['جناب حکیم هارون و سلیل مجید علیهما بهآء اللّه الأبهی', 'addressee'],
  ['بواسطۀ جناب میرزا فرج‌اللّه زائر علیه بهآء اللّه', 'addressee'],
  ['حیفا', 'closing'],
  ['١١ ربیع‌الثّانی ١٣٣٨', 'closing'],
  ['(کلمات مکنونۀ عربی، شمارۀ ۶۸) [۱]', 'citation'],
  ['(آرشیو مرکز جهانی) [۱۲]', 'citation'],
  ['(در هر ٢۴ ساعت يک بار ادا شود)', null],
  ['۳۹', 'number'],
  ['از صعود ولد جلیل محزون مباشید زیرا این جهان تنگ است کیهان جنگ است', null],
];

describe('classifyTabletLine', () => {
  it.each(CASES)('%s → %s', (text, want) => {
    expect(classifyTabletLine(text)).toBe(want);
  });
  it('reads Persian and Arabic-Indic numerals', () => {
    expect(numeralValue('۳۹')).toBe(39);
    expect(numeralValue('٣٩')).toBe(39);
  });
});
