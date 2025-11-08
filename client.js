const WebSocket = require('ws');

const log = (level, message) => {
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`${ts} - ${level} - ${message}`);
};

class SportpesaClient {
    constructor() {
        this.url = "wss://realtime-notificator.ke.sportpesa.com/socket.io/?EIO=3&transport=websocket";
        this.ws = null;
        this.reconnectDelay = 5000;
        this.pingInterval = null;

        // You can add more subscription codes here dynamically later
        this.subscriptions = [
            "buffered-event-105395-194-0.00", // Example match market
            // Add more here ⬆️ once we auto-detect live matches
        ];
    }

    connect() {
        log("INFO", "Connecting...");
        this.ws = new WebSocket(this.url, {
            headers: {
                'Origin': 'https://www.ke.sportpesa.com',
                'User-Agent': 'Mozilla/5.0',
                'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
            }
        });

        this.ws.on('open', () => {
            log("INFO", "✅ Connected & Handshake OK");
            this.startPing();
            setTimeout(() => this.sendSubscriptions(), 500);
        });

        this.ws.on('message', (data) => this.handleMessage(data.toString()));

        this.ws.on('close', (code) => {
            log("WARN", `Connection closed (code: ${code})`);
            this.stopPing();
            this.scheduleReconnect();
        });

        this.ws.on('error', (err) => {
            log("ERROR", err.message);
        });
    }

    scheduleReconnect() {
        log("INFO", `Reconnecting in ${this.reconnectDelay / 1000}s...`);
        setTimeout(() => this.connect(), this.reconnectDelay);
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            try {
                this.ws.send('2'); // Client ping
                log("DEBUG", "Ping sent");
            } catch (_) {}
        }, 25000);
    }

    stopPing() {
        clearInterval(this.pingInterval);
    }

    sendSubscriptions() {
        this.subscriptions.forEach(sub => {
            const msg = `42["subscribe","${sub}"]`;
            this.ws.send(msg);
            log("INFO", `📡 Subscribed: ${sub}`);
        });
    }

    handleMessage(message) {
        // Server Ping → respond with Pong
        if (message === '2') {
            this.ws.send('3');
            return;
        }

        // Socket.IO event frames start with 42
        if (message.startsWith("42")) {
            const json = message.substring(2);
            let payload;
            try {
                payload = JSON.parse(json);
            } catch {
                return;
            }

            const eventName = payload[0];
            const data = payload[1];

            switch (eventName) {
                case "EVENT_UPDATE":
                    this.handleMatchEvent(data);
                    break;

                case "BUFFERED_MARKET_UPDATE":
                    this.handleMarketUpdate(data);
                    break;

                default:
                    log("DEBUG", `Unhandled event: ${eventName}`);
            }
        }
    }

    handleMatchEvent(data) {
        const id = data.id;
        const time = data.state?.matchTime;
        const home = data.state?.matchScore?.home;
        const away = data.state?.matchScore?.away;

        log("UPDATE", `⚽ Match ${id} | ${home}:${away} | Time: ${time}`);
    }

    handleMarketUpdate(data) {
        const market = data.eventMarketId;
        const match = data.eventId;
        const name = data.name;
        const selections = data.selections || [];

        log("UPDATE", `💰 Market ${name} for Match ${match}`);

        selections.forEach(s => {
            console.log(`   → ${s.name} @ ${s.odds}`);
        });
    }
}

// Run directly
if (require.main === module) {
    const client = new SportpesaClient();
    client.connect();
}
