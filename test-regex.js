const str = '### *Swana* - Rs. 17,500\n![Swana](https://cdn.shopify.com/s/files/1/0783/4055/4975/files/IMG_9769_JPG.jpg?v=1771707293)\n[View Swana](https://cutecoodle.com/products/swana)';
console.log("Original:\n", str);

let replaced = str.replace(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g, '[MEDIA:$1]');
console.log("\nReplaced:\n", replaced);

const mediaRegex = /\[MEDIA:(.+?)\]/g;
let extractedMedia = [];
let match;
while ((match = mediaRegex.exec(replaced)) !== null) {
  extractedMedia.push(match[1]);
}
let finalString = replaced.replace(mediaRegex, '').trim();

console.log("\nExtracted:", extractedMedia);
console.log("\nFinal:\n", finalString);
