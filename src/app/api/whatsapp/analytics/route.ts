import { NextResponse } from 'next/server';
import { DB, DEFAULT_CONFIG } from '@/lib/db';
import { getSessionFromCookies } from "@/lib/auth-session";

export async function GET(req: any) {

  try {
    const session = await getSessionFromCookies(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let config, chats, orders, appointments, scheduledFollowUps, allCustomers;

    if (session.role === 'admin') {
      const queryTenantId = req.nextUrl?.searchParams?.get('tenantId');
      const targetTenantId = queryTenantId && queryTenantId !== 'admin' ? queryTenantId : undefined;
      if (targetTenantId) {
        config = await DB.getConfig(targetTenantId);
        chats = await DB.getAllChats(targetTenantId);
        orders = await DB.getOrders(targetTenantId);
        appointments = await DB.getAllAppointments(targetTenantId);
        scheduledFollowUps = await DB.getAllScheduledFollowUps(targetTenantId);
        allCustomers = await DB.getAllCustomers(targetTenantId);
      } else {
        config = DEFAULT_CONFIG;
        chats = await DB.getAllChatsAdminAllTenants();
        orders = await DB.getOrdersAdminAllTenants();
        appointments = await DB.getAllAppointmentsAdminAllTenants();
        scheduledFollowUps = await DB.getAllScheduledFollowUpsAdminAllTenants();
        allCustomers = await DB.getAllCustomersAdminAllTenants();
      }
    } else {
      const tenantId = session.tenantId;
      config = await DB.getConfig(tenantId);
      chats = await DB.getAllChats(tenantId);
      orders = await DB.getOrders(tenantId);
      appointments = await DB.getAllAppointments(tenantId);
      scheduledFollowUps = await DB.getAllScheduledFollowUps(tenantId);
      allCustomers = await DB.getAllCustomers(tenantId);
    }

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
      const statusStr = o.status as string;
      if ((statusStr === 'confirmed' || statusStr === 'delivered' || statusStr === 'completed') && new Date(o.timestamp) >= startOfWeek) {
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
    const sentScheduledCount = scheduledFollowUps.filter(f => f.status === 'sent').length;
    const sentSequenceCount = allCustomers.reduce((sum, c) => sum + (c.followUpLevel || 0), 0);

    const sentRecoveryCount = orders.reduce((sum, o) => sum + (o.recoveryStage || 0), 0);

    const totalFollowUps = sentScheduledCount + sentSequenceCount + sentRecoveryCount;

    // Sales Completed
    const successfulOrders = orders.filter(o => {
      const s = o.status as string;
      return s === 'confirmed' || s === 'delivered' || s === 'completed' || s === 'processing' || s === 'shipped';
    });
    const totalSalesCount = successfulOrders.length;

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
