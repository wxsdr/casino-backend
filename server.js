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
    // Временно убираем привязку к каналу, чтобы проверить, увидит ли он сообщение везде
    if (message.content.includes('[CASINO_ORDER]')) {
        console.log(`[БОТ НАШЕЛ] Сообщение в канале ${message.channel.name}: ${message.content}`);
        
        const cleanContent = message.content.substring(message.content.indexOf('[CASINO_ORDER]')).replace('[CASINO_ORDER] ', '').trim();
        const [user, amount] = cleanContent.split(':');
        
        if (user && amount) {
            try {
                const userRef = db.ref(`users_by_name/${user.toLowerCase()}`);
                const snapshot = await userRef.once('value');
                const data = snapshot.val();
                const currentChips = data ? (data.chips || 0) : 0;

                await userRef.update({ 
                    username: user, 
                    chips: currentChips + parseInt(amount) 
                });
                
                console.log(`[УСПЕХ] Начислил ${amount} фишек игроку ${user}`);
            } catch (error) {
                console.error(`[ОШИБКА] Не удалось обновить Firebase:`, error);
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
