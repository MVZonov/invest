document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('#stocksTable tbody');
    const totalSumElement = document.querySelector('#totalSum');
    const totalDividendsElement = document.querySelector('#totalDividends');
    const lastUpdateElement = document.querySelector('#lastUpdate');
    let isUpdating = false;
    checkAuthStatus();

    // Создание строки
    function createRow() {
        const row = document.createElement('tr');
        row.innerHTML = `
        <td><input type="text" class="ticker-input" placeholder="Тикер + Enter"></td>
        <td class="company-name"></td>
        <td class="price"></td>
        <td><input type="number" min="0" class="quantity-input" value="0"></td>
        <td class="sum">—</td>
        <td class="dividend-per-share">—</td>
        <td class="dividend-yield">—</td>
        <td class="portfolio-dividends">—</td>
        <td><button class="delete-row">×</button></td>
    `;
        return row;
    }

    // Запрос данных акции
    async function fetchStockData(ticker) {
        try {
            const response = await fetch(`http://localhost:3000/api/stock/${ticker}`);
            if (!response.ok) throw new Error("Тикер не найден");
            return await response.json();
        } catch (error) {
            return { error: error.message };
        }
    }

    // Расчет суммы для строки
    function calculateRowSum(row) {
        const priceElement = row.querySelector('.price');
        const quantityInput = row.querySelector('.quantity-input');
        const sumElement = row.querySelector('.sum');

        if (!priceElement || !quantityInput || !sumElement) return 0;

        const priceText = priceElement.textContent.replace(/[^\d.,]/g, '').replace(',', '.');
        const price = parseFloat(priceText) || 0;
        const quantity = parseFloat(quantityInput.value) || 0;
        const sum = price * quantity;

        sumElement.textContent = sum ? `${sum.toFixed(2)} ₽` : "—";
        return sum;
    }

    // Обновление общей суммы
    function updateTotalSum() {
        let total = 0;
        tbody.querySelectorAll('tr').forEach(row => {
            total += calculateRowSum(row);
        });
        totalSumElement.textContent = `${total.toFixed(2)} ₽`;
    }

    // Запрос дивидендов
    async function fetchDividendData(ticker) {
        try {
            const response = await fetch(`http://localhost:3000/api/dividend/${ticker}`);
            return await response.json();
        } catch {
            return { error: "Ошибка загрузки" };
        }
    }

    // Обновление данных дивидендов
    async function updateDividendData(row, ticker) {
        try {
            const dividendData = await fetchDividendData(ticker);
            const price = parseFloat(row.querySelector('.price').textContent.replace(/[^\d.]/g, '')) || 0;

            if (dividendData.error) throw new Error(dividendData.error);

            // Обновляем только дивидендные поля
            row.querySelector('.dividend-per-share').textContent =
                `${dividendData.value.toFixed(2)} ₽`;

            row.querySelector('.dividend-yield').textContent =
                `${((dividendData.value / price) * 100).toFixed(2)}%`;

        } catch (error) {
            row.querySelector('.dividend-per-share').textContent = "—";
            row.querySelector('.dividend-yield').textContent = "—";
        }
    }

    // Обновление итоговых дивидендов
    function updateTotalDividends() {
        let total = 0;
        document.querySelectorAll('.portfolio-dividends').forEach(cell => {
            total += parseFloat(cell.textContent) || 0;
        });
        totalDividendsElement.textContent = `${total.toFixed(2)} ₽`;
    }

    // Обработчик ввода тикера
    async function handleTickerInput(row, ticker) {
        if (isUpdating || !ticker.trim()) return;
        isUpdating = true;

        try {
            const upperTicker = ticker.toUpperCase();

            // 1. Запрос данных акции с MOEX
            const stockData = await fetchStockData(upperTicker);
            if (stockData.error) throw new Error(stockData.error);

            // 2. Параллельный запрос дивидендов с dohod.ru
            const dividendPromise = fetchDividendData(upperTicker);

            // 3. Обновление основной информации
            row.querySelector('.company-name').textContent = stockData.name || "—";
            row.querySelector('.price').textContent = stockData.price ?
                `${stockData.price.toFixed(2)} ₽` : "—";
            row.querySelector('.ticker-input').value = upperTicker;

            // 4. Обработка дивидендов
            const dividendData = await dividendPromise;
            if (!dividendData.error) {
                const dividendValue = dividendData.value;
                const price = stockData.price || 0;

                // Обновление дивидендных полей
                row.querySelector('.dividend-per-share').textContent =
                    `${dividendValue.toFixed(2)} ₽`;
                row.querySelector('.dividend-yield').textContent =
                    `${((dividendValue / price) * 100).toFixed(2)}%`;
            }

            // 5. Добавление новой строки
            if (row === tbody.lastElementChild) {
                const newRow = createRow();
                tbody.appendChild(newRow);
                addEventListenersToRow(newRow);
            }

        } catch (error) {
            row.querySelector('.company-name').textContent = "Ошибка";
            row.querySelector('.price').textContent = "—";
            row.querySelector('.dividend-per-share').textContent = "—";
            row.querySelector('.dividend-yield').textContent = "—";
        } finally {
            updateTotalSum();
            updateTotalDividends();
            isUpdating = false;
        }
    }

    // Обработчики событий
    function addEventListenersToRow(row) {
        const tickerInput = row.querySelector('.ticker-input');
        const quantityInput = row.querySelector('.quantity-input');
        const deleteButton = row.querySelector('.delete-row');

        // Обработчик для тикера (остаётся без изменений)
        tickerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleTickerInput(row, tickerInput.value.trim());
            }
        });

        // Новый обработчик для количества
        quantityInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const ticker = tickerInput.value.trim().toUpperCase();
                if (!ticker) return;

                // Загружаем дивиденды только при наличии тикера
                await updateDividendData(row, ticker);
                updateTotalDividends();
            }
        });

        // Обновление сумм при любом изменении (без запроса к API)
        quantityInput.addEventListener('input', () => {
            updateTotalSum();
            updatePortfolioDividends(row); // Локальный пересчёт
            updateTotalDividends();
        });

        // Удаление строки
        deleteButton.addEventListener('click', () => {
            row.remove();
            updateTotalSum();
            updateTotalDividends();
            if (tbody.children.length === 0) tbody.appendChild(createRow());
        });
    }

    // Локальный пересчёт дивидендов без запроса к API
    function updatePortfolioDividends(row) {
        const dividendPerShare = parseFloat(row.querySelector('.dividend-per-share').textContent) || 0;
        const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
        row.querySelector('.portfolio-dividends').textContent =
            `${(dividendPerShare * quantity).toFixed(2)} ₽`;
    }

    // Инициализация
    tbody.appendChild(createRow());
    addEventListenersToRow(tbody.firstElementChild);

    async function updateAllPrices() {
        const rows = tbody.querySelectorAll('tr');
        lastUpdateElement.textContent = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        for (const row of rows) {
            const ticker = row.querySelector('.ticker-input').value.trim();
            if (ticker) {
                const data = await fetchStockData(ticker);
                if (!data.error) {
                    row.querySelector('.price').textContent = `${data.price.toFixed(2)} ₽`;
                }
            }
        }
        updateTotalSum();
    }

    //обработчик кнопки обновить
    window.manualRefresh = async () => {
        await updateAllData();
    };

    //полное обновление данных
    async function updateAllData() {
        const rows = tbody.querySelectorAll('tr');
        lastUpdateElement.textContent = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Обновление цен
        for (const row of rows) {
            const ticker = row.querySelector('.ticker-input').value.trim();
            if (ticker) {
                const stockData = await fetchStockData(ticker);
                if (!stockData.error) {
                    row.querySelector('.price').textContent = `${stockData.price.toFixed(2)} ₽`;
                }
            }
        }

        // Обновление дивидендов
        for (const row of rows) {
            const ticker = row.querySelector('.ticker-input').value.trim();
            if (ticker) {
                await updateDividendData(row, ticker);
            }
        }

        updateTotalSum();
        updateTotalDividends();
    }

    async function login() {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            })
        });

        if (response.ok) window.location.reload();
    }

    // При загрузке страницы
    async function loadAssets() {
        const response = await fetch('/api/assets');
        const assets = await response.json();

        // Отрисовка таблицы с данными из assets
    }

    // Проверка авторизации при загрузке
    async function checkAuth() {
        const response = await fetch('/api/check-auth');
        if (!response.ok) window.location.href = '/login.html';
    }

    // Отображение имени пользователя
    async function loadUserInfo() {
        const response = await fetch('/api/user');
        const user = await response.json();
        document.getElementById('usernameDisplay').textContent = user.username;
    }

    // Выход
// Функция выхода
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include' // Для передачи кук
        });

        if (response.ok) {
            window.location.href = '/login.html';
        } else {
            console.error('Ошибка выхода:', await response.text());
        }
    } catch (error) {
        console.error('Ошибка сети:', error);
    }
}

// Инициализация после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
        logoutButton.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogout(e);
        });
    }
});

// Проверка статуса авторизации
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/check-auth', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const userData = await fetch('/api/user', {
                credentials: 'include'
            }).then(res => res.json());
            
            document.getElementById('currentUser').textContent = `👤 ${userData.username}`;
        } else {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

    // Инициализация
    checkAuth();
    loadUserInfo();

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    checkAuthStatus();
    loadUserInfo();
    initTable();
});

// Вынесенная наружу функция обработки выхода
async function handleLogout(e) {
    e.preventDefault();
    const button = e.currentTarget;
    
    try {
        button.disabled = true;
        button.style.opacity = '0.7';
        
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            window.location.href = '/login.html';
        } else {
            alert('Ошибка выхода. Попробуйте снова.');
        }
    } catch (error) {
        console.error('Logout failed:', error);
    } finally {
        button.disabled = false;
        button.style.opacity = '1';
    }
}

