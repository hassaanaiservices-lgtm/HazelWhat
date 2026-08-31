import * as cheerio from "cheerio";

export interface ProductItem {
  id: string;
  title: string;
  price: string;
  image: string;
  imageUrl?: string;
  images?: string[];
  imageUrls?: string[];
  link: string;
  category?: string;
  description?: string;
  variations?: { title: string; price: string }[];
}

export async function scrapeStore(targetUrl: string, currency: string = "$"): Promise<{ catalog: string; productCount: number; items: ProductItem[] }> {
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl;
  }
  
  let origin: string;
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
          products.forEach((p) => {
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
              id: p.id ? String(p.id) : `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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
          products.forEach((p) => {
            const title = p.name;
            const priceVal = p.prices?.price ? (parseInt(p.prices.price) / (10 ** (p.prices.currency_minor_unit || 2))).toFixed(2) : "N/A";
            const symbol = p.prices?.currency_symbol || currency;
            const fullPrice = priceVal !== "N/A" ? `${symbol}${priceVal}` : "N/A";
            const image = p.images && p.images[0] ? p.images[0].src : "";
            const link = p.permalink || "";
            const desc = p.description ? p.description.replace(/<[^>]*>?/gm, '').trim().substring(0, 200) : "";

            items.push({
              id: p.id ? String(p.id) : `woo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

  // 3. Try Sitemap Crawling (Blinkco / Next.js / Custom Stores)
  try {
    let productUrls: string[] = [];
    const sitemapEndpoints = [
      `${origin}/sitemap-products/1.xml`,
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/api/sitemap`
    ];

    for (const smUrl of sitemapEndpoints) {
      try {
        const res = await fetch(smUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const text = await res.text();
          const $ = cheerio.load(text, { xmlMode: true });
          
          const subSitemaps: string[] = [];
          $('sitemap loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc) subSitemaps.push(loc);
          });
          
          for (const sub of subSitemaps) {
            if (sub.includes('product') || sub.includes('item') || sub.includes('menu')) {
              try {
                const subRes = await fetch(sub, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
                if (subRes.ok) {
                  const subText = await subRes.text();
                  const $sub = cheerio.load(subText, { xmlMode: true });
                  $sub('url loc').each((_, el) => {
                    const loc = $sub(el).text().trim();
                    if (loc.includes('/product/') || loc.includes('/item/') || loc.includes('/menu/')) {
                      productUrls.push(loc);
                    }
                  });
                }
              } catch (e) {}
            }
          }

          $('url loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc.includes('/product/') || loc.includes('/item/') || loc.includes('/menu/')) {
              productUrls.push(loc);
            }
          });

          if (productUrls.length > 0) break;
        }
      } catch (e) {}
    }

    productUrls = [...new Set(productUrls)];

    if (productUrls.length > 0) {
      const urlsToFetch = productUrls.slice(0, 80);
      const batchSize = 10;
      
      for (let i = 0; i < urlsToFetch.length; i += batchSize) {
        const batch = urlsToFetch.slice(i, i + batchSize);
        await Promise.all(batch.map(async (pUrl) => {
          try {
            const res = await fetch(pUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) });
            if (!res.ok) return;
            const html = await res.text();
            const $ = cheerio.load(html);

            // A. Next.js __NEXT_DATA__
            const nextDataEl = $('#__NEXT_DATA__');
            if (nextDataEl.length > 0) {
              try {
                const parsed = JSON.parse(nextDataEl.html() || '{}');
                const prefetched = parsed.props?.pageProps?.prefetchedItem?.data?.[0];
                if (prefetched) {
                  const title = prefetched.name;
                  const basePrice = parseFloat(prefetched.base_price || prefetched.price || 0);
                  const category = prefetched.sub_category_name || prefetched.category_name || "Menu";
                  const desc = prefetched.desc || "";
                  const image = prefetched.img_url || "";

                  const variations: { title: string; price: string }[] = [];
                  if (prefetched.dish_options && Array.isArray(prefetched.dish_options)) {
                    prefetched.dish_options.forEach((opt: any) => {
                      if (opt.dish_sub_options && Array.isArray(opt.dish_sub_options)) {
                        opt.dish_sub_options.forEach((subOpt: any) => {
                          const subPrice = parseFloat(subOpt.price || 0);
                          variations.push({
                            title: subOpt.name,
                            price: subPrice > 0 ? `PKR ${subPrice.toFixed(0)}` : (basePrice > 0 ? `PKR ${basePrice.toFixed(0)}` : "N/A")
                          });
                        });
                      }
                    });
                  }

                  let priceDisplay = basePrice > 0 ? `PKR ${basePrice.toFixed(0)}` : "N/A";
                  if (priceDisplay === "N/A" && variations.length > 0 && variations[0].price !== "N/A") {
                    priceDisplay = variations[0].price;
                  }

                  items.push({
                    id: String(prefetched.id || Date.now()),
                    title,
                    price: priceDisplay,
                    image,
                    link: pUrl,
                    category,
                    description: desc,
                    variations: variations.length > 0 ? variations : undefined
                  });
                  return;
                }
              } catch (e) {}
            }

            // B. JSON-LD Schema.org
            let jsonLdFound = false;
            $('script[type="application/ld+json"]').each((_, el) => {
              try {
                const ldData = JSON.parse($(el).html() || '{}');
                if (ldData['@type'] === 'Product' || ldData['@type'] === 'MenuItem') {
                  const title = ldData.name;
                  const image = Array.isArray(ldData.image) ? ldData.image[0] : (ldData.image || "");
                  const desc = ldData.description || "";
                  let price = "N/A";
                  if (ldData.offers) {
                    const priceVal = ldData.offers.price || ldData.offers.lowPrice;
                    const priceCurr = ldData.offers.priceCurrency || currency;
                    if (priceVal) price = `${priceCurr} ${priceVal}`;
                  }
                  if (title) {
                    items.push({
                      id: `ld-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      title,
                      price,
                      image,
                      link: pUrl,
                      category: "Menu",
                      description: desc
                    });
                    jsonLdFound = true;
                  }
                }
              } catch (e) {}
            });

            if (jsonLdFound) return;

            // C. HTML OpenGraph / Headings fallback
            const title = $('h1').text().trim() || $('meta[property="og:title"]').attr('content') || $('title').text().trim();
            const image = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src') || "";
            const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || "";
            
            let price = "N/A";
            const bodyText = $('body').text();
            const priceMatch = bodyText.match(/(?:Rs\.?|PKR|\$)\s*([\d,]+)/i);
            if (priceMatch) {
              price = priceMatch[0];
            }

            if (title) {
              items.push({
                id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                title,
                price,
                image,
                link: pUrl,
                category: "Menu",
                description: desc
              });
            }
          } catch (e) {}
        }));
      }

      if (items.length > 0) {
        const groupedProducts: Record<string, ProductItem[]> = {};
        items.forEach((item) => {
          const cat = item.category || "Menu";
          if (!groupedProducts[cat]) groupedProducts[cat] = [];
          groupedProducts[cat].push(item);
        });

        for (const [cat, prods] of Object.entries(groupedProducts)) {
          catalogText += `\n### CATEGORY: ${cat.toUpperCase()} ###\n`;
          prods.forEach((p) => {
            let varText = "";
            if (p.variations && p.variations.length > 0) {
              varText = "\n  Variations:";
              p.variations.forEach(v => {
                varText += `\n    - ${v.title}: ${v.price}`;
              });
            }
            catalogText += `- ${p.title} (${p.price})\n  Image: ${p.image || "N/A"}\n  Link: ${p.link}${varText}\n\n`;
            productCount++;
          });
        }
        
        catalogText += `(Extracted ${productCount} products via Sitemap & Page Scraper)\n`;
        return { catalog: catalogText, productCount, items };
      }
    }
  } catch (e) {
    console.log("Sitemap scraper failed");
  }

  // 4. Fallback Generic Cheerio Scraper
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
