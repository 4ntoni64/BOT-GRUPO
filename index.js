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
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        // Eliminamos la opción antigua para quitar el aviso de advertencia
        logger: pino({ level: "silent" }),
        browser: ["Freddy Bot", "Chrome", "1.0.0"] 
    });

    // --- NUEVA LÓGICA PARA EL QR ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Si el servidor envía un QR, lo dibujamos en la terminal
        if (qr) {
            console.log("📌 ESCANEA EL SIGUIENTE CÓDIGO QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('✅ ¡CONECTADO EXITOSAMENTE!');
        } else if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                conectarBot();
            }
        }
    });

    // --- TUS FUNCIONES (Bienvenida, Cron, Moderación) ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let num of anu.participants) {
                await sock.sendMessage(anu.id, { 
                    text: `¡Hola @${num.split('@')[0]}! 🎉 Bienvenido al grupo.`,
                    mentions: [num]
                });
            }
        }
    });

    cron.schedule('0 6 * * *', async () => {
        // Recuerda obtener el ID del grupo de los logs después de conectar
        const idGrupo = "TU_ID_AQUI@g.us"; 
        await sock.sendMessage(idGrupo, { text: "¡Buenos días chicos! ☀️" });
    }, { timezone: "America/Bogota" });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const insultos = ["mierda", "hpta", "gonorrea"]; 
        if (msg.key.remoteJid.endsWith('@g.us') && insultos.some(p => texto.includes(p))) {
            await sock.groupParticipantsUpdate(msg.key.remoteJid, [msg.key.participant], "remove");
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

conectarBot();
