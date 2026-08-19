import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { WhatsAppManager } from "@/lib/whatsapp";
import { getSessionFromCookies } from "@/lib/auth-session";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies(request);
    const tenantId = session?.tenantId;

    let config = await DB.getConfig(tenantId);
    const resolvedTenantId = tenantId || 'admin';
    const tenant = await DB.getTenantById(resolvedTenantId);

    // Auto-seed dummy products & knowledge base for atomixweb (t-1007) if empty
    // Auto-seed/update dummy products & knowledge base for atomixweb (t-1007)
    const isAtomix = resolvedTenantId === 't-1007' || tenant?.clientUsername?.toLowerCase() === 'atomixweb' || tenant?.name?.toLowerCase().includes('atomix');
    const hasOldItProducts = config.products?.some((p: any) => p.id === 'prod-101' || p.category === 'Web Development' || p.title?.includes('Web Application'));
    
    if (isAtomix && (!config.products || config.products.length === 0 || hasOldItProducts)) {
      const ATOMIXWEB_PRODUCTS = [
        {
          id: "food-101",
          title: "Smokey Zinger Burger Supreme",
          price: "750",
          category: "Burgers & Sandwiches",
          description: "Crispy double-fried chicken breast fillet, smoked cheese slice, jalapeños, secret chipotle sauce, & fresh iceberg in toasted brioche bun.",
          image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
          link: "https://atomixfood.com/menu/zinger-burger",
          variations: [
            { id: "v-1", title: "Single Patty Zinger", price: "750" },
            { id: "v-2", title: "Double Patty Zinger", price: "1050" }
          ]
        },
        {
          id: "food-102",
          title: "Gourmet Pepperoni Feast Pizza",
          price: "1490",
          category: "Pizzas",
          description: "Hand-tossed sourdough pizza topped with Italian pepperoni slices, extra mozzarella, marinara sauce, and oregano.",
          image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80",
          link: "https://atomixfood.com/menu/pepperoni-pizza",
          variations: [
            { id: "v-3", title: "Small (8 inch)", price: "990" },
            { id: "v-4", title: "Medium (11 inch)", price: "1490" },
            { id: "v-5", title: "Large (14 inch)", price: "1990" }
          ]
        },
        {
          id: "food-103",
          title: "Creamy Chicken Alfredo Pasta",
          price: "1250",
          category: "Pasta & Italian",
          description: "Fettuccine pasta tossed in rich garlic parmesan cream sauce, grilled chicken strips, and fresh mushrooms served with warm garlic bread.",
          image: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=600&auto=format&fit=crop&q=80",
          link: "https://atomixfood.com/menu/alfredo-pasta"
        },
        {
          id: "food-104",
          title: "Cheesy Loaded Beast Fries",
          price: "550",
          category: "Appetizers & Sides",
          description: "Crispy golden fries smothered in melted cheddar cheese sauce, spicy minced beef, jalapeños, and signature ranch drizzle.",
          image: "https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80",
          link: "https://atomixfood.com/menu/loaded-fries"
        },
        {
          id: "food-105",
          title: "Chilled Mint Margarita",
          price: "350",
          category: "Beverages & Drinks",
          description: "Refreshing crushed ice drink blended with fresh mint leaves, lemon juice, sprite soda, and black salt.",
          image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
          link: "https://atomixfood.com/menu/mint-margarita"
        },
        {
          id: "food-106",
          title: "Molten Lava Chocolate Cake",
          price: "650",
          category: "Desserts",
          description: "Warm Belgian chocolate cake with gooey liquid lava center, served with a rich vanilla bean ice cream scoop.",
          image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80",
          link: "https://atomixfood.com/menu/molten-lava"
        }
      ];

      const ATOMIXWEB_KB = `=== ATOMIX GOURMET KITCHEN & FOOD HUB ===\nOverview: Atomix Food Hub is a premiere fast-food & gourmet restaurant delivering fresh burgers, sourdough pizzas, creamy pastas, loaded fries, drinks, and desserts.\n\nOperating Hours: 12:00 PM - 2:00 AM (Midnight) Every Day.\nDelivery Time: 35 to 45 minutes.\nDelivery Fee: FREE delivery on all orders over PKR 1000! (PKR 150 delivery fee for orders below PKR 1000).\n\nPayment Methods Accepted:\n- Cash on Delivery (COD)\n- Bank Transfer (Meezan Bank & HBL)\n- JazzCash / EasyPaisa\n\nCUSTOMER SAVED ADDRESS RULE:\n- If customer address is already saved in their profile/history, NEVER ask for the address again! Confirm delivery to the saved address.\n- Customers can order multiple food items and quantities at once.`;

      const keywordReplies = [
        { keyword: "menu", reply: "Here is our top Atomix Food Hub menu:\n1. 🍔 Smokey Zinger Burger Supreme - PKR 750\n2. 🍕 Gourmet Pepperoni Feast Pizza - PKR 1490\n3. 🍝 Creamy Chicken Alfredo Pasta - PKR 1250\n4. 🍟 Cheesy Loaded Beast Fries - PKR 550\n5. 🍹 Chilled Mint Margarita - PKR 350\n6. 🍰 Molten Lava Chocolate Cake - PKR 650\n\nWhich items would you like to order today?" },
        { keyword: "timing", reply: "Atomix Food Hub is open every day from 12:00 PM to 2:00 AM (Midnight)!" },
        { keyword: "delivery fee", reply: "Delivery is 100% FREE on all orders over PKR 1,000! (PKR 150 delivery fee applies for orders below 1000)." },
        { keyword: "payment", reply: "We accept Cash on Delivery (COD), JazzCash, EasyPaisa, and Bank Transfers!" }
      ];

      const systemPrompt = `You are the official food ordering assistant for Atomix Gourmet Kitchen & Food Hub.

=== CRITICAL FOOD ORDERING & CUSTOMER RULES ===
1. ADDRESS PERSISTENCE & CONFIRMATION:
   - Check if the customer's delivery address is ALREADY saved in their profile or chat context.
   - IF SAVED ADDRESS EXISTS: DO NOT ASK FOR THE ADDRESS AGAIN!
   - Instead, confirm: "Hum aapka order is pehle se saved address par deliver kar rahe hain: [Saved Address]. (Agar address change karna ho to humein bata dein!)"
   - ONLY ask for a delivery address if NO saved address exists yet or if the customer explicitly requests an address change.

2. MULTIPLE ITEMS IN A SINGLE ORDER:
   - Customers can order multiple food items and quantities at once (e.g. "Mujhe 2 Zinger Burgers, 1 Medium Pepperoni Pizza, aur 2 Mint Margaritas chahiye").
   - Calculate item totals (Price x Quantity) for each item.
   - Calculate Grand Total Order Price (Sum of all item totals).
   - Call place_order tool with:
     * productName: Combined list of all ordered items with quantities & sizes (e.g. "2x Smokey Zinger Burger Supreme, 1x Gourmet Pepperoni Feast Pizza (Medium), 2x Chilled Mint Margarita").
     * price: Total calculated bill (e.g. "3680").
     * deliveryAddress: The saved address or provided address.

3. FRIENDLY & SPEEDY RESPONSE:
   - Keep answers warm, fast, and helpful (2-4 sentences max per message).
   - Quote exact prices from the food catalog above.`;

      await DB.updateConfig({
        products: ATOMIXWEB_PRODUCTS,
        productInfo: ATOMIXWEB_KB,
        systemPrompt: systemPrompt,
        keywordReplies: keywordReplies,
        botMode: "orders"
      }, resolvedTenantId);

      config = await DB.getConfig(tenantId);
    }
    
    if (tenant) {
      config = {
        ...config,
        deepgramApiKey: tenant.deepgramApiKey || config.deepgramApiKey,
        deepgramVoice: tenant.deepgramVoice || config.deepgramVoice,
        businessName: tenant.businessName || tenant.name || config.businessName
      };
    }

    return NextResponse.json({ success: true, config, tenantId: resolvedTenantId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await getSessionFromCookies(request);
    const tenantId = session?.tenantId;

    await DB.updateConfig(body, tenantId);

    // Sync to tenant record if tenantId is present
    if (tenantId) {
      const tenant = await DB.getTenantById(tenantId);
      if (tenant) {
        if (body.systemPrompt !== undefined) tenant.systemPrompt = body.systemPrompt;
        if (body.productInfo !== undefined || body.knowledgeBase !== undefined) {
          const kbVal = body.productInfo !== undefined ? body.productInfo : body.knowledgeBase;
          tenant.knowledgeBase = kbVal;
          tenant.productKnowledgeBase = kbVal;
        }
        if (body.products !== undefined) tenant.products = body.products;
        if (body.businessName !== undefined) tenant.businessName = body.businessName;
        await DB.saveTenants([tenant]);
      }
    }

    let updatedConfig = await DB.getConfig(tenantId);
    if (tenantId) {
      const tenant = await DB.getTenantById(tenantId);
      if (tenant) {
        updatedConfig = {
          ...updatedConfig,
          businessName: tenant.businessName || tenant.name || updatedConfig.businessName
        };
      }
    }

    return NextResponse.json({ success: true, config: updatedConfig, tenantId });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
