import { db } from '../db.js';

/**
 * Каналы доставки. Сейчас работает только внутренний (запись в БД).
 * Telegram/WhatsApp подключаются добавлением функции в CHANNELS.
 */
const CHANNELS = {
  inapp: (userId, payload) => {
    db.prepare(
      `INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)`
    ).run(userId, payload.type, payload.title, payload.body ?? null, payload.link ?? null);
  },
};

export function notify(userId, type, title, body, link) {
  if (!userId) return;
  for (const send of Object.values(CHANNELS)) {
    try {
      send(userId, { type, title, body, link });
    } catch (err) {
      console.error('Не удалось отправить уведомление:', err.message);
    }
  }
}

export function notifyMany(userIds, type, title, body, link) {
  for (const id of new Set(userIds.filter(Boolean))) notify(id, type, title, body, link);
}

export const TEMPLATES = {
  registered: () => ['registered', 'Регистрация завершена', 'Выберите тип волонтерства и заполните анкету.', '#/profile'],
  applicationSubmitted: () => ['application_submitted', 'Анкета отправлена', 'Заявка на рассмотрении. Мы сообщим о решении.', '#/profile'],
  approved: () => ['application_approved', 'Заявка одобрена', 'Доступ к мероприятиям открыт.', '#/events'],
  rejected: (comment) => ['application_rejected', 'Заявка отклонена', comment || 'Решение принято администратором.', '#/profile'],
  revision: (comment) => ['application_revision', 'Анкету нужно заполнить заново', comment || 'Уточните данные и отправьте анкету повторно.', '#/application'],
  coordinatorAssigned: (name) => ['coordinator_assigned', 'Назначен координатор', `Ваш координатор: ${name}`, '#/profile'],
  newEvent: (title) => ['event_created', 'Новое мероприятие', title, '#/events'],
  eventUpdated: (title) => ['event_updated', 'Мероприятие изменено', title, '#/events'],
  eventCancelled: (title) => ['event_cancelled', 'Мероприятие отменено', title, '#/events'],
  participationAccepted: (title) => ['participation_accepted', 'Участие подтверждено', title, '#/events'],
  participationRejected: (title) => ['participation_rejected', 'Заявка на мероприятие отклонена', title, '#/events'],
  hoursAdded: (hours, title) => ['hours_added', 'Начислены часы', `+${hours} ч за «${title}»`, '#/profile'],
};
