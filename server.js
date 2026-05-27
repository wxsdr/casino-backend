const express = require('express');
const admin = require('firebase-admin');
const app = express();

// Получаем секретный ключ из Render
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Подключаемся к твоей базе данных
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://kurahivka-casino-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();

// Команда 1: Покупка фишек из Майнкрафта
app.get('/api/buy', async (req, res) => {
    const { user, amount } = req.query;
    if (!user || !amount) return res.send("ERROR");
    
    const userRef = db.ref(`users_by_name/${user.toLowerCase()}`);

    try {
        const snapshot = await userRef.once('value');
        const data = snapshot.val();
        const currentChips = data ? (data.chips || 0) : 0;

        await userRef.update({
            username: user,
            chips: currentChips + parseInt(amount)
        });
        res.send("OK");
    } catch (e) {
        res.send("ERROR");
    }
});

// Команда 2: Вывод фишек обратно в игру
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
        res.send("0");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Бэкенд запущен на порту ${PORT}`));
