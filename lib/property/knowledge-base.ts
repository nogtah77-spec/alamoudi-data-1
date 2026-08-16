/**
 * قاعدة معرفة دلالية عقارية (Real Estate Semantic Knowledge Base)
 * =================================================================
 * المصدر الأول: قائمة "حصيلة المصطلحات العقارية" (~1960 مصطلح/عبارة عربية شائعة
 * في السوق العقاري: مرادفات، اختصارات، لغة تسويقية، عامية، أنماط كتابة الأرقام).
 * المصدر الثاني: مواصفة "Smart Analyzer v2.0" التي تحدد كيف يجب أن يُفهم ويُصنّف
 * كل مصطلح (حقيقة مقابل ادعاء تسويقي، وعي بالنفي، التعامل مع الغموض والتعارض،
 * الاحتفاظ بالنص الأصلي ومصدره).
 *
 * القاعدة الذهبية: لا يُنشأ أي حقل جديد ولا تُخترع أي معلومة. هذا الملف يُستخدم
 * فقط لتحسين دقة استخراج الحقول الموجودة فعليًا في `PropertyRecord`
 * (lib/property/types.ts) بواسطة المحلل السريع القائم على regex في
 * lib/property/parse.ts — دون أي تأثير على الوكيل الذكي (analyze-ai.ts).
 *
 * كل مرادف/اختصار مضاف هنا يُطابَق فقط عندما تكون قيمته "الكنية" (canonical)
 * موجودة أصلاً ضمن referenceOptions. لا تُضاف قيم جديدة غير مدعومة في الواجهة.
 *
 * مبادئ التصنيف (من Smart Analyzer v2.0):
 * 1) لا اختراع معلومة: لا قيمة تُملأ إلا بدليل نصي صريح.
 * 2) الفصل بين Fact و Claim: الادعاءات التسويقية ("آخر وحدة"، "عائد مضمون"،
 *    "أفضل موقع"، "فرصة لا تفوت") لا تتحول لحقل بيانات — تبقى ضمن النص الخام
 *    (features) كما وردت حرفيًا.
 * 3) النفي أولوية: "بدون/غير/لا يوجد/ليس/عدم/خالي من" تُبطل مطابقة أي كلمة
 *    مفتاحية تلحقها مباشرة، ولا يجوز إسقاطها أثناء الاستخراج.
 * 4) الغموض لا يُحسم بالقوة: مصطلحات ملتبسة لا تُطابَق تلقائيًا إلا بسياق كامل.
 * 5) التعارض يُحفظ لا يُحسم: عند وجود أكثر من قيمة مختلفة لنفس الحقل، يُسجَّل
 *    التعارض ولا تُختار "الأصح" تلقائيًا.
 * 6) الاحتفاظ بالنص الأصلي: الأرقام تُطبَّع للمطابقة فقط؛ النص الكامل الأصلي
 *    يبقى محفوظًا دومًا في حقل features.
 */

import { referenceOptions } from './types'

// ---------------------------------------------------------------------------
// 1) تطبيع النص العربي للمطابقة فقط (لا يُستخدم لتغيير القيمة المخزَّنة)
// ---------------------------------------------------------------------------

/** يحوّل الأرقام العربية-الهندية (٠-٩) إلى أرقام لاتينية للمطابقة الرقمية. */
export function normalizeArabicDigits(input: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  }
  return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d)
}

/** تبسيط الحروف المتشابهة شكليًا (لأغراض المطابقة النصية فقط، ألف/تاء مربوطة/ياء). */
function foldArabic(input: string): string {
  return input
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '') // تشكيل + تطويل
}

/** النص الموحَّد المستخدم داخليًا لعمليات المطابقة (لا يُخزَّن، فقط للفحص). */
export function normalizeForMatch(input: string): string {
  return foldArabic(normalizeArabicDigits(input)).toLowerCase()
}

// ---------------------------------------------------------------------------
// 2) أدوات النفي — الأولوية القصوى قبل أي مطابقة كلمة مفتاحية
// ---------------------------------------------------------------------------

/** أدوات نفي عربية شائعة في السياق العقاري. */
export const NEGATION_WORDS = [
  'بدون', 'غير', 'لا يوجد', 'ليس', 'عدم', 'خالي من', 'مش', 'من دون', 'من غير', 'بلا',
  'ماعندها', 'ما عندها', 'معندهاش', 'مفيهاش', 'مافيهاش', 'ما فيها', 'لا يحتوي على', 'لا يحتوي',
] as const

/** يزيل علامات الترقيم اللاصقة بالكلمة (فاصلة عربية/لاتينية، نقطتين، إلخ) لمقارنة دقيقة بحدود الكلمة. */
function stripPunctuation(word: string): string {
  return word.replace(/[،,.:؛;!؟?()"'«»]+/g, '')
}

/**
 * يتحقق مما إذا كانت كلمة/عبارة مفتاحية عند موضع `matchIndex` في `normalizedText`
 * مسبوقة بأداة نفي خلال نافذة قصيرة (افتراضيًا 3 كلمات) — إن كانت، تُعتبر النتيجة
 * نفيًا ويجب ألا تُستخدَم كمطابقة إيجابية.
 *
 * المقارنة تتم بحدود الكلمة الكاملة (بعد إزالة علامات الترقيم) لا بالاحتواء
 * الحرفي، لمنع تطابقات كاذبة مثل "مش" داخل كلمة "مشترك" أو "مشروع".
 */
export function isNegatedAt(normalizedText: string, matchIndex: number, windowWords = 3): boolean {
  // النفي لا يتجاوز حدود الجملة/البند: "لا يوجد موقف، أسانسير متاح" يجب ألا
  // يجعل "أسانسير" منفيًا لمجرد أن "لا يوجد" ظهرت قبله بكلمتين — لأن الفاصلة
  // تفصل بندًا مستقلًا. لذلك نقصر البحث على المسافة الواقعة بعد آخر فاصل بند
  // (، , . ؛ سطر جديد) السابق لموضع المطابقة.
  const clauseBoundary = /[،,.؛\n]/g
  let lastBoundary = -1
  let m: RegExpExecArray | null
  while ((m = clauseBoundary.exec(normalizedText.slice(0, matchIndex)))) {
    lastBoundary = m.index
  }
  const before = normalizedText.slice(lastBoundary + 1, matchIndex)
  const rawWords = before.trim().split(/\s+/).filter(Boolean)
  const words = rawWords.map(stripPunctuation).filter(Boolean)
  const window = words.slice(Math.max(0, words.length - windowWords))

  return NEGATION_WORDS.some((neg) => {
    const negFolded = foldArabic(neg)
    const negWords = negFolded.split(/\s+/)
    if (negWords.length === 1) {
      // كلمة نفي مفردة: يجب أن تطابق كلمة كاملة في النافذة، لا جزءًا من كلمة أخرى.
      return window.some((w) => w === negWords[0])
    }
    // نفي متعدد الكلمات (مثل "لا يوجد"، "من دون"): يجب أن تتطابق كلمات متتالية بالكامل.
    for (let i = 0; i <= window.length - negWords.length; i++) {
      if (negWords.every((nw, j) => window[i + j] === nw)) return true
    }
    return false
  })
}

// ---------------------------------------------------------------------------
// 3) خرائط المرادفات/الاختصارات/العامية → قيمة كنية موجودة في referenceOptions
// ---------------------------------------------------------------------------

export type CanonicalMap = { canonical: string; aliases: string[] }

/** يبني خريطة كنية لحقل select، مع التحقق أن كل canonical موجود في القيم المرجعية. */
function buildMap(entries: CanonicalMap[], allowed: readonly string[]): CanonicalMap[] {
  return entries.filter((entry) => allowed.includes(entry.canonical))
}

export const TYPE_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'شقة', aliases: ['شقه', 'شقة سكنية', 'شقة تمليك', 'وحدة سكنية', 'apartment', 'flat'] },
    { canonical: 'أستوديو', aliases: ['استوديو', 'ستوديو', 'استديو', 'studio'] },
    { canonical: 'فيلا', aliases: ['فيلا مستقلة', 'فيلا مستقله', 'فله', 'فيله', 'فيلا مستقله بالكامل', 'استراحة', 'شاليه', 'villa'] },
    { canonical: 'عمارة', aliases: ['عماره', 'مبنى', 'بناية', 'عقار كامل', 'building'] },
    { canonical: 'محل', aliases: ['محل تجاري', 'محل تجارى', 'وحدة تجارية', 'shop', 'retail'] },
    { canonical: 'مكتب', aliases: ['مكتب إداري', 'وحدة إدارية', 'مساحة مكتبية', 'office'] },
    { canonical: 'عيادة', aliases: ['عياده', 'وحدة طبية', 'عيادة طبية', 'clinic'] },
    { canonical: 'توين هاوس', aliases: ['توين هاوس', 'توينهاوس', 'توين هاوز', 'twin house', 'twinhouse'] },
    { canonical: 'بنت هاوس', aliases: ['بنتهاوس', 'بنت هاوز', 'بنتهاوز', 'penthouse'] },
    { canonical: 'تاون هاوس', aliases: ['تاون هاوس', 'تاونهاوس', 'تاون هاوز', 'townhouse', 'town house'] },
  ],
  referenceOptions.types,
)

export const FINISHING_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'متشطب', aliases: ['تشطيب كامل', 'مشطب', 'تم التشطيب', 'جاهز بالتشطيب', 'finished'] },
    { canonical: 'نص تشطيب', aliases: ['نصف تشطيب', 'تشطيب نصف', 'نص تشطيب فاخر', 'semi finished', 'semi-finished'] },
    { canonical: 'مفروش', aliases: ['مفروشة', 'فرش كامل', 'مؤثث', 'مؤثثة', 'furnished', 'fully furnished'] },
    { canonical: 'سوبر لوكس', aliases: ['سوبر ديلوكس', 'تشطيب سوبر لوكس', 'سوبر لوكس فاخر', 'super lux', 'super deluxe'] },
    { canonical: 'طوب أحمر', aliases: ['على الطوب الأحمر', 'مرحلة الطوب الأحمر', 'عظم مع مواد', 'عظم'] },
    { canonical: 'ألترا سوبر لوكس', aliases: ['ألترا سوبر لوكس', 'التراسوبر لوكس', 'ألترا لوكس', 'ultra super lux'] },
  ],
  referenceOptions.finishings,
)

export const VIEW_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'جنينة خاصة', aliases: ['حديقة خاصة', 'جاردن خاص', 'جنينه خاصه'] },
    { canonical: 'فيو مفتوح', aliases: ['فيو مفتوح بالكامل', 'إطلالة مفتوحة', 'فيو بانورامي'] },
    { canonical: 'فيو جنينة', aliases: ['إطلالة على الحديقة', 'فيو على الجنينة'] },
    { canonical: 'باركنج', aliases: ['فيو باركينج', 'إطلالة على الموقف'] },
    { canonical: 'فيو نادي + جنينة', aliases: ['فيو نادي وجنينة', 'إطلالة على النادي والحديقة'] },
  ],
  referenceOptions.views,
)

export const FACADE_ALIASES: CanonicalMap[] = buildMap(
  [
  { canonical: 'أمامي', aliases: ['واجهة أمامية', 'فيو أمامي', 'أمامية'] },
  { canonical: 'خلفي', aliases: ['واجهة خلفية', 'فيو خلفي', 'خلفية'] },
  { canonical: 'خلفي جانبي', aliases: ['واجهة خلفية جانبية', 'جانبية خلفية'] },
  { canonical: 'بحري', aliases: ['واجهة بحرية', 'بحري', 'شمالي', 'شمال'] },
  { canonical: 'شرقي', aliases: ['واجهة شرقية', 'شرقي', 'شرق'] },
  { canonical: 'غربي', aliases: ['واجهة غربية', 'غربي', 'غرب'] },
  { canonical: 'قبلي', aliases: ['واجهة قبلية', 'قبلي', 'جنوبي', 'جنوب'] },
  ],
  referenceOptions.facades,
)

export const FLOOR_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'أرضي', aliases: ['الدور الأرضي', 'ارضي', 'دور ارضي', 'ground floor'] },
    { canonical: 'متكرر', aliases: ['دور متكرر', 'طابق متكرر', 'دور وسط'] },
    { canonical: 'أخير', aliases: ['الدور الأخير', 'الطابق الأخير', 'أعلى دور', 'top floor', 'last floor'] },
    { canonical: 'بدروم', aliases: ['البدروم', 'دور بدروم', 'قطعة بدروم', 'basement'] },
    { canonical: 'روف', aliases: ['الروف', 'دور روف', 'روف مستقل', 'roof'] },
    { canonical: 'دوبلكس', aliases: ['دوبلكس', 'دوبليكس', 'duplex'] },
  ],
  referenceOptions.floors,
)

export const CITY_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'كمباوند وصال', aliases: ['كمبوند وصال', 'Compound Wesal', 'Compound Wasl', 'Wesal Compound', 'Wasl Compound'] },
  ],
  referenceOptions.cities,
)

export const CATEGORY_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'بيع', aliases: ['للبيع', 'بيع كاش', 'بيع تمليك', 'تمليك', 'for sale'] },
    { canonical: 'إيجار', aliases: ['للإيجار', 'للايجار', 'تأجير', 'ايجار', 'for rent'] },
    { canonical: 'مفروش', aliases: ['إيجار مفروش', 'ايجار مفروش', 'furnished for rent'] },
  ],
  referenceOptions.categories,
)

/**
 * حالة العقار (status) — تُطابَق فقط لألفاظ صريحة عالية الثقة ومباشرة الدلالة
 * (مباع/مؤجر/متاح/غير متاح). لا تُضاف حالات إدارية داخلية مثل "قيد المراجعة"
 * أو "جاهز للنشر" لأنها نادرًا ما تظهر في نص إعلان خام، ولمنع الخلط مع الكلمة
 * الملتبسة "جاهز" (انظر AMBIGUOUS_TERMS).
 */
export const STATUS_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'مباع', aliases: ['العقار مباع', 'تم البيع', 'مباعة', 'sold'] },
    { canonical: 'مؤجر', aliases: ['العقار مؤجر', 'مؤجرة', 'مؤجر بالكامل', 'مؤجرة بالكامل', 'rented'] },
    { canonical: 'غير متاح', aliases: ['غير متاحة', 'not available'] },
  ],
  referenceOptions.statuses,
)

export const LISTING_TYPE_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'مباشر', aliases: ['من المالك مباشرة', 'من المالك', 'مباشرة من المالك', 'مالك مباشر'] },
    { canonical: 'وسيط', aliases: ['عن طريق وسيط', 'بواسطة وسيط', 'من خلال وسيط', 'مكتب عقاري'] },
    // ملاحظة مقصودة: "بدون وسيط" لا تُضاف كمرادف لـ"مباشر" — فهي نفي لكلمة "وسيط"
    // فقط، وليست دليلاً حاسمًا على أن المصدر هو المالك (تُترك للنفي وتبقى في features).
  ],
  referenceOptions.listingTypes,
)

/**
 * العملة — تُطابَق فقط من رمز/اسم صريح مذكور في النص (جنيه، دولار، ريال...).
 * لا تُستنتج أبدًا من المدينة أو الدولة أو الرقم وحده (قاعدة Fact vs Claim،
 * انظر SMART_ANALYZER_SCHEMA_HANDOFF.md §6).
 */
export const CURRENCY_ALIASES: CanonicalMap[] = buildMap(
  [
    { canonical: 'جنيه مصري', aliases: ['جنيه مصرى', 'جنيه', 'ج.م', 'ج م', 'EGP', 'LE'] },
    { canonical: 'دولار أمريكي', aliases: ['الدولار الأمريكي', 'دولار امريكي', 'دولار', 'USD', '$'] },
    { canonical: 'ريال سعودي', aliases: ['ريال سعودى', 'ريال', 'SAR'] },
    { canonical: 'درهم إماراتي', aliases: ['درهم اماراتي', 'درهم', 'AED'] },
    { canonical: 'يورو', aliases: ['EUR', '€'] },
  ],
  referenceOptions.currencies,
)

// ---------------------------------------------------------------------------
// 4) حقول نعم/لا (ماستر، أسانسير، موقف سيارة) — كلمات إيجابية مع وعي بالنفي
// ---------------------------------------------------------------------------

export const YES_NO_KEYWORDS: Record<'master' | 'elevator' | 'parkingAvailable', string[]> = {
  master: ['ماستر', 'غرفة ماستر', 'ماستر بدروم', 'ح��ام ماستر', 'روم ماستر'],
  elevator: ['أسانسير', 'اسانسير', 'مصعد'],
  // مرتّبة من الأكثر تحديدًا (موقف سيارة/سيارات) إلى الأعم (موقف خاص/موقف)
  // لأن matchYesNo يتوقف عند أول تطابق — نريد الأولوية للعبارة الأكثر وضوحًا
  // إن وُجدت، مع بقاء "موقف" وحدها كافية لأن القائمة المرجعية تستخدمها كذلك
  // ("موقف خاص"، "لا يوجد موقف") دون ذكر كلمة "سيارة" في أغلب الإعلانات.
  parkingAvailable: ['موقف سيارة', 'موقف سيارات', 'مواقف سيارات', 'باركينج', 'جراج', 'كراج', 'موقف خاص', 'موقف'],
}

// ---------------------------------------------------------------------------
// 5) مصطلحات ملتبسة — تُستثنى من المطابقة التلقائية بلا سياق كامل
// ---------------------------------------------------------------------------

/**
 * كلمات لا تُطابَق منفردة لأي حقل select لأنها غامضة بلا سياق إضافي كامل
 * (مثال: "جاهز" وحدها لا تعني بالضرورة حالة معينة، "مدخل" وحدها لا تعني وجود
 * مدخل خاص/مستقل). تُستخدم فقط كتحذير — لا تُنتج أي قيمة في حقل بيانات.
 */
export const AMBIGUOUS_TERMS = [
  'جاهز', 'مدخل', 'عظم', 'قريب من', 'بالقرب من', 'مساحة تقريبية', 'موقع مميز', 'راقي',
] as const

/** عبارات ادعاء/تسويق شائعة — تبقى حرفيًا داخل features ولا تتحول لحقل بيانات أبدًا. */
export const MARKETING_CLAIM_PATTERNS: RegExp[] = [
  /آخر\s*وحدة/i,
  /عائد\s*(?:استثمار\s*)?مضمون/i,
  /أفضل\s*(?:موقع|سعر|فرصة)/i,
  /فرصة\s*(?:لا تفوت|العمر|استثمارية)/i,
  /السعر\s*(?:الحالي|قبل الزيادة)/i,
  /لفترة\s*محدودة/i,
  /خصم\s*خاص/i,
]

// ---------------------------------------------------------------------------
// 6) تطبيع الأرقام (عربي/فواصل/مضاعفات) للمطابقة داخل parse.ts فقط
// ---------------------------------------------------------------------------

// ملاحظة: لا نستخدم \b حول m/k لأن \b لا يفصل بين رقم وحرف (كلاهما \w) في
// صيغ ملتصقة شائعة مثل "850k" أو "2.5m" — نعتمد على أن الحرف يأتي في نهاية
// المقتطف الملتقط (بعد إزالة الفواصل)، لذا نربطه بنهاية النص ($) بدل \b.
const MULTIPLIER_PATTERNS: { pattern: RegExp; multiplier: number }[] = [
  { pattern: /مليون/i, multiplier: 1_000_000 },
  { pattern: /الف|ألف/i, multiplier: 1_000 },
  { pattern: /m$/i, multiplier: 1_000_000 },
  { pattern: /k$/i, multiplier: 1_000 },
]

/**
 * يحاول تفسير رقم عربي/إنجليزي مكتوب بأشكال مختلفة (فواصل، أرقام عربية-هندية،
 * "مليون"/"ألف"/"K"/"M") إلى رقم صحيح. يعيد null إن تعذّر الفهم — لا يُخترع رقم.
 */
export function parseHumanNumber(raw: string): number | null {
  if (!raw) return null
  const normalized = normalizeArabicDigits(raw).trim()
  const numericPart = normalized.match(/[\d,.٫]+/)?.[0]
  if (!numericPart) return null

  const cleaned = numericPart.replace(/,/g, '').replace(/٫/g, '.')
  const base = Number.parseFloat(cleaned)
  if (Number.isNaN(base)) return null

  const multiplierEntry = MULTIPLIER_PATTERNS.find(({ pattern }) => pattern.test(normalized))
  return multiplierEntry ? base * multiplierEntry.multiplier : base
}

/**
 * يفحص إن كان النص يحتوي على أي عبارة ادعاء/تسويق معروفة (MARKETING_CLAIM_PATTERNS).
 * لا يُنشئ حقل بيانات جديدًا أبدًا — هذه إشارة تعريفية فقط (metadata) تُضاف إلى
 * قائمة detectedFields في نتيجة التحليل لتوضيح أن النص يحتوي على ادعاء تسويقي
 * مكتشَف، بينما تبقى العبارة نفسها محفوظة حرفيًا داخل features فقط.
 */
export function detectMarketingClaim(text: string): boolean {
  return MARKETING_CLAIM_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * يستخرج الاقتباسات الحرفية (كما وردت بالضبط) لكل عبارة ادعاء/تسويق مطابقة
 * لأنماط MARKETING_CLAIM_PATTERNS. لا يحوّل أي ادعاء (مثل "عائد مضمون 15%")
 * إلى حقيقة رقمية أو حقل مستقل — يُعاد النص المطابق فقط كما ورد، ليُخزَّن في
 * حقل marketingClaims (Claim لا Fact، انظر SMART_ANALYZER_SCHEMA_HANDOFF.md §8).
 */
export function extractMarketingClaims(text: string): string[] {
  const claims: string[] = []
  for (const pattern of MARKETING_CLAIM_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
    for (const match of text.matchAll(globalPattern)) {
      const claim = match[0]?.trim()
      if (claim && !claims.includes(claim)) claims.push(claim)
    }
  }
  return claims
}

// ---------------------------------------------------------------------------
// 7) الحقول المالية والقانونية المضافة (currency/downPayment/installmentPeriod/
//    deliveryDate/legalStatus/negotiable) — شروط معلنة تُحفظ حرفيًا، لا تُخترع
//    ولا تُحوَّل إلى ضمانات (Fact vs Claim، §6 و§8 من الـhandoff).
// ---------------------------------------------------------------------------

/** كلمات مفتاحية لتحديد بداية عبارة المقدّم/الدفعة الأولى — القيمة تُحفظ كما وردت. */
export const DOWN_PAYMENT_KEYWORDS = [
  'المقدم', 'مقدم الحجز', 'مقدم', 'الدفعة الأولى', 'دفعة أولى', 'down payment', 'downpayment',
] as const

/** كلمات مفتاحية لمدة التقسيط — القيمة تُحفظ كما وردت، دون تحويلها لعدد أشهر. */
export const INSTALLMENT_PERIOD_KEYWORDS = [
  'مدة التقسيط', 'فترة التقسيط', 'التقسيط على مدار', 'تقسيط على', 'installment period', 'installments over', 'تقسيط',
] as const

/** كلمات مفتاحية لموعد/شرط التسليم — القيمة تُحفظ كما وردت (فوري/خلال سنتين/تاريخ صريح). */
export const DELIVERY_DATE_KEYWORDS = [
  'موعد التسليم', 'تاريخ التسليم', 'شرط التسليم', 'التسليم', 'تسليم', 'delivery date', 'handover',
] as const

/**
 * عبارات الحالة القانونية/الملكية المعروفة في السوق العقاري — نص حر وليس enum
 * (§6 من الـhandoff). مرتّبة من الأكثر تحديدًا إلى الأعم لتفضيل العبارة الكاملة
 * عند وجودها. لا تُعتبر ادعاء المعلن تحققًا قانونيًا موثقًا.
 */
export const LEGAL_STATUS_TERMS = [
  'مسجل عقاريا بالكامل',
  'مسجل عقاريا',
  'عقد ابتدائي مسجل',
  'عقد ابتدائي',
  'توكيل عام غير مسجل',
  'توكيل عام',
  'تمليك حر',
  'تمليك',
  'عقد عرفي',
] as const

/** عبارات صريحة تفيد أن السعر قابل للتفاوض. */
export const NEGOTIABLE_KEYWORDS = ['قابل للتفاوض', 'قابل للنقاش', 'يقبل التفاوض', 'negotiable'] as const

/** عبارات مستقلة (لا تعتمد على أداة نفي) تفيد أن السع�� نهائي/غير قابل للتفاوض. */
export const NOT_NEGOTIABLE_PHRASES = [
  'غير قابل للتفاوض', 'غير قابل للنقاش', 'السعر نهائي', 'سعر نهائي', 'fixed price', 'non-negotiable',
] as const

/**
 * يبحث عن أول عبارة من `terms` موجودة فعليًا في النص وغير منفية (isNegatedAt)،
 * ويعيدها كما هي في القائمة (بلا اختراع أو إعادة صياغة). يُستخدم لحقول نصية
 * حرة (غير select) مثل legalStatus حيث لا يجوز حصر القيم في enum ضيق.
 */
export function matchFirstTerm(text: string, terms: readonly string[]): string {
  const normalizedText = normalizeForMatch(text)
  for (const term of terms) {
    const idx = normalizedText.indexOf(normalizeForMatch(term))
    if (idx !== -1 && !isNegatedAt(normalizedText, idx)) return term
  }
  return ''
}

/** يتحقق من وجود عبارة تأكيدية مستقلة (غير منفية) ضمن `phrases` داخل النص. */
export function matchAssertivePhrase(text: string, phrases: readonly string[]): boolean {
  const normalizedText = normalizeForMatch(text)
  return phrases.some((phrase) => {
    const idx = normalizedText.indexOf(normalizeForMatch(phrase))
    return idx !== -1 && !isNegatedAt(normalizedText, idx)
  })
}

export const knowledgeBase = {
  TYPE_ALIASES,
  FINISHING_ALIASES,
  VIEW_ALIASES,
  FACADE_ALIASES,
  FLOOR_ALIASES,
  CATEGORY_ALIASES,
  LISTING_TYPE_ALIASES,
  STATUS_ALIASES,
  CURRENCY_ALIASES,
  YES_NO_KEYWORDS,
  AMBIGUOUS_TERMS,
  MARKETING_CLAIM_PATTERNS,
  NEGATION_WORDS,
  DOWN_PAYMENT_KEYWORDS,
  INSTALLMENT_PERIOD_KEYWORDS,
  DELIVERY_DATE_KEYWORDS,
  LEGAL_STATUS_TERMS,
  NEGOTIABLE_KEYWORDS,
  NOT_NEGOTIABLE_PHRASES,
}
