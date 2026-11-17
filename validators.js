const CATEGORIES = ['Сукні', 'Піджаки', 'Верхній одяг'];
const SIZES = ['XS', 'S', 'M', 'L'];
const MAX_RENTAL_DAYS = 30;

const isString = (v) => typeof v === 'string';

function isEmail(v) {
  return isString(v) && v.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

// Формат РРРР-ММ-ДД і справжня дата (відхиляє 2026-02-31)
function isIsoDate(v) {
  if (!isString(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === v;
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function validateRegistration({ name, email, password }) {
  if (!isString(name) || name.trim().length < 2 || name.trim().length > 50) {
    return 'Імʼя має містити від 2 до 50 символів';
  }
  if (!isEmail(email)) return 'Некоректний email';
  // bcrypt обробляє не більше 72 байтів пароля
  if (!isString(password) || password.length < 6 || password.length > 72) {
    return 'Пароль має містити від 6 до 72 символів';
  }
  return null;
}

function validateItem(b) {
  if (!isString(b.title) || !b.title.trim() || b.title.length > 100) {
    return 'Назва обовʼязкова (до 100 символів)';
  }
  if (typeof b.price_per_day !== 'number' || !(b.price_per_day > 0) || b.price_per_day > 1000000) {
    return 'Ціна за день має бути додатним числом';
  }
  const deposit = b.deposit ?? 0;
  if (typeof deposit !== 'number' || deposit < 0 || deposit > 10000000) {
    return 'Застава має бути числом не менше 0';
  }
  if (!CATEGORIES.includes(b.category)) return 'Невідома категорія';
  if (!SIZES.includes(b.size)) return 'Невідомий розмір';
  if (b.designer != null && (!isString(b.designer) || b.designer.length > 100)) {
    return 'Імʼя дизайнера не довше 100 символів';
  }
  if (b.description != null && (!isString(b.description) || b.description.length > 1000)) {
    return 'Опис не довший за 1000 символів';
  }
  const img = b.image_url ?? '';
  if (
    !isString(img) ||
    img.length > 500 ||
    (img !== '' && !/^(\/uploads\/[\w.-]+|https?:\/\/\S+)$/.test(img))
  ) {
    return 'Некоректне посилання на зображення';
  }
  return null;
}

function validateRentalDates(start, end) {
  if (!isIsoDate(start) || !isIsoDate(end)) return 'Дати мають бути у форматі РРРР-ММ-ДД';
  if (start < todayStr()) return 'Дата початку не може бути в минулому';
  if (end < start) return 'Дата завершення не може бути раніше за дату початку';
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  if (days > MAX_RENTAL_DAYS) return `Максимальний термін оренди: ${MAX_RENTAL_DAYS} днів`;
  return null;
}

module.exports = { validateRegistration, validateItem, validateRentalDates };