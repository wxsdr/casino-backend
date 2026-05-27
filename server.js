const express = require('express');
const admin = require('firebase-admin');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();

// Получаем секретный ключ Firebase из Render
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Подключаемся к базе данных Firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kurahivka-casino-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();

// --- БЛОК DISCORD БОТА ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

client.on('messageCreate', async (message) => {
    // Слушаем только канал с названием 'casino' и сообщения с тегом [CASINO_ORDER]
    if (message.channel.name === 'casino' && message.content.startsWith('[CASINO_ORDER]')) {
        // Убираем тег и пробел, остается "xui:10"
        const content = message.content.replace('[CASINO_ORDER] ', '');
        // Разбиваем строку на ник и количество
        const [user, amount] = content.split(':');
        
        if (user && amount) {
            await updateFirebaseChips(user, parseInt(amount));
            console.log(`[УСПЕХ] Добавлено ${amount} фишек игроку ${user}`);
        }
    }
});

// Функция для обновления базы
async function updateFirebaseChips(username, amount) {
    const userRef = db.ref(`users_by_name/${username.toLowerCase()}`);
    const snapshot = await userRef.once('value');
    const data = snapshot.val();
    const currentChips = data ? (data.chips || 0) : 0;

    await userRef.update({
        username: username, // сохраняем оригинальный регистр ника
        chips: currentChips + amount
    });
}

// Запускаем бота
client.login(process.env.DISCORD_TOKEN);


// --- БЛОК HTTP API (для вывода фишек обратно в игру) ---
app.get('/api/withdraw', async (req, res) => {
    const { user } = req.query;
    if (!user) return res.send("0");
    
    const userRef = db.ref(`users_by_name/${user.toLowerCase()}`);

    try {
        const snapshot = await userRef.once('value');
        const data = snapshot.val();
        const chips = data ? (data.chips || 0) : 0;

        if (chips > 0) {
            await userRef.update({ chips: 0 }); // Обнуляем на сайте
        }
        res.send(chips.toString()); // Отдаем число фишек в Майнкрафт
    } catch (e) {
        console.error("Ошибка при выводе фишек:", e);
        res.send("0");
    }
});

// Запускаем веб-сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Бэкенд успешно запущен на порту ${PORT}`));
