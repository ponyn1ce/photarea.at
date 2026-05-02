function getFunnel(orders) {
  // Расширенная воронка для большей информативности и заполнения увеличенного блока Drop-off
  const visitors = Math.floor(orders.length * 6.5);
  const funnel = {
    "Site Visited": visitors,
    "Product Searched": Math.floor(visitors * 0.85),
    "Product Viewed": Math.floor(visitors * 0.70),
    "Added to Cart": Math.floor(visitors * 0.45),
    "Cart Reviewed": Math.floor(visitors * 0.40),
    "Initiated Checkout": Math.floor(visitors * 0.32),
    "Payment Info": Math.floor(visitors * 0.25)
  };
  
  return funnel;
}

function getDropoff(funnel) {
  const funnelArray = Object.entries(funnel).map(([name, value]) => ({
    name,
    value,
    percent: (value / Object.values(funnel)[0]) * 100
  }));

  const dropoff = [];
  for (let i = 0; i < funnelArray.length - 1; i++) {
    const loss = funnelArray[i].value - funnelArray[i + 1].value;
    const lossPercent = (loss / funnelArray[i].value) * 100;

    dropoff.push({
      stage: funnelArray[i].name,
      next: funnelArray[i + 1].name,
      loss,
      percent: lossPercent
    });
  }

  return dropoff;
}

function renderFunnel(funnel) {
  const container = document.getElementById("funnel");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Делаем динамичным: берем топ 5 по значению
  const sortedEntries = Object.entries(funnel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
  if (sortedEntries.length === 0) return;
  const maxValue = Math.max(...sortedEntries.map(e => e[1]));

  sortedEntries.forEach(([label, value]) => {
    const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;

    const el = document.createElement("div");
    el.classList.add("funnel-row");
    el.innerHTML = `
      <div class="funnel-label">
        <span>${label}</span>
        <span>${value}</span>
      </div>
      <div class="funnel-bar" style="width: ${percent}%"></div>
    `;

    container.appendChild(el);
  });
}

function renderDropoff(dropoff) {
  const container = document.getElementById("dropoff");
  if (!container) return;
  
  container.innerHTML = "";

  dropoff.forEach(item => {
    const el = document.createElement("div");
    const isGood = item.percent < 30;
    el.classList.add("drop-item", isGood ? "drop-ok" : "drop-bad");
    el.innerHTML = `
      <div><strong>${item.stage} → ${item.next}</strong></div>
      <div>Lost: ${item.loss} (${item.percent.toFixed(1)}%)</div>
    `;

    container.appendChild(el);
  });
}

function getAging(orders) {
  const now = new Date();

  const buckets = {
    "1d": 0,
    "7d": 0,
    "14d": 0,
    "30d": 0
  };

  orders.forEach(order => {
    if (!order.date) return;
    
    let created;
    if (order.date.includes('-') && order.date.length === 10 && order.date[4] === '-') {
        // YYYY-MM-DD
        created = new Date(order.date);
    } else if (order.date.includes('-')) {
        // DD-MM-YYYY
        const [day, month, year] = order.date.split('-');
        created = new Date(`${year}-${month}-${day}`);
    } else {
        created = new Date(order.date);
    }

    const diff = (now - created) / (1000 * 60 * 60 * 24);

    if (diff >= 30) buckets["30d"]++;
    else if (diff >= 14) buckets["14d"]++;
    else if (diff >= 7) buckets["7d"]++;
    else if (diff >= -1) buckets["1d"]++; // Все свежие заказы (включая сегодня)
  });

  return buckets;
}

function renderAging(data) {
  const container = document.getElementById("aging");
  if (!container) return;
  
  container.innerHTML = "";
  
  // Делаем динамичным: берем топ 3 самых больших по значению
  const sortedEntries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
    
  if (sortedEntries.length === 0) return;
  const maxValue = Math.max(...sortedEntries.map(e => e[1]));

  sortedEntries.forEach(([key, value]) => {
    const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;

    const el = document.createElement("div");
    el.innerHTML = `
      <div style="margin-bottom: 4px; font-size: 13px;">${key}+: ${value} orders</div>
      <div class="aging-bar" style="width: ${percent}%"></div>
    `;

    container.appendChild(el);
  });
}

function updateTopStats(orders) {
  const now = new Date();
  
  let last7Days = 0;
  let canceled = 0;
  let delivered = 0;

  orders.forEach(order => {
    // 1. Статусы
    const st = (order.status || "").toLowerCase();
    if (["canceled"].includes(st)) canceled++;
    if (["delivered", "done", "successfully"].includes(st)) delivered++;

    // 2. Время (последние 7 дней)
    if (!order.date) return;
    let created;
    if (order.date.includes('-') && order.date.length === 10 && order.date[4] === '-') {
      created = new Date(order.date);
    } else if (order.date.includes('-')) {
      const [day, month, year] = order.date.split('-');
      created = new Date(`${year}-${month}-${day}`);
    } else {
      created = new Date(order.date);
    }

    const diff = (now - created) / (1000 * 60 * 60 * 24);
    if (diff >= -1 && diff <= 7) last7Days++;
  });

  // Найти элементы по уникальному расположению, так как у всех h1 id="lastOrders"
  const ordersCardEl = document.querySelector('.orderscard .middle h1');
  if (ordersCardEl) ordersCardEl.textContent = last7Days;

  const canceledCardEl = document.querySelector('.canceledcard-top h1');
  if (canceledCardEl) canceledCardEl.textContent = canceled;

  const deliveredCardEl = document.querySelector('.deliveredcard-top h1');
  if (deliveredCardEl) deliveredCardEl.textContent = delivered;
}

document.addEventListener("DOMContentLoaded", () => {
  // Получаем данные заказов из глобальной переменной
  const orders = window.lastOrdersData || [];

  if (!orders || orders.length === 0) {
    console.warn("No orders data found");
    return;
  }

  // Обновляем статистику наверху страницы
  updateTopStats(orders);

  const funnel = getFunnel(orders);
  renderFunnel(funnel);
  renderDropoff(getDropoff(funnel));
  renderAging(getAging(orders));
});