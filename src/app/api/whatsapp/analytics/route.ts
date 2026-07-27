import { NextResponse } from 'next/server';
import { DB } from '@/lib/db';

export async function GET() {
  try {
    const config = DB.getConfig();
    const chats = DB.getAllChats();
    const orders = DB.getOrders();
    const appointments = DB.getAllAppointments();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Compute Today's chat count
    let todayChatCount = 0;
    let totalChats = 0;
    Object.values(chats).forEach((messages) => {
      totalChats += messages.length;
      messages.forEach(msg => {
        if (new Date(msg.timestamp) >= today) {
          todayChatCount++;
        }
      });
    });

    // Compute Pending orders count
    const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;

    // Compute this week's revenue
    let weekRevenue = 0;
    orders.forEach(o => {
      if ((o.status === 'confirmed' || o.status === 'delivered') && new Date(o.timestamp) >= startOfWeek) {
        if (o.price) {
          const num = parseFloat(o.price.replace(/[^\d.-]/g, ''));
          if (!isNaN(num)) {
            weekRevenue += num;
          }
        }
      }
    });

    // Urgent alerts (Orders pending for 2+ hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const urgentOrders = orders.filter(o => o.status === 'pending' && new Date(o.timestamp) <= twoHoursAgo).length;

    // Total Bookings and Orders
    const totalOrders = orders.length;
    const totalBookings = appointments.length;

    // Conversion rate
    const uniqueContacts = Object.keys(chats).length;
    const conversionRate = uniqueContacts > 0 ? ((totalOrders + totalBookings) / uniqueContacts * 100).toFixed(1) : 0;

    // Most requested products
    const productCounts: Record<string, number> = {};
    orders.forEach(o => {
      if (o.productName) {
        productCounts[o.productName] = (productCounts[o.productName] || 0) + 1;
      }
    });
    
    // Most requested services
    const serviceCounts: Record<string, number> = {};
    appointments.forEach(a => {
      if (a.service) {
        serviceCounts[a.service] = (serviceCounts[a.service] || 0) + 1;
      }
    });

    // Top 3 Products
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => ({ name: entry[0], count: entry[1] }));

    // Compute Follow-ups sent:
    // System A (Scheduled Follow-ups sent)
    const scheduledFollowUps = DB.getAllScheduledFollowUps();
    const sentScheduledCount = scheduledFollowUps.filter(f => f.status === 'sent').length;

    // System B (Sequence Follow-ups)
    const allCustomers = DB.getAllCustomers();
    const sentSequenceCount = allCustomers.reduce((sum, c) => sum + (c.followUpLevel || 0), 0);

    // System C (Abandoned Order Recovery Follow-ups)
    const sentRecoveryCount = orders.reduce((sum, o) => sum + (o.recoveryStage || 0), 0);

    const totalFollowUps = sentScheduledCount + sentSequenceCount + sentRecoveryCount;

    // Sales Completed (status confirmed, delivered, processing, shipped)
    const successfulOrders = orders.filter(o => o.status === 'confirmed' || o.status === 'delivered' || o.status === 'processing' || o.status === 'shipped');
    const totalSalesCount = successfulOrders.length;

    // Total Sales Revenue
    let totalSalesRevenue = 0;
    successfulOrders.forEach(o => {
      if (o.price) {
        const num = parseFloat(o.price.replace(/[^\d.-]/g, ''));
        if (!isNaN(num)) {
          totalSalesRevenue += num;
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        todayChatCount,
        pendingOrdersCount,
        weekRevenue,
        urgentOrders,
        totalChats,
        totalOrders,
        totalBookings,
        conversionRate,
        topProducts,
        totalContacts: uniqueContacts,
        totalFollowUps,
        totalSalesCount,
        totalSalesRevenue,
        currency: config.storeCurrency || '$'
      }
    });

  } catch (error: any) {
    console.error("Analytics Error", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
