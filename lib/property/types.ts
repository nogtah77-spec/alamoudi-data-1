export type PropertyField = {
  key: keyof PropertyRecord
  label: string
  hint?: string
  section: 'basic' | 'details' | 'location' | 'source' | 'media'
  kind: 'text' | 'textarea' | 'select' | 'number'
  options?: readonly string[]
  required?: boolean
  placeholder?: string
}

export type PropertyRecord = {
  code: string
  title: string
  price: string
  size: string
  builtSize: string
  landSize: string
  beds: string
  masterBedrooms: string
  baths: string
  floor: string
  floorCount: string
  floorType: string
  roof: string
  master: string
  elevator: string
  finishing: string
  view: string
  facade: string
  parkingAvailable: string
  features: string
  category: string
  status: string
  featured: string
  listingType: string
  type: string
  region: string
  city: string
  district: string
  locationUrl: string
  listingUrl: string
  videoUrl: string
  images: string
  sourceName: string
  sourceNumber: string
  sourceLocation: string
  sourceDescription: string
  responsibleEmployee: string
  dateAdded: string
  currency: string
  downPayment: string
  remainingAmount: string
  installmentCount: string
  installmentAmount: string
  installmentFrequency: string
  installmentPeriod: string
  deliveryDate: string
  legalStatus: string
  negotiable: string
  sourceRawText: string
}

export const referenceOptions = {
  types: ['شقة', 'أستوديو', 'فيلا', 'عمارة', 'محل', 'مكتب', 'عيادة', 'توين هاوس', 'بنت هاوس', 'تاون هاوس'],
  categories: ['بيع', 'إيجار', 'مفروش'],
  statuses: ['قيد المراجعة', 'جاهز للنشر', 'مباع', 'مؤجر', 'موقوف', 'غير متاح'],
  featured: ['نعم', 'لا'],
  listingTypes: ['مباشر', 'وسيط'],
  floors: ['أرضي', 'متكرر', 'أخير', 'بدروم', 'دوبلكس'],
  finishings: ['متشطب', 'نص تشطيب', 'مفروش', 'سوبر لوكس', 'طوب أحمر', 'ألترا سوبر لوكس'],
  views: ['جنينة خاصة', 'فيو مفتوح', 'فيو جنينة', 'باركنج', 'فيو نادي + جنينة'],
  facades: ['أمامي', 'خلفي', 'خلفي جانبي', 'بحري', 'شرقي', 'غربي', 'قبلي'],
  yesNo: ['نعم', 'لا'],
  cities: ['مدينة الشروق', 'كمباوند وصال', 'مدينتي', 'بدر', 'هليوبليس الجديدة', 'التجمع', 'بيت الوطن', 'مدينة نصر'],
  currencies: ['جنيه مصري', 'دولار أمريكي', 'ريال سعودي', 'درهم إماراتي', 'يورو'],
} as const

export const emptyProperty: PropertyRecord = {
  code: '',
  title: '',
  price: '',
  size: '',
  builtSize: '',
  landSize: '',
  beds: '',
  masterBedrooms: '',
  baths: '',
  floor: '',
  floorCount: '',
  floorType: '',
  roof: '',
  master: '',
  elevator: '',
  finishing: '',
  view: '',
  facade: '',
  parkingAvailable: '',
  features: '',
  category: '',
  status: '',
  featured: '',
  listingType: '',
  type: '',
  region: '',
  city: '',
  district: '',
  locationUrl: '',
  listingUrl: '',
  videoUrl: '',
  images: '',
  sourceName: '',
  sourceNumber: '',
  sourceLocation: '',
  sourceDescription: '',
  responsibleEmployee: '',
  dateAdded: '',
  currency: '',
  downPayment: '',
  remainingAmount: '',
  installmentCount: '',
  installmentAmount: '',
  installmentFrequency: '',
  installmentPeriod: '',
  deliveryDate: '',
  legalStatus: '',
  negotiable: '',
  sourceRawText: '',
}

export const propertyFields: PropertyField[] = [
  { key: 'code', label: 'كود العقار', section: 'basic', kind: 'text', placeholder: 'يُنشأ تلقائيًا إن تُرك فارغًا' },
  { key: 'type', label: 'نوع العقار', section: 'basic', kind: 'select', options: referenceOptions.types },
  { key: 'category', label: 'الفئة', section: 'basic', kind: 'select', options: referenceOptions.categories },
  { key: 'status', label: 'حالة العقار', section: 'basic', kind: 'select', options: referenceOptions.statuses },
  { key: 'featured', label: 'مميز', section: 'basic', kind: 'select', options: referenceOptions.featured },
  { key: 'listingType', label: 'نوع العرض', section: 'basic', kind: 'select', options: referenceOptions.listingTypes },
  { key: 'dateAdded', label: 'تاريخ الإضافة', section: 'basic', kind: 'text', placeholder: 'YYYY-MM-DD' },

  { key: 'price', label: 'السعر', section: 'details', kind: 'number', required: true },
  { key: 'size', label: 'المساحة (م²)', section: 'details', kind: 'number' },
  { key: 'builtSize', label: 'مساحة المباني (م²)', section: 'details', kind: 'number' },
  { key: 'landSize', label: 'مساحة الأرض (م²)', section: 'details', kind: 'number' },
  { key: 'beds', label: 'غرف النوم', section: 'details', kind: 'number' },
  { key: 'masterBedrooms', label: 'غرف الماستر', section: 'details', kind: 'number' },
  { key: 'baths', label: 'الحمامات', section: 'details', kind: 'number' },
  { key: 'floor', label: 'الدور', section: 'details', kind: 'text', placeholder: 'مثال: الثالث أو 3' },
  { key: 'floorCount', label: 'عدد الطوابق', section: 'details', kind: 'number' },
  { key: 'floorType', label: 'نوع الطابق', section: 'details', kind: 'select', options: referenceOptions.floors },
  { key: 'roof', label: 'روف', section: 'details', kind: 'text', placeholder: 'نعم أو المساحة بالمتر' },
  { key: 'finishing', label: 'التشطيب', section: 'details', kind: 'select', options: referenceOptions.finishings },
  { key: 'view', label: 'الفيو', section: 'details', kind: 'select', options: referenceOptions.views },
  { key: 'facade', label: 'الواجهة', section: 'details', kind: 'text', placeholder: 'أمامي / خلفي' },
  { key: 'master', label: 'ماستر', section: 'details', kind: 'select', options: referenceOptions.yesNo },
  { key: 'elevator', label: 'أسانسير', section: 'details', kind: 'select', options: referenceOptions.yesNo },
  { key: 'parkingAvailable', label: 'موقف السيارة', section: 'details', kind: 'select', options: referenceOptions.yesNo },
  { key: 'currency', label: 'العملة', section: 'details', kind: 'select', options: referenceOptions.currencies },
  { key: 'downPayment', label: 'المقدم', section: 'details', kind: 'text', placeholder: 'مثال: 10% أو 500 ألف' },
  { key: 'remainingAmount', label: 'المبلغ المتبقي', section: 'details', kind: 'text' },
  { key: 'installmentCount', label: 'عدد الأقساط', section: 'details', kind: 'number' },
  { key: 'installmentAmount', label: 'قيمة القسط', section: 'details', kind: 'text' },
  { key: 'installmentFrequency', label: 'دورية السداد', section: 'details', kind: 'text' },
  { key: 'installmentPeriod', label: 'مدة التقسيط', section: 'details', kind: 'text', placeholder: 'مثال: 8 سنوات' },
  { key: 'deliveryDate', label: 'التسليم', section: 'details', kind: 'text', placeholder: 'مثال: فوري أو خلال سنتين' },
  { key: 'legalStatus', label: 'الحالة القانونية', section: 'details', kind: 'text', placeholder: 'مثال: تمليك، عقد ابتدائي، مسجل عقاريًا' },
  { key: 'negotiable', label: 'قابل للتفاوض', section: 'details', kind: 'select', options: referenceOptions.yesNo },
  { key: 'city', label: 'المدينة', section: 'location', kind: 'select', options: referenceOptions.cities },
  { key: 'region', label: 'المنطقة', hint: 'داخل المدينة', section: 'location', kind: 'text', required: true },
  { key: 'district', label: 'الحي', hint: 'داخل المدينة', section: 'location', kind: 'text', required: true },
  { key: 'locationUrl', label: 'رابط الموقع (خرائط)', section: 'location', kind: 'text' },

  { key: 'sourceName', label: 'اسم المصدر', section: 'source', kind: 'text' },
  { key: 'sourceNumber', label: 'رقم المصدر', section: 'source', kind: 'text' },
  { key: 'sourceLocation', label: 'موقع المصدر', section: 'source', kind: 'text' },
  { key: 'sourceDescription', label: 'وصف المصدر', section: 'source', kind: 'textarea' },
  { key: 'responsibleEmployee', label: 'الموظف المسؤول', section: 'source', kind: 'text' },

  { key: 'listingUrl', label: 'رابط الإعلان', section: 'media', kind: 'text' },
  { key: 'videoUrl', label: 'رابط الفيديو', section: 'media', kind: 'text' },
  { key: 'images', label: 'روابط الصور (مفصولة بفاصلة)', section: 'media', kind: 'textarea' },
]

export const sectionLabels: Record<PropertyField['section'], string> = {
  basic: 'البيانات الأساسية',
  details: 'التفاصيل والمواصفات',
  location: 'الموقع',
  source: 'بيانات المصدر',
  media: 'الروابط والوسائط',
}
