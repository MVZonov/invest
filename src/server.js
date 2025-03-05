const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const cheerio = require('cheerio');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
require('dotenv').config();

// Инициализация PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
});

const db = {
  query: (text, params) => pool.query(text, params),
};

// Middleware аутентификации
const authenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    
    if (!user.rows[0]) throw new Error();
    req.user = user.rows[0];
    
    next();
  } catch (err) {
    res.status(401).json({ error: 'Неверный токен' });
  }
};

const app = express();
const PORT = 3000;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Роуты API
app.post('/api/register', async (req, res) => {
  console.log('Получен запрос:', req.body); // Логируем данные
  
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const result = await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [req.body.username, hashedPassword]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Ошибка БД:', err); // Детальный лог ошибки
    res.status(500).json({ error: 'Не удалось создать пользователя' });
  }
});

app.post('/api/login', async (req, res) => {
  // Логирование входящего запроса
  console.log('[Login] Получен запрос:', {
    username: req.body.username,
    password: req.body.password ? '***' : 'не указан'
  });

  try {
    // 1. Поиск пользователя в базе данных
    const userQuery = await db.query(
      'SELECT * FROM users WHERE username = $1', 
      [req.body.username]
    );
    
    // 2. Проверка существования пользователя
    if (!userQuery.rows[0]) {
      console.log('[Login] Пользователь не найден:', req.body.username);
      return res.status(401).json({ 
        error: 'Неверные учетные данные' 
      });
    }

    const user = userQuery.rows[0];
    
    // 3. Проверка пароля
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password_hash
    );
    
    if (!validPassword) {
      console.log('[Login] Неверный пароль для:', user.username);
      return res.status(401).json({ 
        error: 'Неверные учетные данные' 
      });
    }

    // 4. Генерация JWT токена
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username 
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    // 5. Установка cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // В продакшене используйте HTTPS
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000 // 12 часов
    });

    // 6. Успешный ответ
    console.log('[Login] Успешная авторизация:', user.username);
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (err) {
    // 7. Обработка ошибок
    console.error('[Login] Ошибка сервера:', err);
    res.status(500).json({ 
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

// Проверка авторизации
app.get('/api/check-auth', authenticate, (req, res) => {
  res.json({ authenticated: true });
});

// Получение данных пользователя
app.get('/api/user', authenticate, (req, res) => {
  res.json({
      id: req.user.id,
      username: req.user.username
  });
});

// Выход
app.post('/api/logout', (req, res) => {
  res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      path: '/'
  }).status(200).json({ success: true });
});

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