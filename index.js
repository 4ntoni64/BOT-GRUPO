const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const cron = require("node-cron");

async function conectarBot() {
    console.log("🚀 SOCIALIZE32 BOT: INICIANDO...");

    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        // El nombre del navegador es vital para que el Pairing Code funcione
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        printQRInTerminal: false
    });

    // --- LÓGICA DE EMPAREJAMIENTO (Sustituye al QR) ---
    if (!sock.authState.creds.registered) {
        // ⚠️ CAMBIA ESTO: Pon tu número con código de país (Ej: 573100000000)
        const miNumero = "TU_NUMERO_AQUI"; 

        setTimeout(async () => {
            let code = await sock.requestPairingCode(miNumero);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n\n🔗 TU CÓDIGO DE VINCULACIÓN ES: ${code}\n\n`);
        }, 3000);
    }

    // --- GESTIÓN DE CONEXIÓN ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

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

        const insultos = ["mierda", "hpta", "gonorrea", "malparido", "hijueputa", "carechimba"]; 

        if (groupJid.endsWith('@g.us') && insultos.some(p => texto.includes(p))) {
            try {
                // Eliminar mensaje y expulsar
                await sock.sendMessage(groupJid, { delete: msg.key });
                await sock.groupParticipantsUpdate(groupJid, [msg.key.participant], "remove");
                await sock.sendMessage(groupJid, { text: '❌ Usuario expulsado por lenguaje inapropiado.' });
            } catch (err) {
                console.log("Error en moderación (Revisa si el bot es Admin):", err);
            }
        }
    });

    // --- SALUDO AUTOMÁTICO 6 AM ---
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
