import { ordersData as orders } from './ordersController.js';

const ctx = document.getElementById('ordersChart').getContext('2d');
let chart;
let chartType = 'day';
let dateFromFilter = null;
let dateToFilter = null;

function buildChart(labels, ordersData, delivered, returns) {
    if (chart) chart.destroy();

    const tr = window.currentTranslations || {};
    const labelOrders = tr["orders"] || "Orders";
    const labelDelivered = tr["delivered"] || "Delivered";
    const labelReturns = tr["canceled"] || "Returns"; // assuming returns -> canceled

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: labelOrders,
                    data: ordersData,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79,70,229,0.2)',
                    tension: 0.4,
                    fill: true,
                },
                {
                    label: labelDelivered,
                    data: delivered,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.2)',
                    tension: 0.4,
                    fill: true,
                },
                {
                    label: labelReturns,
                    data: returns,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    tension: 0.4,
                    fill: true,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#aaa'
                    }
                },
                tooltip: {
                    backgroundColor: '#111',
                    padding: 10,
                    callbacks: {
                        title: (items) => {
                            return items[0].label;
                        },
                        label: (item) => {
                            return `${item.dataset.label}: ${item.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#777' },
                    grid: { color: '#2c2f36' }
                },
                y: {
                    ticks: { color: '#777' },
                    grid: { color: '#2c2f36' }
                }
            },
        }
    });
}





function filterDataByDates(data) {
    if (!dateFromFilter && !dateToFilter) {
        return data;
    }

    return data.filter(item => {
        const itemDate = item.date;
        
        if (dateFromFilter && itemDate < dateFromFilter) {
            return false;
        }
        
        if (dateToFilter && itemDate > dateToFilter) {
            return false;
        }
        
        return true;
    });
}

function groupData(type, filteredData = null) {
    const dataToUse = filteredData || orders;
    const normalized = normalizeData(dataToUse);
    const filtered = filterDataByDates(normalized);

    const grouped = {};

    filtered.forEach(item => {
        let key;

        if (type === 'day') {
            key = item.date.toISOString().split('T')[0];
        }

        if (type === 'week') {
            const week = Math.ceil(item.date.getDate() / 7);
            key = `${item.date.getMonth()+1}/W${week}`;
        }

        if (type === 'month') {
            key = `${item.date.getMonth()+1}/${item.date.getFullYear()}`;
        }

        if (!grouped[key]) {
            grouped[key] = { orders: 0, delivered: 0, returns: 0 };
        }

        grouped[key].orders += 1;

        if (item.isDelivered) grouped[key].delivered += 1;
        if (item.isReturned) grouped[key].returns += 1;
    });

    const sortedLabels = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

    return {
        labels: sortedLabels,
        orders: sortedLabels.map(l => grouped[l].orders),
        delivered: sortedLabels.map(l => grouped[l].delivered),
        returns: sortedLabels.map(l => grouped[l].returns)
    };
}

function updateChart(type, e) {
    document.querySelectorAll('.group-buttons button').forEach(btn => {
        btn.classList.remove('active');
    });

    e.target.classList.add('active');
    chartType = type;

    const data = groupData(type);
    buildChart(data.labels, data.orders, data.delivered, data.returns);
}

function resetDateFilters() {
    dateFromFilter = null;
    dateToFilter = null;
    
    const dateFromInput = document.getElementById('dateFromFilter');
    const dateToInput = document.getElementById('dateToFilter');
    
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';
    
    const data = groupData(chartType);
    buildChart(data.labels, data.orders, data.delivered, data.returns);
}

window.refreshChartLang = () => {
    const data = groupData(chartType);
    buildChart(data.labels, data.orders, data.delivered, data.returns);
};

function parseInputDate(dateString) {
    if (!dateString) return null;
    
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, parseInt(month) - 1, day);
    date.setHours(0, 0, 0, 0);
    
    return date;
}

function onDateFilterChange() {
    const dateFromInput = document.getElementById('dateFromFilter');
    const dateToInput = document.getElementById('dateToFilter');
    
    dateFromFilter = parseInputDate(dateFromInput?.value);
    dateToFilter = parseInputDate(dateToInput?.value);
    
    const data = groupData(chartType);
    buildChart(data.labels, data.orders, data.delivered, data.returns);
}


function normalizeData(data) {
    return data.map(item => {

        // 🔥 нормализация даты
        let date;

        if (item.date.includes('-') && item.date.length === 10 && item.date[4] === '-') {
            // формат YYYY-MM-DD
            date = new Date(item.date);
        } else {
            // формат DD-MM-YYYY
            const [day, month, year] = item.date.split('-');
            date = new Date(`${year}-${month}-${day}`);
        }

        // 🔥 нормализация статусов
        const status = item.status.toLowerCase();

        return {
            date,
            isDelivered: ["delivered", "done", "successfully"].includes(status),
            isReturned: ["canceled"].includes(status),
            isOrder: true
        };
    });
}

window.onload = () => {
    const data = groupData('day');
    buildChart(data.labels, data.orders, data.delivered, data.returns);
    updateChartThemeFromDOM();
    // Подключаем обработчики для фильтров по датам
    const dateFromInput = document.getElementById('dateFromFilter');
    const dateToInput = document.getElementById('dateToFilter');
    const resetBtn = document.getElementById('resetDateFilter');
    
    if (dateFromInput) dateFromInput.addEventListener('change', onDateFilterChange);
    if (dateToInput) dateToInput.addEventListener('change', onDateFilterChange);
    if (resetBtn) resetBtn.addEventListener('click', resetDateFilters);
};


function updateChartThemeFromDOM() {
    if (!chart) return;

    const isDark = document.body.classList.contains('dark-theme-variables');

    chart.options.plugins.legend.labels.color = isDark ? '#aaa' : '#333';

    chart.options.scales.x.ticks.color = isDark ? '#777' : '#333';
    chart.options.scales.y.ticks.color = isDark ? '#777' : '#333';

    chart.options.scales.x.grid.color = isDark ? '#2c2f36' : '#00000025';
    chart.options.scales.y.grid.color = isDark ? '#2c2f36' : '#00000025';

    chart.options.plugins.tooltip.backgroundColor = isDark ? '#111' : '#fff';
    chart.options.plugins.tooltip.titleColor = isDark ? '#fff' : '#000';
    chart.options.plugins.tooltip.bodyColor = isDark ? '#ddd' : '#333';

    chart.update();
}

const observer = new MutationObserver(() => {
    updateChartThemeFromDOM();
});

observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
});

