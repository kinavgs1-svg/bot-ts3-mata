const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] }
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    console.log('Escaneia o QR Code acima no seu WhatsApp');
});

client.on('ready', () => {
    console.log('BOT ONLINE! Já está respondendo ausente.');
});

client.on('message', async msg => {
    // Não responde grupo e nem mensagem sua
    if (msg.from.includes('@g.us') || msg.fromMe) return;

    const frase = `Olá! 👋

No momento não estou disponível, mas assim que der irei te responder, tá bom?

Obrigado pela compreensão! 🙏`;

    await client.sendMessage(msg.from, frase);
});

client.initialize();
