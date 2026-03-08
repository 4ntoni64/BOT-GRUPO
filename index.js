const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const cron = require("node-cron");
const QRCode = require('qrcode'); // Nueva librería

async function conectarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        browser: ["Socialize32", "Chrome", "1.0.0"],
        printQRInTerminal: false
    });

    // --- GENERADOR DE QR COMPACTO PARA RAILWAY ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n--- INICIO DEL QR ---");
            // Genera el QR usando caracteres pequeños para evitar que Railway lo deforme
            QRCode.toString(qr, { type: 'terminal', small: true }, function (err, url) {
                console.log(url);
            });
            console.log("--- FIN DEL QR ---\n");
            console.log("💡 TRUCO: Si no lee, baja el zoom del navegador al 50%");
        }

        if (connection === 'open') {
            console.log('✅ BOT ONLINE EN SOCIALIZE32');
        } else if (connection === 'close') {
            const debeReconectar = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            if (debeReconectar) conectarBot();
        }
    });

    // --- MODERACIÓN Y SALUDO (Tu lógica original) ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const groupJid = msg.key.remoteJid;

        const insultos = ["mierda", "hpta", "gonorrea", "malparido", "hijueputa", "carechimba"]; 
        if (groupJid.endsWith('@g.us') && insultos.some(p => texto.includes(p))) {
            try {
                await sock.sendMessage(groupJid, { delete: msg.key });
                await sock.groupParticipantsUpdate(groupJid, [msg.key.participant], "remove");
            } catch (e) { console.log("Error de admin:", e); }
        }
    });

    cron.schedule('0 6 * * *', async () => {
        try {
            await sock.sendMessage("120363385735164283@g.us", { text: "¡Buenos días Socialize32! ☀️" });
        } catch (e) { console.log(e); }
    }, { timezone: "America/Bogota" });

    sock.ev.on('creds.update', saveCreds);
}

conectarBot().catch(err => console.log(err));
