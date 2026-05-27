const express = require('express');
const admin = require('firebase-admin');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();

// --- НАСТРОЙКА FIREBASE ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kurahivka-casino-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();

// --- НАСТРОЙКА DISCORD БОТА ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// Проверка успешного запуска бота
client.on('ready', () => {
    console.log(`[БОТ] Успешно залогинился как ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // Игнорируем логи сервера (чтобы не дублировать начисления и не ловить баги со временем)
    if (message.content.includes("INFO") || message.content.includes("issued server command") || message.content.includes("```")) return;

    // --- ПОПОВНЕННЯ ФІШОК (ПОКУПКА) ---
    const orderMatch = message.content.match(/\[CASINO_ORDER\]\s*([a-zA-Z0-9_\-\.]+):(\d+)/);
    if (orderMatch) {
        const username = orderMatch[1];
        const amount = parseInt(orderMatch[2], 10);

        try {
            const userRef = db.ref(`users_by_name/${username.toLowerCase()}`);
            const snapshot = await userRef.once('value');
            if (!snapshot.exists()) {
                await userRef.set({ username: username, chips: amount });
            } else {
                const data = snapshot.val();
                await userRef.update({ chips: parseInt(data.chips || 0, 10) + amount });
            }
            console.log(`[ПОПОВНЕННЯ] Зарахував ${amount} фішок гравцю ${username}`);
        } catch (e) { console.error(e); }
    }

    // --- ЗНЯТТЯ ФІШОК (ВИВЕДЕННЯ) ---
    const withdrawMatch = message.content.match(/\[CASINO_WITHDRAW\]\s*([a-zA-Z0-9_\-\.]+):(\d+)/);
    if (withdrawMatch) {
        const username = withdrawMatch[1];
        const amount = parseInt(withdrawMatch[2], 10);

        try {
            const userRef = db.ref(`users_by_name/${username.toLowerCase()}`);
            const snapshot = await userRef.once('value');
            if (snapshot.exists()) {
                const data = snapshot.val();
                let newChips = parseInt(data.chips || 0, 10) - amount;
                if (newChips < 0) newChips = 0; // Защита от минуса
                await userRef.update({ chips: newChips });
                console.log(`[ЗНЯТТЯ] Списав ${amount} фішок з сайту у гравця ${username}`);
            }
        } catch (e) { console.error(e); }
    }

    // --- ПАРОЛЬ ДЛЯ САЙТА (PIN) ---
    const pinMatch = message.content.match(/\[CASINO_PIN\]\s*([a-zA-Z0-9_\-\.]+):(\d+)/);
    if (pinMatch) {
        const username = pinMatch[1];
        const pin = pinMatch[2];

        try {
            const userRef = db.ref(`users_by_name/${username.toLowerCase()}`);
            await userRef.update({ pin: pin });
            console.log(`[БЕЗОПАСНОСТЬ] Установил PIN для ${username}`);
        } catch (e) { console.error(e); }
    }
});

client.login(process.env.DISCORD_TOKEN);


// --- API ДЛЯ АВТОРИЗАЦИИ НА САЙТЕ ---
app.get('/api/login', async (req, res) => {
    // Включаем CORS, чтобы сайт мог делать запросы с любого домена
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    
    const { user, pin } = req.query;
    if (!user || !pin) return res.json({ success: false, message: "Введіть нік та код!" });

    try {
        const userRef = db.ref(`users_by_name/${user.toLowerCase()}`);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Проверяем, совпадает ли код
            if (data.pin && data.pin === pin) {
                // Если совпал, пускаем и затираем пин (чтобы он был одноразовым)
                await userRef.update({ pin: null }); 
                res.json({ success: true });
            } else {
                res.json({ success: false, message: "Невірний код! Напишіть /casinopass у грі." });
            }
        } else {
            res.json({ success: false, message: "Акаунт не знайдено. Спочатку купіть фішки!" });
        }
    } catch (e) {
        res.json({ success: false, message: "Помилка сервера." });
    }
});

// --- API ВЫВОДА СРЕДСТВ ---
app.get('/api/withdraw', async (req, res) => {
    const { user } = req.query;
    if (!user) return res.send("0");
    
    const userRef = db.ref(`users_by_name/${user.toLowerCase()}`);

    try {
        const snapshot = await userRef.once('value');
        if (!snapshot.exists()) {
            // Создаем юзера, если он впервые зашел
            await userRef.set({ username: user, chips: 0 });
            res.send("0");
        } else {
            const data = snapshot.val();
            const chips = data.chips || 0;
            if (chips > 0) {
                await userRef.update({ chips: 0 }); 
            }
            res.send(chips.toString());
        }
    } catch (e) {
        console.error("[ОШИБКА] API withdraw:", e);
        res.send("0");
    }
});

// ... и запуск сервера ...
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[СЕРВЕР] Бэкенд запущен на порту ${PORT}`));
