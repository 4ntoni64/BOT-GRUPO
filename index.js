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
    console.log("🚀 INICIANDO BOT EN SOCIALIZE32..."); // Aviso de arranque

    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        browser: ["Freddy Bot", "Chrome", "1.0.0"],
        printQRInTerminal: false // Lo manejamos con qrcode-terminal
    });

    // --- 1. GESTIÓN DE CONEXIÓN Y QR ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("✅ CÓDIGO QR GENERADO (Escanéalo ahora):");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('✅ BOT ONLINE Y ESTABLE EN SOCIALIZE32');
        } else if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reconectando...");
                conectarBot();
            }
        }
    });

    // --- 2. BIENVENIDA AUTOMÁTICA ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let num of anu.participants) {
                try {
                    await sock.sendMessage(anu.id, { 
                        text: `¡Hola @${num.split('@')[0]}! 🎉\n\nBienvenido(a) a *Socialize32*. Es un gusto tenerte aquí.\n\nEscribe *!reglas* para conocer las normas. ¡Diviértete! 🚀`,
                        mentions: [num]
                    });
                } catch (e) { console.log("Error bienvenida:", e); }
            }
        }
    });

    // --- 3. COMANDOS Y MODERACIÓN ---
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        const msg = chatUpdate.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const groupJid = msg.key.remoteJid;

        // Comando !reglas
        if (texto === '!reglas') {
            const reglas = `📜 *REGLAS DE SOCIALIZE32*:\n\n1. Respeto total a los miembros.\n2. Prohibido el spam o links externos.\n3. Prohibido el contenido ofensivo.\n4. No insultar (el bot te expulsará automáticamente).`;
            await sock.sendMessage(groupJid, { text: reglas });
        }

        // Comando !ayuda
        if (texto === '!ayuda' || texto === '!help') {
            const ayuda = `🤖 *MENU DEL BOT*:\n\n- *!test*: Verificar estado.\n- *!reglas*: Ver normas del grupo.\n- *!kick @usuario*: Expulsar (Solo Admins).`;
            await sock.sendMessage(groupJid, { text: ayuda });
        }

        // Comando !test
        if (texto === '!test') {
            await sock.sendMessage(groupJid, { text: '✅ ¡Bot activo y estable en Railway, Freddy!' });
        }

        // Moderación Automática (Insultos)
        const insultos = ["mierda", "hpta", "gonorrea", "malparido"]; 
        if (groupJid.endsWith('@g.us') && insultos.some(p => texto.includes(p))) {
            try {
                await sock.groupParticipantsUpdate(groupJid, [msg.key.participant], "remove");
                await sock.sendMessage(groupJid, { text: '❌ Usuario expulsado por lenguaje inapropiado.' });
            } catch (err) { console.log("Error moderación:", err); }
        }
    });

    // --- 4. SALUDO AUTOMÁTICO 6 AM ---
    cron.schedule('0 6 * * *', async () => {
        const idGrupo = "120363385735164283@g.us"; 
        try {
            await sock.sendMessage(idGrupo, { text: "¡Buenos días Socialize32! ☀️ ¡Que tengan un excelente día!" });
        } catch (e) { console.log("Error saludo cron:", e); }
    }, { timezone: "America/Bogota" });

    sock.ev.on('creds.update', saveCreds);
}

conectarBot().catch(err => console.log("Error crítico:", err));