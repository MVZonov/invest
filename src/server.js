const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Роут для данных акций
app.get('/api/stock/:ticker', async (req, res) => {
    try {
        const { ticker } = req.params;
        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}.json`;
        
        const response = await axios.get(url, {
            params: { iss: 'meta', lang: 'ru' }
        });

        const securityData = response.data.securities.data[0];
        const marketData = response.data.marketdata.data[0];
        
        res.json({
            name: securityData[9],
            price: marketData[12]
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Роут для дивидендов
app.get('/api/dividend/:ticker', async (req, res) => {
    try {
        const { ticker } = req.params;
        const url = `https://www.dohod.ru/ik/analytics/dividend/${ticker.toLowerCase()}`;
        
        const response = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ru-RU,ru;q=0.9'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Новая логика парсинга (аналогичная Google Sheets)
        const tables = $('table');
        const targetTable = tables.eq(1); // Вторая таблица на странице
        const dividend = targetTable.find('tr').eq(1).find('td').eq(1).text().trim();

        res.json({
            value: parseFloat(dividend.replace(',', '.')) || 0
        });

    } catch (error) {
        res.status(500).json({ error: "Данные недоступны" });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});