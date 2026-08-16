/**
 * اختبارات حقل `conflicts` في نتيجة المحلل السريع (parseSmartText):
 * يتحقق من أن التعارضات المكتشفة في الحقول الرقمية (price/size/beds/baths)
 * تُحفظ وتُعاد صريحة في `conflicts` بدل أن تُحسم صمتًا أو تضيع (Smart
 * Analyzer v2.0: "التعارض يُحفظ لا يُحسم"، انظر SMART_ANALYZER_SCHEMA_HANDOFF.md).
 *
 * تُشغَّل عبر:
 *   pnpm exec tsx --test lib/property/parse.conflicts.test.ts
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSmartText } from './parse'

test('لا يوجد تعارض عند وجود رقم سعر واحد فقط', () => {
  const { record, conflicts } = parseSmartText('شقة للبيع بسعر 1500000 جنيه')
  assert.equal(record.price, '1500000')
  assert.deepEqual(conflicts, [])
})

test('يسجل تعارض price عند وجود رقمين مختلفين يطابقان نمط السعر', () => {
  const { conflicts } = parseSmartText('السعر 1500000 جنيه، وأحيانًا يباع بسعر 1650000')
  assert.ok(conflicts.includes('price'))
})

test('يسجل تعارض size عند وجود مساحتين مختلفتين', () => {
  const { conflicts } = parseSmartText('المساحة 180 متر، وملحق آخر 220 متر')
  assert.ok(conflicts.includes('size'))
})

test('يسجل تعارض beds عند وجود عددين مختلفين لغرف النوم', () => {
  const { conflicts } = parseSmartText('غرف النوم 3، وبعض الوحدات بها 4 غرف')
  assert.ok(conflicts.includes('beds'))
})

test('يسجل تعارض baths عند وجود عددين مختلفين للحمامات', () => {
  const { conflicts } = parseSmartText('الحمامات 2، وبعض الوحدات بها 3 حمامات')
  assert.ok(conflicts.includes('baths'))
})

test('لا يوجد تعارض عند تكرار نفس الرقم بصيغ مختلفة لنفس الحقل', () => {
  const { record, conflicts } = parseSmartText('السعر 1,500,000 جنيه، أي ما يعادل 1500000 بالضبط')
  assert.equal(record.price, '1500000')
  assert.ok(!conflicts.includes('price'))
})

test('النص الفارغ لا ينتج أي تعارض', () => {
  const { conflicts } = parseSmartText('')
  assert.deepEqual(conflicts, [])
})

test('يمكن أن يحتوي على أكثر من تعارض في نفس النص معًا', () => {
  const text = 'السعر 1500000 جنيه وأحيانًا يباع بسعر 1650000، المساحة 180 متر وملحق 220 متر'
  const { conflicts } = parseSmartText(text)
  assert.ok(conflicts.includes('price'))
  assert.ok(conflicts.includes('size'))
})
