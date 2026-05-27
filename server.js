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
    if (message.content.includes('[CASINO_ORDER]')) {
        const rawContent = message.content.split('[CASINO_ORDER]')[1];
        if (!rawContent) return;

        const [user, amountRaw] = rawContent.split(':');
        const amount = parseInt(amountRaw.replace(/\D/g, ''));
        const username = user.trim();

        if (username && amount) {
            try {
                const userRef = db.ref(`users_by_name/${username.toLowerCase()}`);
                const snapshot = await userRef.once('value');
                
                if (!snapshot.exists()) {
                    // Якщо користувача немає — створюємо новий запис
                    await userRef.set({
                        username: username,
                        chips: amount
                    });
                    console.log(`[НОВИЙ ЮЗЕР] Створено ${username}, налічено ${amount} фішок`);
                } else {
                    // Якщо є — оновлюємо
                    const data = snapshot.val();
                    await userRef.update({ 
                        chips: (data.chips || 0) + amount 
                    });
                    console.log(`[УСПЕХ] Начислил ${amount} фишек игроку ${username}`);
                }
            } catch (error) {
                console.error(`[ОШИБКА] Firebase:`, error);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);


// --- НАСТРОЙКА HTTP API (ДЛЯ МАЙНКРАФТА) ---
app.get('/api/withdraw', async (req, res) => {
    const { user } = req.query;
    if (!user) return res.send("0");
    
    const userRef = db.ref(`users_by_name/${user.toLowerCase()}`);

    try {
        const snapshot = await userRef.once('value');
        const data = snapshot.val();
        const chips = data ? (data.chips || 0) : 0;

        if (chips > 0) {
            await userRef.update({ chips: 0 }); 
        }
        res.send(chips.toString());
    } catch (e) {
        console.error("[ОШИБКА] API withdraw:", e);
        res.send("0");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[СЕРВЕР] Бэкенд запущен на порту ${PORT}`));
