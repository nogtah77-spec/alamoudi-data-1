import * as XLSX from 'xlsx'
import { emptyProperty, referenceOptions, type PropertyRecord } from './types'
import {
  CATEGORY_ALIASES,
  CITY_ALIASES,
  CURRENCY_ALIASES,
  DELIVERY_DATE_KEYWORDS,
  DOWN_PAYMENT_KEYWORDS,
  FACADE_ALIASES,
  FINISHING_ALIASES,
  FLOOR_ALIASES,
  INSTALLMENT_PERIOD_KEYWORDS,
  isNegatedAt,
  LEGAL_STATUS_TERMS,
  LISTING_TYPE_ALIASES,
  matchAssertivePhrase,
  matchFirstTerm,
  NEGOTIABLE_KEYWORDS,
  normalizeForMatch,
  NOT_NEGOTIABLE_PHRASES,
  parseHumanNumber,
  STATUS_ALIASES,
  TYPE_ALIASES,
  VIEW_ALIASES,
  YES_NO_KEYWORDS,
  type CanonicalMap,
} from './knowledge-base'

export type ParseResult = {
  record: PropertyRecord
  detectedFields: string[]
  /**
   * الحقول التي طابقت أكثر من قيمة رقمية مختلفة في النص (مثال: "السعر 1.5
   * مليون" و"1,600,000 جنيه" في نفس النص). القيمة المعروضة في `record` هي أول
   * رقم عُثر عليه فقط — التعارض يُحفظ هنا ليُعرض للمستخدم بدل أن يُحسم صمتًا
   * (Smart Analyzer v2.0: "التعارض يُحفظ لا يُحسم").
   */
  conflicts: (keyof PropertyRecord)[]
}

/**
 * يبحث عن أول رقم يطابق أحد الأنماط ويُطبّعه (فواصل/أرقام عربية/مضاعفات
 * "مليون"/"ألف"/"K"/"M"). يعيد أيضًا `conflict: true` إذا طابقت الأنماط أكثر
 * من قيمة رقمية مختلفة في النص — عندها لا يُحسم الاختيار تلقائيًا، بل يُحفظ
 * أول رقم موجود مع الإشارة إلى وجود تعارض (Smart Analyzer v2.0: "التعارض يُحفظ لا يُحسم").
 */
function matchExplicitCode(text: string): string {
  const match = text.match(/(?:الكود|كود|code|رقم\s+(?:الوحدة|العقار))\s*[:：-]?\s*([A-Za-zА-Яа-яء-ي][A-Za-zА-Яа-яء-ي0-9_-]{1,19}|\d{2,20})/i) || text.match(/(?:^|[\n\r])\s*(?:[-•*▪◦]\s*)?([A-Z]{1,3}\s*[-/]?\s*\d{1,3})\s*$/im)
  return match?.[1]?.trim() ?? ''
}

function matchNumber(text: string, patterns: RegExp[]): { value: string; conflict: boolean } {
  const found: string[] = []
  for (const pattern of patterns) {
    const matches = text.matchAll(new RegExp(pattern, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))
    for (const match of matches) {
      const raw = match[1]
      if (!raw) continue
      const parsed = parseHumanNumber(raw)
      if (parsed === null) continue
      const normalized = String(parsed)
      if (!found.includes(normalized)) found.push(normalized)
    }
  }
  if (found.length === 0) return { value: '', conflict: false }
  return { value: found[0], conflict: found.length > 1 }
}

/**
 * مطابقة حقل select بالاعتماد على القيم الأصلية + مرادفات قاعدة المعرفة،
 * مع وعي كامل بالنفي: أي مطابقة تسبقها أداة نفي (بدون/غير/لا يوجد...) خلال
 * نافذة قصيرة من الكلمات تُرفض ولا تُستخدم كقيمة للحقل.
 */
function matchOption(text: string, options: readonly string[], aliasMaps: CanonicalMap[] = []): string {
  const normalizedText = normalizeForMatch(text)

  // القيم الأصلية أولاً (أعلى ثقة)
  for (const option of options) {
    const idx = normalizedText.indexOf(normalizeForMatch(option))
    if (idx !== -1 && !isNegatedAt(normalizedText, idx)) return option
  }

  // ثم مرادفات قاعدة المعرفة، بشرط أن تكون كنيتها من القيم المسموح بها
  for (const map of aliasMaps) {
    if (!options.includes(map.canonical)) continue
    for (const alias of map.aliases) {
      const idx = normalizedText.indexOf(normalizeForMatch(alias))
      if (idx !== -1 && !isNegatedAt(normalizedText, idx)) return map.canonical
    }
  }

  return ''
}

/**
 * يفحص حقول نعم/لا (ماستر/أسانسير/موقف سيارة) عبر كلمات مفتاحية إيجابية.
 * إن وُجدت الكلمة مسبوقة بأداة نفي تُعتبر "لا"؛ وإن لم توجد أي إشارة إطلاقًا
 * يبقى الحقل فارغًا (لا افتراض بالسلب أو الإيجاب دون دليل).
 */
function matchYesNo(text: string, keywords: readonly string[]): string {
  const normalizedText = normalizeForMatch(text)
  for (const keyword of keywords) {
    const idx = normalizedText.indexOf(normalizeForMatch(keyword))
    if (idx !== -1) return isNegatedAt(normalizedText, idx) ? 'لا' : 'نعم'
  }
  return ''
}

/**
 * يستخرج قيمة نصية حرة تلي كلمة مفتاحية (مثل "المقدم: 10%" أو "التسليم فوري")
 * حتى أول حد بند (فاصلة/سطر جديد)، مع الاحتفاظ بالنص كما ورد دون أي تحويل
 * (لا تحويل نسبة إلى مبلغ، ولا عبارة نسبية إلى تاريخ تقويمي مخترع). إن كانت
 * الكلمة المفتاحية نفسها منفية ("بدون مقدم") تُرفض المطابقة ولا تُعاد أي قيمة.
 */
function matchClauseValue(text: string, keywords: readonly string[]): string {
  const normalizedText = normalizeForMatch(text)
  for (const keyword of keywords) {
    const pattern = new RegExp(`(?:${keyword})\\s*[:：]?\\s*([^\\n،,]+)`, 'i')
    const match = pattern.exec(text)
    if (!match || match.index === undefined) continue
    const value = match[1]?.trim()
    if (!value) continue
    if (isNegatedAt(normalizedText, match.index)) continue
    return value
  }
  return ''
}

function buildResidualDescription(text: string, record: PropertyRecord) {
  const extractedValues = new Set(
    Object.entries(record)
      .filter(([key, value]) => key !== 'title' && key !== 'features' && key !== 'sourceRawText' && value)
      .map(([, value]) => String(value).replace(/[,،]/g, '').trim().toLowerCase()),
  )
  const bullet = /^\s*(?:[-•*▪◦✅✨📍🏢📐🏠💰]+)\s*/
  const fieldLabel = /^(?:الكود|كود العقار|العنوان|اسم العقار|النوع|نوع العقار|نوع العملية|الفئة|السعر|المطلوب|المساحة|غرف(?: النوم)?|عدد غرف النوم|حمام(?:ات)?|عدد الحمامات|الحمامات|الدور|عدد الأدوار|نوع الطابق|التشطيب|حالة التشطيب|الفيو|الواجهة|اتجاه(?: العقار)?|الاتجاه|ماستر|أسانسير|يوجد أسانسير|عدد الشرفات|شرفة|يوجد جراج|جراج|العملة|المقدم|المبلغ المتبقي|عدد الأقساط|عدد الأقساط المتبقية|قيمة القسط|دورية السداد|مدة التقسيط|التسليم|موعد التسليم|الحالة|حالة العقار|الحالة القانونية|الموقف من التسجيل|طريقة السداد|قابل للتفاوض|المدينة|المنطقة|الحي|رابط|المعلن|اسم المصدر|رقم المصدر|رقم الهاتف|الهاتف|واتساب|المسوق|اسم المسوق|الموظف المسؤول)\s*(?:[:：-]|$)/i
  const sectionHeading = /^(?:التفاصيل المالية|المميزات والمواصفات|المواصفات|بيانات العقار|الموقع|للتواصل|للتفاصيل|المميزات)\s*:?$/i
  const rawLines = text.split(/\r?\n/).map((line) => line.replace(bullet, '').trim()).filter(Boolean)
  const lines = rawLines.flatMap((line) => line.split(/[،,](?=\s*(?:الكود|السعر|المساحة|المقدم|المدينة|المنطقة|الحي|الهاتف|المميزات|الواجهة|الاتجاه|قابل\s+للتفاوض)(?:\s*[:：-]|\s))/i))
  const residual: string[] = []
  for (const [index, rawLine] of lines.entries()) {
    let line = rawLine.replace(bullet, '').trim().replace(/[.;؛]+$/, '').trim()
    if (!line || sectionHeading.test(line) || fieldLabel.test(line)) continue
    if (/^(?:المقدم|السعر|المطلوب|المساحة|غرف|غرفة|حمام|الحمامات|الدور|الفيو|الواجهة|الاتجاه|التشطيب|التسليم|التفاوض|قابل للتفاوض|المدينة|المنطقة|الحي)\s+(?:\d|نعم|لا|قابل|غير|بدون|شرق|غرب|شمال|جنوب)/i.test(line)) continue
    if (index === 0 && /^(?:شقة|شقه|فيلا|استوديو|أستوديو|مكتب|محل)(?:\s|$)/i.test(line)) {
      const withoutTitlePrefix = line.replace(/^(?:شقة|شقه|فيلا|استوديو|أستوديو|مكتب|محل).*?(?:للبيع|للإيجار|للايجار|for\s+(?:sale|rent))\s*(?:[،,]|[-–—])\s*/i, '').trim()
      if (withoutTitlePrefix && withoutTitlePrefix !== line) line = withoutTitlePrefix
      else continue
    }
    if (/^(?:الموقع|المكان|العنوان)\s*[:：-]/i.test(line)) continue
    if (/^(?:https?:\/\/|(?:فيسبوك|إنستجرام|انستجرام|تيك توك|تواصل|اتصل|للاتصال)\b)/i.test(line)) continue
    if (/^(?:\d{1,3}|[\d,]+\s*(?:جنيه|جنيه مصري|ريال|درهم)?)$/i.test(line)) continue
    if (/^(?:شقة|شقه|فيلا|استوديو|أستوديو|مكتب|محل)\s+(?:للبيع|للإيجار|للايجار|for\s+(?:sale|rent))?\s*$/i.test(line)) continue
    const normalized = line.replace(/[,،]/g, '').trim().toLowerCase()
    if (!extractedValues.has(normalized) && !residual.some((value) => value.toLowerCase() === line.toLowerCase())) residual.push(line)
  }
  return residual.length ? residual.map((line) => `• ${line}`).join('\n') : ''
}

function normalizeAnalyzerText(rawText: string) {
  let text = rawText
    .replace(/^\s*(?:[-•*▪◦✅✨📍🏢📐🏠💰]+)\s*/gm, '')
    .trim()

  // بعض الإعلانات تلصق الأرقام كسطور منفصلة: 250 ثم 000 جنيه.
  // نعيد تجميعها قبل تشغيل أي مستخرج للحقول.
  let previous = ''
  while (previous !== text) {
    previous = text
    text = text.replace(/(\d)\s*\n\s*(\d{3})(?=\s*(?:جنيه|جنيه مصري|ريال|درهم|$|\n))/g, '$1$2')
  }
  return text
}

/**
 * Parses unstructured, free-form Arabic/English property text and extracts
 * as many structured fields as possible using keyword + pattern matching.
 */
export function parseSmartText(rawText: string): ParseResult {
  const sourceText = rawText.trim()
  const text = normalizeAnalyzerText(sourceText)
  const detectedFields: string[] = []
  const conflicts: (keyof PropertyRecord)[] = []
  const record: PropertyRecord = { ...emptyProperty }

  if (!text) return { record, detectedFields, conflicts }

  const explicitTitle = text.match(/(?:العنوان|اسم\s+العقار|title)\s*[:：-]\s*([^\n،,]+)/i)?.[1]?.trim()
  const firstLine = text.split(/[\n،,]/)[0]?.trim()
  const projectTitle = text.match(/(?:وصال\s+(?:ريزدنس|فيوز)|Wesal\s+(?:Residence|Views?)|Wasl\s+(?:Residence|Views?))/i)?.[0]?.trim()
  const cleanedTitle = explicitTitle || projectTitle || firstLine
    ?.replace(/^(?:🏢\s*)?(?:شقة|شقه|فيلا|استوديو|أستوديو|مكتب|محل)\s*/i, '')
    .replace(/\s*(?:للبيع|للإيجار|للايجار|for\s+(?:sale|rent))\s*/i, ' ')
    .replace(/\s*[-–—:]\s*$/, '')
    .trim()
  if (cleanedTitle) {
    record.title = cleanedTitle
    detectedFields.push('title')
  }

  const code = matchExplicitCode(text)
  if (code) { record.code = code; detectedFields.push('code') }

  // النص الأصلي الكامل كما ورد دون أي إعادة صياغة — تعبئة إضافية فقط، لا تحل
  // محل features ولا تغيّر سلوكه الحالي (SMART_ANALYZER_SCHEMA_HANDOFF.md §12).
  record.sourceRawText = sourceText

  const requestedPriceText = text.match(/(?:المطلوب|السعر\s+المطلوب|asking\s+price)\s*[:：-]?\s*([^\n،]+)/i)?.[1] ?? ''
  const explicitPriceMatch = text.match(/(?:السعر\s+المطلوب|المطلوب|السعر|سعر|price)\s*[:：-]?\s*([\d,.٫٠-٩]+(?:\s*\n\s*\d{3})*(?:\s*(?:مليون|الف|ألف|k|m))?)/i)
  const price = explicitPriceMatch
    ? { value: String(parseHumanNumber(explicitPriceMatch[1]) ?? ''), conflict: false }
    : matchNumber(text, [
        /([\d,.٫٠-٩]+\s*(?:مليون|الف|ألف))/i,
        /([\d,]{5,})\s*(?:ريال|جنيه|درهم|SAR|EGP|AED)/i,
      ])
  if (price.value) {
    record.price = Number(price.value).toLocaleString('en-US')
    detectedFields.push('price')
    // القيمة الصريحة بعد اسم الحقل هي المصدر الموثوق، لذلك لا نعرض تعارضًا من أرقام أخرى في الإعلان.
  }

  // العملة — تُطابَق فقط من رمز/اسم صريح، ل���� تُستنتج من الدولة أو الرقم وحده.
  const currency = matchOption(text, referenceOptions.currencies, CURRENCY_ALIASES)
  if (currency) { record.currency = currency; detectedFields.push('currency') }

  const size = matchNumber(text, [
    /(?:المساحة|مساحة|size)\s*[:：]?\s*([\d,.٫٠-٩]+)\s*(?:م2|م²|متر|sqm|sqft)?/i,
    /([\d,.٫٠-٩]+)\s*(?:م2|م²|متر مربع|متر|sqm|sqft)/i,
    // صيغة شائعة جدًا في إعلانات العقارات المصرية: رقم ملتصق مباشرة بحرف "م"
    // بدون فاصل (مثل "320م")، لا يجوز الخلط بينها وبين "م" كحرف وحي�� ملتبس؛
    // الشرط الملزم هنا هو الالتصاق المباشر برقم وعدم اتباعها بحرف عربي آخر.
    /([\d,.٫٠-٩]+)\s?م(?![\u0600-\u06FF])/,
  ])
  if (size.value) {
    record.size = size.value
    detectedFields.push('size')
    if (size.conflict) { detectedFields.push('size_conflict'); conflicts.push('size') }
  }

  const beds = matchNumber(text, [
    /(?:غرف النوم|غرف|beds|bedrooms)\s*[:：]?\s*([\d٠-٩]+)/i,
    /([\d٠-٩]+)\s*(?:غرف نوم|غرف)/i,
  ])
  if (beds.value) {
    record.beds = beds.value
    detectedFields.push('beds')
    if (beds.conflict) { detectedFields.push('beds_conflict'); conflicts.push('beds') }
  }

  const baths = matchNumber(text, [
    /(?:الحمامات|حمامات|حمام|baths|bathrooms)\s*[:：]?\s*([\d.٫٠-٩]+)/i,
    /([\d.٫٠-٩]+)\s*(?:حمامات|حمام)/i,
  ])
  if (baths.value) {
    record.baths = baths.value
    detectedFields.push('baths')
    if (baths.conflict) { detectedFields.push('baths_conflict'); conflicts.push('baths') }
  }

  const type = matchOption(text, referenceOptions.types, TYPE_ALIASES)
  if (type) { record.type = type; detectedFields.push('type') }

  const finishing = matchOption(text, referenceOptions.finishings, FINISHING_ALIASES)
  if (finishing) { record.finishing = finishing; detectedFields.push('finishing') }

  const view = matchOption(text, referenceOptions.views, VIEW_ALIASES)
    || (/(?:فيو|إطلالة|اطلالة)\s+(?:حديقة|جنينة)/i.test(text) ? 'فيو جنينة' : '')
  if (view) { record.view = view; detectedFields.push('view') }

  const explicitFacade = text.match(/(?:الواجهة|اتجاه\s+العقار|اتجاه|orientation|facade)\s*[:：-]?\s*([^\n،,]+)/i)?.[1]?.trim()
  const facade = explicitFacade
    ? (matchOption(explicitFacade, referenceOptions.facades, FACADE_ALIASES) || explicitFacade)
    : matchOption(text, referenceOptions.facades, FACADE_ALIASES)
  if (facade) { record.facade = facade; detectedFields.push('facade') }

  const explicitFloor = text.match(/(?:الدور|دور|رقم\s+الدور)\s*[:：-]?\s*(?:الدور\s+)?([^\n،,\.]+)/i)?.[1]?.trim()
  if (explicitFloor) {
    const floorValue = explicitFloor.split(/\s+(?:بفيو|بإطلالة|مع|ويوجد|وبـ)\s+/i)[0].trim()
    record.floor = floorValue
    detectedFields.push('floor')
  }

  const floorType = matchOption(text, referenceOptions.floors, FLOOR_ALIASES)
  if (floorType) { record.floorType = floorType; detectedFields.push('floorType') }

  const category = matchOption(text, referenceOptions.categories, CATEGORY_ALIASES)
  if (category) { record.category = category; detectedFields.push('category') }

  const listingType = matchOption(text, referenceOptions.listingTypes, LISTING_TYPE_ALIASES)
  if (listingType) { record.listingType = listingType; detectedFields.push('listingType') }

  const status = matchOption(text, referenceOptions.statuses, STATUS_ALIASES)
  if (status) { record.status = status; detectedFields.push('status') }

  const master = matchYesNo(text, YES_NO_KEYWORDS.master)
  if (master) { record.master = master; detectedFields.push('master') }

  const elevator = matchYesNo(text, YES_NO_KEYWORDS.elevator)
  if (elevator) { record.elevator = elevator; detectedFields.push('elevator') }

  const parkingAvailable = matchYesNo(text, YES_NO_KEYWORDS.parkingAvailable)
  if (parkingAvailable) { record.parkingAvailable = parkingAvailable; detectedFields.push('parkingAvailable') }

  // شروط الدفع/التسليم المعلنة — تُحفظ حرفيًا كما وردت، دون تحويل نسبة إلى
  // مبلغ أو عبارة نسبية إلى تاريخ تقويمي مخترع (SMART_ANALYZER_SCHEMA_HANDOFF.md §6).
  const downPaymentMatch = text.match(/(?:المقدم|مقدم|down\s*payment)\s*[:：-]?\s*([\d,.٫٠-٩]+(?:\s*\n\s*\d{3})*[^\n]*)/i)?.[1]
  const downPayment = downPaymentMatch
    ?.split(/(?=المبلغ\s+المتبقي|عدد\s+الأقساط|قيمة\s+القسط|دورية\s+السداد|مدة\s+التقسيط|التسليم)/i)[0]
    ?.replace(/[،,؛;]+\s*$/, '')
    .trim()
  if (downPayment && !/^(?:بدون|من\s+دون|لا\s+يوجد)\s+مقدم$/i.test(downPayment)) {
    record.downPayment = downPayment
    detectedFields.push('downPayment')
  }

  const remainingAmount = text.match(/(?:المبلغ\s+المتبقي|المتبقي)\s*[:：-]?\s*([^\n،]+)/i)?.[1]?.trim()
  if (remainingAmount) { record.remainingAmount = remainingAmount; detectedFields.push('remainingAmount') }

  const installmentCount = text.match(/(?:المتبقي\s+هو\s*|عدد\s+الأقساط(?:\s+المتبقية)?\s*[:：-]?\s*)(\d+)\s*أقساط?/i)?.[1]
  if (installmentCount) { record.installmentCount = installmentCount; detectedFields.push('installmentCount') }

  const installmentAmount = text.match(/(?:قيمة\s+كل\s+قسط|قيمة\s+القسط)\s*[:：-]?\s*([\d,.٫٠-٩]+(?:\s*\n\s*\d{3})*[^\n،]*)/i)?.[1]?.trim() || text.match(/(?:القسط)\s*[:：-]?\s*([^\n،]+)/i)?.[1]?.trim()
  if (installmentAmount) { record.installmentAmount = installmentAmount; detectedFields.push('installmentAmount') }

  const installmentFrequency = text.match(/(?:كل\s+6\s+أشهر|نصف\s+سنوي|ربع\s+سنوي|شهري|سنوي)/i)?.[0]
  if (installmentFrequency) { record.installmentFrequency = installmentFrequency; detectedFields.push('installmentFrequency') }

  const installmentPeriod = matchClauseValue(text, INSTALLMENT_PERIOD_KEYWORDS)
    || text.match(/(?:إجمالي\s+المدة|مدة\s+الأقساط|مدة\s+التقسيط)[^\n،.]*?(\d+\s*(?:سنة|سنين|سنوات|شهر|شهور|أشهر))/i)?.[1]?.trim()
  if (installmentPeriod) { record.installmentPeriod = installmentPeriod; detectedFields.push('installmentPeriod') }

  const deliveryDate = matchClauseValue(text, DELIVERY_DATE_KEYWORDS)
  if (deliveryDate) { record.deliveryDate = deliveryDate; detectedFields.push('deliveryDate') }

  // الحالة القانونية — نص حر من عبارات معروفة، وليس enum؛ لا تُعتبر ادعاء
  // المعلن تحققًا قانونيًا موثقًا.
  const legalStatus = text.match(/(?:الموقف\s+من\s+التسجيل|الحالة\s+القانونية|التسجيل)\s*[:：-]?\s*([^\n،,]+)/i)?.[1]?.trim() || matchFirstTerm(text, LEGAL_STATUS_TERMS)
  if (legalStatus) { record.legalStatus = legalStatus; detectedFields.push('legalStatus') }

  // قابلية التفاوض — لا تُستنتج من كلمات مثل "لقطة"/"مميز"، فقط من تصريح صريح.
  const negotiable = matchYesNo(text, NEGOTIABLE_KEYWORDS)
    || (matchAssertivePhrase(text, NOT_NEGOTIABLE_PHRASES) ? 'لا' : '')
  if (negotiable) { record.negotiable = negotiable; detectedFields.push('negotiable') }

  // (?<![\u0600-\u06FFA-Za-z]) يمنع مطابقة الكلمة المفتاحية عند ظهورها كجزء
  // من كلمة أطول (مثل "حي" داخل "أحيانًا")، إذ لا تفصل \b بين حرفين عربيين.
  // الموقع الداخلي: نقرأ المنطقة كسطر مستقل أولًا، ثم ندعم "منطقة B12" داخل أي سطر.
  // fallback الأكواد مهم لإعلانات مدينتي التي تذكر B12 دون كلمة "منطقة".
  const regionCode = /(?:^|[\s\n\r،,؛;:()-])([A-Z]{1,3}\s*[-/]?\s*\d{1,3})(?=$|[\s\n\r،,؛;:.])/im.exec(text)?.[1]?.replace(/\s+/g, '')
  const regionCandidates = Array.from(text.matchAll(/(?:المنطقة|منطقة|region)\s*[:：-]?\s*([^\n\r،,]+?)(?=\s+(?:الحي|حي|district)(?:\s|$)|\s*$|[،,])/gi))
    .map((match) => match[1].trim())
    .filter((value) => value && !/^(?:شرق\s+القاهرة|east\s+cairo|هادئة|هادئ|رئيسية|مميزة)$/i.test(value))
  const region = regionCode || regionCandidates[0] || ''
  const normalizedRegion = region.trim()
  if (normalizedRegion && !/^(?:شرق\s+القاهرة|east\s+cairo)$/i.test(normalizedRegion)) {
    record.region = normalizedRegion
    detectedFields.push('region')
  }

  const city = matchOption(text, referenceOptions.cities, CITY_ALIASES)
    || text.match(/(?<![\u0600-\u06FFA-Za-z])(?:المدينة|مدينة|city)\s*[:：]?\s*([^\n،,]+)/i)?.[1]?.trim()
    || (/(?:وصال|wesal|wasl)/i.test(text) ? 'كمباوند وصال' : '')
  if (city) { record.city = city; detectedFields.push('city') }

  if (!record.city && /(?:مدينة\s+الشروق|new\s+shorouk)/i.test(text)) {
    record.city = 'مدينة الشروق'
    detectedFields.push('city')
  }

  // يدعم الصياغة الطبيعية: "مدينة الشروق الحي الثامن" و"التجمع الخامس حي البنفسج".
  const districtFromLocation = text.match(/(?:مدينة\s+الشروق|التجمع\s+الخامس|مدينتي|بدر)\s+(?:في\s+)?(?:الحي|حي)\s+([^\n،,]+?)(?=\s+(?:شرق\s+القاهرة|east\s+cairo)(?:\s|$)|\s*$|[،,])/i)?.[1]?.trim()
  const district = districtFromLocation
    || text.match(/(?:^|[\n\r])\s*(?:[-•*▪◦]\s*)?(?:الحي|حي|district)\s*[:：-]?\s*([^\n\r،,]+)/im)?.[1]?.trim()
    || text.match(/(?<![\u0600-\u06FFA-Za-z])(?:الحي|حي|district)\s*[:：-]?\s*([^\n\r،,]+)/i)?.[1]?.trim()
  if (district && !record.district) {
    record.district = district.replace(/[.؛;]+$/, '').trim()
    detectedFields.push('district')
  }

  
  const locationUrl = text.match(/(https?:\/\/(?:www\.)?(?:maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]+)/i)?.[1]
  if (locationUrl) { record.locationUrl = locationUrl; detectedFields.push('locationUrl') }

  const videoUrl = text.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com)[^\s]+)/i)?.[1]
  if (videoUrl) { record.videoUrl = videoUrl; detectedFields.push('videoUrl') }

  const listingUrl = text.match(/(https?:\/\/[^\s]+)/g)?.find((url) => url !== locationUrl && url !== videoUrl)
  if (listingUrl) { record.listingUrl = listingUrl; detectedFields.push('listingUrl') }

  const phone = text.match(/(?:رقم المصدر|رقم التواصل|جوال|هاتف|واتساب)\s*[:：]?\s*(\+?\d[\d\s-]{6,})/i)?.[1]?.trim()
  if (phone) { record.sourceNumber = phone; detectedFields.push('sourceNumber') }

  const sourceName = text.match(/(?:المعلن|اسم\s+المصدر)\s*[:：-]?\s*([^\n،,]+)/i)?.[1]?.trim()
  if (sourceName) { record.sourceName = sourceName; detectedFields.push('sourceName') }

  const responsibleEmployee = text.match(/(?:اسم\s+المسوق|المسوق|الموظف\s+المسؤول)\s*[:：-]?\s*([^\n،,]+)/i)?.[1]?.trim()
  if (responsibleEmployee) { record.responsibleEmployee = responsibleEmployee; detectedFields.push('responsibleEmployee') }

  return { record, detectedFields, conflicts }
}

const HEADER_ALIASES: Record<keyof PropertyRecord, string[]> = {
  code: ['الكود', 'كود', 'code'],
  title: ['العنوان', 'اسم العقار', 'title'],
  price: ['السعر', 'price'],
  size: ['المساحة', 'size'],
  beds: ['غرف النوم', 'غرف', 'beds'],
  baths: ['الحمامات', 'baths'],
  floor: ['الدور', 'floor'],
  floorType: ['نوع الطابق', 'floorType'],
  master: ['ماست��', 'master'],
  elevator: ['أسانسير', 'elevator'],
  finishing: ['التشطيب', 'finishing'],
  view: ['الفيو', 'view'],
  facade: ['الواجهة', 'facade'],
  parkingAvailable: ['موقف السيارة', 'parkingAvailable'],
  features: ['الوصف والمميزات', 'مميزات إضافية', 'المميزات', 'الوصف', 'features'],
  category: ['الفئة', 'category'],
  status: ['حالة العقار', 'الحالة', 'status'],
  featured: ['مميز', 'featured'],
  listingType: ['نوع العرض', 'نوع الطرح', 'listingType'],
  type: ['نوع العقار', 'النوع', 'type'],
  region: ['المنطقة', 'region'],
  city: ['المدينة', 'city'],
  district: ['الحي', 'district'],
  locationUrl: ['رابط الموقع (خرائط)', 'رابط الموقع', 'رابط اللوك��شن', 'locationUrl'],
  listingUrl: ['رابط الإعلان', 'listingUrl'],
  videoUrl: ['رابط الفيديو', 'videoUrl'],
  images: ['روابط الصور (مفصولة بفاصلة)', 'الصور', 'images'],
  sourceName: ['اسم المصدر', 'sourceName'],
  sourceNumber: ['رقم المصدر', 'sourceNumber'],
  sourceLocation: ['موقع المصدر', 'sourceLocation'],
  sourceDescription: ['وصف المصدر', 'sourceDescription'],
  responsibleEmployee: ['الموظف المسؤول', 'اسم الموظف المسؤول', 'responsibleEmployee'],
  dateAdded: ['تاريخ الإضافة', 'dateAdded'],
  currency: ['العملة', 'currency'],
  downPayment: ['المقدم', 'مقدم', 'downPayment'],
  remainingAmount: ['المبلغ المتبقي', 'المتبقي', 'remainingAmount'],
  installmentCount: ['عدد الأقساط', 'installmentCount'],
  installmentAmount: ['قيمة القسط', 'installmentAmount'],
  installmentFrequency: ['دورية ا��سداد', 'installmentFrequency'],
  installmentPeriod: ['مدة التقسيط', 'فترة التقسيط', 'installmentPeriod'],
  deliveryDate: ['التسليم', 'موعد التسليم', 'تاريخ التسليم', 'deliveryDate'],
  legalStatus: ['الحالة القانونية', 'legalStatus'],
  negotiable: ['قابل للتفاوض', 'التفاوض', 'negotiable'],
  sourceRawText: ['النص الأصلي الكامل', 'النص الأصلي', 'sourceRawText'],
}

function findColumnValue(row: Record<string, unknown>, keys: string[]): string {
  const entry = Object.entries(row).find(
    ([key, value]) => keys.some((candidate) => key.trim() === candidate) && value !== '' && value !== null && value !== undefined,
  )
  return entry ? String(entry[1]).trim() : ''
}

/**
 * Parses a spreadsheet file (xlsx, xls, csv) into one or more structured
 * property records, matching Arabic/English column headers.
 */
export async function parseSpreadsheetFile(file: File): Promise<PropertyRecord[]> {
  const isCsvOrText = /\.(csv|txt)$/i.test(file.name)

  // CSV/TXT files must be decoded as UTF-8 text first, otherwise Arabic
  // headers and values get mangled when read as a raw binary buffer.
  const workbook = isCsvOrText
    ? XLSX.read(await file.text(), { type: 'string', cellDates: true, raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return rows.map((row) => {
    const record: PropertyRecord = { ...emptyProperty }
    for (const key of Object.keys(HEADER_ALIASES) as (keyof PropertyRecord)[]) {
      const value = findColumnValue(row, HEADER_ALIASES[key])
      if (value) record[key] = value
    }
    return record
  })
}

/**
 * Extracts plain text from a Word (.docx) file so it can be run through the
 * same smart-text parser used for pasted text.
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value
}

export function readPlainTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('text_read_failed'))
    reader.readAsText(file, 'utf-8')
  })
}

export const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv']
export const TEXT_EXTENSIONS = ['.txt']
export const DOCX_EXTENSIONS = ['.docx']
export const SUPPORTED_EXTENSIONS = [...SPREADSHEET_EXTENSIONS, ...TEXT_EXTENSIONS, ...DOCX_EXTENSIONS]
