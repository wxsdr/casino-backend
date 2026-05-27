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
    // Regex строго ищет: [CASINO_ORDER] ник:число (и никаких других символов)
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
});

client.login(process.env.DISCORD_TOKEN);


// ... твій код бота вище ...

// ВСТАВЛЯЙ СЮДИ:
app.get('/api/withdraw', async (req, res) => {
    const { user } = req.query;
    if (!user) return res.send("0");
    
    const userRef = db.ref(`users_by_name/${user.toLowerCase()}`);

    try {
        const snapshot = await userRef.once('value');
        if (!snapshot.exists()) {
            // Створюємо юзера, якщо він вперше зайшов
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

// ... і далі йде запуск сервера ...
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[СЕРВЕР] Бэкенд запущен на порту ${PORT}`));
