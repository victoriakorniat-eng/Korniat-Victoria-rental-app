const API = '/api';

const STATUS_LABELS = {
  created: 'Створена',
  confirmed: 'Підтверджена',
  issued: 'Видана',
  returned: 'Повернена',
  cancelled: 'Скасована',
};

function getAuth() {
  return JSON.parse(localStorage.getItem('auth') || 'null');
}
function setAuth(data) {
  if (data) localStorage.setItem('auth', JSON.stringify(data));
  else localStorage.removeItem('auth');
}

async function api(path, options = {}) {
  const auth = getAuth();
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = 'Bearer ' + auth.token;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Помилка сервера');
  return data;
}

function renderAuthArea() {
  const area = document.getElementById('auth-area');
  const forms = document.getElementById('auth-forms');
  const mySection = document.getElementById('my-rentals-section');
  const auth = getAuth();
  area.textContent = '';
  if (auth) {
    const span = document.createElement('span');
    span.textContent = 'Привіт, ' + auth.user.name + ' ';
    const out = document.createElement('button');
    out.textContent = 'Вийти';
    out.onclick = () => { setAuth(null); renderAuthArea(); };
    if (auth.user.role === 'admin') {
  const link = document.createElement('a');
  link.href = 'admin.html';
  link.textContent = 'Адмін-панель';
  link.className = 'link-btn';
  area.append(link);
}
area.append(span, out);
    forms.hidden = true;
    mySection.hidden = false;
    loadMyRentals();
  } else {
    forms.hidden = false;
    mySection.hidden = true;
  }
}

document.getElementById('btn-login').onclick = async () => {
  const msg = document.getElementById('auth-message');
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      }),
    });
    setAuth(data);
    msg.textContent = '';
    renderAuthArea();
  } catch (e) {
    msg.textContent = e.message;
  }
};

document.getElementById('btn-register').onclick = async () => {
  const msg = document.getElementById('auth-message');
  try {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      }),
    });
    msg.textContent = 'Реєстрація успішна, тепер увійдіть';
  } catch (e) {
    msg.textContent = e.message;
  }
};

const PAGE_SIZE = 8;

function renderPagination(data) {
  const box = document.getElementById('pagination');
  box.textContent = '';
  if (data.pages <= 1) return;

  const prev = document.createElement('button');
  prev.textContent = '← Назад';
  prev.disabled = data.page <= 1;
  prev.onclick = () => loadCatalog(data.page - 1);

  const info = document.createElement('span');
  info.textContent = ` Сторінка ${data.page} з ${data.pages} (знайдено: ${data.total}) `;

  const next = document.createElement('button');
  next.textContent = 'Далі →';
  next.disabled = data.page >= data.pages;
  next.onclick = () => loadCatalog(data.page + 1);

  box.append(prev, info, next);
}

async function loadCatalog(page = 1) {
  const params = new URLSearchParams();
  const search = document.getElementById('f-search').value.trim();
  const category = document.getElementById('f-category').value;
  const size = document.getElementById('f-size').value;
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (size) params.set('size', size);
  params.set('page', page);
  params.set('limit', PAGE_SIZE);

  const box = document.getElementById('catalog');
  let data;
  try {
    data = await api('/items?' + params.toString());
  } catch (e) {
    box.textContent = e.message;
    return;
  }

  box.textContent = '';
  renderPagination(data);
  if (data.items.length === 0) {
    box.textContent = 'Нічого не знайдено';
    return;
  }

  // сьогоднішня дата у форматі РРРР-ММ-ДД (щоб не обирати минуле)
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  data.items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'card';

    if (item.image_url) {
      const img = document.createElement('img');
      img.src = item.image_url;
      img.alt = item.title;
      img.className = 'card-img';
      card.append(img);
    }

    const title = document.createElement('h3');
    title.textContent = item.title;

    const info = document.createElement('p');
    info.className = 'muted';
    info.textContent = `${item.designer || ''} · ${item.category || ''} · розмір ${item.size || ''}`;

    const desc = document.createElement('p');
    desc.textContent = item.description || '';

    const price = document.createElement('p');
    price.textContent = `${item.price_per_day} грн/день, застава ${item.deposit} грн`;

    const start = document.createElement('input');
    start.type = 'date';
    start.min = today;
    const end = document.createElement('input');
    end.type = 'date';
    end.min = today;

    const btn = document.createElement('button');
    btn.textContent = 'Орендувати';
    btn.onclick = async () => {
      if (!getAuth()) return alert('Спочатку увійдіть в акаунт');
      try {
        const r = await api('/rentals', {
          method: 'POST',
          body: JSON.stringify({ item_id: item.id, start_date: start.value, end_date: end.value }),
        });
        alert(`Оренду створено! Днів: ${r.days}, сума з заставою: ${r.total_price} грн`);
        loadMyRentals();
      } catch (e) {
        alert(e.message);
      }
    };

    card.append(title, info, desc, price, start, end, btn);
    box.append(card);
  });
}

async function cancelRental(id) {
  if (!confirm('Скасувати цю оренду?')) return;
  try {
    await api(`/rentals/${id}/cancel`, { method: 'PATCH' });
    loadMyRentals();
  } catch (e) {
    alert(e.message);
  }
}

async function loadMyRentals() {
  const box = document.getElementById('my-rentals');
  box.textContent = '';
  try {
    const rentals = await api('/rentals/my');
    if (rentals.length === 0) {
      box.textContent = 'Оренд поки немає';
      return;
    }
    rentals.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'rental';

      const text = document.createElement('span');
      text.textContent =
        `${r.title}: ${r.start_date} — ${r.end_date}, ${r.total_price} грн, ` +
        `статус: ${STATUS_LABELS[r.status] || r.status} `;
      div.append(text);

      // Скасувати можна лише до видачі
      if (r.status === 'created' || r.status === 'confirmed') {
        const btn = document.createElement('button');
        btn.textContent = 'Скасувати';
        btn.className = 'danger';
        btn.onclick = () => cancelRental(r.id);
        div.append(btn);
      }
      box.append(div);
    });
  } catch (e) {
    box.textContent = e.message;
  }
}

document.getElementById('btn-filter').onclick = () => loadCatalog(1);

document.getElementById('btn-reset').onclick = () => {
  document.getElementById('f-search').value = '';
  document.getElementById('f-category').value = '';
  document.getElementById('f-size').value = '';
  loadCatalog(1);
};

document.getElementById('f-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadCatalog(1);
});

renderAuthArea();
loadCatalog();