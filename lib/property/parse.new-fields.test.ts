/**
 * اختبارات استخراج الحقول الثمانية الجديدة في المحلل السريع (parseSmartText):
 * currency, downPayment, installmentPeriod, deliveryDate, legalStatus,
 * negotiable, marketingClaims, sourceRawText.
 *
 * تُشغَّل عبر Node الأصلي (يدعم TypeScript مباشرة بدون أدوات بناء إضافية):
 *   node --test lib/property/parse.new-fields.test.ts
 *
 * تغطي: الحالات الأساسية، المرادفات، النفي، الغموض، والتعارضات — دون التأثير
 * على floorType أو سلوك features (يُتحقق منهما صريحًا في نهاية الملف).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSmartText } from './parse'

// ---------------------------------------------------------------------------
// 1) الحالات الأساسية — استخراج مباشر لكل حقل من عبارة صريحة
// ---------------------------------------------------------------------------

test('يستخرج currency من رمز صريح (جنيه مصري)', () => {
  const { record, detectedFields } = parseSmartText('شقة للبيع بسعر 1500000 جنيه مصري')
  assert.equal(record.currency, 'جنيه مصري')
  assert.ok(detectedFields.includes('currency'))
})

test('يستخرج downPayment كما ورد حرفيًا (نسبة)', () => {
  const { record } = parseSmartText('شقة للبيع، المقدم 10% والباقي تقسيط')
  assert.equal(record.downPayment, '10% والباقي تقسيط')
})

test('يستخرج installmentPeriod كما ورد', () => {
  const { record } = parseSmartText('شقة للبيع، مدة التقسيط 8 سنوات')
  assert.equal(record.installmentPeriod, '8 سنوات')
})

test('يستخرج deliveryDate كعبارة نسبية دون تحويلها لتاريخ', () => {
  const { record } = parseSmartText('شقة للبيع، التسليم خلال سنتين')
  assert.equal(record.deliveryDate, 'خلال سنتين')
})

test('يستخرج legalStatus من عبارة معروفة (تمليك)', () => {
  const { record } = parseSmartText('شقة للبيع تمليك في مدينة نصر')
  assert.equal(record.legalStatus, 'تمليك')
})

test('يستخرج legalStatus الأكثر تحديدًا عند وجوده (مسجل عقاريا) بدل الجزء الأعم', () => {
  const { record } = parseSmartText('شقة للبيع، مسجل عقاريا بالكامل')
  assert.equal(record.legalStatus, 'مسجل عقاريا بالكامل')
})

test('يستخرج negotiable = نعم من تصريح صريح', () => {
  const { record } = parseSmartText('شقة للبيع، السعر قابل للتفاوض')
  assert.equal(record.negotiable, 'نعم')
})

test('يستخرج negotiable = لا من عبارة "السعر نهائي"', () => {
  const { record } = parseSmartText('شقة للبيع، السعر نهائي')
  assert.equal(record.negotiable, 'لا')
})

test('يضع العبارات غير المستخرجة داخل الوصف والمميزات فقط', () => {
  const { record } = parseSmartText('شقة للبيع، آخر وحدة متاحة بالمشروع')
  assert.match(record.features, /آخر\s*وحدة/)
  assert.equal('marketingClaims' in record, false)
})

test('يحفظ sourceRawText مطابقًا للنص الأصلي دون إعادة صياغة', () => {
  const raw = 'شقة للبيع 320م بسعر 1.5 مليون جنيه'
  const { record } = parseSmartText(raw)
  assert.equal(record.sourceRawText, raw)
})

// ---------------------------------------------------------------------------
// 2) المرادفات — نفس الحقل يُستخرج من صيغ مختلفة (عربي/إنجليزي/رمز)
// ---------------------------------------------------------------------------

test('currency: يقبل مرادفات متعددة لنفس العملة', () => {
  assert.equal(parseSmartText('السعر 500000 دولار').record.currency, 'دولار أمريكي')
  assert.equal(parseSmartText('السعر 500000 USD').record.currency, 'دولار أمريكي')
  assert.equal(parseSmartText('السعر 500000 EGP').record.currency, 'جنيه مصري')
  assert.equal(parseSmartText('السعر 500000 ريال').record.currency, 'ريال سعودي')
})

test('deliveryDate: يقبل "موعد التسليم" و"تسليم فوري" كصيغتين مختلفتين', () => {
  assert.equal(parseSmartText('الوحدة موعد التسليم فوري').record.deliveryDate, 'فوري')
  assert.equal(parseSmartText('الوحدة تسليم فوري').record.deliveryDate, 'فوري')
})

test('negotiable: يقبل "قابل للنقاش" كمرادف لـ"قابل للتفاوض"', () => {
  assert.equal(parseSmartText('السعر قابل للنقاش').record.negotiable, 'نعم')
})

// ---------------------------------------------------------------------------
// 3) النفي — لا تُستخرج قيمة إيجابية عند وجود أداة نفي صريحة
// ---------------------------------------------------------------------------

test('downPayment: "بدون مقدم" لا تُستخرج كقيمة', () => {
  const { record } = parseSmartText('شقة للبيع بدون مقدم، التسليم فوري')
  assert.equal(record.downPayment, '')
})

test('negotiable: "غير قابل للتفاوض" تُستخرج كـ"لا" لا كـ"نعم"', () => {
  const { record } = parseSmartText('شقة للبيع، السعر غير قابل للتفاوض')
  assert.equal(record.negotiable, 'لا')
})

test('legalStatus: "بدون توكيل عام" لا تُستخرج كحالة قانونية إيجابية', () => {
  const { record } = parseSmartText('شقة للبيع بدون توكيل عام')
  assert.equal(record.legalStatus, '')
})

test('negotiable: "السعر غير نهائي" لا تُستخرج كـ"لا" (نفي لعبارة نهائي)', () => {
  const { record } = parseSmartText('شقة للبيع، السعر غير نهائي وقابل للمراجعة')
  assert.equal(record.negotiable, '')
})

// ---------------------------------------------------------------------------
// 4) الغموض — عدم اختراع قيمة عند غياب دليل صريح
// ---------------------------------------------------------------------------

test('currency: لا تُستنتج العملة من المدينة أو الرقم وحده', () => {
  const { record } = parseSmartText('شقة للبيع بسعر 1500000 في الرياض')
  assert.equal(record.currency, '')
})

test('legalStatus: تبقى فارغة عند غياب أي عبارة قانونية معروفة', () => {
  const { record } = parseSmartText('شقة للبيع في مدينة الشروق بحالة ممتازة')
  assert.equal(record.legalStatus, '')
})

test('negotiable: لا تُستنتج من كلمات تسويقية مثل "لقطة" أو "مميز"', () => {
  const { record } = parseSmartText('شقة للبيع، لقطة العمر وموقع مميز')
  assert.equal(record.negotiable, '')
})

test('downPayment/installmentPeriod/deliveryDate: تبقى فارغة عند غياب أي ذكر', () => {
  const { record } = parseSmartText('شقة للبيع 320م، 3 غرف، حمامين')
  assert.equal(record.downPayment, '')
  assert.equal(record.installmentPeriod, '')
  assert.equal(record.deliveryDate, '')
})

// ---------------------------------------------------------------------------
// 5) التعارضات وعدم اختراع claims كحقائق
// ---------------------------------------------------------------------------

test('العبارات التسويقية تبقى ضمن الوصف ولا تتحول إلى حقول', () => {
  const { record } = parseSmartText('شقة للبيع، عائد مضمون 15% سنويًا، فرصة استثمارية')
  assert.match(record.features, /عائد\s*مضمون/)
  assert.equal((record as unknown as Record<string, unknown>).marketingClaims, undefined)
})

test('يجمع الوصف غير المستخرج مرتبًا دون تكرار الحقول', () => {
  const { record } = parseSmartText('آخر وحدة متاحة، عائد مضمون 20%، أفضل موقع بالمنطقة')
  assert.match(record.features, /آخر\s*وحدة/)
  assert.match(record.features, /عائد\s*مضمون/)
  assert.match(record.features, /أفضل\s*موقع/)
})

test('نص مختلط عربي/إنجليزي: يستخرج الحقول الثمانية معًا دون تعارض بينها', () => {
  const text = [
    'Villa for sale, 500 sqm',
    'السعر 3000000 EGP',
    'المقدم 15%',
    'مدة التقسيط 5 سنوات',
    'التسليم خلال سنتين',
    'تمليك',
    'السعر قابل للتفاوض',
    'آخر وحدة متاحة بالكمبوند',
  ].join('، ')
  const { record } = parseSmartText(text)
  assert.equal(record.currency, 'جنيه مصري')
  assert.equal(record.downPayment, '15%')
  assert.equal(record.installmentPeriod, '5 سنوات')
  assert.equal(record.deliveryDate, 'خلال سنتين')
  assert.equal(record.legalStatus, 'تمليك')
  assert.equal(record.negotiable, 'نعم')
  assert.match(record.features, /آخر\s*وحدة/)
  assert.equal(record.sourceRawText, text)
})

// ---------------------------------------------------------------------------
// 6) عدم كسر floorType أو سلوك features الحالي
// ---------------------------------------------------------------------------

test('floorType لا يتأثر بالحقول الجديدة (يبقى فارغًا كما كان دون تغيير سلوك)', () => {
  const { record } = parseSmartText('شقة للبيع، المقدم 10%، تمليك، السعر قابل للتفاوض')
  assert.equal(record.floorType, '')
})

test('features يحتوي فقط على المحتوى المتبقي بعد استخراج الحقول', () => {
  const raw = 'شقة للبيع، المقدم 10%، آخر وحدة، السعر قابل للتفاوض'
  const { record } = parseSmartText(raw)
  assert.match(record.features, /آخر وحدة/)
  assert.doesNotMatch(record.features, /المقدم 10%/)
  assert.doesNotMatch(record.features, /السعر قابل للتفاوض/)
  assert.equal(record.sourceRawText, raw)
})
