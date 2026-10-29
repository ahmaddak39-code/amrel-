// Первичное наполнение: только реальные модели AMREL с присланных фотографий.
// Цены, размеры и наличие НЕ заполнены намеренно — их задаёт владелец в админ-панели.

const COLORS = {
  white: { name: 'Белый', hex: '#F2F1EC' },
  black: { name: 'Чёрный', hex: '#0E0E0E' },
  navy: { name: 'Тёмно-синий', hex: '#1C2B52' },
  royal: { name: 'Синий', hex: '#26408A' },
};

const v = (key, colors) =>
  colors.map((c) => ({
    id: c,
    name: COLORS[c].name,
    hex: COLORS[c].hex,
    images: [`/img/products/${key}-${c}-front.webp`, `/img/products/${key}-${c}-back.webp`],
    spin: [],
    sizes: [],
  }));

export const SEED_CATEGORIES = [
  { id: 'cat-tshirts', slug: 'tshirts', name: 'Футболки' },
  { id: 'cat-hoodies', slug: 'hoodies', name: 'Худи' },
  { id: 'cat-sweatshirts', slug: 'sweatshirts', name: 'Свитшоты' },
];

const T = 'cat-tshirts';
const front = 'Спереди — фирменный знак AMREL';

export const SEED_PRODUCTS = [
  {
    slug: 'amrel-without-limits', name: 'AMREL Without Limits', categoryId: T, featured: true,
    description: 'Оверсайз-футболка с манифестом бренда. Спереди — надпись AMREL с оранжевым росчерком, на спине — крупная рукописная надпись AMREL WITHOUT LIMITS.',
    variants: v('limits', ['white', 'navy']),
  },
  {
    slug: 'dubai-nights', name: 'Dubai Nights', categoryId: T, featured: true,
    description: `Оверсайз-футболка. ${front} на груди слева, на спине — графика ночного Дубая с оранжевым солнцем и подписью FEARLESS / LIMITLESS.`,
    variants: v('dubai', ['navy', 'black', 'white']),
  },
  {
    slug: 'khasavyurt-heart-of-dagestan', name: 'Khasavyurt — The Heart of Dagestan', categoryId: T, featured: true,
    description: `Оверсайз-футболка. ${front} по центру груди, на спине — указатель направлений и улица Хасавюрта с надписью THE HEART OF DAGESTAN.`,
    variants: v('heart', ['white', 'black', 'navy']),
  },
  {
    slug: 'mind-over-all', name: 'Mind Over All 心', categoryId: T, featured: true,
    description: `Оверсайз-футболка. ${front} по центру груди, на спине — иероглиф 心, горный пейзаж в технике туши и подпись BEYOND LIMITS.`,
    variants: v('mind', ['royal', 'black', 'white']),
  },
  {
    slug: 'tokyo-drive', name: 'Tokyo Drive', categoryId: T, featured: true,
    description: `Оверсайз-футболка. ${front} на груди слева, на спине — ночной Токио, спорткар и подпись NO ROADS, NO LIMITS.`,
    variants: v('tokyo', ['navy', 'white']),
  },
  {
    slug: 'live-with-purpose', name: 'Live With Purpose 生き甲斐', categoryId: T, featured: true,
    description: `Оверсайз-футболка. ${front} по центру груди, на спине — дерево сакуры на фоне красного солнца, надпись 生き甲斐 и LIVE WITH PURPOSE.`,
    variants: v('purpose', ['navy', 'white']),
  },
  {
    slug: 'khasavyurt-toturbieva-boulevard', name: 'Khasavyurt — Toturbieva Boulevard', categoryId: T,
    description: `Оверсайз-футболка. ${front} по центру груди, на спине — бульвар Тотурбиева на закате и подпись FEARLESS / LIMITLESS.`,
    variants: v('toturbieva', ['black', 'white']),
  },
  {
    slug: 'driven-by-ambition', name: 'Driven by Ambition', categoryId: T,
    description: `Оверсайз-футболка. ${front} на груди слева, на спине — графика с автомобилями и пальмами, надпись Driven by Ambition.`,
    variants: v('driven', ['black', 'white']),
  },
  {
    slug: 'monaco-monte-carlo', name: 'Monaco Monte Carlo', categoryId: T,
    description: `Оверсайз-футболка. ${front} по центру груди, на спине — винтажная марка с трассой Монте-Карло и гоночным болидом.`,
    variants: v('monaco', ['white', 'black']),
  },
  {
    slug: 'vf-07-future-in-progress', name: 'VF-07 Future in Progress', categoryId: T,
    description: `Оверсайз-футболка. ${front} на груди слева, на спине — техно-графика со сферой из колец и подписью FUTURE IN PROGRESS.`,
    variants: v('vf07', ['white']),
  },
  {
    slug: 'system-07', name: 'System 07', categoryId: T,
    description: `Оверсайз-футболка. ${front} на груди слева, на спине — системный интерфейс «07» со штрихкодом, координатами и каркасной сферой.`,
    variants: v('sys07', ['white']),
  },
];

export const DEFAULT_SETTINGS = {
  hero: {
    eyebrow: 'Коллекция футболок AMREL',
    title: 'СТИЛЬ БЕЗ ГРАНИЦ',
    subtitle: 'Индивидуальность в каждой детали',
    image: '/img/products/dubai-black-back.webp',
    imageSecondary: '/img/products/tokyo-navy-back.webp',
    imageThird: '/img/products/mind-white-back.webp',
  },
  slogan: 'AMREL. WITHOUT LIMITS.',
  about: {
    title: 'Философия AMREL',
    lead: 'Одежда, которая не просит разрешения.',
    text: 'AMREL — это streetwear для тех, кто сам задаёт направление. Каждый принт — отдельная история: города, дороги, горы, скорость и внутренний стержень. Мы держим форму простой, чтобы говорил характер.\n\nЧистые оверсайз-силуэты, графика на спине и фирменный знак с оранжевым росчерком — узнаваемый почерк бренда.',
    pillars: [
      { title: 'Характер', text: 'Принты с собственным смыслом — от Хасавюрта до Токио.' },
      { title: 'Форма', text: 'Свободный оверсайз-крой и лаконичный знак на груди.' },
      { title: 'Свобода', text: 'Fearless. Limitless. Твой стиль — твои правила.' },
    ],
    image: '/img/scenes/vf07-scene.webp',
  },
  quote: 'ТВОЙ СТИЛЬ. ТВОИ ПРАВИЛА. БЕЗ ГРАНИЦ.',
  marquee: ['FEARLESS / LIMITLESS', 'MIND OVER ALL', 'DRIVEN BY AMBITION', 'NO ROADS, NO LIMITS', 'LIVE WITH PURPOSE', 'FUTURE IN PROGRESS'],
  lookbook: [
    { image: '/img/scenes/mind-backs.webp', caption: 'Mind Over All', link: '/product/mind-over-all' },
    { image: '/img/scenes/dubai-backs.webp', caption: 'Dubai Nights', link: '/product/dubai-nights' },
    { image: '/img/scenes/tokyo-backs.webp', caption: 'Tokyo Drive', link: '/product/tokyo-drive' },
    { image: '/img/scenes/limits-backs.webp', caption: 'Without Limits', link: '/product/amrel-without-limits' },
    { image: '/img/scenes/monaco-backs.webp', caption: 'Monaco', link: '/product/monaco-monte-carlo' },
    { image: '/img/scenes/purpose-backs.webp', caption: 'Live With Purpose', link: '/product/live-with-purpose' },
  ],
  contacts: {
    address: 'Тотурбиева, 202',
    phone: '+7 928 585-89-89',
    whatsapp: '79285858989',
    whatsappText: 'Здравствуйте! Пишу с сайта AMREL. Хочу узнать подробнее о вашей одежде',
    instagram: 'amrel.official',
    hours: '',
  },
  delivery: 'После оформления заявки менеджер свяжется с вами, чтобы подтвердить наличие, размер и способ оплаты. Возможен самовывоз по адресу магазина.',
  sizeChart: {
    note: '',
    columns: ['Размер', 'Ширина, см', 'Длина, см'],
    rows: [],
  },
};
