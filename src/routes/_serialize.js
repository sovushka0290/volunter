import { db } from '../db.js';
import { ageFrom, parseJson } from '../utils/helpers.js';

/** Пользователь без пароля, с возрастом и координатором. */
export async function publicUser(u) {
  if (!u) return null;
  const stats = await db.prepare(`SELECT * FROM volunteer_stats WHERE user_id = ?`).get(u.id) || {};
  const coordinator = u.coordinator_id
    ? await db.prepare(`SELECT id, full_name, contact FROM users WHERE id = ?`).get(u.coordinator_id)
    : null;
  return {
    id: u.id,
    contact: u.contact,
    role: u.role,
    full_name: u.full_name,
    birth_date: u.birth_date,
    age: ageFrom(u.birth_date),
    gender: u.gender,
    city: u.city,
    email: u.email,
    photo_url: u.photo_url,
    is_blocked: !!u.is_blocked,
    volunteer_type: u.volunteer_type,
    application_status: u.application_status,
    coordinator,
    total_hours: Number(stats.total_hours || 0),
    events_count: Number(stats.events_count || 0),
    last_event_at: stats.last_event_at || null,
    created_at: u.created_at,
  };
}

export function publicApplication(a) {
  if (!a) return null;
  return {
    id: a.id,
    user_id: a.user_id,
    volunteer_type: a.volunteer_type,
    status: a.status,
    education: a.education,
    occupation: a.occupation,
    languages: parseJson(a.languages_json, []),
    skills: parseJson(a.skills_json, []),
    directions: parseJson(a.directions_json, []),
    interests: parseJson(a.interests_json, []),
    qualities: parseJson(a.qualities_json, []),
    goals: a.goals,
    motivation: a.motivation,
    experience: a.experience,
    has_car: !!a.has_car,
    has_laptop: !!a.has_laptop,
    free_time: a.free_time,
    answers: parseJson(a.answers_json, {}),
    review_comment: a.review_comment,
    reviewed_at: a.reviewed_at,
    submitted_at: a.submitted_at,
  };
}

export async function publicEvent(e, viewerId) {
  if (!e) return null;
  const counts = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN status IN ('signed_up','accepted') THEN 1 ELSE 0 END) AS signed_up,
         SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted
       FROM registrations WHERE event_id = ?`
    )
    .get(e.id);
  const coordinator = e.coordinator_id
    ? await db.prepare(`SELECT id, full_name, contact FROM users WHERE id = ?`).get(e.coordinator_id)
    : null;
  const myRegistration = viewerId
    ? await db.prepare(`SELECT id, status, attendance, hours FROM registrations WHERE event_id = ? AND user_id = ?`).get(e.id, viewerId)
    : null;
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    location: e.location,
    city: e.city,
    needed_count: e.needed_count,
    requirements: e.requirements,
    directions: parseJson(e.directions_json, []),
    status: e.status,
    coordinator,
    signed_up_count: Number(counts?.signed_up || 0),
    accepted_count: Number(counts?.accepted || 0),
    my_registration: myRegistration || null,
    created_at: e.created_at,
  };
}
