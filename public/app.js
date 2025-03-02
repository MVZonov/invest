document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.querySelector('#stocksTable tbody');
    const totalSumElement = document.querySelector('#totalSum');
    const lastUpdateElement = document.querySelector('#lastUpdate');
    let isUpdating = false;
    let updateInterval = null;

    // Создание строки
    function createRow() {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" class="ticker-input" placeholder="Введите тикер и нажмите Enter"></td>
            <td class="company-name"></td>
            <td class="price"></td>
            <td><input type="number" min="0" class="quantity-input" placeholder="0"></td>
            <td class="sum"></td>
            <td><button class="delete-row">×</button></td>
        `;
        return row;
    }

    // Запрос данных
    async function fetchStockData(ticker) {
        try {
            const response = await fetch(`http://localhost:3000/api/stock/${ticker}`);
            if (!response.ok) throw new Error("Тикер не найден");
            return await response.json();
        } catch (error) {
            return { error: error.message };
        }
    }

    // Расчёт суммы
    function calculateRowSum(row) {
        const priceText = row.querySelector('.price').textContent;
        const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;
        const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
        const sum = price * quantity;
        row.querySelector('.sum').textContent = sum ? `${sum.toFixed(2)} ₽` : '—';
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

    // Обработчик тикера (запускается по Enter)
    async function handleTickerInput(row, ticker) {
        if (isUpdating || !ticker.trim()) return;
        isUpdating = true;

        try {
            const data = await fetchStockData(ticker.toUpperCase());
            
            if (data.error) throw new Error(data.error);
            
            row.querySelector('.company-name').textContent = data.name || '—';
            row.querySelector('.price').textContent = data.price ? 
                `${data.price.toFixed(2)} ₽` : '—';

            // Добавляем новую строку, если текущая — последняя
            if (row === tbody.lastElementChild) {
                const newRow = createRow();
                tbody.appendChild(newRow);
                addEventListenersToRow(newRow);
            }
        } catch (error) {
            row.querySelector('.company-name').textContent = 'Ошибка';
            row.querySelector('.price').textContent = '—';
        } finally {
            isUpdating = false;
            updateTotalSum();
        }
    }

    // Обработчики событий для строки
    function addEventListenersToRow(row) {
        const tickerInput = row.querySelector('.ticker-input');
        const quantityInput = row.querySelector('.quantity-input');
        const deleteButton = row.querySelector('.delete-row');

        // Запрос по нажатию Enter
        tickerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleTickerInput(row, tickerInput.value.trim());
            }
        });

        // Обновление суммы при изменении количества
        quantityInput.addEventListener('input', updateTotalSum);

        // Удаление строки
        deleteButton.addEventListener('click', () => {
            row.remove();
            updateTotalSum();
            // Добавляем строку, если таблица пуста
            if (tbody.children.length === 0) tbody.appendChild(createRow());
        });
    }

    // Автообновление цен
    async function updateAllPrices() {
        const rows = tbody.querySelectorAll('tr');
        lastUpdateElement.textContent = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        for (const row of rows) {
            const ticker = row.querySelector('.ticker-input').value.trim().toUpperCase();
            if (ticker) {
                const data = await fetchStockData(ticker);
                if (!data.error) {
                    row.querySelector('.price').textContent = 
                        `${data.price?.toFixed(2) || '—'} ₽`;
                }
            }
        }
        updateTotalSum();
    }

    // Инициализация
    tbody.appendChild(createRow());
    addEventListenersToRow(tbody.firstElementChild);
    updateInterval = setInterval(updateAllPrices, 60000);
    updateAllPrices();

    // Ручное обновление
    window.manualRefresh = () => {
        clearInterval(updateInterval);
        updateAllPrices();
        updateInterval = setInterval(updateAllPrices, 60000);
    };
});