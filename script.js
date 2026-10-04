if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    const user = tg.initDataUnsafe?.user;
    if (user && document.getElementById('user')) {
        document.getElementById('user').textContent = '👋 Здравствуйте, ' + (user.first_name || 'курьер') + '!';
    }
}

let currentFilter = 'active';
let currentDoneId = null;

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function(s) {
        s.classList.remove('active');
    });
    const el = document.getElementById('screen-' + name);
    if (el) {
        el.classList.add('active');
        window.scrollTo(0, 0);
    }
    if (name === 'orders') renderOrders();
    if (name === 'report') renderReport();
    updateMainStats();
}

function getOrders() {
    const raw = localStorage.getItem('courierOrders');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
}

function saveOrders(orders) {
    localStorage.setItem('courierOrders', JSON.stringify(orders));
    updateMainStats();
}

function updateMainStats() {
    const badge = document.getElementById('orders-count');
    const stat = document.getElementById('today-stat');
    const orders = getOrders();
    const active = orders.filter(function(o) {
        return o.status !== 'Доставлен';
    }).length;
    if (badge) badge.textContent = active > 0 ? active : '';
    if (stat) stat.textContent = orders.filter(function(o) { return o.status === 'Доставлен'; }).length + ' доставлено';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.filter-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    document.querySelector('.filter-btn[data-filter="' + f + '"]').classList.add('active');
    renderOrders();
}

function statusBadge(status) {
    if (status === 'Новый') return '<span class="badge-status new">🟡 Назначен</span>';
    if (status === 'Забрал') return '<span class="badge-status accepted">🟠 Забрал</span>';
    if (status === 'В пути') return '<span class="badge-status route">🚗 В пути</span>';
    if (status === 'Доставлен') return '<span class="badge-status done">🟢 Доставлен</span>';
    return '<span class="badge-status new">' + escapeHtml(status) + '</span>';
}

function renderOrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;

    const all = getOrders();
    let orders = all;

    if (currentFilter === 'active') {
        orders = all.filter(function(o) { return o.status !== 'Доставлен'; });
    } else if (currentFilter === 'done') {
        orders = all.filter(function(o) { return o.status === 'Доставлен'; });
    }

    if (orders.length === 0) {
        container.innerHTML = '<div class="stub"><div class="stub-icon">📦</div><div class="stub-text">Заказов нет</div><div class="stub-hint">Когда менеджер назначит заказ — он появится здесь</div></div>';
        return;
    }

    let html = '';
    for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const mark = o.urgent ? ' <span class="badge-urgent">🚀 СРОЧНО</span>' : '';
        let cls = 'order-card';
        if (o.urgent) cls += ' urgent';
        if (o.status === 'Доставлен') cls += ' done';

        html += '<div class="' + cls + '">';
        html += '<div class="order-head">📦 Заказ №' + escapeHtml(String(o.id).slice(-4)) + mark + '</div>';
        if (o.shop) {
            html += '<div class="order-row">🏪 <b>Забрать из: ' + escapeHtml(o.shop) + '</b></div>';
        }
        if (o.shopAddress) {
            html += '<div class="order-row">📍 ' + escapeHtml(o.shopAddress) + '</div>';
        }
        if (o.shopPhone) {
            html += '<div class="order-row">📞 Магазин: ' + escapeHtml(o.shopPhone) + '</div>';
        }
        html += '<div class="order-row" style="margin-top:8px;">📍 <b>Доставить: ' + escapeHtml(o.address) + '</b></div>';
        html += '<div class="order-row">📞 Клиент: ' + escapeHtml(o.phone) + '</div>';
        html += '<div class="order-row">💰 ' + escapeHtml(o.amount) + ' смн</div>';
        if (o.comment) {
            html += '<div class="order-row">📝 ' + escapeHtml(o.comment) + '</div>';
        }
        html += '<div class="order-foot"><span>' + escapeHtml(o.created || '') + '</span>' + statusBadge(o.status) + '</div>';

        if (o.status === 'Новый') {
            html += '<div class="order-actions">';
            html += '<button class="btn-take" onclick="takeOrder(' + o.id + ')">📦 Забрал</button>';
            html += '</div>';
        } else if (o.status === 'Забрал') {
            html += '<div class="order-actions">';
            html += '<button class="btn-route" onclick="routeOrder(' + o.id + ')">🚗 В пути</button>';
            html += '</div>';
        } else if (o.status === 'В пути') {
            html += '<div class="order-actions">';
            html += '<button class="btn-done" onclick="openDone(' + o.id + ')">✅ Доставил</button>';
            html += '</div>';
        }
        html += '</div>';
    }
    container.innerHTML = html;
}

function takeOrder(id) {
    const orders = getOrders();
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === id) { orders[i].status = 'Забрал'; break; }
    }
    saveOrders(orders);
    renderOrders();
}

function routeOrder(id) {
    const orders = getOrders();
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === id) { orders[i].status = 'В пути'; break; }
    }
    saveOrders(orders);
    renderOrders();
}

function openDone(id) {
    const orders = getOrders();
    const order = orders.find(function(o) { return o.id === id; });
    if (!order) return;
    currentDoneId = id;
    document.getElementById('done-sum').value = order.amount || '';
    showScreen('done');
}

function confirmDone() {
    if (!currentDoneId) return;
    const sum = document.getElementById('done-sum').value.trim();
    if (!sum || isNaN(parseInt(sum))) {
        alert('Введите сумму числом');
        return;
    }

    const orders = getOrders();
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === currentDoneId) {
            orders[i].status = 'Доставлен';
            orders[i].received = sum;
            orders[i].deliveredAt = new Date().toLocaleString('ru-RU');
            break;
        }
    }
    saveOrders(orders);
    currentDoneId = null;
    showScreen('orders');
}

function renderReport() {
    const container = document.getElementById('report-content');
    if (!container) return;

    const orders = getOrders();
    const today = new Date().toLocaleDateString('ru-RU');

    let delivered = 0, cash = 0, active = 0;
    for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        if (o.status === 'Доставлен') {
            delivered++;
            const r = parseInt(o.received || o.amount || 0);
            if (!isNaN(r)) cash += r;
        } else {
            active++;
        }
    }

    const earned = delivered * 20;
    const toGive = cash - earned;

    let html = '<h3>📊 Отчёт за сегодня</h3>';
    html += '<div class="report-row"><span>📅 Дата</span><b>' + today + '</b></div>';
    html += '<div class="report-row"><span>✅ Доставлено</span><b>' + delivered + '</b></div>';
    html += '<div class="report-row"><span>🔄 В работе</span><b>' + active + '</b></div>';
    html += '<div class="report-row"><span>💰 Собрано с клиентов</span><b>' + cash + ' смн</b></div>';
    html += '<div class="report-row"><span>🚚 Мой заработок</span><b>' + earned + ' смн</b></div>';
    html += '<div class="report-row total"><span>💵 К сдаче</span><b>' + toGive + ' смн</b></div>';
    container.innerHTML = html;
}

// Демо-заказы для теста — потом уберём, когда подключим API
function addDemoOrders() {
    if (getOrders().length > 0) return;
    const demo = [
        {
            id: 1700000000001,
            shop: 'Магазин Айни', shopAddress: 'ул. Рудаки 25', shopPhone: '+992 900 11 11 11',
            address: 'ул. Айни 5', phone: '900000000', amount: '150',
            comment: 'Позвонить за 5 минут', urgent: false, status: 'Новый',
            created: new Date().toLocaleString('ru-RU')
        },
        {
            id: 1700000000002,
            shop: 'Chronos.tj', shopAddress: '102 мкр', shopPhone: '+992 907 83 47 47',
            address: 'Караболо 10', phone: '911111111', amount: '200',
            comment: 'Клиент ждёт', urgent: true, status: 'Новый',
            created: new Date().toLocaleString('ru-RU')
        }
    ];
    saveOrders(demo);
}
addDemoOrders();

updateMainStats();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(reg) { console.log('SW:', reg.scope); })
            .catch(function(err) { console.log('SW err:', err); });
    });
}
