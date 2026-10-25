export const categories = [
  { id: 'household', label: 'Бытовая помощь', icon: 'bag', tone: 'blue' },
  { id: 'digital', label: 'Цифровая помощь', icon: 'laptop', tone: 'lavender' },
  { id: 'home', label: 'Дом и животные', icon: 'plant', tone: 'green' },
  { id: 'study', label: 'Учёба и документы', icon: 'book', tone: 'peach' },
  { id: 'support', label: 'Поддержка и забота', icon: 'heart', tone: 'pink' },
  { id: 'other', label: 'Другая помощь', icon: 'sparkles', tone: 'yellow' },
]
export const districts = ['Центральный', 'Северный', 'Южный', 'Восточный', 'Западный']
export const initialData = {
  profile: { name: 'Анна Иванова', district: 'Центральный', availability: 'Будни после 18:00', about: 'Верю, что добро начинается с мелочей. Помогаю соседям с техникой, покупками и иногда присматриваю за их питомцами. Буду рада познакомиться!', skills: ['Цифровая помощь', 'Бытовая помощь', 'Дом и животные'] },
  tasks: [
    { id: 'groceries', category: 'household', title: 'Донести покупки из магазина', description: 'Нужна помощь с тяжёлыми пакетами. Магазин совсем рядом с домом, но одной донести покупки непросто. Буду очень благодарна!', when: 'Сегодня, после 19:00', district: 'Центральный', distance: 400, urgent: true, online: false, name: 'Марина', rating: '4,8', deals: 12, tone: 'peach', status: 'active' },
    { id: 'wifi', category: 'digital', title: 'Помочь настроить Wi-Fi', description: 'Интернет иногда пропадает. Хочу разобраться с настройками роутера. Можно созвониться и попробовать всё сделать вместе.', when: 'В удобное время · 30 минут', district: 'Центральный', distance: 1200, online: true, name: 'Пётр', rating: '4,9', deals: 27, tone: 'lavender', status: 'active' },
    { id: 'flowers', category: 'home', title: 'Полить цветы, пока я в отъезде', description: 'Уезжаю на три дня. Нужно пару раз заглянуть и полить растения на подоконнике. Всё покажу и оставлю короткую инструкцию.', when: 'На этой неделе · 15 минут', district: 'Центральный', distance: 200, isNew: true, online: false, name: 'Ольга', rating: '4,7', deals: 5, tone: 'green', status: 'active' },
    { id: 'documents', category: 'study', title: 'Помочь заполнить заявление', description: 'Нужно разобраться с электронной формой заявления. Будет здорово, если кто-то объяснит, какие поля и как заполнить.', when: 'В удобное время · 30 минут', district: 'Северный', distance: null, online: true, name: 'Сергей', rating: '5,0', deals: 3, tone: 'blue', status: 'active' },
    { id: 'clinic', category: 'support', title: 'Проводить до поликлиники', description: 'Ищу доброго соседа, чтобы вместе дойти до поликлиники и вернуться домой. Дорога займёт около двадцати минут.', when: 'Во вторник, 10:00', district: 'Центральный', distance: 800, online: false, name: 'Нина', rating: '4,9', deals: 8, tone: 'pink', status: 'active' },
    { id: 'dog', category: 'home', title: 'Погулять с собакой вечером', description: 'Задерживаюсь на работе. Наш дружелюбный корги будет рад небольшой прогулке по двору. Поводок оставлю у соседки.', when: 'Сегодня, 20:00 · 40 минут', district: 'Центральный', distance: 150, urgent: true, online: false, name: 'Елена', rating: '4,8', deals: 21, tone: 'yellow', status: 'active' },
    { id: 'my-shelf', category: 'household', title: 'Помочь собрать книжный стеллаж', description: 'Все детали и инструменты уже есть. Нужна ещё одна пара рук, чтобы придержать полки во время сборки.', when: 'В выходные · около часа', district: 'Центральный', distance: null, online: false, name: 'Анна', rating: '4,9', deals: 12, tone: 'peach', owner: true, status: 'active' },
    { id: 'my-boxes', category: 'household', title: 'Помочь занести коробки', description: 'Спасибо за помощь с переездом! Вместе удалось быстро поднять все коробки на третий этаж.', when: 'Завершено 20 октября', district: 'Центральный', distance: null, online: false, name: 'Анна', rating: '4,9', deals: 12, tone: 'peach', owner: true, status: 'completed' },
  ],
  responses: [
    { taskId: 'wifi', status: 'accepted', message: 'Помогу разобраться с настройками. Можем созвониться вечером.' },
    { taskId: 'clinic', status: 'waiting', message: 'Добрый день! Во вторник свободна, с радостью провожу вас.' },
  ],
}
export function plural(number, forms = ['заявка', 'заявки', 'заявок']) {
  const lastTwo = number % 100
  const last = number % 10
  return `${number} ${forms[lastTwo > 10 && lastTwo < 20 ? 2 : last === 1 ? 0 : last > 1 && last < 5 ? 1 : 2]}`
}
export function locationLabel(task) {
  if (task.online) return 'Можно помочь онлайн'
  const distance = task.distance == null ? '' : task.distance < 1000 ? ` · ${task.distance} м` : ` · ${String(task.distance / 1000).replace('.', ',')} км`
  return `${task.district} район${distance}`
}
