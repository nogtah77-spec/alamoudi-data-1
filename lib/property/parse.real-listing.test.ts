import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSmartText } from './parse'

const listing = `🏢 شقة لقطة للبيع - وصال ريزدنس
📐 المساحة: 160 م²
🏠 التقسيم الداخلي: 3 غرف نوم + 2 حمام.
✨ المميزات والمواصفات:
• دور أرضي بفيو حديقة مميز.
• تشطيب سوبر لوكس.
💰 التفاصيل المالية:
المبلغ المتبقي: 1.5 -  على "خمس سنين".
المطلوب: 4,600,000
 تفاصيل ومدة الأقساط: المتبقي هو 10 أقساط، قيمة كل قسط 152 ألف،
ويتم دفع قسط كل 6 أشهر (نصف سنوي).
إجمالي المدة المتبقية للأقساط هي 5 سنوات (10 أقساط × 6 أشهر = 60 شهراً).
🔑 الكود: S84
🌐 منصة العمودي للتسويق العقاري
📱 التيك توك: تيك توك - العمودي للتسويق العقاري`

test('يحلل إعلانًا غنيًا دون خلط المبلغ المتبقي بالمطلوب', () => {
  const { record, detectedFields } = parseSmartText(listing)
  assert.equal(record.code, 'S84')
  assert.equal(record.price, '4,600,000')
  assert.equal(record.size, '160')
  assert.equal(record.beds, '3')
  assert.equal(record.baths, '2')
  assert.equal(record.type, 'شقة')
  assert.equal(record.category, 'بيع')
  assert.equal(record.floor, 'أرضي')
  assert.equal(record.floorType, 'أرضي')
  assert.equal(record.view, 'فيو جنينة')
  assert.equal(record.finishing, 'سوبر لوكس')
  assert.equal(record.installmentPeriod, '5 سنوات')
  assert.equal(record.remainingAmount, '1.5 -  على "خمس سنين".')
  assert.equal(record.installmentCount, '10')
  assert.equal(record.installmentAmount, '152 ألف')
  assert.equal(record.installmentFrequency, 'كل 6 أشهر')
  assert.ok(detectedFields.includes('code'))
  assert.ok(detectedFields.includes('price'))
  assert.equal(record.sourceRawText, listing.trim())
})

test('يستخرج الواجهة من صيغة صريحة دون خلطها مع الفيو', () => {
  const { record } = parseSmartText('شقة للبيع في مدينتي\nالواجهة: بحري شرقي\nفيو مفتوح على اللاندسكيب')
  assert.equal(record.facade, 'بحري')
  assert.equal(record.view, 'فيو مفتوح')
})

test('يفصل بين رقم الدور ونوع الطابق ولا يملأ شرق القاهرة كمنطقة', () => {
  const { record } = parseSmartText('شقة للبيع، المدينة: مدينتي، المنطقة: شرق القاهرة، الدور: الدور الثالث، دور متكرر بفيو مفتوح')
  assert.equal(record.city, 'مدينتي')
  assert.equal(record.region, '')
  assert.equal(record.floor, 'الثالث')
  assert.equal(record.floorType, 'متكرر')
})

test('لا يلتقط رقم الأقساط أو القسط ككود أو سعر', () => {
  const { record } = parseSmartText('المتبقي 10 أقساط، قيمة القسط 152 ألف، المطلوب 4,600,000، الكود S89')
  assert.equal(record.code, 'S89')
  assert.equal(record.price, '4,600,000')
})

test('يستخرج الكود من الصيغ العربية والإنجليزية', () => {
  assert.equal(parseSmartText('كود: S89').record.code, 'S89')
  assert.equal(parseSmartText('Code A-12').record.code, 'A-12')
  assert.equal(parseSmartText('رقم الوحدة 204').record.code, '204')
})


test('لا يخترع كودًا من رقم عادي', () => {
  assert.equal(parseSmartText('شقة 160 متر، 3 غرف، السعر 4600000').record.code, '')
})
