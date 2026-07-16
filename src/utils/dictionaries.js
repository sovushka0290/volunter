/**
 * Справочники направлений и навыков.
 * Используются в анкете, в фильтрах базы волонтеров и в подборе кандидатов.
 */
export const DIRECTIONS = [
  {
    key: 'content',
    title: 'Контент',
    skills: [
      { key: 'designer', title: 'Дизайнер' },
      { key: 'photographer', title: 'Фотограф' },
      { key: 'videographer', title: 'Видеограф' },
      { key: 'editor', title: 'Монтажер' },
      { key: 'smm', title: 'SMM' },
      { key: 'copywriter', title: 'Копирайтер' },
    ],
  },
  {
    key: 'it',
    title: 'IT',
    skills: [
      { key: 'frontend', title: 'Frontend' },
      { key: 'backend', title: 'Backend' },
      { key: 'mobile', title: 'Mobile' },
      { key: 'uxui', title: 'UX/UI' },
      { key: 'analytics', title: 'Аналитика' },
      { key: 'devops', title: 'DevOps' },
    ],
  },
  {
    key: 'events',
    title: 'Организация мероприятий',
    skills: [
      { key: 'logistics', title: 'Логистика' },
      { key: 'registration', title: 'Регистрация участников' },
      { key: 'stage', title: 'Работа со сценой' },
      { key: 'tech_support', title: 'Техническое сопровождение' },
    ],
  },
  {
    key: 'media',
    title: 'Медиа',
    skills: [
      { key: 'interview', title: 'Интервью' },
      { key: 'host', title: 'Ведущий' },
      { key: 'press', title: 'Пресс-служба' },
    ],
  },
];

export const QUALITIES = [
  'Ответственность',
  'Коммуникабельность',
  'Пунктуальность',
  'Работа в команде',
  'Стрессоустойчивость',
  'Лидерство',
  'Инициативность',
  'Внимательность к деталям',
];

export const LANGUAGES = ['Казахский', 'Русский', 'Английский', 'Турецкий', 'Китайский', 'Немецкий'];

export const FREE_TIME = [
  { key: 'weekdays_day', title: 'Будни, день' },
  { key: 'weekdays_evening', title: 'Будни, вечер' },
  { key: 'weekends', title: 'Выходные' },
  { key: 'flexible', title: 'Свободный график' },
];

export const SKILL_TITLES = Object.fromEntries(
  DIRECTIONS.flatMap((d) => d.skills.map((s) => [s.key, s.title]))
);
export const DIRECTION_TITLES = Object.fromEntries(DIRECTIONS.map((d) => [d.key, d.title]));
export const ALL_SKILL_KEYS = Object.keys(SKILL_TITLES);
export const ALL_DIRECTION_KEYS = Object.keys(DIRECTION_TITLES);
