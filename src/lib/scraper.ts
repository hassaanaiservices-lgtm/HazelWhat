import * as cheerio from "cheerio";

export interface ProductItem {
  id: string;
  title: string;
  price: string;
  image: string;
  link: string;
  category?: string;
  description?: string;
  variations?: { title: string; price: string }[];
}

export async function scrapeStore(targetUrl: string, currency: string = "$"): Promise<{ catalog: string; productCount: number; items: ProductItem[] }> {
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  let origin;
  try {
    origin = new URL(targetUrl).origin;
  } catch (e) {
    throw new Error("Invalid URL format");
  }

  let catalogText = "--- E-COMMERCE CATALOG ---\n\n";
  let productCount = 0;
  const items: ProductItem[] = [];

  // 1. Try Shopify API
  try {
    const shopifyRes = await fetch(`${origin}/products.json?limit=250`, { signal: AbortSignal.timeout(8000) });
    if (shopifyRes.ok) {
      const data = await shopifyRes.json();
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        const groupedProducts: Record<string, any[]> = {};
        
        data.products.forEach((p: any) => {
          const type = p.product_type && p.product_type.trim() !== "" ? p.product_type : "Other / Uncategorized";
          if (!groupedProducts[type]) groupedProducts[type] = [];
          groupedProducts[type].push(p);
        });

        for (const [type, products] of Object.entries(groupedProducts)) {
          catalogText += `\n### CATEGORY: ${type.toUpperCase()} ###\n`;
          products.forEach((p, i) => {
            const title = p.title;
            
            let priceStr = "N/A";
            let variationsText = "";
            const variationsList: { title: string; price: string }[] = [];

            if (p.variants && p.variants.length > 0) {
              const prices = p.variants.map((v: any) => parseFloat(v.price)).filter((val: number) => !isNaN(val));
              if (prices.length > 0) {
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                priceStr = min === max ? `${currency}${min}` : `${currency}${min} - ${currency}${max}`;
              }
              
              const validVariants = p.variants.filter((v: any) => v.title && !v.title.toLowerCase().includes("custom"));
              if (validVariants.length > 0 && validVariants.length !== 1) {
                variationsText = "\n  Variations:";
                validVariants.forEach((v: any) => {
                  const vPriceFormatted = `${currency}${v.price}`;
                  variationsText += `\n    - ${v.title}: ${vPriceFormatted}`;
                  variationsList.push({ title: v.title, price: vPriceFormatted });
                });
              }
            }
            const price = priceStr;
            
            const image = p.images && p.images[0] ? p.images[0].src : "";
            const link = `${origin}/products/${p.handle}`;
            const cleanBodyHtml = p.body_html ? p.body_html.replace(/<[^>]*>?/gm, '').trim().substring(0, 200) : "";

            items.push({
              id: p.id ? String(p.id) : `prod-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              title,
              price: price.startsWith(currency) ? price : `${currency}${price}`,
              image: image !== "N/A" ? image : "",
              link,
              category: type,
              description: cleanBodyHtml,
              variations: variationsList.length > 0 ? variationsList : undefined
            });
            
            catalogText += `- ${title} (Base Price/Range: ${price})\n  Image: ${image || "N/A"}\n  Link: ${link}${variationsText}\n\n`;
            productCount++;
          });
        }
        
        catalogText += `(Extracted ${productCount} products via Shopify API)\n`;
        return { catalog: catalogText, productCount, items };
      }
    }
  } catch (e) {
    console.log("Shopify check failed");
  }

  // 2. Try WooCommerce Store API
  try {
    const wooRes = await fetch(`${origin}/wp-json/wc/store/products`, { signal: AbortSignal.timeout(8000) });
    if (wooRes.ok) {
      const data = await wooRes.json();
      if (Array.isArray(data) && data.length > 0) {
        const groupedProducts: Record<string, any[]> = {};
        
        data.forEach((p: any) => {
          let category = "Other / Uncategorized";
          if (p.categories && Array.isArray(p.categories) && p.categories.length > 0) {
            category = p.categories[0].name;
          }
          if (!groupedProducts[category]) groupedProducts[category] = [];
          groupedProducts[category].push(p);
        });

        for (const [category, products] of Object.entries(groupedProducts)) {
          catalogText += `\n### CATEGORY: ${category.toUpperCase()} ###\n`;
          products.forEach((p, i) => {
            const title = p.name;
            const priceVal = p.prices?.price ? (parseInt(p.prices.price) / (10 ** (p.prices.currency_minor_unit || 2))).toFixed(2) : "N/A";
            const symbol = p.prices?.currency_symbol || currency;
            const fullPrice = priceVal !== "N/A" ? `${symbol}${priceVal}` : "N/A";
            const image = p.images && p.images[0] ? p.images[0].src : "";
            const link = p.permalink || "";
            const desc = p.description ? p.description.replace(/<[^>]*>?/gm, '').trim().substring(0, 200) : "";

            items.push({
              id: p.id ? String(p.id) : `woo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              title,
              price: fullPrice,
              image: image !== "N/A" ? image : "",
              link,
              category,
              description: desc
            });
            
            catalogText += `- ${title} (${fullPrice})\n  Image: ${image || "N/A"}\n  Link: ${link}\n\n`;
            productCount++;
          });
        }
        
        catalogText += `(Extracted ${productCount} products via WooCommerce API)\n`;
        return { catalog: catalogText, productCount, items };
      }
    }
  } catch (e) {
    console.log("WooCommerce check failed");
  }

  // 3. Fallback Generic Cheerio Scraper
  const genericRes = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    signal: AbortSignal.timeout(8000)
  });
  
  if (genericRes.ok) {
    const html = await genericRes.text();
    const $ = cheerio.load(html);
    
    const pageTitle = $('title').text().trim();
    catalogText = `--- WEBSITE CONTENT: ${pageTitle} ---\n\n`;
    
    let textContent = "";
    $('h1, h2, h3, p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 15) {
        textContent += text + "\n";
      }
    });
    catalogText += textContent.substring(0, 2000) + "\n\n";

    catalogText += "--- IMAGES & LINKS ---\n";
    let imgCount = 0;
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt') || 'Product Image';
      if (src && !src.includes('logo') && !src.includes('icon') && imgCount < 15) {
        let fullSrc = src.startsWith('http') ? src : `${origin}${src.startsWith('/') ? '' : '/'}${src}`;
        catalogText += `Image (${alt}): ${fullSrc}\n`;

        if (alt && alt.length > 3 && !alt.toLowerCase().includes("logo")) {
          items.push({
            id: `gen-${imgCount}-${Date.now()}`,
            title: alt,
            price: `${currency}0.00`,
            image: fullSrc,
            link: targetUrl,
            category: "Scraped Website Items",
            description: `Scraped item from ${pageTitle}`
          });
        }
        imgCount++;
      }
    });

    return { catalog: catalogText, productCount: items.length || imgCount, items };
  } else {
    throw new Error("Failed to fetch website HTML");
  }
}

