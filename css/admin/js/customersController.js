
//импорт данных о клиентах из файла customers.js,
//почему то он не работает
import { customers } from "./customers.js";


// Получаем элементы из DOM
const table = document.getElementById("customers-table");


const qInput = document.getElementById("q");
const potentialSelect = document.getElementById("potential");
const statusSelect = document.getElementById("status");
const amountInput = document.getElementById("amount");

const dateFromInput = document.getElementById("dateFrom");
const dateToInput = document.getElementById("dateTo");
const resetBtn = document.getElementById("btnReset");

// Элементы мини-статистики
const statTotal = document.getElementById("statTotal");
const statNew = document.getElementById("statNew");
const statActive = document.getElementById("statProcessing"); // Active
const statLost = document.getElementById("statDelivered"); // Lost

// Элементы модального окна профиля пользователя
const modal = document.getElementById("orderModal");
const modalTitle = document.getElementById("orderModalTitle");
const modalAvatar = document.getElementById("modalAvatar");
const modalCloseBtn = document.getElementById("closeOrderModal");
const orderMeta = document.getElementById("orderMeta");

/* Фильтрация данных */


//
const parseCustomers = (valume) => {
    if (!valume){
        return null;
    }

    const parts = valume.split("-");
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

// Функция для вычисления потенциала по суммам и давности последнего заказа
const getPotentialInfo = (customer) => {
    let numericSpend = 0;
    if (customer.totalSpend) {
        // Удаляем все, кроме цифр
        const valueStr = customer.totalSpend.replace(/[^0-9]/g, '');
        numericSpend = valueStr ? Number(valueStr) / 100 : 0; 
    }

    // Если пользователь совершил заказ в течение месяца
    if (customer.orders && customer.orders.length > 0) {
        const lastOrderStr = customer.orders[customer.orders.length - 1];
        const lastOrderDate = parseCustomers(lastOrderStr);
        if (lastOrderDate) {
            const diffTime = (new Date()).getTime() - lastOrderDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) {
                return { level: 'new', icon: '🔥' };
            }
        }
    } else if (customer.orders && customer.orders.length === 0) {
        // Если у клиента еще нет заказов, но он недавно зарегистрировался
        return { level: 'new', icon: '🔥' };
    }
    
    if (numericSpend >= 50) return { level: 'high', icon: '🌟' };
    if (numericSpend >= 25) return { level: 'medium', icon: '💕' };
    return { level: 'low', icon: '😢' };
};

// Функция для динамического расчета статуса клиента
const getCustomerStatus = (customer) => {
    if (!customer.orders || customer.orders.length === 0) {
        return "active"; 
    }

    const lastOrderStr = customer.orders[customer.orders.length - 1];
    const lastOrderDate = parseCustomers(lastOrderStr);
    
    if (!lastOrderDate) return "active";

    const diffTime = (new Date()).getTime() - lastOrderDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Количество дней с последнего заказа
    const orderCount = customer.orders.length;

    let numericSpend = 0;
    if (customer.totalSpend) {
        const valueStr = customer.totalSpend.replace(/[^0-9]/g, '');
        numericSpend = valueStr ? Number(valueStr) / 100 : 0; 
    }

    // Если последний заказ сделан год назад (365 дней)
    if (diffDays > 365) {
        return "lost";
    }

    // Если пользователь сделал один заказ давно (больше 2х месяцев назад ~ 60 дней)
    if (orderCount === 1 && diffDays > 60) {
        return "sleeping";
    }

    // Если клиент сделал много заказов и потратил много денег
    if (orderCount > 1 && numericSpend >= 50) { // Используем порог 50, так же как у потенциала high
        return "vip";
    }

    // Если "спящий" для тех, кто сделал больше 1 заказа, но тоже очень давно (по условиям не 100% ясно, но пусть будет активным или спящим)
    // Добавим логику спящего и для них, если прошло > 60 дней, но еще не VIP
    if (diffDays > 60) {
        return "sleeping";
    }

    return "active";
};

// Функция для создания строки таблицы для каждого клиента
const buildRow = (customer) => {
    const row = document.createElement("tr");

    const lastOrder = customer.orders?.length
        ? customer.orders[customer.orders.length - 1]
        : "—";

    const potential = getPotentialInfo(customer);
    const statusKey = getCustomerStatus(customer);
    
    let statusLabel = '';
    switch (statusKey) {
        case 'active': statusLabel = 'Active 💪'; break;
        case 'lost': statusLabel = 'Lost 😢'; break;
        case 'vip': statusLabel = 'VIP 👑'; break;
        case 'sleeping': statusLabel = 'Sleeping 😴'; break;
        default: statusLabel = '—';
    }

    row.innerHTML = `
        <td>${customer.id}</td>
        <td>${customer.client}</td>
        <td>
            <div>${customer.contacts || '—'}</div>
            <div class="text-muted" style="font-size: 0.85em; opacity: 0.7;">${customer.email || '—'}</div>
        </td>
        <td>${statusLabel}</td>
        <td style="text-transform: capitalize;">${potential.level} ${potential.icon}</td>
        <td>${customer.totalSpend || '—'}</td>
        <td>${customer.registrationDate || '—'}</td>
        <td>${lastOrder}</td>
        <td>
            <button class="details-btn" data-id="${customer.id}">
                ${customer.action || "Details"}
            </button>
        </td>
    `;

    return row;
};


// Функция для отображения клиентов в таблице
const renderCustomers = (customers) => {
    table.innerHTML = ""; // Очищаем таблицу перед рендерингом
    customers.forEach(customer => {
        const row = buildRow(customer);
        table.appendChild(row);
    });

    if (window.refreshCustomersPagination) {
        window.refreshCustomersPagination();
    }
}


// Функция фильтрации
const filterCustomers = () => {
    let result = customers;

    if (qInput && qInput.value.trim()) {
        const query = qInput.value.toLowerCase().trim();
        result = result.filter(c => {
            const idMatch = c.id.toString().includes(query);
            const nameMatch = c.client && c.client.toLowerCase().includes(query);
            const emailMatch = c.email && c.email.toLowerCase().includes(query);
            const phoneMatch = c.contacts && c.contacts.toLowerCase().includes(query);
            return idMatch || nameMatch || emailMatch || phoneMatch;
        });
    }

    if (amountInput && amountInput.value.trim()) {
        const amountQuery = amountInput.value.trim().replace(/[^0-9]/g, '');
        if (amountQuery) {
            result = result.filter(c => {
                const spend = c.totalSpend ? c.totalSpend.replace(/[^0-9]/g, '') : '0';
                return spend.includes(amountQuery);
            });
        }
    }

    if (potentialSelect && potentialSelect.value && potentialSelect.value !== 'all') {
        const pVal = potentialSelect.value;
        result = result.filter(c => {
            const pot = getPotentialInfo(c);
            return pot.level === pVal;
        });
    }

    if (statusSelect && statusSelect.value && statusSelect.value !== '') {
        const sVal = statusSelect.value;
        result = result.filter(c => {
            return getCustomerStatus(c) === sVal;
        });
    }

    if (dateFromInput && dateFromInput.value) {
        const dateFrom = new Date(dateFromInput.value).getTime();
        result = result.filter(c => {
            const regDate = parseCustomers(c.registrationDate);
            return regDate && regDate.getTime() >= dateFrom;
        });
    }

    if (dateToInput && dateToInput.value) {
        const dateTo = new Date(dateToInput.value).getTime();
        result = result.filter(c => {
            const regDate = parseCustomers(c.registrationDate);
            return regDate && regDate.getTime() <= dateTo;
        });
    }

    renderCustomers(result);
    updateStatistics(result);
};

// Функция для обновления панели мини-статистики
const updateStatistics = (filteredCustomers) => {
    if (!statTotal) return; // Если элементов нет, не обновляем
    
    // Total Customers (считаем из отфильтрованного списка или из полного, 
    // обычно статистику показывают по текущей фильтрации)
    const totalCount = filteredCustomers.length;
    let newCount = 0;
    let activeCount = 0;
    let lostCount = 0;

    filteredCustomers.forEach(customer => {
        const cStatus = getCustomerStatus(customer);
        const potInfo = getPotentialInfo(customer);
        
        // Посчитаем "New" как тех, у кого потенциал 'new'
        if (potInfo.level === 'new') {
            newCount++;
        }
        
        if (cStatus === 'active') activeCount++;
        if (cStatus === 'lost') lostCount++;
    });

    if (statTotal) statTotal.textContent = totalCount;
    if (statNew) statNew.textContent = newCount;
    if (statActive) statActive.textContent = activeCount;
    if (statLost) statLost.textContent = lostCount;

    // Обновляем правые панели
    updateSidePanels(filteredCustomers);
};

// Функция для отрисовки правых блоков (Требуют внимания, Быстрые деньги и т.д.)
const updateSidePanels = (customersList) => {
    const attContainer = document.getElementById("attentionList");
    const quickContainer = document.getElementById("quickMoneyList");
    const trigContainer = document.getElementById("triggersList");
    const recContainer = document.getElementById("recommendationsList");
    const quickTotalEl = document.getElementById("quickMoneyTotal");
    const attentionTitle = document.getElementById("attentionTitle");

    let attHtml = '';
    let quickHtml = '';
    let trigHtml = '';

    let attCount = 0;
    let quickCount = 0;
    let trigCount = 0;
    let quickTotal = 0;

    const t = (key, fallback) => window.currentTranslations && window.currentTranslations[key] ? window.currentTranslations[key] : fallback;

    customersList.forEach(c => {
        const hasOrders = c.orders && c.orders.length > 0;
        let lastOrderDate = null;
        let diffDays = -1;

        if (hasOrders) {
            lastOrderDate = parseCustomers(c.orders[c.orders.length - 1]);
            if (lastOrderDate) {
                diffDays = Math.floor(((new Date()).getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
            }
        }

        const numOrders = hasOrders ? c.orders.length : 0;
        const statInfo = getCustomerStatus(c); // 'vip', 'active', 'lost', 'sleeping'
        const isVip = (statInfo === 'vip');
        const spendStr = c.totalSpend ? c.totalSpend.replace(/[^0-9.-]+/g, "") : "0";
        const totalSpendNum = Number(spendStr);

        // -- Блок 1: Требуют внимания --
        let attReason = null;
        if (numOrders === 0) attReason = t("no_orders_yet", "нет заказов");
        else if (diffDays >= 60) attReason = `${diffDays} ${t("days_without_purchase", "дней без покупки")}`;
        else if (numOrders === 1) attReason = t("one_order_push", "1 заказ — дожать");

        if (attReason) {
            attCount++;
            attHtml += `
                <div class="country-row" style="cursor: pointer;" onclick="window.openCustomerModalById(${c.id})">
                    <span style="font-weight: 500; font-size: 0.9rem;">${c.client}</span>
                    <span style="color: var(--color-danger); font-size: 0.8rem;">${attReason}</span>
                </div>`;
        }

        // -- Блок 2: Быстрые деньги --
        // 1-2 заказа, не VIP, последний заказ < 60 дней
        if (numOrders >= 1 && numOrders <= 2 && !isVip && diffDays >= 0 && diffDays < 60) {
            quickCount++;
            quickTotal += totalSpendNum;
            quickHtml += `
                <div class="country-row" style="cursor: pointer;" onclick="window.openCustomerModalById(${c.id})">
                    <span style="font-weight: 500; font-size: 0.9rem;">${c.client}</span>
                    <span style="color: var(--color-success); font-size: 0.8rem; font-weight: 600;">${t("potential_high", "потенциал HIGH")}</span>
                </div>`;
        }

        // -- Блок 3: Автоматические триггеры --
        // > 30 дней -> предложить новый альбом, > 180 дней (6 мес) -> апселл
        let trigReason = null;
        if (diffDays >= 180) trigReason = t("upsell_text", "апселл");
        else if (diffDays >= 30) trigReason = t("suggest_new_album", "предложить новый альбом");

        if (trigReason) {
            trigCount++;
            trigHtml += `
                <div class="country-row" style="cursor: pointer;" onclick="window.openCustomerModalById(${c.id})">
                    <span style="font-weight: 500; font-size: 0.9rem;">${c.client}</span>
                    <span style="color: var(--color-warning); font-size: 0.8rem;">${trigReason}</span>
                </div>`;
        }
    });

    const emptyMsg = `<p style="text-align: center; font-size: 0.85rem; color: var(--color-info-dark); margin: 0.5rem 0;">${t("empty_here", "Пока пусто 🤷‍♂️")}</p>`;

   // Вспомогательная функция для рендера сжимающегося блока
    const renderBlock = (containerId, html, count) => {
        const previewId = containerId;
        const modalId = containerId + "Content"; // attentionList -> attentionListContent
        
        const previewEl = document.getElementById(previewId);
        const modalEl = document.getElementById(modalId);
        
        if (!previewEl || !modalEl) return;
        
        if (!html) {
            previewEl.innerHTML = emptyMsg;
            modalEl.innerHTML = '';
            
            const container = previewEl.closest('.update');
            if (container) {
                const openBtn = container.querySelector('.expand-btn');
                const closeBtn = container.querySelector('.collapse-btn');
                if (openBtn) openBtn.style.display = 'none';
                if (closeBtn) closeBtn.style.display = 'none';
            }
            return;
        }
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const allItems = Array.from(tempDiv.children);
        
        const previewItems = allItems.slice(0, 5);
        const modalItems = allItems.slice(5);
        
        previewEl.innerHTML = '';
        previewItems.forEach(item => previewEl.appendChild(item.cloneNode(true)));
        
        modalEl.innerHTML = '';
        modalItems.forEach(item => modalEl.appendChild(item.cloneNode(true)));
        
        const container = previewEl.closest('.update');
        if (!container) return;
        
        const openBtn = container.querySelector('.expand-btn');
        const closeBtn = container.querySelector('.collapse-btn');
        const modalFull = previewEl.nextElementSibling;
        
        if (modalItems.length === 0) {
            if (openBtn) openBtn.style.display = 'none';
            if (closeBtn) closeBtn.style.display = 'none';
        } else {
            if (openBtn) openBtn.style.display = 'flex';
            if (openBtn && !openBtn.dataset.listenerAttached) {
                openBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    modalFull.classList.add('active');
                    openBtn.setAttribute('aria-expanded', 'true');
                    openBtn.style.display = 'none';
                    if (closeBtn) closeBtn.style.display = 'flex';
                });
                openBtn.dataset.listenerAttached = 'true';
            }
            
            if (closeBtn && !closeBtn.dataset.listenerAttached) {
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    modalFull.classList.remove('active');
                    openBtn.setAttribute('aria-expanded', 'false');
                    openBtn.style.display = 'flex';
                    closeBtn.style.display = 'none';
                });
                closeBtn.dataset.listenerAttached = 'true';
            }
        }
    };

    renderBlock('attentionList', attHtml, attCount);
    renderBlock('quickMoneyList', quickHtml, quickCount);
    renderBlock('triggersList', trigHtml, trigCount);

    if (quickTotalEl) {
        quickTotalEl.textContent = `€${quickTotal.toFixed(2)}`;
    }
    if (attentionTitle) {
        const attText = t("attention_req", "Требуют внимания");
        attentionTitle.innerHTML = `🔥 <span data-i18n="attention_req">${attText}</span> (${attCount})`;
    }
};

window.openCustomerModalById = (id) => {
    const c = customers.find(x => x.id === id);
    if (c) openCustomerModal(c);
};

// Привязка событий (автоматическая фильтрация)
if (qInput) qInput.addEventListener("input", filterCustomers);
if (amountInput) amountInput.addEventListener("input", filterCustomers);
if (potentialSelect) potentialSelect.addEventListener("change", filterCustomers);
if (statusSelect) statusSelect.addEventListener("change", filterCustomers);
if (dateFromInput) dateFromInput.addEventListener("change", filterCustomers);
if (dateToInput) dateToInput.addEventListener("change", filterCustomers);

if (resetBtn) {
    resetBtn.addEventListener("click", () => {
        if (qInput) qInput.value = "";
        if (amountInput) amountInput.value = "";
        if (dateFromInput) dateFromInput.value = "";
        if (dateToInput) dateToInput.value = "";
        if (potentialSelect) potentialSelect.value = "all";
        if (statusSelect) statusSelect.value = "";
        renderCustomers(customers);
    });
}

// Функции для работы с модальным окном
const renderCustomerMeta = (customer) => {
    if (!orderMeta) return;

    const potInfo = getPotentialInfo(customer);
    const statInfo = getCustomerStatus(customer);
    
    let statusLabel = '';
    switch (statInfo) {
        case 'active': statusLabel = 'Active 💪'; break;
        case 'lost': statusLabel = 'Lost 😢'; break;
        case 'vip': statusLabel = 'VIP 👑'; break;
        case 'sleeping': statusLabel = 'Sleeping 😴'; break;
        default: statusLabel = '—';
    }

    orderMeta.innerHTML = `
        <div class="kv-row"><div class="kv-key">ID</div><div class="kv-value">${customer.id}</div></div>
        <div class="kv-row"><div class="kv-key">Contacts</div><div class="kv-value">${customer.contacts || "—"}</div></div>
        <div class="kv-row"><div class="kv-key">Email</div><div class="kv-value">${customer.email || "—"}</div></div>
        <div class="kv-row"><div class="kv-key">Country</div><div class="kv-value">${customer.country || "—"}</div></div>
        <div class="kv-row"><div class="kv-key">Total Spend</div><div class="kv-value">${customer.totalSpend || "—"}</div></div>
        <div class="kv-row"><div class="kv-key">Status</div><div class="kv-value" style="text-transform: capitalize;">${statusLabel}</div></div>
        <div class="kv-row"><div class="kv-key">Potential</div><div class="kv-value" style="text-transform: capitalize;">${potInfo.level} ${potInfo.icon}</div></div>
        <div class="kv-row"><div class="kv-key">Reg Date</div><div class="kv-value">${customer.registrationDate || "—"}</div></div>
    `;
};

const openCustomerModal = (customer) => {
    if (!modal) return;

    if (modalTitle) {
        modalTitle.textContent = `${customer.client} (#${customer.id})`;
    }
    
    if (modalAvatar) {
        // Устанавливаем аватарку, если она указана в базе, иначе стандартную заглушку
        modalAvatar.src = customer.avatar ? customer.avatar : "../img/john-wick-1200-1200.jpg.avif";
        modalAvatar.alt = `Avatar: ${customer.client}`;
    }

    renderCustomerMeta(customer);

    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
};

const closeCustomerModal = () => {
    if (!modal) return;
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
};

const attachModalListeners = () => {
    if (!table || !modal) return;

    table.addEventListener("click", (event) => {
        const target = event.target;
        const button = target.closest(".details-btn");
        if (!button) return;

        const customerId = Number(button.dataset.id);
        const customer = customers.find(item => item.id === customerId);
        if (customer) {
            openCustomerModal(customer);
        }
    });

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", closeCustomerModal);
    }

    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeCustomerModal();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeCustomerModal();
    });
};

attachModalListeners();

const languageSelectEl = document.getElementById("languageSelect");
if (languageSelectEl) {
    languageSelectEl.addEventListener("change", () => {
        // Даем немного времени i18n.js на обновление window.currentTranslations
        setTimeout(() => filterCustomers(), 100);
    });
}

const initCustomersPagination = () => {
    const tableBody = document.getElementById('customers-table');
    const pagination = document.querySelector('.test-items-pagination');

    if (!tableBody || !pagination) {
        return;
    }

    const rows = Array.from(tableBody.querySelectorAll('tr'));
    const perPage = 8;
    const totalPages = Math.ceil(rows.length / perPage);

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        rows.forEach(row => {
            row.style.display = '';
            row.classList.remove('is-last-visible');
        });
        return;
    }

    pagination.style.display = 'flex'; // Подстраивается под flex стили с orders

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

window.refreshCustomersPagination = initCustomersPagination;

// Инициализируем при загрузке документа
document.addEventListener("DOMContentLoaded", () => {
    filterCustomers(); // Запускаем первоначальный рендер и пагинацию
});

// Инициализация
renderCustomers(customers);

// Закрытие развернутых блоков при нажатии на ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const expandedLists = document.querySelectorAll('.collapsible-list:not(.collapsed)');
        expandedLists.forEach(list => {
            const btn = list.parentElement.querySelector('.expand-toggle-btn');
            if (btn) {
                list.classList.add('collapsed');
                const t = (key, fallback) => window.currentTranslations && window.currentTranslations[key] ? window.currentTranslations[key] : fallback;
                const textShow = t("show_all_btn", "Показать все");
                btn.innerHTML = `<span>${textShow}</span> <span class="material-icons-sharp">expand_more</span>`;
            }
        });
    }
});
