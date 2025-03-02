const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

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

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});