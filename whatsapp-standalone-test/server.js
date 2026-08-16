const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const QRCode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");

const app = express();
const PORT = 3005;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let sock = null;
let connectionState = {
  status: 'disconnected', // disconnected, connecting, scanning, connected
  qrCode: null,
  phoneNumber: null,
  displayName: null,
  lastError: null
};

const AUTH_FOLDER = path.join(__dirname, '.auth_state');

async function startWhatsApp() {
  try {
    if (sock) {
      try { sock.end(undefined); } catch (e) {}
      sock = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    connectionState.status = 'connecting';
    connectionState.qrCode = null;
    connectionState.lastError = null;
    console.log('[Baileys] Initializing WASocket connection...');

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: pino({ level: 'info' }),
      browser: Browsers.ubuntu("Chrome")
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          connectionState.status = 'scanning';
          connectionState.qrCode = qrDataUrl;
          console.log('[Baileys] New QR generated. Scanning active.');
        } catch (e) {
          console.error('Error generating QR Data URL:', e);
        }
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error;
        const statusCode = error?.output?.statusCode;
        const errorMsg = error?.message || 'Unknown reason';
        
        console.log(`[Baileys] Connection closed. StatusCode: ${statusCode}, Error: ${errorMsg}`);
        connectionState.status = 'disconnected';
        connectionState.qrCode = null;
        connectionState.lastError = `Connection closed: ${errorMsg} (Code: ${statusCode})`;
        
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('[Baileys] Reconnecting in 5 seconds...');
          setTimeout(startWhatsApp, 5000);
        } else {
          console.log('[Baileys] Logged out. Clearing auth credentials...');
          if (fs.existsSync(AUTH_FOLDER)) {
            try {
              fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            } catch (err) {}
          }
        }
      } else if (connection === 'open') {
        console.log('[Baileys] WhatsApp session successfully opened!');
        connectionState.status = 'connected';
        connectionState.qrCode = null;
        connectionState.phoneNumber = sock.user.id.split(':')[0];
        connectionState.displayName = sock.user.name || 'Connected WhatsApp App';
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      console.log('[Baileys] Message Received:', JSON.stringify(m, null, 2));
    });

  } catch (e) {
    console.error('[Baileys] Fatal initialization error:', e);
    connectionState.status = 'disconnected';
    connectionState.lastError = e.message;
  }
}

// 1. Get status API endpoint
app.get('/api/status', (req, res) => {
  res.json(connectionState);
});

// 2. Start session API endpoint
app.post('/api/start', async (req, res) => {
  if (connectionState.status === 'connected') {
    return res.json({ success: false, error: 'Already connected' });
  }
  startWhatsApp();
  res.json({ success: true, message: 'Start requested' });
});

// 3. Reset / Disconnect API endpoint
app.post('/api/reset', async (req, res) => {
  console.log('[Baileys] Reset requested by user...');
  connectionState.status = 'disconnected';
  connectionState.qrCode = null;
  connectionState.phoneNumber = null;
  connectionState.displayName = null;
  connectionState.lastError = null;

  if (sock) {
    try { sock.end(undefined); } catch (e) {}
    sock = null;
  }

  // Gracefully clear files
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (fs.existsSync(AUTH_FOLDER)) {
    try {
      fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
      console.log('[Baileys] Local auth directory deleted.');
    } catch (e) {
      console.error('Failed to delete auth folder:', e);
    }
  }

  res.json({ success: true, message: 'Reset successfully completed' });
});

// 4. Send Message API endpoint
app.post('/api/send', async (req, res) => {
  const { to, content } = req.body;
  if (!to || !content) {
    return res.status(400).json({ success: false, error: 'Missing to or content' });
  }

  if (connectionState.status !== 'connected' || !sock) {
    return res.status(400).json({ success: false, error: 'WhatsApp is not connected' });
  }

  try {
    const formattedJid = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    const result = await sock.sendMessage(formattedJid, { text: content });
    res.json({ success: true, messageId: result?.key?.id });
  } catch (e) {
    console.error('Error sending message:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Standalone WhatsApp Test Utility running on:`);
  console.log(`http://localhost:${PORT}`);
  console.log(`====================================================`);
  // Auto-connect on startup
  startWhatsApp();
});
