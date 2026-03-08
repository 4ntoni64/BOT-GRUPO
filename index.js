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

    // 1. Gestión de autenticación persistente
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        browser: ["Socialize32", "Chrome", "1.0.0"],
        printQRInTerminal: false // Lo manejamos nosotros para mayor control
    });

    // --- GESTIÓN DE CONEXIÓN Y QR ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.clear(); // Limpia basura previa de los logs
            console.log("\n📢 ESCANEA EL QR PARA CONECTAR SOCIALIZE32:");
            // Usamos small: false para que el QR sea más grande y legible en Railway
            qrcode.generate(qr, { small: false }); 
            console.log("Pista: Aleja el zoom del navegador (Ctrl y -) si ves el QR deforme.\n");
        }

        if (connection === 'open') {
            console.log('✅ BOT ONLINE 24/7 EN SOCIALIZE32');
        } else if (connection === 'close') {
            const debeReconectar = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            if (debeReconectar) {
                console.log("🔄 Conexión perdida. Reconectando...");
                conectarBot();
            }
        }
    });

    // --- MODERACIÓN AUTOMÁTICA (Eliminar y Expulsar) ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const groupJid = msg.key.remoteJid;

        const insultos = ["mierda", "hpta", "gonorrea", "malparido", "hijueputa", "carechimba"]; 

        if (groupJid.endsWith('@g.us') && insultos.some(p => texto.includes(p))) {
            try {
                // Borra el mensaje insultante
                await sock.sendMessage(groupJid, { delete: msg.key });
                // Saca al usuario (El bot DEBE ser admin)
                await sock.groupParticipantsUpdate(groupJid, [msg.key.participant], "remove");
                await sock.sendMessage(groupJid, { text: '❌ Usuario expulsado por falta de respeto.' });
            } catch (err) {
                console.log("Error de moderación: ¿El bot es administrador?");
            }
        }
    });

    // --- SALUDO DIARIO 6 AM ---
    cron.schedule('0 6 * * *', async () => {
        const idGrupo = "120363385735164283@g.us"; 
        try {
            await sock.sendMessage(idGrupo, { 
                text: "¡Buenos días Socialize32! ☀️\n\nQue tengan un excelente día todos. Recuerden seguir las reglas. 🚀" 
            });
            console.log("✅ Mensaje matutino enviado con éxito.");
        } catch (e) {
            console.log("Error enviando saludo programado:", e);
        }
    }, {
        scheduled: true,
        timezone: "America/Bogota"
    });

    sock.ev.on('creds.update', saveCreds);
}

conectarBot().catch(err => console.log("Error crítico en el arranque:", err));
