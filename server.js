const express = require('express');
const admin = require('firebase-admin');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://kurahivka-casino-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();

// Инициализация бота
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.on('messageCreate', async (message) => {
    // Проверяем название канала и префикс
    if (message.channel.name === 'casino' && message.content.startsWith('[CASINO_ORDER]')) {
        const content = message.content.replace('[CASINO_ORDER] ', '');
        const [user, amount] = content.split(':');
        
        if (user && amount) {
            const userRef = db.ref(`users_by_name/${user.toLowerCase()}`);
            const snapshot = await userRef.once('value');
            const data = snapshot.val();
            const currentChips = data ? (data.chips || 0) : 0;

            await userRef.update({ username: user, chips: currentChips + parseInt(amount) });
            console.log(`[БОТ] Начислил ${amount} фишек игроку ${user}`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

app.listen(process.env.PORT || 3000, () => console.log("Бэкенд запущен!"));
