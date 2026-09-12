const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);

// إعداد Cors لضمان عمل الاتصال بدون مشاكل Cross-Origin
const io = new Server(server, {
    cors: { origin: "*" }
});

// تقديم ملفات الواجهة (HTML/CSS/JS) مباشرة من السيرفر
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let tiktokLiveConnection = null;

io.on('connection', (socket) => {
    console.log('صفحة اللعبة متصلة بالخادم');

    socket.on('connect-tiktok', (uniqueId) => {
        if (tiktokLiveConnection) {
            try { tiktokLiveConnection.disconnect(); } catch (e) {}
        }

        tiktokLiveConnection = new WebcastPushConnection(uniqueId);

        socket.emit('tiktok-status', { status: 'connecting', message: 'جاري الاتصال بالبث...' });

        tiktokLiveConnection.connect().then(state => {
            socket.emit('tiktok-status', { status: 'connected', message: `تم الاتصال ببث: ${uniqueId}` });
        }).catch(err => {
            socket.emit('tiktok-status', { status: 'disconnected', message: 'فشل الاتصال بالبث! تأكد أنك لايف حالياً.' });
        });

        // الاستماع للتعليقات
        tiktokLiveConnection.on('chat', data => {
            socket.emit('tiktok-chat', {
                uniqueId: data.uniqueId,
                nickname: data.nickname,
                comment: data.comment
            });
        });

        // الاستماع لمغادرة المتابعين أو انتهاء البث
        tiktokLiveConnection.on('streamEnd', () => {
            socket.emit('tiktok-status', { status: 'disconnected', message: 'انتهى البث المباشر' });
        });
    });

    socket.on('disconnect-tiktok', () => {
        if (tiktokLiveConnection) {
            try { tiktokLiveConnection.disconnect(); } catch (e) {}
            tiktokLiveConnection = null;
        }
        socket.emit('tiktok-status', { status: 'disconnected', message: 'تم قطع الاتصال' });
    });
});

// استخدام المنفذ المخصص من Render أو 3000 للتطوير المحلي
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل بنجاح على المنفذ: ${PORT}`);
});
