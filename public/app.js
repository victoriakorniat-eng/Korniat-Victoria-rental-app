const API = '/api';

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

async function loadCatalog() {
  const params = new URLSearchParams();
  const category = document.getElementById('f-category').value;
  const size = document.getElementById('f-size').value;
  if (category) params.set('category', category);
  if (size) params.set('size', size);

  const items = await api('/items?' + params.toString());
  const box = document.getElementById('catalog');
  box.textContent = '';

  items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'card';

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
    const end = document.createElement('input');
    end.type = 'date';

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

async function loadMyRentals() {
  const box = document.getElementById('my-rentals');
  box.textContent = '';
  try {
    const rentals = await api('/rentals/my');
    rentals.forEach((r) => {
      const div = document.createElement('div');
      div.className = 'rental';
      div.textContent = `${r.title}: ${r.start_date} — ${r.end_date}, ${r.total_price} грн, статус: ${r.status}`;
      box.append(div);
    });
    if (rentals.length === 0) box.textContent = 'Оренд поки немає';
  } catch (e) {
    box.textContent = e.message;
  }
}

document.getElementById('btn-filter').onclick = loadCatalog;

renderAuthArea();
loadCatalog();