const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const cron = require("node-cron");
const qrcode = require("qrcode-terminal");

async function conectarBot() {
    console.log("🚀 SOCIALIZE32 BOT: INICIANDO...");

    // Carpeta 'sesion_auth' para mantener la sesión activa en Railway
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        browser: ["Socialize32 Bot", "Chrome", "1.0.0"],
        printQRInTerminal: false
    });

    // --- GESTIÓN DE CONEXIÓN ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📢 ESCANEA EL QR PARA CONECTAR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('✅ BOT ONLINE 24/7 EN SOCIALIZE32');
        } else if (connection === 'close') {
            const debeReconectar = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            if (debeReconectar) {
                console.log("🔄 Reconectando...");
                conectarBot();
            }
        }
    });

    // --- MODERACIÓN AUTOMÁTICA (24 HORAS) ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const groupJid = msg.key.remoteJid;

        // Lista de palabras prohibidas
        const insultos = ["mierda", "hpta", "gonorrea", "malparido", "hijueputa", "carechimba"]; 

        if (groupJid.endsWith('@g.us') && insultos.some(p => texto.includes(p))) {
            try {
                // Eliminar el mensaje ofensivo
                await sock.sendMessage(groupJid, { delete: msg.key });
                
                // Expulsar al usuario
                await sock.groupParticipantsUpdate(groupJid, [msg.key.participant], "remove");
                
                await sock.sendMessage(groupJid, { text: '❌ Usuario expulsado automáticamente por falta de respeto.' });
            } catch (err) {
                console.log("Error en moderación (posiblemente el bot no es admin):", err);
            }
        }
    });

    // --- SALUDO AUTOMÁTICO 6 AM (Cron Job) ---
    // El ID del grupo es el que pusiste: 120363385735164283@g.us
    cron.schedule('0 6 * * *', async () => {
        const idGrupo = "120363385735164283@g.us"; 
        try {
            await sock.sendMessage(idGrupo, { 
                text: "¡Buenos días Socialize32! ☀️\n\nQue tengan un excelente día todos. Recuerden seguir las reglas. 🚀" 
            });
            console.log("✅ Saludo matutino enviado.");
        } catch (e) {
            console.log("Error en cron job:", e);
        }
    }, {
        scheduled: true,
        timezone: "America/Bogota"
    });

    sock.ev.on('creds.update', saveCreds);
}

conectarBot().catch(err => console.log("Error crítico:", err));