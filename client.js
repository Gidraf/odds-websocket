const WebSocket = require('ws');

// Simple logger to match Python's output format
const log = (level, message) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    console.log(`${timestamp} - ${level} - ${message}`);
};

class SportpesaClient {
    constructor() {
        this.wsUrl = "wss://realtime-notificator.ke.sportpesa.com/socket.io/?EIO=3&transport=websocket";
        this.ws = null;
        this.shouldRun = true;
        this.reconnectDelay = 5000; // 5 seconds
        this.isReconnecting = false;
    }

    connect() {
        if (this.ws) {
            this.ws.terminate();
        }

        const headers = {
            'Origin': 'https://www.ke.sportpesa.com',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        };

        log('INFO', "Connecting to Sportpesa...");
        this.ws = new WebSocket(this.wsUrl, { headers: headers });

       this.ws.on('open', () => {
    log('INFO', "Sportpesa Connection opened");
    this.isReconnecting = false;

    // Send subscription **AFTER handshake**
    setTimeout(() => {
        const sub = '42["subscribe","buffered-event-105395-194-0.00"]';
        this.ws.send(sub);
        log('INFO', `Subscription Sent: ${sub}`);
    }, 500); // small delay ensures server is ready
});

        this.ws.on('message', (data) => {
            // Convert Buffer to string
            const message = data.toString();

            // --- Engine.IO v3 Protocol Handler ---

            // Type '0': Open (Handshake)
            if (message.startsWith('0{')) {
                log('INFO', "Handshake successful");
            }
            // Type '1': Close
            else if (message.startsWith('1')) {
                log('INFO', "Server requested close");
            }
            // Type '2': Ping -> WE MUST SEND PONG ('3')
            else if (message === '2') {
                log('DEBUG', "Ping received, sending Pong");
                this.ws.send('3');
            }
            // Type '42': Event Message
            else if (message.startsWith('42')) {
                try {
                    // Strip the '42' prefix and parse
                    const jsonStr = message.substring(2);
                    const payload = JSON.parse(jsonStr);
                    const eventName = payload[0];
                    const eventData = payload[1];

                    if (eventName === 'BUFFERED_MARKET_UPDATE') {
                        this.handleMarketUpdate(eventData);
                    } else {
                        log('DEBUG', `Other event received: ${eventName}`);
                    }
                } catch (e) {
                    log('ERROR', `Failed to parse message: ${message} - Error: ${e.message}`);
                }
            }
        });

        this.ws.on('error', (error) => {
            log('ERROR', `WebSocket Error: ${error.message}`);
        });

        this.ws.on('close', (code, reason) => {
             log('WARN', `Sportpesa Connection closed (Code: ${code})`);
             this.scheduleReconnect();
        });
    }

    scheduleReconnect() {
        if (this.shouldRun && !this.isReconnecting) {
            this.isReconnecting = true;
            log('INFO', `Reconnecting in ${this.reconnectDelay / 1000} seconds...`);
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay);
        }
    }

    handleMarketUpdate(data) {
        /*
         YOUR CUSTOM LOGIC HERE
         */
        const marketId = data.eventMarketId;
        const odds = data.selections || [];
        log('INFO', `UPDATE RECEIVED | Market: ${marketId} | Selections: ${odds.length}`);
        
        // Example: log full data if needed
        // console.log(JSON.stringify(data, null, 2));
    }
}

// --- Quick Test ---
if (require.main === module) {
    const client = new SportpesaClient();
    client.connect();
}

module.exports = SportpesaClient;