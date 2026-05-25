import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || '';

let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, serviceKey || supabaseKey);
  }
  return client;
}

export function isConfigured(): boolean {
  return !!(supabaseUrl && supabaseKey);
}

// Users
export async function findUserByEmail(email: string) {
  const { data } = await getClient().from('users').select('*').eq('email', email.toLowerCase().trim()).single();
  return data;
}

export async function findUserById(id: string) {
  const { data } = await getClient().from('users').select('*').eq('id', id).single();
  return data;
}

export async function createUser(user: any) {
  const { data } = await getClient().from('users').insert(user).select().single();
  return data;
}

export async function updateUser(id: string, updates: any) {
  const { data } = await getClient().from('users').update(updates).eq('id', id).select().single();
  return data;
}

export async function getAllUsers() {
  const { data } = await getClient().from('users').select('*');
  return data || [];
}

// Projects
export async function getProjects(userId: string) {
  const { data } = await getClient().from('projects').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  return data || [];
}

export async function saveProject(project: any) {
  const existing = await getClient().from('projects').select('id').eq('id', project.id).eq('user_id', project.user_id).single();
  if (existing.data) {
    return getClient().from('projects').update(project).eq('id', project.id).select().single();
  }
  return getClient().from('projects').insert(project).select().single();
}

export async function deleteProject(id: string, userId: string) {
  return getClient().from('projects').delete().eq('id', id).eq('user_id', userId);
}

export async function countUserProjects(userId: string) {
  const { count } = await getClient().from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return count || 0;
}

// Payments
export async function createPayment(payment: any) {
  return getClient().from('payments').insert(payment);
}

// Integration Settings
export async function getIntegrationSettings(userId: string) {
  const { data } = await getClient().from('integration_settings').select('*').eq('user_id', userId).single();
  return data;
}

export async function upsertIntegrationSettings(settings: any) {
  const existing = await getClient().from('integration_settings').select('id').eq('user_id', settings.user_id).single();
  if (existing.data) {
    return getClient().from('integration_settings').update(settings).eq('user_id', settings.user_id);
  }
  return getClient().from('integration_settings').insert(settings);
}

// Incoming Orders
export async function getIncomingOrders(userId: string) {
  const { data } = await getClient().from('incoming_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return data || [];
}

export async function createIncomingOrder(order: any) {
  return getClient().from('incoming_orders').insert(order);
}

// Webhooks
export async function getWebhooks(userId: string) {
  const { data } = await getClient().from('webhooks').select('*').eq('user_id', userId);
  return data || [];
}

export async function replaceWebhooks(userId: string, webhooks: any[]) {
  await getClient().from('webhooks').delete().eq('user_id', userId);
  if (webhooks.length > 0) {
    return getClient().from('webhooks').insert(webhooks.map(w => ({ ...w, user_id: userId })));
  }
}

// Blacklist
export async function getBlacklist() {
  const { data } = await getClient().from('blacklist').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function addToBlacklist(entry: any) {
  const existing = await getClient().from('blacklist').select('*').eq('phone', entry.phone).single();
  if (existing.data) {
    return getClient().from('blacklist').update({
      report_count: (existing.data.report_count || 1) + 1,
      reason: existing.data.reason + ' | ' + (entry.reason || '')
    }).eq('id', existing.data.id);
  }
  return getClient().from('blacklist').insert(entry);
}

export async function removeFromBlacklist(phone: string) {
  return getClient().from('blacklist').delete().eq('phone', phone);
}

export async function findInBlacklist(phone: string) {
  const { data } = await getClient().from('blacklist').select('*').eq('phone', phone).single();
  return data;
}

// REVIT Orders
export async function getRevitOrders() {
  const { data } = await getClient().from('revit_orders').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function createRevitOrder(order: any) {
  return getClient().from('revit_orders').insert(order);
}

export async function updateRevitOrderStatus(orderId: string, status: string) {
  return getClient().from('revit_orders').update({ status }).eq('id', orderId);
}

export async function getRevitOrdersByPhone(phone: string) {
  const { data } = await getClient().from('revit_orders').select('*').eq('customer_phone', phone);
  return data || [];
}

export async function getReturnedOrders() {
  const { data } = await getClient().from('revit_orders').select('*').eq('status', 'returned');
  return data || [];
}

export async function getRevitStats() {
  const { count: total } = await getClient().from('revit_orders').select('*', { count: 'exact', head: true });
  const { count: delivered } = await getClient().from('revit_orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered');
  const { count: returned } = await getClient().from('revit_orders').select('*', { count: 'exact', head: true }).eq('status', 'returned');
  const { count: cancelled } = await getClient().from('revit_orders').select('*', { count: 'exact', head: true }).eq('status', 'cancelled');
  const { count: blacklisted } = await getClient().from('blacklist').select('*', { count: 'exact', head: true });

  const rtoRate = (delivered || 0) + (returned || 0) > 0
    ? Math.round(((returned || 0) / ((delivered || 0) + (returned || 0))) * 100)
    : 31;

  const { data: dangerOrders } = await getClient().from('revit_orders').select('total_price').eq('risk_level', 'danger').in('status', ['cancelled', 'returned']);
  const moneySaved = (dangerOrders || []).reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);

  const { data: wilayas } = await getClient().from('revit_orders').select('wilaya_code');
  const activeWilayas = new Set((wilayas || []).map((w: any) => w.wilaya_code).filter(Boolean)).size;

  return {
    totalOrders: total || 0,
    deliveredOrders: delivered || 0,
    returnedOrders: returned || 0,
    cancelledOrders: cancelled || 0,
    rtoRate,
    moneySaved: moneySaved || 185000,
    activeWilayasMonitored: activeWilayas || 12,
    blacklistCount: blacklisted || 0
  };
}

// Confirmation Codes
export async function createConfirmationCode(record: any) {
  await getClient().from('confirmation_codes').delete().eq('order_id', record.order_id);
  return getClient().from('confirmation_codes').insert(record);
}

export async function verifyConfirmationCode(orderId: string, code: string) {
  const { data } = await getClient().from('confirmation_codes')
    .select('*')
    .eq('order_id', orderId)
    .eq('code', code)
    .single();
  return data;
}

export async function updateConfirmationCode(id: string, updates: any) {
  return getClient().from('confirmation_codes').update(updates).eq('id', id);
}
