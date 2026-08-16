/**
 * اختبارات استخراج المنطقة/المدينة/الحي في المحلل السريع (parseSmartText):
 * تتحقق من عدم مطابقة "حي"/"منطقة"/"مدينة" كجزء من كلمة أطول (مثل "حي" داخل
 * "أحيانًا")، لأن \b لا تفصل بين حرفين عربيين متتاليين في JavaScript.
 *
 * تُشغَّل عبر:
 *   pnpm exec tsx --test lib/property/parse.location.test.ts
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSmartText } from './parse'

test('لا يُستخرج الحي من كلمة "أحيانًا" التي تحتوي على "حي" كجزء منها', () => {
  const { record } = parseSmartText('شقة للبيع، وأحيانًا يباع بسعر أعلى')
  assert.equal(record.district, '')
})

test('يستخرج الحي بشكل صحيح عند ذكره كحقل صريح', () => {
  const { record } = parseSmartText('شقة للبيع، الحي: النرجس')
  assert.equal(record.district, 'النرجس')
})

test('لا تُستخرج المنطقة من كلمة تحتوي على "منطقة" كجزء من سياق آخر غير صريح', () => {
  const { record } = parseSmartText('شقة للبيع في منطقة راقية بمواصفات عالية')
  // "منطقة" هنا صريحة كفاية لتُطابَق كبداية كلمة قائمة بذاتها، والقيمة الملتقطة
  // هي بقية الجملة كما وردت — لا اختراع ولا حذف صمت، فقط تحقق من عدم انهيار
  // السلوك مع سياقات نصية طبيعية.
  assert.equal(record.region, 'راقية بمواصفات عالية')
})

test('يستخرج المنطقة والمدينة معًا دون تعارض في نفس النص', () => {
  // "التجمع" من قيم referenceOptions.cities المعتمدة، لذا matchOption يطابقها
  // كمدينة أولًا (أعلى ثقة من الحقل الحر) قبل تجربة نمط "المدينة:" النصي —
  // سلوك مقصود موجود مسبقًا، لا نغيّره هنا.
  const { record } = parseSmartText('شقة للبيع، المدينة: مدينة الشروق، المنطقة: التجمع الخامس')
  assert.equal(record.city, 'مدينة الشروق')
  assert.equal(record.region, 'التجمع الخامس')
})

test('يستخرج كمباوند وصال كمدينة ويحتفظ باسم المشروع كعنوان', () => {
  const { record } = parseSmartText('شقة لقطة للبيع - وصال ريزدنس، كمبوند وصال، الحي الثالث')
  assert.equal(record.title, 'وصال ريزدنس')
  assert.equal(record.city, 'كمباوند وصال')
  assert.equal(record.district, 'الثالث')
})

test('يدعم الاسم الإنجليزي Compound Wesal كمرادف للمدينة', () => {
  const { record } = parseSmartText('Apartment for sale - Wesal Residence, Compound Wesal')
  assert.equal(record.city, 'كمباوند وصال')
  assert.equal(record.title, 'Wesal Residence')
})

test('يعتبر وصال وحدها أو مع اسم المشروع كمباوند وصال', () => {
  for (const text of ['شقة للبيع - وصال', 'شقة للبيع - وصال ريزدنس', 'شقة للبيع - وصال فيوز']) {
    const { record } = parseSmartText(text)
    assert.equal(record.city, 'كمباوند وصال')
  }
})

test('يفصل مدينة الشروق عن المنطقة والحي في الصياغة الطبيعية', () => {
  const { record } = parseSmartText('شقة للبيع في مدينة الشروق المنطقة الخامسة الحي الثامن')
  assert.equal(record.city, 'مدينة الشروق')
  assert.equal(record.region, 'الخامسة')
  assert.equal(record.district, 'الثامن')
})

test('يختار التجمع ويستخرج حي البنفسج دون إدخال شرق القاهرة', () => {
  const { record } = parseSmartText('شقة للبيع في التجمع الخامس حي البنفسج شرق القاهرة')
  assert.equal(record.city, 'التجمع')
  assert.equal(record.district, 'البنفسج')
  assert.equal(record.region, '')
})

test('يضع B12 في المنطقة عند ذكرها كمنطقة', () => {
  const { record } = parseSmartText('شقة للبيع في مدينتي منطقة B12')
  assert.equal(record.city, 'مدينتي')
  assert.equal(record.region, 'B12')
})

test('يستخرج B12 من إعلان متعدد الأسطر', () => {
  const { record } = parseSmartText('شقة للبيع في مدينتي\nمنطقة B12\nالمساحة: 175 متر')
  assert.equal(record.city, 'مدينتي')
  assert.equal(record.region, 'B12')
})

test('يستخرج B12 حتى عندما تسبقها شرطة أو رمز', () => {
  const { record } = parseSmartText('المدينة: مدينتي\n- منطقة B12\nالمساحة: 175 م²')
  assert.equal(record.city, 'مدينتي')
  assert.equal(record.region, 'B12')
})

test('يستخرج كود المنطقة B12 حتى بدون كلمة منطقة', () => {
  const { record } = parseSmartText('شقة للبيع في مدينتي\nB12\nالمساحة: 175 م²')
  assert.equal(record.city, 'مدينتي')
  assert.equal(record.region, 'B12')
})
