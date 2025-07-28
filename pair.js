const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const pino = require("pino");
const { upload } = require('./mega');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore
} = require('@fizzxydev/baileys-pro'); // 🛑 Note: this should match your actual installed package!

const router = express.Router();

function removeFile(filePath) {
  if (fs.existsSync(filePath)) fs.rmSync(filePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
  const id = makeid();
  let number = req.query.number;

  async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);
    try {
      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        printQRInTerminal: false,
        browser: Browsers.macOS("Safari"),
        logger: pino({ level: "silent" }),
      });

      if (!sock.authState.creds.registered) {
        await delay(1500);
        number = number.replace(/[^0-9]/g, '');

        try {
          const code = await sock.requestPairingCode(`${number}@s.whatsapp.net`); // ✅ FIXED LINE
          if (!code) return res.send({ code: "❌ Pairing failed: code is null" });
          return res.send({ code });
        } catch (err) {
          return res.send({ code: "❌ Error requesting code: " + err.message });
        }
      }

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on("connection.update", async ({ connection }) => {
        if (connection === "open") {
          await delay(5000);
          const filePath = `./temp/${id}/creds.json`;
          const sessionData = fs.createReadStream(filePath);

          const megaUrl = await upload(sessionData, `${sock.user.id}.json`);
          const sessionId = "ARSL~" + megaUrl.replace('https://mega.nz/file/', '');

          await sock.sendMessage(sock.user.id, { text: sessionId });

          const desc = `*🎉 Session Generated Successfully!*\n\n*🤖 Bot:* Arslan-Ai-2.0\n🔗 *GitHub:* https://github.com/Arslan-MD/Arslan_MD\n\n⚠️ *Keep this session ID safe!*`;
          await sock.sendMessage(sock.user.id, {
            text: desc,
            contextInfo: {
              externalAdReply: {
                title: "ArslanMD Official",
                thumbnailUrl: "https://i.imgur.com/GVW7aoD.jpeg",
                sourceUrl: "https://github.com/Arslan-MD/Arslan_MD",
                mediaType: 1,
                renderLargerThumbnail: true
              }
            }
          });

          await sock.ws.close();
          removeFile(`./temp/${id}`);
          process.exit(0);
        }
      });
    } catch (err) {
      removeFile(`./temp/${id}`);
      return res.send({ code: "❌ Pairing Error: " + err.message });
    }
  }

  await startPairing();
});

module.exports = router;
