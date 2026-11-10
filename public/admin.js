const API = '/api';

function getAuth() {
  return JSON.parse(localStorage.getItem('auth') || 'null');
}

async function api(path, options = {}) {
  const auth = getAuth();
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = 'Bearer ' + auth.token;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // токен недійсний або прострочений: повертаємо на головну
    localStorage.removeItem('auth');
    window.location.href = 'index.html';
  }
  if (!res.ok) throw new Error(data.error || 'Помилка сервера');
  return data;
}

function initAdminPage() {
  const form = document.getElementById('item-form');
  const msg = document.getElementById('form-message');
  const field = (id) => document.getElementById(id);

  document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('auth');
    window.location.href = 'index.html';
  };

  function resetForm() {
    form.reset();
    field('item-id').value = '';
    field('form-title').textContent = 'Додати товар';
    field('btn-cancel').hidden = true;
  }

  function fillForm(item) {
    field('item-id').value = item.id;
    field('title').value = item.title;
    field('designer').value = item.designer || '';
    field('category').value = item.category || '';
    field('size').value = item.size || '';
    field('price').value = item.price_per_day;
    field('deposit').value = item.deposit;
    field('image').value = item.image_url || '';
    field('description').value = item.description || '';
    field('form-title').textContent = 'Редагувати товар №' + item.id;
    field('btn-cancel').hidden = false;
    msg.textContent = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  field('btn-cancel').onclick = () => {
    resetForm();
    msg.textContent = '';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = field('item-id').value;
    const body = {
      title: field('title').value.trim(),
      designer: field('designer').value.trim(),
      category: field('category').value,
      size: field('size').value,
      description: field('description').value.trim(),
      price_per_day: Number(field('price').value),
      deposit: Number(field('deposit').value || 0),
      image_url: field('image').value.trim(),
    };
    try {
      if (id) {
        await api('/items/' + id, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/items', { method: 'POST', body: JSON.stringify(body) });
      }
      resetForm();
      msg.textContent = id ? 'Зміни збережено' : 'Товар додано';
      loadItems();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  async function loadItems() {
    const items = await api('/items');
    const tbody = document.querySelector('#items-table tbody');
    tbody.textContent = '';

    items.forEach((item) => {
      const tr = document.createElement('tr');
      [
        item.id,
        item.title,
        item.designer || '',
        item.category || '',
        item.size || '',
        item.price_per_day,
        item.deposit,
      ].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      });

      const actions = document.createElement('td');

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Редагувати';
      editBtn.onclick = () => fillForm(item);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Видалити';
      delBtn.className = 'danger';
      delBtn.onclick = async () => {
        if (!confirm(`Видалити «${item.title}»?`)) return;
        try {
          await api('/items/' + item.id, { method: 'DELETE' });
          loadItems();
        } catch (err) {
          alert(err.message);
        }
      };

      actions.append(editBtn, delBtn);
      tr.append(actions);
      tbody.append(tr);
    });
  }

    // ---------- Оренди ----------
  const STATUS_LABELS = {
    created: 'Створена',
    confirmed: 'Підтверджена',
    issued: 'Видана',
    returned: 'Повернена',
    cancelled: 'Скасована',
  };
  // Які кнопки показувати для кожного статусу (дзеркало правил сервера)
  const NEXT_STATUSES = {
    created: ['confirmed', 'cancelled'],
    confirmed: ['issued', 'cancelled'],
    issued: ['returned'],
    returned: [],
    cancelled: [],
  };
  const ACTION_LABELS = {
    confirmed: 'Підтвердити',
    issued: 'Видати',
    returned: 'Прийняти повернення',
    cancelled: 'Скасувати',
  };

  async function changeStatus(id, status) {
    try {
      await api(`/rentals/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadRentals();
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadRentals() {
    const filter = field('rental-filter').value;
    const query = filter ? '?status=' + encodeURIComponent(filter) : '';
    const rentals = await api('/rentals' + query);

    const tbody = document.querySelector('#rentals-table tbody');
    tbody.textContent = '';
    field('rentals-message').textContent = rentals.length ? '' : 'Оренд немає';

    rentals.forEach((r) => {
      const tr = document.createElement('tr');
      [
        r.id,
        r.title,
        `${r.user_name} (${r.user_email})`,
        `${r.start_date} — ${r.end_date}`,
        r.total_price,
        STATUS_LABELS[r.status] || r.status,
      ].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      });

      const actions = document.createElement('td');
      const next = NEXT_STATUSES[r.status] || [];
      if (next.length === 0) {
        actions.textContent = '—';
      }
      next.forEach((status) => {
        const btn = document.createElement('button');
        btn.textContent = ACTION_LABELS[status];
        if (status === 'cancelled') btn.className = 'danger';
        btn.onclick = () => {
          if (status === 'cancelled' && !confirm('Скасувати цю оренду?')) return;
          changeStatus(r.id, status);
        };
        actions.append(btn);
      });
      tr.append(actions);
      tbody.append(tr);
    });
  }

  field('rental-filter').onchange = loadRentals;

  loadItems();
  loadRentals();
}

// Сторінка доступна лише адміністратору
const auth = getAuth();
if (!auth || auth.user.role !== 'admin') {
  alert('Доступ лише для адміністратора');
  window.location.href = 'index.html';
} else {
  initAdminPage();
}