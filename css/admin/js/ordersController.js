import { orders } from "./orders.js";

// Сохраняем заказы в глобальную переменную для доступа из других скриптов
window.lastOrdersData = orders;

const table = document.getElementById("ordersTable");
const emptyHint = document.getElementById("emptyHint");
const modal = document.getElementById("orderModal");
const modalTitle = document.getElementById("orderModalTitle");
const modalCloseBtn = document.getElementById("closeOrderModal");
const orderMeta = document.getElementById("orderMeta");
const orderItems = document.getElementById("orderItems");
const modalStatus = document.getElementById("modalStatus");
const modalPayment = document.getElementById("modalPayment");
const modalTotal = document.getElementById("modalTotal");

const qInput = document.getElementById("q");
const statusSelect = document.getElementById("status");
const paymentSelect = document.getElementById("payment");
const dateFromInput = document.getElementById("dateFrom");
const dateToInput = document.getElementById("dateTo");
const resetBtn = document.getElementById("btnReset");

const normalizeValue = (value) => String(value || "").toLowerCase().trim();

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const parts = value.split("-");
  if (parts.length !== 3) {
    return null;
  }

  let year;
  let month;
  let day;

  if (parts[0].length === 4) {
    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  } else {
    day = Number(parts[0]);
    month = Number(parts[1]);
    year = Number(parts[2]);
  }

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const buildRow = (order) => {
  const row = document.createElement("tr");
  const actionLabel = order.action || "Details";

  row.innerHTML = `
    <td>${order.id}</td>
    <td>${order.client}</td>
    <td>${order.contacts}</td>
    <td>${order.total}</td>
    <td>${order.status}</td>
    <td>${order.payment}</td>
    <td>${order.date}</td>
    <td><button class="order-details-btn" type="button" data-order-id="${order.id}">${actionLabel}</button></td>
  `;

  return row;
};

const setSelectValue = (selectEl, value) => {
  if (!selectEl || value === undefined || value === null) {
    return;
  }

  const normalized = normalizeValue(value);
  const options = Array.from(selectEl.options);
  const match = options.find((option) => normalizeValue(option.value) === normalized);

  if (match) {
    selectEl.value = match.value;
  }
};

const renderOrderMeta = (order) => {
  if (!orderMeta) {
    return;
  }

  orderMeta.innerHTML = `
    <div class="kv-row"><div class="kv-key">ID</div><div class="kv-value">${order.id}</div></div>
    <div class="kv-row"><div class="kv-key">Client</div><div class="kv-value">${order.client}</div></div>
    <div class="kv-row"><div class="kv-key">Contacts</div><div class="kv-value">${order.contacts}</div></div>
    <div class="kv-row"><div class="kv-key">Total</div><div class="kv-value">${order.total}</div></div>
    <div class="kv-row"><div class="kv-key">Status</div><div class="kv-value">${order.status}</div></div>
    <div class="kv-row"><div class="kv-key">Payment</div><div class="kv-value">${order.payment}</div></div>
    <div class="kv-row"><div class="kv-key">Date</div><div class="kv-value">${order.date}</div></div>
  `;
};

const openOrderModal = (order) => {
  if (!modal) {
    return;
  }

  if (modalTitle) {
    modalTitle.textContent = `Order #${order.id}`;
  }

  renderOrderMeta(order);
  setSelectValue(modalStatus, order.status);
  setSelectValue(modalPayment, order.payment);

  if (modalTotal) {
    modalTotal.value = order.total || "";
  }

  if (orderItems) {
    orderItems.innerHTML = "";
  }

  modal.classList.add("is-open");
  document.body.classList.add("modal-open");
};

const closeOrderModal = () => {
  if (!modal) {
    return;
  }

  modal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
};

const getFilteredOrders = () => {
  const query = normalizeValue(qInput?.value);
  const status = normalizeValue(statusSelect?.value);
  const payment = normalizeValue(paymentSelect?.value);
  const fromDate = parseDate(dateFromInput?.value);
  const toDate = parseDate(dateToInput?.value);

  return orders.filter((order) => {
    const haystack = normalizeValue(
      [
        order.id,
        order.client,
        order.contacts,
        order.total,
        order.status,
        order.payment,
        order.date,
        order.action
      ].join(" ")
    );

    if (query && !haystack.includes(query)) {
      return false;
    }

    if (status && normalizeValue(order.status) !== status) {
      return false;
    }

    if (payment && normalizeValue(order.payment) !== payment) {
      return false;
    }

    if (fromDate || toDate) {
      const orderDate = parseDate(order.date);

      if (!orderDate) {
        return false;
      }

      if (fromDate && orderDate < fromDate) {
        return false;
      }

      if (toDate && orderDate > toDate) {
        return false;
      }
    }

    return true;
  });
};

const getVisibleOrders = (ordersList) => {
  const hasPagination = Boolean(document.querySelector(".test-items-pagination"));

  if (hasPagination) {
    return ordersList;
  }

  return ordersList.slice(0, 8);
};

const renderOrders = () => {
  if (!table) {
    return;
  }

  const filtered = getFilteredOrders();
  const visibleOrders = getVisibleOrders(filtered);

  table.innerHTML = "";
  visibleOrders.forEach((order) => {
    table.appendChild(buildRow(order));
  });

  if (emptyHint) {
    emptyHint.style.display = filtered.length === 0 ? "block" : "none";
  }

  if (window.refreshTestItemsPagination) {
    window.refreshTestItemsPagination();
  }
};

const attachModalListeners = () => {
  if (!table || !modal) {
    return;
  }

  table.addEventListener("click", (event) => {
    const target = event.target;
    const button = target.closest(".order-details-btn");
    if (!button) {
      return;
    }

    const orderId = Number(button.dataset.orderId);
    const order = orders.find((item) => item.id === orderId);
    if (order) {
      openOrderModal(order);
    }
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeOrderModal);
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeOrderModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeOrderModal();
    }
  });
};

const attachFilterListeners = () => {
  if (qInput) {
    qInput.addEventListener("input", () => {
      renderOrders();
      updateCountriesStatistics();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener("change", () => {
      renderOrders();
      updateCountriesStatistics();
    });
  }

  if (paymentSelect) {
    paymentSelect.addEventListener("change", () => {
      renderOrders();
      updateCountriesStatistics();
    });
  }

  if (dateFromInput) {
    dateFromInput.addEventListener("change", () => {
      renderOrders();
      updateCountriesStatistics();
    });
  }

  if (dateToInput) {
    dateToInput.addEventListener("change", () => {
      renderOrders();
      updateCountriesStatistics();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (qInput) qInput.value = "";
      if (statusSelect) statusSelect.value = "";
      if (paymentSelect) paymentSelect.value = "";
      if (dateFromInput) dateFromInput.value = "";
      if (dateToInput) dateToInput.value = "";
      renderOrders();
      updateCountriesStatistics();
    });
  }
};

attachFilterListeners();
attachModalListeners();
renderOrders();

const flags = {
  Austria: "🇦🇹",
  Germany: "🇩🇪",
  France: "🇫🇷",
  USA: "🇺🇸",
  Russia: "🇷🇺",
  Armenia: "🇦🇲",
  Italy: "🇮🇹",
  Spain: "🇪🇸",
  Portugal: "🇵🇹",
  China: "🇨🇳",
  Japan: "🇯🇵",
  Switzerland: "🇨🇭",
  Scotland: "🏴",
  Ukraine: "🇺🇦",
  Turkey: "🇹🇷",
  Iran : "🇮🇷",
  Finland: "🇫🇮",
};


function getOrdersByCountry(ordersList = getFilteredOrders()) {

  const result = {};

  ordersList.forEach(order => {

    const country = order.country;

    if (!country) return;

    if (!result[country]) {
      result[country] = 0;
    }

    result[country]++;

  });

  return result;
}



const initTestItemsPagination = () => {
    const wrapper = document.querySelector('.test-items');
    const pagination = document.querySelector('.test-items-pagination');

    if (!wrapper || !pagination) {
        return;
    }

    const tbody = wrapper.querySelector('tbody');
    if (!tbody) {
        return;
    }

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const perPage = 8;
    const totalPages = Math.ceil(rows.length / perPage);

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = '';

    const pageList = pagination.querySelector('.page-list');
    const prevBtn = pagination.querySelector('[data-action="prev"]');
    const nextBtn = pagination.querySelector('[data-action="next"]');
    let currentPage = 1;

    const renderPageButtons = () => {
        pageList.innerHTML = '';
        for (let i = 1; i <= totalPages; i += 1) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'page-number';
            btn.textContent = String(i);
            btn.addEventListener('click', () => {
                renderPage(i);
            });
            pageList.appendChild(btn);
        }
    };

    const updateControls = () => {
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        const buttons = pageList.querySelectorAll('.page-number');
        buttons.forEach((btn, index) => {
            btn.classList.toggle('active', index + 1 === currentPage);
        });
    };

    const renderPage = (page) => {
        currentPage = page;
        const start = (page - 1) * perPage;
        const end = start + perPage;

        rows.forEach((row, index) => {
            row.classList.remove('is-last-visible');
            row.style.display = index >= start && index < end ? '' : 'none';
        });

        const visibleRows = rows.filter((row) => row.style.display !== 'none');
        const lastVisibleRow = visibleRows[visibleRows.length - 1];
        if (lastVisibleRow) {
            lastVisibleRow.classList.add('is-last-visible');
        }

        updateControls();
    };

    prevBtn.onclick = () => {
        if (currentPage > 1) {
            renderPage(currentPage - 1);
        }
    };

    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            renderPage(currentPage + 1);
        }
    };

    renderPageButtons();
    renderPage(1);
};

window.refreshTestItemsPagination = initTestItemsPagination;
window.addEventListener('DOMContentLoaded', initTestItemsPagination);


function renderOrdersByCountry(ordersList = getFilteredOrders()) {

  const container = document.getElementById("ordersByCountry");

  if (!container) {
    console.warn("ordersByCountry container not found");
    return;
  }

  const countries = getOrdersByCountry(ordersList);

  const sortedCountries = Object.entries(countries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  container.innerHTML = "";

  sortedCountries.forEach((item) => {

    const country = item[0];
    const count = item[1];

    const row = document.createElement("div");

    row.className = "country-row";

    row.innerHTML = `
      <span>${flags[country] || ""} ${country}</span>
      <span>${count}</span>
    `;

    container.appendChild(row);

  });

}
renderOrdersByCountry();

// ===== COUNTRIES MODAL CLASS =====
class CountriesModal {
  constructor() {
    this.openBtn = document.querySelector('[data-modal-trigger="countries"]');
    this.closeBtn = document.querySelector('[data-modal-close="countries"]');
    this.modal = document.getElementById('countriesModal');
    this.countriesList = document.getElementById('countriesListContent');
    
    // Если необходимые элементы не существуют (например, на orders.html), пропускаем инициализацию
    if (!this.modal || !this.countriesList) {
      return;
    }
    
    this.isOpen = false;
    this.init();
  }

  init() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
      });
    }

    // Закрытие при нажатии на ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  getCountriesStatistics() {
    const filteredOrders = getFilteredOrders();
    const countriesMap = {};

    // Подсчитываем количество заказов по странам из отфильтрованных данных
    filteredOrders.forEach(order => {
      if (order.country) {
        countriesMap[order.country] = (countriesMap[order.country] || 0) + 1;
      }
    });

    // Преобразуем в массив и сортируем по количеству заказов
    return Object.entries(countriesMap)
      .map(([country, count]) => ({
        name: country,
        orders: count
      }))
      .sort((a, b) => b.orders - a.orders);
  }

  renderCountries() {
    if (!this.countriesList) return;

    const countries = this.getCountriesStatistics();
    
    // Показываем только страны начиная со степени 6 (пропускаем первые 5, которые видны в превью)
    const expandedCountries = countries.slice(5);

    this.countriesList.innerHTML = expandedCountries
      .map((country) => `
        <div class="country-row">
          <span>${flags[country.name] || ""} ${country.name}</span>
          <span>${country.orders}</span>
        </div>
      `)
      .join('');
  }

  getOrdersText(count) {
    // Для правильного отображения слова "заказ/заказа/заказов"
    if (count % 10 === 1 && count % 100 !== 11) {
      return 'заказ';
    } else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
      return 'заказа';
    } else {
      return 'заказов';
    }
  }

  open() {
    if (!this.modal) return;

    this.renderCountries();
    this.modal.classList.add('active');
    this.openBtn.setAttribute('aria-expanded', 'true');
    this.openBtn.style.display = 'none';
    if (this.closeBtn) this.closeBtn.style.display = 'flex';
    this.isOpen = true;
  }

  close() {
    if (!this.modal) return;

    this.modal.classList.remove('active');
    this.openBtn.setAttribute('aria-expanded', 'false');
    this.openBtn.style.display = 'flex';
    if (this.closeBtn) this.closeBtn.style.display = 'none';
    this.isOpen = false;
  }

  update() {
    if (this.isOpen) {
      this.renderCountries();
    }
  }
}

// Инициализация CountriesModal
const countriesModal = new CountriesModal();

// Функция для обновления статистики стран
function updateCountriesStatistics() {
  renderOrdersByCountry();
  if (countriesModal) {
    countriesModal.update();
  }
}



// Функция для обновления статистики
function updateOrderStats(orders) {
  const total = orders.length;
  const countNew = orders.filter(o => o.status === "New").length;
  const countProcessing = orders.filter(o => o.status === "Processing").length;
  const countDelivered = orders.filter(o => o.status === "Delivered").length;
  const countCanceled = orders.filter(o => o.status === "Canceled").length;

  // Вставляем данные в HTML (только если элементы существуют)
  const el1 = document.getElementById("statTotal");
  const el2 = document.getElementById("statNew");
  const el3 = document.getElementById("statProcessing");
  const el4 = document.getElementById("statDelivered");
  const el5 = document.getElementById("statCanceled");
  
  if (el1) el1.textContent = total;
  if (el2) el2.textContent = countNew;
  if (el3) el3.textContent = countProcessing;
  if (el4) el4.textContent = countDelivered;
  if (el5) el5.textContent = countCanceled;
}

// Вызываем функцию при загрузке страницы
updateOrderStats(orders);
updateCountriesStatistics();


// Объект для хранения переводов
let aiTranslations = {};

// Загружаем переводы для подсказок
async function loadAITranslations() {
  try {
    const currentLang = localStorage.getItem("language") || "en";
    const isHtmlFolder = window.location.pathname.includes('/html/');
    const basePath = isHtmlFolder ? '../' : './';
    const response = await fetch(`${basePath}lang/${currentLang}.json`);
    aiTranslations = await response.json();
  } catch (error) {
    console.error("Failed to load AI hints translations:", error);
    // Fallback to English
    aiTranslations = {
      "insight_orders_improved": "Orders improved by",
      "insight_orders_declined": "Orders declined by",
      "insight_delivery_improved": "Delivery rate improved by",
      "insight_delivery_declined": "Delivery rate declined by",
      "insight_delivery_stable": "Delivery rate stable by",
      "insight_orders_stable": "Orders stable by",
      "insight_this_week": "this week",
      "insight_canceled_trend": "orders canceled — check customer satisfaction",
      "insight_processing_trend": "orders in progress — monitor workflow",
      "insight_excellent": "Excellent performance — keep up the good work!",
      "insight_many_new": "Many new orders — process them faster.",
      "insight_few_new": "Few new orders — current pace is normal.",
      "insight_processing": "Orders in progress are accumulating — check resources.",
      "insight_delivered": "Many delivered orders — great work!",
      "insight_canceled_msg": "Canceled orders detected — consider contacting customers.",
      "insight_no_canceled": "No canceled orders — excellent!"
    };
  }
}

// Функция генерации AI-подсказок
function generateAIHints(orders) {
  const ul = document.getElementById("aiInsights");
  if (!ul) return;

  ul.innerHTML = ""; // очистка предыдущих подсказок

  // Получаем текущую дату
  const today = new Date(2026, 2, 26); // 26 марта 2026

  // Функция для парсинга даты формата "DD-MM-YYYY"
  const parseDate = (dateString) => {
    const [day, month, year] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Функция для получения номера недели
  const getWeekNumber = (date) => {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDay) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
  };

  // Функция для получения цвета и эмодзи
  const getColorAndEmoji = (percent) => {
    if (percent >= 10) return { color: "#41f1b6", emoji: "📈", trend: "improved" }; // зелёный
    if (percent >= 0) return { color: "#ffbb55", emoji: "⚠️", trend: "stable" }; // жёлтый
    return { color: "#ff7782", emoji: "📉", trend: "declined" }; // красный
  };

  // Подсчитываем статусы заказов
  const countNew = orders.filter(o => o.status === "New").length;
  const countProcessing = orders.filter(o => o.status === "Processing").length;
  const countDelivered = orders.filter(o => o.status === "Delivered" || o.status === "Done").length;
  const countCanceled = orders.filter(o => o.status === "Canceled").length;
  const total = orders.length;

  // Подсчитываем заказы по неделям для аналитики
  const currentWeek = getWeekNumber(today);
  const previousWeek = currentWeek - 1;

  let thisWeekOrders = 0;
  let lastWeekOrders = 0;
  let deliverdThisWeek = 0;
  let deliveredLastWeek = 0;

  orders.forEach(order => {
    const orderDate = parseDate(order.date);
    const orderWeek = getWeekNumber(orderDate);
    const orderYear = orderDate.getFullYear();

    if (orderYear === today.getFullYear() && orderWeek === currentWeek) {
      thisWeekOrders++;
      if (order.status === "Done" || order.status === "Delivered") {
        deliverdThisWeek++;
      }
    }

    if (orderYear === today.getFullYear() && orderWeek === previousWeek) {
      lastWeekOrders++;
      if (order.status === "Done" || order.status === "Delivered") {
        deliveredLastWeek++;
      }
    }
  });

  // Расчет процентов
  const orderChangePercent = lastWeekOrders > 0 
    ? Math.round(((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100)
    : 0;

  const deliveryChangePercent = deliveredLastWeek > 0
    ? Math.round(((deliverdThisWeek - deliveredLastWeek) / deliveredLastWeek) * 100)
    : 0;

  const orderTrend = getColorAndEmoji(orderChangePercent);
  const deliveryTrend = getColorAndEmoji(deliveryChangePercent);

  // Определяем тип страницы
  const isAnalyticsPage = document.getElementById("aiHints") && document.querySelector(".ai-like-insights");

  // ANALYTICS VERSION - с процентами и цветами
  if (isAnalyticsPage) {
    // Insight 1: Orders changed
    const orderSign = orderChangePercent >= 0 ? "+" : "";
    const orderTrendText = orderTrend.trend === "improved" ? aiTranslations["insight_orders_improved"] || "Orders improved by" :
                          orderTrend.trend === "declined" ? aiTranslations["insight_orders_declined"] || "Orders declined by" :
                          aiTranslations["insight_orders_stable"] || "Orders stable by";
    
    const li1 = document.createElement("li");
    li1.innerHTML = `<span style="color: ${orderTrend.color}">${orderTrend.emoji}</span> ${orderTrendText} <strong style="color: ${orderTrend.color}">${orderSign}${orderChangePercent}%</strong> ${aiTranslations["insight_this_week"] || "this week"}`;
    ul.appendChild(li1);

    // Insight 2: Delivery rate changed
    const deliverySign = deliveryChangePercent >= 0 ? "+" : "";
    const deliveryTrendText = deliveryTrend.trend === "improved" ? aiTranslations["insight_delivery_improved"] || "Delivery rate improved by" :
                             deliveryTrend.trend === "declined" ? aiTranslations["insight_delivery_declined"] || "Delivery rate declined by" :
                             aiTranslations["insight_delivery_stable"] || "Delivery rate stable by";
    
    const li2 = document.createElement("li");
    li2.innerHTML = `<span style="color: ${deliveryTrend.color}">${deliveryTrend.emoji}</span> ${deliveryTrendText} <strong style="color: ${deliveryTrend.color}">${deliverySign}${deliveryChangePercent}%</strong> ${aiTranslations["insight_this_week"] || "this week"}`;
    ul.appendChild(li2);

    // Insight 3: Summary with colors
    const li3 = document.createElement("li");
    if (countCanceled > 2) {
      const canceledText = aiTranslations["insight_canceled_trend"] || "orders canceled — check customer satisfaction";
      li3.innerHTML = `<span style="color: #ff7782">❌</span> <strong style="color: #ff7782">${countCanceled} ${canceledText}</strong>`;
    } else if (countProcessing > 3) {
      const processingText = aiTranslations["insight_processing_trend"] || "orders in progress — monitor workflow";
      li3.innerHTML = `<span style="color: #ffbb55">⏳</span> <strong style="color: #ffbb55">${countProcessing} ${processingText}</strong>`;
    } else {
      li3.innerHTML = `<span style="color: #41f1b6">✅</span> ${aiTranslations["insight_excellent"] || "Excellent performance — keep up the good work!"}`;
    }
    ul.appendChild(li3);
  } 
  // ORDERS VERSION - простые подсказки
  else {
    const hints = [];

    const manyNewText = aiTranslations["insight_many_new"] || "Many new orders — process them faster.";
    const fewNewText = aiTranslations["insight_few_new"] || "Few new orders — current pace is normal.";
    const processingText = aiTranslations["insight_processing"] || "Orders in progress are accumulating — check resources.";
    const deliveredText = aiTranslations["insight_delivered"] || "Many delivered orders — great work!";
    const canceledMsgText = aiTranslations["insight_canceled_msg"] || "Canceled orders detected — consider contacting customers.";
    const noCanceledText = aiTranslations["insight_no_canceled"] || "No canceled orders — excellent!";

    if(countNew > 3) hints.push("• 💬 " + manyNewText);
    else hints.push("• 😔 " + fewNewText);

    if(countProcessing > 2) hints.push("• 💼 " + processingText);
    if(countDelivered > 1) hints.push("• ✅ " + deliveredText);
    if(countCanceled > 0) hints.push(`• ‼️ ${canceledMsgText} (${countCanceled} ${aiTranslations["total"] || "total"})`);
    else hints.push("• ☺️ " + noCanceledText);

    hints.forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    });
  }
}

// Авто-запуск при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  // Генерируем подсказки (используются переводы, если они загружены, или fallback)
  if (document.getElementById("aiInsights")) {
    generateAIHints(orders);
  }
  
  // Загружаем переводы в фоне для дальнейших обновлений
  loadAITranslations();
});

// Экспортируем данные заказов для графиков
export const ordersData = orders;
