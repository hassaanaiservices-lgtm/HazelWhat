const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');

try {
  const cards = [
    {
      body: { text: "Card 1" },
      header: { title: "Title 1", hasMediaAttachment: false },
      nativeFlowMessage: {
        buttons: [
          { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "Link", url: "https://google.com" }) }
        ]
      }
    }
  ];

  const interactiveMessage = {
    body: { text: "Here are some products" },
    footer: { text: "Footer" },
    carouselMessage: { cards, messageVersion: 1 }
  };

  const msg = generateWAMessageFromContent(
    "123@s.whatsapp.net",
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage
        }
      }
    },
    { userJid: "456@s.whatsapp.net" }
  );
  console.log("Success");
} catch (e) {
  console.error("Error:", e);
}
