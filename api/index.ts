import express from "express";
import path from "path";
import fs from "fs";
import { createClient } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  avatarUrl: string;
  plan: "free" | "pro" | "agency" | "enterprise";
  geminiApiKeyToken?: string;
  createdAt: number;
}

interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  updatedAt: number;
  data: any;
}

interface DB {
  users: UserProfile[];
  projects: ProjectRecord[];
  payments: any[];
  integrationSettings?: any[];
  incomingOrders?: any[];
  webhooks?: any[];
  blacklist?: any[];
  revitOrders?: any[];
  confirmationCodes?: any[];
}

const DB_FILE = path.join(process.cwd(), "db.json");

function readDB(): DB {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const db = JSON.parse(data);
      if (!db.integrationSettings) db.integrationSettings = [];
      if (!db.incomingOrders) db.incomingOrders = [];
      if (!db.webhooks) db.webhooks = [];
      if (!db.blacklist) db.blacklist = [];
      if (!db.revitOrders) db.revitOrders = [];
      if (!db.confirmationCodes) db.confirmationCodes = [];
      return db;
    }
  } catch (e) {
    console.error("Error reading db.json", e);
  }
  return { 
    users: [], 
    projects: [], 
    payments: [], 
    integrationSettings: [], 
    incomingOrders: [], 
    webhooks: [],
    blacklist: [],
    revitOrders: [],
    confirmationCodes: []
  };
}

function writeDB(db: DB) {
  try {
    if (!db.integrationSettings) db.integrationSettings = [];
    if (!db.incomingOrders) db.incomingOrders = [];
    if (!db.webhooks) db.webhooks = [];
    if (!db.blacklist) db.blacklist = [];
    if (!db.revitOrders) db.revitOrders = [];
    if (!db.confirmationCodes) db.confirmationCodes = [];
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing db.json", e);
  }
}

// Ensure database file exits
if (!fs.existsSync(DB_FILE)) {
  writeDB({ users: [], projects: [], payments: [], integrationSettings: [], incomingOrders: [], webhooks: [] });
}

// Supabase initialization (optional — falls back to db.json when not configured)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
function isSupabaseActive(): boolean { return !!supabase; }

const app = express();
const PORT = 3000;

// Middleware for body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Inject Supabase client into request
app.use((req: any, res, next) => {
  req.supabase = supabase;
  next();
});

  // Health check: 503 if Supabase setup is empty / unconfigured
  app.get("/api/health", (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
    const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseKey.length > 0;
    
    if (!isSupabaseConfigured) {
      return res.status(503).json({
        status: "degraded",
        message: "Supabase connection not configured. Operating in high-performance local persistent Fallback Mode.",
        supabaseConfigured: false
      });
    }

    res.json({
      status: "ok",
      message: "Database system healthy and synchronized.",
      supabaseConfigured: true
    });
  });

  // Auth endpoints
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان." });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: existing } = await sb.from('users').select('id').eq('email', cleanEmail).maybeSingle();
        if (existing) {
          return res.status(400).json({ error: "البريد الإلكتروني مسجل بالفعل." });
        }

        const newUser = {
          id: "usr_" + Math.random().toString(36).substring(2, 11),
          email: cleanEmail,
          password_hash: password,
          full_name: fullName || "مستخدم جديد",
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
          plan: "free",
          created_at: Date.now()
        };

        const { error: insertError } = await sb.from('users').insert(newUser);
        if (insertError) throw insertError;

        return res.status(201).json({
          user: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.full_name,
            avatarUrl: newUser.avatar_url,
            plan: newUser.plan
          }
        });
      } catch (e) {
        console.error("Supabase error in signup, falling back to db.json:", e);
      }
    }

    const db = readDB();
    
    if (db.users.find(u => u.email === cleanEmail)) {
      return res.status(400).json({ error: "البريد الإلكتروني مسجل بالفعل." });
    }

    const newUser: UserProfile = {
      id: "usr_" + Math.random().toString(36).substring(2, 11),
      email: cleanEmail,
      passwordHash: password, // In plain demo/localStorage mode, simplify hashes
      fullName: fullName || "مستخدم جديد",
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
      plan: "free",
      createdAt: Date.now()
    };

    db.users.push(newUser);
    writeDB(db);

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        avatarUrl: newUser.avatarUrl,
        plan: newUser.plan
      }
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان." });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: user } = await sb.from('users').select('*').eq('email', cleanEmail).maybeSingle();

        if (!user) {
          const newUser = {
            id: "usr_" + Math.random().toString(36).substring(2, 11),
            email: cleanEmail,
            password_hash: password,
            full_name: "مستخدم جديد",
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
            plan: "free",
            created_at: Date.now()
          };
          const { error: insertError } = await sb.from('users').insert(newUser);
          if (insertError) throw insertError;

          return res.json({
            user: {
              id: newUser.id,
              email: newUser.email,
              fullName: newUser.full_name,
              avatarUrl: newUser.avatar_url,
              plan: newUser.plan,
              geminiApiKeyToken: undefined
            }
          });
        }

        if (user.password_hash !== password) {
          const { error: updateError } = await sb.from('users').update({ password_hash: password }).eq('id', user.id);
          if (updateError) throw updateError;
        }

        return res.json({
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            avatarUrl: user.avatar_url,
            plan: user.plan,
            geminiApiKeyToken: user.gemini_api_key_token || undefined
          }
        });
      } catch (e) {
        console.error("Supabase error in login, falling back to db.json:", e);
      }
    }

    const db = readDB();
    let user = db.users.find(u => u.email === cleanEmail);

    if (!user) {
      // Auto-register style for ease of access!
      const newUser: UserProfile = {
        id: "usr_" + Math.random().toString(36).substring(2, 11),
        email: cleanEmail,
        passwordHash: password,
        fullName: "مستخدم جديد",
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
        plan: "free",
        createdAt: Date.now()
      };
      db.users.push(newUser);
      writeDB(db);
      user = newUser;
    } else if (user.passwordHash !== password) {
      // Automatically update password hash to accept login for the testing user
      user.passwordHash = password;
      writeDB(db);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
        geminiApiKeyToken: user.geminiApiKeyToken
      }
    });
  });

  // Project Endpoints
  app.get("/api/projects", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) {
      return res.status(401).json({ error: "يجب تسجيل الدخول لجلب المشاريع." });
    }

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: projects, error } = await sb.from('projects').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
        if (error) throw error;
        return res.json((projects || []).map(p => ({
          id: p.id,
          userId: p.user_id,
          name: p.name,
          updatedAt: p.updated_at,
          data: p.data
        })));
      } catch (e) {
        console.error("Supabase error fetching projects, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const userProjects = db.projects.filter(p => p.userId === userId);
    res.json(userProjects);
  });

  app.post("/api/projects/save", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح لك بحفظ المشروع." });
    }

    const { id, name, data } = req.body;
    if (!name) {
      return res.status(400).json({ error: "اسم المشروع مطلوب." });
    }

    const projId = id || "proj_" + Math.random().toString(36).substring(2, 15);

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;

        const { data: existing } = await sb.from('projects').select('id').eq('id', projId).eq('user_id', userId).maybeSingle();

        if (!existing) {
          const { data: user } = await sb.from('users').select('plan').eq('id', userId).single();
          const { data: allProjects, error: countError } = await sb.from('projects').select('id').eq('user_id', userId);
          if (countError) throw countError;
          const userProjectsCount = allProjects ? allProjects.length : 0;
          const plan = user?.plan || "free";

          if (plan === "free" && userProjectsCount >= 3) {
            return res.status(403).json({ 
              error: "لقد وصلت للحد الأقصى للمشاريع في الخطة المجانية (3 مشاريع). يرجى الترقية لخطة Pro لتوليد مشاريع أكثر." 
            });
          } else if (plan === "pro" && userProjectsCount >= 20) {
            return res.status(403).json({ 
              error: "لقد وصلت للحجم الأقصى المتاح لخطة المحترفين Pro (20 مشروع). يرجى الترقية لوكالة Agency لمشاريع غير محدودة." 
            });
          }
        }

        const newRecord = {
          id: projId,
          user_id: userId,
          name,
          updated_at: Date.now(),
          data
        };

        const { error: upsertError } = await sb.from('projects').upsert(newRecord);
        if (upsertError) throw upsertError;

        return res.json({ success: true, project: { id: projId, userId, name, updatedAt: newRecord.updated_at, data } });
      } catch (e) {
        console.error("Supabase error saving project, falling back to db.json:", e);
      }
    }

    const db = readDB();
    
    // Check constraints based on plan
    const user = db.users.find(u => u.id === userId);
    const existingIndex = db.projects.findIndex(p => p.id === projId && p.userId === userId);
    
    if (existingIndex === -1) {
      // New project, check tier limits
      const userProjectsCount = db.projects.filter(p => p.userId === userId).length;
      const plan = user?.plan || "free";
      
      if (plan === "free" && userProjectsCount >= 3) {
        return res.status(403).json({ 
          error: "لقد وصلت للحد الأقصى للمشاريع في الخطة المجانية (3 مشاريع). يرجى الترقية لخطة Pro لتوليد مشاريع أكثر." 
        });
      } else if (plan === "pro" && userProjectsCount >= 20) {
        return res.status(403).json({ 
          error: "لقد وصلت للحجم الأقصى المتاح لخطة المحترفين Pro (20 مشروع). يرجى الترقية لوكالة Agency لمشاريع غير محدودة." 
        });
      }
    }

    const newRecord: ProjectRecord = {
      id: projId,
      userId,
      name,
      updatedAt: Date.now(),
      data
    };

    if (existingIndex !== -1) {
      db.projects[existingIndex] = newRecord;
    } else {
      db.projects.push(newRecord);
    }

    writeDB(db);
    res.json({ success: true, project: newRecord });
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح." });
    }

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: existing } = await sb.from('projects').select('id').eq('id', req.params.id).eq('user_id', userId).maybeSingle();
        if (!existing) {
          return res.status(404).json({ error: "المشروع غير موجود." });
        }

        const { error: deleteError } = await sb.from('projects').delete().eq('id', req.params.id);
        if (deleteError) throw deleteError;

        return res.json({ success: true, message: "تم حذف المشروع بنجاح." });
      } catch (e) {
        console.error("Supabase error deleting project, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const initialLen = db.projects.length;
    db.projects = db.projects.filter(p => !(p.id === req.params.id && p.userId === userId));
    
    if (db.projects.length === initialLen) {
      return res.status(404).json({ error: "المشروع غير موجود." });
    }

    writeDB(db);
    res.json({ success: true, message: "تم حذف المشروع بنجاح." });
  });

  // Settings Endpoints
  app.put("/api/user/profile", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح." });
    }

    const { fullName, avatarUrl } = req.body;

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const updateData: any = {};
        if (fullName) updateData.full_name = fullName;
        if (avatarUrl) updateData.avatar_url = avatarUrl;

        const { data: updated, error } = await sb.from('users').update(updateData).eq('id', userId).select().single();
        if (error) throw error;

        return res.json({
          success: true,
          user: {
            id: updated.id,
            email: updated.email,
            fullName: updated.full_name,
            avatarUrl: updated.avatar_url,
            plan: updated.plan,
            geminiApiKeyToken: updated.gemini_api_key_token
          }
        });
      } catch (e) {
        console.error("Supabase error updating profile, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    if (fullName) db.users[userIndex].fullName = fullName;
    if (avatarUrl) db.users[userIndex].avatarUrl = avatarUrl;
    
    writeDB(db);
    res.json({ success: true, user: db.users[userIndex] });
  });

  app.put("/api/user/gemini-key", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح." });
    }

    const { key } = req.body;

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: existing } = await sb.from('users').select('id').eq('id', userId).maybeSingle();
        if (!existing) {
          return res.status(404).json({ error: "المستند غير متوفر." });
        }

        const { error } = await sb.from('users').update({ gemini_api_key_token: key }).eq('id', userId);
        if (error) throw error;

        return res.json({ success: true, message: "تم تحديث مفتاح Gemini بنجاح." });
      } catch (e) {
        console.error("Supabase error updating gemini key, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: "المستند غير متوفر." });
    }

    db.users[userIndex].geminiApiKeyToken = key;
    writeDB(db);
    res.json({ success: true, message: "تم تحديث مفتاح Gemini بنجاح." });
  });

  // Payments / Subscription Simulation endpoints
  app.post("/api/payments/create-checkout", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح." });
    }

    const { plan, amount, currency } = req.body;
    if (!plan) {
      return res.status(400).json({ error: "نوع الاشتراك مطلوب." });
    }

    const checkoutId = "chg_" + Math.random().toString(36).substring(2, 11);
    
    res.json({
      checkoutUrl: `/payment/simulate?id=${checkoutId}&userId=${userId}&plan=${plan}&amount=${amount}`,
      checkoutId
    });
  });

  app.post("/api/payments/confirm", async (req, res) => {
    const { userId, plan, amount, checkoutId } = req.body;
    if (!userId || !plan) {
      return res.status(400).json({ error: "البيانات المدخلة ناقصة." });
    }

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: existing } = await sb.from('users').select('id').eq('id', userId).maybeSingle();
        if (!existing) {
          return res.status(404).json({ error: "المستخدم غير موجود." });
        }

        const { error: planError } = await sb.from('users').update({ plan }).eq('id', userId);
        if (planError) throw planError;

        const payId = checkoutId || "pay_" + Math.random().toString(36).substring(2, 11);
        const { error: payError } = await sb.from('payments').insert({
          id: payId,
          user_id: userId,
          plan,
          amount: amount || "0",
          status: "paid",
          created_at: Date.now()
        });
        if (payError) throw payError;

        return res.json({ success: true, plan });
      } catch (e) {
        console.error("Supabase error confirming payment, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    db.users[userIndex].plan = plan;
    
    // Log Payment
    db.payments.push({
      id: checkoutId || "pay_" + Math.random().toString(36).substring(2, 11),
      userId,
      plan,
      amount: amount || "0",
      status: "paid",
      createdAt: Date.now()
    });

    writeDB(db);
    res.json({ success: true, plan });
  });

  // Admin Endpoints
  app.get("/api/admin/users", async (req, res) => {
    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: users, error } = await sb.from('users').select('*');
        if (error) throw error;
        return res.json((users || []).map(u => ({
          id: u.id,
          email: u.email,
          passwordHash: u.password_hash,
          fullName: u.full_name,
          avatarUrl: u.avatar_url,
          plan: u.plan,
          geminiApiKeyToken: u.gemini_api_key_token,
          createdAt: u.created_at
        })));
      } catch (e) {
        console.error("Supabase error fetching users, falling back to db.json:", e);
      }
    }

    const db = readDB();
    res.json(db.users);
  });

  app.put("/api/admin/users/:id/plan", async (req, res) => {
    const { plan } = req.body;

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: updated, error } = await sb.from('users').update({ plan }).eq('id', req.params.id).select().single();
        if (error) throw error;

        return res.json({
          success: true,
          user: {
            id: updated.id,
            email: updated.email,
            fullName: updated.full_name,
            avatarUrl: updated.avatar_url,
            plan: updated.plan,
            geminiApiKeyToken: updated.gemini_api_key_token,
            createdAt: updated.created_at
          }
        });
      } catch (e) {
        console.error("Supabase error updating user plan, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const userIndex = db.users.findIndex(u => u.id === req.params.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: "المستخدم غير موجود." });
    }

    db.users[userIndex].plan = plan;
    writeDB(db);
    res.json({ success: true, user: db.users[userIndex] });
  });

  // Helper to extract nested json value
  function getDeepValue(obj: any, pathStr: string): any {
    if (!obj || !pathStr) return undefined;
    const cleanPath = pathStr.replace(/\[/g, '.').replace(/\]/g, '');
    const keys = cleanPath.split('.').filter(Boolean);
    let current = obj;
    for (const key of keys) {
      if (current === null || current === undefined) return undefined;
      current = current[key];
    }
    return current;
  }

  // Algerian phone cleansing and validation
  function cleanAlgerianPhone(phone: any): { cleansed: string; status: 'clean' | 'invalid' } {
    if (phone === null || phone === undefined) {
      return { cleansed: "غير متوفر", status: 'invalid' };
    }
    let val = String(phone).replace(/\s+/g, '').replace(/[\(\)\-\+]/g, '');
    if (val.startsWith('213')) {
      val = '0' + val.substring(3);
    }
    const isValidMobile = /^(0)(5|6|7)[0-9]{8}$/.test(val);
    const isValidLandline = /^(0)(2|3|4|9)[0-9]{7,8}$/.test(val);
    if (isValidMobile || isValidLandline) {
      return { cleansed: val, status: 'clean' };
    }
    if (/^(5|6|7)[0-9]{8}$/.test(val)) {
      return { cleansed: '0' + val, status: 'clean' };
    }
    return { cleansed: val || "غير متوفر", status: 'invalid' };
  }

  // Algerian Wilayas
  const WILAYAS_DZ = [
    { code: "01", name: "Adrar - أدرار" },
    { code: "02", name: "Chlef - الشلف" },
    { code: "03", name: "Laghouat - الأغواط" },
    { code: "04", name: "Oum El Bouaghi - أم البواقي" },
    { code: "05", name: "Batna - باتنة" },
    { code: "06", name: "Béjaïa - بجاية" },
    { code: "07", name: "Biskra - بسكرة" },
    { code: "08", name: "Béchar - بشار" },
    { code: "09", name: "Blida - البليدة" },
    { code: "10", name: "Bouira - البويرة" },
    { code: "11", name: "Tamanrasset - تمنراست" },
    { code: "12", name: "Tébessa - تبسة" },
    { code: "13", name: "Tlemcen - تلمسان" },
    { code: "14", name: "Tiaret - تيارت" },
    { code: "15", name: "Tizi Ouzou - تيزي وزو" },
    { code: "16", name: "Alger - الجزائر العاصمة" },
    { code: "17", name: "Djelfa - الجلفة" },
    { code: "18", name: "Jijel - جيجل" },
    { code: "19", name: "Sétif - سطيف" },
    { code: "20", name: "Saïda - سعيدة" },
    { code: "21", name: "Skikda - سكيكدة" },
    { code: "22", name: "Sidi Bel Abbès - سيدي بلعباس" },
    { code: "23", name: "Annaba - عنابة" },
    { code: "24", name: "Guelma - قالمة" },
    { code: "25", name: "Constantine - قسنطينة" },
    { code: "26", name: "Médéa - المدية" },
    { code: "27", name: "Mostaganem - مستغانم" },
    { code: "28", name: "M'Sila - المسيلة" },
    { code: "29", name: "Mascara - معسكر" },
    { code: "30", name: "Ouargla - ورقلة" },
    { code: "31", name: "Oran - وهران" },
    { code: "32", name: "El Bayadh - البيض" },
    { code: "33", name: "Illizi - إليزي" },
    { code: "34", name: "Bordj Bou Arréridj - برج بوعريريج" },
    { code: "35", name: "Boumerdès - بومرداس" },
    { code: "36", name: "El Tarf - الطارف" },
    { code: "37", name: "Tindouf - تندوف" },
    { code: "38", name: "Tissemsilt - تيسمسيلت" },
    { code: "39", name: "El Oued - الوادي" },
    { code: "40", name: "Khenchela - خنشلة" },
    { code: "41", name: "Souk Ahras - سوق أهراس" },
    { code: "42", name: "Tipaza - تيبازة" },
    { code: "43", name: "Mila - ميلة" },
    { code: "44", name: "Aïn Defla - عين الدفلى" },
    { code: "45", name: "Naâma - النعامة" },
    { code: "46", name: "Aïn Témouchent - عين تموشنت" },
    { code: "47", name: "Ghardaïa - غرداية" },
    { code: "48", name: "Relizane - غليزان" },
    { code: "49", name: "El M'Ghair - المغير" },
    { code: "50", name: "El Meniaa - المنيعة" },
    { code: "51", name: "Ouled Djellal - أولاد جلال" },
    { code: "52", name: "Bordj Baji Mokhtar - برج باجي مختار" },
    { code: "53", name: "Béni Abbès - بني عباس" },
    { code: "54", name: "Timimoun - تيميمون" },
    { code: "55", name: "Touggourt - تقرت" },
    { code: "56", name: "Djanet - جانت" },
    { code: "57", name: "In Salah - عين صالح" },
    { code: "58", name: "In Guezzam - عين قزام" }
  ];

  function normalizeAlgerianWilaya(text: any): { matched: string; code: string } {
    if (!text) return { matched: "غير محدد", code: "00" };
    const str = String(text).toLowerCase().trim();
    const digitMatch = str.match(/\b([0-5][0-9])\b/);
    if (digitMatch) {
      const found = WILAYAS_DZ.find(w => w.code === digitMatch[1]);
      if (found) return { matched: found.name, code: found.code };
    }
    for (const w of WILAYAS_DZ) {
      const frenchParts = w.name.split('-')[0].toLowerCase().trim();
      const arabicParts = w.name.split('-')[1]?.trim() || '';
      if (str.includes(frenchParts) || str.includes(arabicParts) || frenchParts.includes(str) || (arabicParts && arabicParts.includes(str))) {
        return { matched: w.name, code: w.code };
      }
    }
    return { matched: String(text), code: "00" };
  }

  // --- REVIT DATABASE INITIALIZATION & SEED ---
  const dbInit = readDB();
  let dbChanged = false;
  if (!dbInit.blacklist) dbInit.blacklist = [];
  if (!dbInit.revitOrders) dbInit.revitOrders = [];
  if (!dbInit.confirmationCodes) dbInit.confirmationCodes = [];

  // Seed default shared blacklist (consortium) if empty
  if (dbInit.blacklist.length === 0) {
    dbInit.blacklist = [
      { id: "bl_1", phone: "0770112233", reason: "رفض الاستلام بشكل متكرر (+3 مرات) ولا يرد على اتصالات موزع الشحن بالبليدة", reportedBy: "Algiers Shop", reportCount: 3, createdAt: Date.now() - 15 * 24 * 3600 * 1000 },
      { id: "bl_2", phone: "0550998877", reason: "يطلب نفس المنتج من 5 تجار مختلفين ويلغي جميع الطرود عند وصول الموزع في تيبازة", reportedBy: "Sahara Chic", reportCount: 5, createdAt: Date.now() - 20 * 24 * 3600 * 1000 },
      { id: "bl_3", phone: "0661445566", reason: "رقم وهمي يطلب بكميات كبيرة بدون دفع تأكيد ثم يغلق شريحة الهاتف", reportedBy: "Belkacem Express", reportCount: 2, createdAt: Date.now() - 5 * 24 * 3600 * 1000 }
    ];
    dbChanged = true;
  }

  // Seed default orders if empty
  if (dbInit.revitOrders.length === 0) {
    dbInit.revitOrders = [
      { id: "REV_1001", merchantId: "usr_static", customerName: "عمر فاروق بوزينة", customerPhone: "0555112233", wilaya: "Oran - وهران", wilayaCode: "31", commune: "بئر الجير", address: "حي المنظر الجميل عمارة ب", status: "delivered", finalScore: 10, riskLevel: "safe", riskFactors: [], totalPrice: 6500, source: "shopify", createdAt: Date.now() - 5 * 24 * 3600 * 1000 },
      { id: "REV_1002", merchantId: "usr_static", customerName: "أمين بلمخطار", customerPhone: "0666223344", wilaya: "Alger - الجزائر العاصمة", wilayaCode: "16", commune: "شراقة", address: "نهج قدور بوعلام فيلا 12", status: "returned", finalScore: 45, riskLevel: "danger", riskFactors: ["ولاية الاستلام تصنف كولاية عالية المرتجعات RTO", "معدل RTO التاريخي لهذا العميل متذبذب"], totalPrice: 4200, source: "woocommerce", createdAt: Date.now() - 10 * 24 * 3600 * 1000 },
      { id: "REV_1003", merchantId: "usr_static", customerName: "حميد بوقرة", customerPhone: "0777334455", wilaya: "Constantine - قسنطينة", wilayaCode: "25", commune: "الخروب", address: "حي 500 مسكن عمارة 4", status: "pending", finalScore: 5, riskLevel: "safe", riskFactors: [], totalPrice: 12000, source: "manual", createdAt: Date.now() - 1 * 24 * 3600 * 1000 },
      { id: "REV_1004", merchantId: "usr_static", customerName: "سارة جيلالي", customerPhone: "0654123456", wilaya: "Batna - باتنة", wilayaCode: "05", commune: "بريكة", address: "مقابل مسجد النور", status: "cancelled", finalScore: 25, riskLevel: "suspicious", riskFactors: ["العنوان مقتضب جداً ويفتقر للكلمات الدلالية المعتادة"], totalPrice: 3500, source: "shopify", createdAt: Date.now() - 3 * 24 * 3600 * 1000 },
      { id: "REV_1005", merchantId: "usr_static", customerName: "تست تجربة فقط", customerPhone: "0555555555", wilaya: "Blida - البليدة", wilayaCode: "09", commune: "بوفاريك", address: "123456789123456789", status: "cancelled", finalScore: 95, riskLevel: "danger", riskFactors: ["رقم وهمي بلاستيكي (تكرار نفس الرقم بشكل مكثف)", "الاسم المشترك يبدو وهمياً أو غير مكتمل", "العنوان يحتوي على أرقام عشوائية متتالية غير معتادة", "ولاية الاستلام تصنف كولاية عالية المرتجعات RTO"], totalPrice: 150000, source: "woocommerce", createdAt: Date.now() - 2 * 3600 * 1000 }
    ];
    dbChanged = true;
  }

  if (dbChanged) {
    writeDB(dbInit);
  }

  // --- REVIT SYSTEM ENDPOINTS ---

  // 1. GET shared blacklist Consortium
  app.get("/api/blacklist", async (req, res) => {
    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: list, error } = await sb.from('blacklist').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.json((list || []).map(b => ({
          id: b.id,
          phone: b.phone,
          reason: b.reason,
          reportedBy: b.reported_by,
          reportCount: b.report_count,
          createdAt: b.created_at
        })));
      } catch (e) {
        console.error("Supabase error fetching blacklist, falling back to db.json:", e);
      }
    }

    const db = readDB();
    res.json(db.blacklist || []);
  });

  // 2. POST add number to blacklist
  app.post("/api/blacklist", async (req, res) => {
    const { phone, reason, reportedBy } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "رقم الهاتف مطلوب" });
    }

    const { cleansed, status } = cleanAlgerianPhone(phone);
    if (status === 'invalid') {
      return res.status(400).json({ error: "صيغة الرقم غير صالحة لإضافته إلى القائمة السوداء" });
    }

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: existing } = await sb.from('blacklist').select('*').eq('phone', cleansed).maybeSingle();

        if (existing) {
          const { error: updateError } = await sb.from('blacklist').update({
            report_count: (existing.report_count || 1) + 1,
            reason: existing.reason + " | " + (reason || "إبلاغ إضافي من تاجر آخر")
          }).eq('id', existing.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await sb.from('blacklist').insert({
            id: "bl_" + Math.random().toString(36).substring(2, 9),
            phone: cleansed,
            reason: reason || "سلوك احتيالي في الـ COD",
            reported_by: reportedBy || "تاجر شريك",
            report_count: 1,
            created_at: Date.now()
          });
          if (insertError) throw insertError;
        }

        const { data: updatedList } = await sb.from('blacklist').select('*').order('created_at', { ascending: false });
        return res.json({
          success: true,
          blacklist: (updatedList || []).map((b: any) => ({
            id: b.id, phone: b.phone, reason: b.reason,
            reportedBy: b.reported_by, reportCount: b.report_count, createdAt: b.created_at
          }))
        });
      } catch (e) {
        console.error("Supabase error adding to blacklist, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const existing = db.blacklist!.find(b => cleanAlgerianPhone(b.phone).cleansed === cleansed);

    if (existing) {
      existing.reportCount = (existing.reportCount || 1) + 1;
      existing.reason = existing.reason + " | " + (reason || "إبلاغ إضافي من تاجر آخر");
    } else {
      db.blacklist!.push({
        id: "bl_" + Math.random().toString(36).substring(2, 9),
        phone: cleansed,
        reason: reason || "سلوك احتيالي في الـ COD",
        reportedBy: reportedBy || "تاجر شريك",
        reportCount: 1,
        createdAt: Date.now()
      });
    }

    writeDB(db);
    res.json({ success: true, blacklist: db.blacklist });
  });

  // 3. DELETE delete from shared blacklist
  app.delete("/api/blacklist", async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "رقم الهاتف مطلوب" });
    }

    const { cleansed } = cleanAlgerianPhone(phone);

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: existing } = await sb.from('blacklist').select('id').eq('phone', cleansed).maybeSingle();
        if (!existing) {
          return res.status(444).json({ error: "الرقم غير موجود في القائمة السوداء" });
        }

        const { error: deleteError } = await sb.from('blacklist').delete().eq('id', existing.id);
        if (deleteError) throw deleteError;

        const { data: updatedList } = await sb.from('blacklist').select('*').order('created_at', { ascending: false });
        return res.json({
          success: true,
          blacklist: (updatedList || []).map((b: any) => ({
            id: b.id, phone: b.phone, reason: b.reason,
            reportedBy: b.reported_by, reportCount: b.report_count, createdAt: b.created_at
          }))
        });
      } catch (e) {
        console.error("Supabase error deleting from blacklist, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const lengthBefore = db.blacklist!.length;
    db.blacklist = db.blacklist!.filter(b => cleanAlgerianPhone(b.phone).cleansed !== cleansed);

    if (db.blacklist.length === lengthBefore) {
      return res.status(444).json({ error: "الرقم غير موجود في القائمة السوداء" });
    }

    writeDB(db);
    res.json({ success: true, blacklist: db.blacklist });
  });

  // 4. GET all REVIT Orders
  app.get("/api/orders", async (req, res) => {
    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: orders, error } = await sb.from('revit_orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.json((orders || []).map((o: any) => ({
          id: o.id,
          merchantId: o.merchant_id,
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          wilaya: o.wilaya,
          wilayaCode: o.wilaya_code,
          commune: o.commune,
          address: o.address,
          status: o.status,
          finalScore: o.final_score,
          riskLevel: o.risk_level,
          riskFactors: o.risk_factors || [],
          totalPrice: o.total_price,
          source: o.source,
          createdAt: o.created_at
        })));
      } catch (e) {
        console.error("Supabase error fetching orders, falling back to db.json:", e);
      }
    }

    const db = readDB();
    res.json(db.revitOrders || []);
  });

  // 5. POST create order running the 7 Layers of Fraud Detection Orchestratation
  app.post("/api/orders", async (req, res) => {
    const { customerName, customerPhone, wilaya, wilayaCode, commune, address, totalPrice, source } = req.body;
    const userId = req.headers.authorization || "usr_static";

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const phoneRes = cleanAlgerianPhone(customerPhone);
        const valPhone = phoneRes.cleansed;

        // Fetch blacklist and previous orders from Supabase
        const { data: blacklistEntry } = await sb.from('blacklist').select('*').eq('phone', valPhone).maybeSingle();
        const { data: previousOrders } = await sb.from('revit_orders').select('*').eq('customer_phone', valPhone);

        const factors: string[] = [];
        let score = 0;
        const previous = previousOrders || [];

        // --- Layer 1: Shared Blacklist Check ---
        if (blacklistEntry) {
          score += 80;
          factors.push(`الرقم موجود في القائمة السوداء المشتركة Consortium (مبلغ عنه من جهة: ${blacklistEntry.reported_by} بسسب: ${blacklistEntry.reason})`);
        }

        // --- Layer 2: Phone Quality ---
        if (phoneRes.status === 'invalid') {
          score += 35;
          factors.push("الرقم الهاتفي لا يتطابق مع أي بادئة مشغل معتمد بالجزائر (موبيليس 06، جيزي 07، أوريدو 05)");
        } else {
          const digitsOnly = valPhone.replace(/\D/g, '');
          const counts: Record<string, number> = {};
          for (const char of digitsOnly) counts[char] = (counts[char] || 0) + 1;
          const maxRepetitions = Math.max(...Object.values(counts));
          if (digitsOnly.length >= 9 && maxRepetitions >= 8) {
            score += 45;
            factors.push("رقم هاتف بلاستيكي عشوائي (تكرار نفس الرقم 8 مرات فأكثر)");
          } else {
            const uniqueDigits = new Set(digitsOnly.split('')).size;
            if (uniqueDigits < 4) {
              score += 25;
              factors.push("جودة الرقم مريبة جداً (يحتوي الهاتف على أقل من 4 أرقام مختلفة)");
            }
          }
        }

        // --- Layer 3: Time-Based Risk ---
        const algHour = (new Date().getUTCHours() + 1) % 24;
        if (algHour >= 0 && algHour <= 5) {
          score += 40;
          factors.push("طلب في وقت متأخر جداً (بين منتصف الليل والـ 5 صباحاً - وقت نشاط البوتات)");
        }

        // --- Layer 4: Customer Profile Insights ---
        const totalPrevious = previous.length;
        let rtoRate = 0;
        let cancelledCount = 0;
        let returnedCount = 0;
        const distinctWilayas = new Set<string>();

        previous.forEach((o: any) => {
          if (o.wilaya_code) distinctWilayas.add(o.wilaya_code);
          if (o.status === 'returned') returnedCount++;
          if (o.status === 'cancelled') cancelledCount++;
        });

        const completedCount = previous.filter((o: any) => o.status === 'delivered').length;
        if (returnedCount + completedCount > 0) {
          rtoRate = returnedCount / (returnedCount + completedCount);
        }

        if (rtoRate > 0.5) { score += 50; factors.push(`سجل الزبون سلبي: يملك معدل استرجاع RTO يتجاوز 50% (${Math.round(rtoRate * 100)}%)`); }
        if (cancelledCount >= 3) { score += 25; factors.push(`الزبون إلغائي الشغف: إلغاء متكرر لـ ${cancelledCount} طلبيات سابقة`); }
        if (returnedCount >= 2) { score += 20; factors.push(`العميل أرجع طروداً مرتين أو أكثر من قبل (${returnedCount} مرات مرتجع)`); }
        if (distinctWilayas.size >= 3) { score += 15; factors.push(`الزبون يغيّر ولايات التوصيل بشكل متكرر (طلب لـ ${distinctWilayas.size} ولاية مختلفة)`); }

        // --- Layer 5: Order Value Limits ---
        const priceNum = Number(totalPrice) || 0;
        if (priceNum > 100000) { score += 50; factors.push("قيمة طرد فلكية تتجاوز 100,000 دج (مخاطرة COD غير عادية بدون إثبات مسبق)"); }
        else if (priceNum > 50000) { score += 30; factors.push("قيمة الطرد مرتفعة وتتجاوز 50,000 دج"); }
        if (totalPrevious === 0 && priceNum > 3000) { score += 20; factors.push("طلب وافد أول بقيمة مرتفعة نسبياً تتجاوز 3,000 دج لزبون جديد"); }
        if (rtoRate > 0.2 && priceNum > 5000) { score += 40; factors.push("طلب بقيمة تتجاوز 5,000 دج لعميل مثقل تاريخياً بمرتجعات سابقة"); }

        // --- Layer 6: Velocity ---
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const hourOrders = previous.filter((o: any) => (o.created_at || 0) > oneHourAgo);
        if (hourOrders.length >= 5) { score = Math.max(score, 80); factors.push("حظر تدفق سبام: تم إنشاء أكثر من 5 طلبات بنفس الرقم في ساعة واحدة"); }
        else if (hourOrders.length >= 3) { score += 50; factors.push("سرعة إنشاء مفرطة مسببة للشبهة (أكثر من 3 طلبات في ساعة)"); }

        // --- Layer 7: Daily Limit ---
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        const dayOrders = previous.filter((o: any) => (o.created_at || 0) > twentyFourHoursAgo);
        if (dayOrders.length >= 5) { score = Math.max(score, 75); factors.push("حظر الحد اليومي: تجاوز العميل 5 طلبات في يوم واحد"); }
        else if (dayOrders.length >= 3) { score += 40; factors.push("نمط سحب طلبات غير مألوف في الـ 24 ساعة الماضية"); }

        // --- Local patterns ---
        const cleanName = String(customerName || "").trim().toLowerCase();
        const fakeNames = /^(عميل|زبون|تاجر|اختبار|تجربة|مجهول|تست|الزبون|التاجر|test|tester|client|customer|anonymous|admin|guest|asdf|asd|aaaa|zzzz|abc|123)$/;
        if (fakeNames.test(cleanName) || cleanName.length < 3) { score += 30; factors.push(`الاسم يبدو عشوائياً أو وهمياً: "${customerName}"`); }
        if (/([a-zA-Z\u0600-\u06FF])\1{3,}/.test(cleanName)) { score += 25; factors.push("الاسم المدخل يحتوي على سيل من الحروف المكررة تلقائياً"); }

        const cleanAddress = String(address || "").trim().toLowerCase();
        if (cleanAddress) {
          const physicalKeys = ["نهج", "شارع", "حي", "دوار", "فيلا", "عمارة", "حومة", "طريق", "rue", "avenue", "cite", "villa", "quartier"];
          const hasKeywords = physicalKeys.some(k => cleanAddress.includes(k));
          if (!hasKeywords && cleanAddress.length < 10) { score += 15; factors.push("العنوان مقتضب جداً ويفتقر للعناصر الدالة (مثل نهج، حي، عمارة)"); }
        } else { score += 10; factors.push("العنوان الجغرافي فارغ أو غير متوفر"); }

        const highRiskWilayas = ["16", "31", "09", "35", "06"];
        if (wilayaCode && highRiskWilayas.includes(String(wilayaCode))) {
          score += 15;
          factors.push("ولاية العميل تصنف عالية الخطورة RTO (الجزائر العاصمة 16، وهران 31، البليدة 09، بومرداس 35 وبجاية 06)");
        }

        let riskLevel: 'safe' | 'suspicious' | 'danger' = 'safe';
        const finalScore = Math.min(100, score);
        if (finalScore >= 40) riskLevel = 'danger';
        else if (finalScore >= 20) riskLevel = 'suspicious';

        // Auto lockout enforcement
        if (riskLevel === 'danger' && returnedCount >= 3) {
          const { data: alreadyBlocked } = await sb.from('blacklist').select('id').eq('phone', valPhone).maybeSingle();
          if (!alreadyBlocked) {
            await sb.from('blacklist').insert({
              id: "autobl_" + Math.random().toString(36).substring(2, 9),
              phone: valPhone,
              reason: "حظر تلقائي ذكي: سلوك احتيالي خطر جداً مع عجز في الرغبة في الاستلام RTO >= 3",
              reported_by: "REVIT Auto-Shield",
              report_count: 1,
              created_at: Date.now()
            });
            factors.push("شوف تم إدراج الرقم تلقائياً في القائمة السوداء المشتركة Consortium وحظره فورا!");
          }
        }

        const orderId = "REV_" + Math.floor(1005 + Math.random() * 8990);
        const { error: insertError } = await sb.from('revit_orders').insert({
          id: orderId,
          merchant_id: userId,
          customer_name: customerName || "زبون مجهول",
          customer_phone: valPhone,
          wilaya: wilaya || "غير محدد",
          wilaya_code: wilayaCode || "00",
          commune: commune || "غير محدد",
          address: address || "غير متوفر",
          status: "pending",
          final_score: finalScore,
          risk_level: riskLevel,
          risk_factors: factors,
          total_price: priceNum,
          source: source || "manual",
          created_at: Date.now()
        });
        if (insertError) throw insertError;

        return res.status(201).json({
          success: true,
          order: {
            id: orderId,
            merchantId: userId,
            customerName: customerName || "زبون مجهول",
            customerPhone: valPhone,
            wilaya: wilaya || "غير محدد",
            wilayaCode: wilayaCode || "00",
            commune: commune || "غير محدد",
            address: address || "غير متوفر",
            status: "pending",
            finalScore,
            riskLevel,
            riskFactors: factors,
            totalPrice: priceNum,
            source: source || "manual",
            createdAt: Date.now()
          }
        });
      } catch (e) {
        console.error("Supabase error creating order, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const phoneRes = cleanAlgerianPhone(customerPhone);
    const valPhone = phoneRes.cleansed;
    
    const factors: string[] = [];
    let score = 0;

    // --- Layer 1: Shared Blacklist Check ---
    const inBlacklist = db.blacklist!.find(b => cleanAlgerianPhone(b.phone).cleansed === valPhone);
    if (inBlacklist) {
      score += 80;
      factors.push(`الرقم موجود في القائمة السوداء المشتركة Consortium (مبلغ عنه من جهة: ${inBlacklist.reportedBy} بسسب: ${inBlacklist.reason})`);
    }

    // --- Layer 2: Phone Quality ---
    if (phoneRes.status === 'invalid') {
      score += 35;
      factors.push("الرقم الهاتفي لا يتطابق مع أي بادئة مشغل معتمد بالجزائر (موبيليس 06، جيزي 07، أوريدو 05)");
    } else {
      const digitsOnly = valPhone.replace(/\D/g, '');
      const counts: Record<string, number> = {};
      for (const char of digitsOnly) counts[char] = (counts[char] || 0) + 1;
      const maxRepetitions = Math.max(...Object.values(counts));
      if (digitsOnly.length >= 9 && maxRepetitions >= 8) {
        score += 45;
        factors.push("رقم هاتف بلاستيكي عشوائي (تكرار نفس الرقم 8 مرات فأكثر)");
      } else {
        const uniqueDigits = new Set(digitsOnly.split('')).size;
        if (uniqueDigits < 4) {
          score += 25;
          factors.push("جودة الرقم مريبة جداً (يحتوي الهاتف على أقل من 4 أرقام مختلفة)");
        }
      }
    }

    // --- Layer 3: Time-Based Risk (Algiers 00:00 - 05:00) ---
    const algHour = (new Date().getUTCHours() + 1) % 24;
    if (algHour >= 0 && algHour <= 5) {
      score += 40;
      factors.push("طلب في وقت متأخر جداً (بين منتصف الليل والـ 5 صباحاً - وقت نشاط البوتات)");
    }

    // --- Layer 4: Customer Profile Insights (RTO ratios & cancels) ---
    const customerPreviousOrders = db.revitOrders!.filter(o => cleanAlgerianPhone(o.customerPhone).cleansed === valPhone);
    const totalPrevious = customerPreviousOrders.length;
    let rtoRate = 0;
    let cancelledCount = 0;
    let returnedCount = 0;
    const distinctWilayas = new Set<string>();

    customerPreviousOrders.forEach(o => {
      if (o.wilayaCode) distinctWilayas.add(o.wilayaCode);
      if (o.status === 'returned') returnedCount++;
      if (o.status === 'cancelled') cancelledCount++;
    });

    const completedCount = customerPreviousOrders.filter(o => o.status === 'delivered').length;
    if (returnedCount + completedCount > 0) {
      rtoRate = returnedCount / (returnedCount + completedCount);
    }

    if (rtoRate > 0.5) {
      score += 50;
      factors.push(`سجل الزبون سلبي: يملك معدل استرجاع RTO يتجاوز 50% (${Math.round(rtoRate * 100)}%)`);
    }
    if (cancelledCount >= 3) {
      score += 25;
      factors.push(`الزبون إلغائي الشغف: إلغاء متكرر لـ ${cancelledCount} طلبيات سابقة`);
    }
    if (returnedCount >= 2) {
      score += 20;
      factors.push(`العميل أرجع طروداً مرتين أو أكثر من قبل (${returnedCount} مرات مرتجع)`);
    }
    if (distinctWilayas.size >= 3) {
      score += 15;
      factors.push(`الزبون يغيّر ولايات التوصيل بشكل متكرر (طلب لـ ${distinctWilayas.size} ولاية مختلفة)`);
    }

    // --- Layer 5: Order Value Limits ---
    const priceNum = Number(totalPrice) || 0;
    if (priceNum > 100000) {
      score += 50;
      factors.push("قيمة طرد فلكية تتجاوز 100,000 دج (مخاطرة COD غير عادية بدون إثبات مسبق)");
    } else if (priceNum > 50000) {
      score += 30;
      factors.push("قيمة الطرد مرتفعة وتتجاوز 50,000 دج");
    }
    if (totalPrevious === 0 && priceNum > 3000) {
      score += 20;
      factors.push("طلب وافد أول بقيمة مرتفعة نسبياً تتجاوز 3,000 دج لزبون جديد");
    }
    if (rtoRate > 0.2 && priceNum > 5000) {
      score += 40;
      factors.push("طلب بقيمة تتجاوز 5,000 دج لعميل مثقل تاريخياً بمرتجعات سابقة");
    }

    // --- Layer 6: Create Velocity ---
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const hourOrders = customerPreviousOrders.filter(o => (o.createdAt || 0) > oneHourAgo);
    if (hourOrders.length >= 5) {
      score = Math.max(score, 80);
      factors.push("حظر تدفق سبام: تم إنشاء أكثر من 5 طلبات بنفس الرقم في ساعة واحدة");
    } else if (hourOrders.length >= 3) {
      score += 50;
      factors.push("سرعة إنشاء مفرطة مسببة للشبهة (أكثر من 3 طلبات في ساعة)");
    }

    // --- Layer 7: Daily Limit ---
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const dayOrders = customerPreviousOrders.filter(o => (o.createdAt || 0) > twentyFourHoursAgo);
    if (dayOrders.length >= 5) {
      score = Math.max(score, 75);
      factors.push("حظر الحد اليومي: تجاوز العميل 5 طلبات في يوم واحد");
    } else if (dayOrders.length >= 3) {
      score += 40;
      factors.push("نمط سحب طلبات غير مألوف في الـ 24 ساعة الماضية");
    }

    // --- Local patterns check (analyzeOrder equivalence) ---
    const cleanName = String(customerName || "").trim().toLowerCase();
    const fakeNames = /^(عميل|زبون|تاجر|اختبار|تجربة|مجهول|تست|الزبون|التاجر|test|tester|client|customer|anonymous|admin|guest|asdf|asd|aaaa|zzzz|abc|123)$/;
    if (fakeNames.test(cleanName) || cleanName.length < 3) {
      score += 30;
      factors.push(`الاسم يبدو عشوائياً أو وهمياً: "${customerName}"`);
    }
    if (/([a-zA-Z\u0600-\u06FF])\1{3,}/.test(cleanName)) {
      score += 25;
      factors.push("الاسم المدخل يحتوي على سيل من الحروف المكررة تلقائياً");
    }

    const cleanAddress = String(address || "").trim().toLowerCase();
    if (cleanAddress) {
      const physicalKeys = ["نهج", "شارع", "حي", "دوار", "فيلا", "عمارة", "حومة", "طريق", "rue", "avenue", "cite", "villa", "quartier"];
      const hasKeywords = physicalKeys.some(k => cleanAddress.includes(k));
      if (!hasKeywords && cleanAddress.length < 10) {
        score += 15;
        factors.push("العنوان مقتضب جداً ويفتقر للعناصر الدالة (مثل نهج، حي، عمارة)");
      }
    } else {
      score += 10;
      factors.push("العنوان الجغرافي فارغ أو غير متوفر");
    }

    // High risk wilaya match
    const highRiskWilayas = ["16", "31", "09", "35", "06"];
    if (wilayaCode && highRiskWilayas.includes(String(wilayaCode))) {
      score += 15;
      factors.push("ولاية العميل تصنف عالية الخطورة RTO (الجزائر العاصمة 16، وهران 31، البليدة 09، بومرداس 35 وبجاية 06)");
    }

    let riskLevel: 'safe' | 'suspicious' | 'danger' = 'safe';
    const finalScore = Math.min(100, score);
    if (finalScore >= 40) riskLevel = 'danger';
    else if (finalScore >= 20) riskLevel = 'suspicious';

    // Auto lockout enforcement
    if (riskLevel === 'danger' && returnedCount >= 3) {
      const blockPhone = cleanAlgerianPhone(customerPhone).cleansed;
      if (!db.blacklist!.find(b => cleanAlgerianPhone(b.phone).cleansed === blockPhone)) {
        db.blacklist!.push({
          id: "autobl_" + Math.random().toString(36).substring(2, 9),
          phone: blockPhone,
          reason: "حظر تلقائي ذكي: سلوك احتيالي خطر جداً مع عجز في الرغبة في الاستلام RTO >= 3",
          reportedBy: "REVIT Auto-Shield",
          reportCount: 1,
          createdAt: Date.now()
        });
        factors.push("شوف تم إدراج الرقم تلقائياً في القائمة السوداء المشتركة Consortium وحظره فورا!");
      }
    }

    const newOrder = {
      id: "REV_" + Math.floor(1005 + Math.random() * 8990),
      merchantId: userId,
      customerName: customerName || "زبون مجهول",
      customerPhone: valPhone,
      wilaya: wilaya || "غير محدد",
      wilayaCode: wilayaCode || "00",
      commune: commune || "غير محدد",
      address: address || "غير متوفر",
      status: "pending",
      finalScore,
      riskLevel,
      riskFactors: factors,
      totalPrice: priceNum,
      source: source || "manual",
      createdAt: Date.now()
    };

    db.revitOrders!.unshift(newOrder);
    writeDB(db);

    res.status(201).json({ success: true, order: newOrder });
  });

  // 6. POST check order without saving (Dry run scanner)
  app.post("/api/orders/check", async (req, res) => {
    const { customerName, customerPhone, wilaya, wilayaCode, commune, address, totalPrice } = req.body;

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const phoneRes = cleanAlgerianPhone(customerPhone);
        const valPhone = phoneRes.cleansed;

        const { data: blacklistEntry } = await sb.from('blacklist').select('*').eq('phone', valPhone).maybeSingle();
        const { data: previousOrders } = await sb.from('revit_orders').select('*').eq('customer_phone', valPhone);

        const factors: string[] = [];
        let score = 0;
        const previous = previousOrders || [];

        if (blacklistEntry) { score += 80; factors.push(`الرقم مسجل في القائمة السوداء المشتركة (أبلغ عنه ${blacklistEntry.report_count} تجار سابقاً)`); }
        if (phoneRes.status === 'invalid') { score += 35; factors.push("صيغة الهاتف لا تطابق أي مشغل معتمد بالجزائر (05/06/07)"); }
        else {
          const digitsOnly = valPhone.replace(/\D/g, '');
          const counts: Record<string, number> = {};
          for (const char of digitsOnly) counts[char] = (counts[char] || 0) + 1;
          if (digitsOnly.length >= 9 && Math.max(...Object.values(counts)) >= 8) { score += 45; factors.push("بصمة رقم وهمي بلاستيكي متكرر الأرقام"); }
        }

        let returnedCount = 0, cancelledCount = 0;
        previous.forEach((o: any) => { if (o.status === 'returned') returnedCount++; if (o.status === 'cancelled') cancelledCount++; });
        const completedCount = previous.filter((o: any) => o.status === 'delivered').length;
        const rtoRate = (returnedCount + completedCount > 0) ? returnedCount / (returnedCount + completedCount) : 0;
        if (rtoRate > 0.5) { score += 50; factors.push(`نسبة إرجاع العميل السابقة بالدولة مرتفعة وتتجاوز 50% (${Math.round(rtoRate*100)}%)`); }
        if (cancelledCount >= 3) { score += 25; factors.push(`سلوك إلغاء طلبيات متكرر (${cancelledCount} طلبات)`); }

        const priceNum = Number(totalPrice) || 0;
        if (priceNum > 100000) { score += 50; factors.push("قيمة مفرطة عالية الخطورة COD (>100,000 دج)"); }

        const cleanName = String(customerName || "").trim().toLowerCase();
        if (cleanName.match(/^(عميل|زبون|تاجر|اختبار|تجربة|مجهول|تست|test|client)$/) || cleanName.length < 3) { score += 30; factors.push("الاسم المدخل يبدو ملفقاً وغير حقيقي"); }
        const cleanAddress = String(address || "").trim().toLowerCase();
        if (!cleanAddress || cleanAddress.length < 10) { score += 15; factors.push("العنوان مقتضب ويصعب معالجته يدوياً من الشاحن"); }

        const finalScore = Math.min(100, score);
        let riskLevel: 'safe' | 'suspicious' | 'danger' = 'safe';
        if (finalScore >= 40) riskLevel = 'danger';
        else if (finalScore >= 20) riskLevel = 'suspicious';

        return res.json({ score: finalScore, riskLevel, factors, shouldBlock: riskLevel === 'danger' });
      } catch (e) {
        console.error("Supabase error in check order, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const phoneRes = cleanAlgerianPhone(customerPhone);
    const valPhone = phoneRes.cleansed;
    
    const factors: string[] = [];
    let score = 0;

    const inBlacklist = db.blacklist!.find(b => cleanAlgerianPhone(b.phone).cleansed === valPhone);
    if (inBlacklist) {
      score += 80;
      factors.push(`الرقم مسجل في القائمة السوداء المشتركة (أبلغ عنه ${inBlacklist.reportCount} تجار سابقاً)`);
    }

    if (phoneRes.status === 'invalid') {
      score += 35;
      factors.push("صيغة الهاتف لا تطابق أي مشغل معتمد بالجزائر (05/06/07)");
    } else {
      const digitsOnly = valPhone.replace(/\D/g, '');
      const counts: Record<string, number> = {};
      for (const char of digitsOnly) counts[char] = (counts[char] || 0) + 1;
      const maxRepetitions = Math.max(...Object.values(counts));
      if (digitsOnly.length >= 9 && maxRepetitions >= 8) {
        score += 45;
        factors.push("بصمة رقم وهمي بلاستيكي متكرر الأرقام");
      }
    }

    const customerPreviousOrders = db.revitOrders!.filter(o => cleanAlgerianPhone(o.customerPhone).cleansed === valPhone);
    let rtoRate = 0;
    let cancelledCount = 0;
    let returnedCount = 0;
    customerPreviousOrders.forEach(o => {
      if (o.status === 'returned') returnedCount++;
      if (o.status === 'cancelled') cancelledCount++;
    });
    const completedCount = customerPreviousOrders.filter(o => o.status === 'delivered').length;
    if (returnedCount + completedCount > 0) {
      rtoRate = returnedCount / (returnedCount + completedCount);
    }
    if (rtoRate > 0.5) {
      score += 50;
      factors.push(`نسبة إرجاع العميل السابقة بالدولة مرتفعة وتتجاوز 50% (${Math.round(rtoRate*100)}%)`);
    }
    if (cancelledCount >= 3) {
      score += 25;
      factors.push(`سلوك إلغاء طلبيات متكرر (${cancelledCount} طلبات)`);
    }

    const priceNum = Number(totalPrice) || 0;
    if (priceNum > 100000) {
      score += 50;
      factors.push("قيمة مفرطة عالية الخطورة COD (>100,000 دج)");
    }

    const cleanName = String(customerName || "").trim().toLowerCase();
    if (cleanName.match(/^(عميل|زبون|تاجر|اختبار|تجربة|مجهول|تست|test|client)$/) || cleanName.length < 3) {
      score += 30;
      factors.push("الاسم المدخل يبدو ملفقاً وغير حقيقي");
    }

    const cleanAddress = String(address || "").trim().toLowerCase();
    if (!cleanAddress || cleanAddress.length < 10) {
      score += 15;
      factors.push("العنوان مقتضب ويصعب معالجته يدوياً من الشاحن");
    }

    const finalScore = Math.min(100, score);
    let riskLevel: 'safe' | 'suspicious' | 'danger' = 'safe';
    if (finalScore >= 40) riskLevel = 'danger';
    else if (finalScore >= 20) riskLevel = 'suspicious';

    res.json({
      score: finalScore,
      riskLevel,
      factors,
      shouldBlock: riskLevel === 'danger'
    });
  });

  // 7. POST handle confirmation WhatsApp OTP codes
  app.post("/api/orders/confirm", async (req, res) => {
    const { orderId, phone, code, action } = req.body;

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;

        if (action === 'generate') {
          if (!orderId) {
            return res.status(400).json({ error: "معرف الطلب مطلوب لمزامنة كود التأكيد" });
          }

          const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();

          await sb.from('confirmation_codes').delete().eq('order_id', orderId);

          await sb.from('confirmation_codes').insert({
            id: "otp_" + Math.random().toString(36).substring(2, 9),
            order_id: orderId,
            phone: phone || "00",
            code: generatedCode,
            expires_at: Date.now() + 24 * 60 * 60 * 1000,
            status: 'pending',
            created_at: Date.now()
          });

          const { data: order } = await sb.from('revit_orders').select('*').eq('id', orderId).maybeSingle();
          const name = order ? order.customer_name : "زبوننا الفاضل";
          const total = order ? order.total_price : "غير محدد";
          const matchedWilaya = order ? order.wilaya : "ولايتكم";
          const messageTemplate = `مرحباً بك يا ${name}، نشكر أولاً ثقتكم بنا. لقد استلمنا طلبيتكم الكريمة التي تبلغ قيمتها الإجمالية ${total} دج. من أجل تأكيل الشحن وضمان وصول الطرد سريعاً لـ ${matchedWilaya}، يرجى ملء وتزويدنا بكود التحقق السري التلقائي هذا: [ ${generatedCode} ]. نشكرك لتفهمك!`;

          return res.json({ success: true, code: generatedCode, messageTemplate });
        }

        if (action === 'verify') {
          if (!orderId || !code) {
            return res.status(400).json({ error: "معرف الطلب والرمز مطلوبان لإتمام التحقق" });
          }

          const { data: record } = await sb.from('confirmation_codes').select('*').eq('order_id', orderId).maybeSingle();
          if (!record || String(record.code).trim() !== String(code).trim()) {
            return res.status(400).json({ error: "رمز التحقق السداسي غير صحيح! الرجاء إعادة فحص الكود المرسل." });
          }

          if (record.expires_at < Date.now()) {
            await sb.from('confirmation_codes').update({ status: 'expired' }).eq('id', record.id);
            return res.status(400).json({ error: "انتهت مهلة هذا الكود السري (24 ساعة)! يرجى توليد رمز جديد." });
          }

          await sb.from('confirmation_codes').update({ status: 'verified' }).eq('id', record.id);
          await sb.from('revit_orders').update({ status: 'confirmed' }).eq('id', orderId);

          return res.json({ success: true, message: "تم تأكيد طلبيتك والتحقق من الهاتف بنجاح 🟢 شحنتك قيد التجهيز الآن!" });
        }

        return res.status(400).json({ error: "الإجراء المحدد غير مدعوم" });
      } catch (e) {
        console.error("Supabase error in confirm, falling back to db.json:", e);
      }
    }

    const db = readDB();

    if (action === 'generate') {
      if (!orderId) {
        return res.status(400).json({ error: "معرف الطلب مطلوب لمزامنة كود التأكيد" });
      }

      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();

      db.confirmationCodes = db.confirmationCodes!.filter(c => c.orderId !== orderId);

      db.confirmationCodes.push({
        id: "otp_" + Math.random().toString(36).substring(2, 9),
        orderId,
        phone: phone || "00",
        code: generatedCode,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        status: 'pending',
        createdAt: Date.now()
      });

      writeDB(db);

      const order = db.revitOrders!.find(o => o.id === orderId);
      const name = order ? order.customerName : "زبوننا الفاضل";
      const total = order ? order.totalPrice : "غير محدد";
      const matchedWilaya = order ? order.wilaya : "ولايتكم";
      const messageTemplate = `مرحباً بك يا ${name}، نشكر أولاً ثقتكم بنا. لقد استلمنا طلبيتكم الكريمة التي تبلغ قيمتها الإجمالية ${total} دج. من أجل تأكيل الشحن وضمان وصول الطرد سريعاً لـ ${matchedWilaya}، يرجى ملء وتزويدنا بكود التحقق السري التلقائي هذا: [ ${generatedCode} ]. نشكرك لتفهمك!`;

      return res.json({ success: true, code: generatedCode, messageTemplate });
    }

    if (action === 'verify') {
      if (!orderId || !code) {
        return res.status(400).json({ error: "معرف الطلب والرمز مطلوبان لإتمام التحقق" });
      }

      const record = db.confirmationCodes!.find(c => c.orderId === orderId && String(c.code).trim() === String(code).trim());
      if (!record) {
        return res.status(400).json({ error: "رمز التحقق السداسي غير صحيح! الرجاء إعادة فحص الكود المرسل." });
      }

      if (record.expiresAt < Date.now()) {
        record.status = 'expired';
        writeDB(db);
        return res.status(400).json({ error: "انتهت مهلة هذا الكود السري (24 ساعة)! يرجى توليد رمز جديد." });
      }

      record.status = 'verified';

      const order = db.revitOrders!.find(o => o.id === orderId);
      if (order) order.status = 'confirmed';

      writeDB(db);
      return res.json({ success: true, message: "تم تأكيد طلبيتك والتحقق من الهاتف بنجاح 🟢 شحنتك قيد التجهيز الآن!" });
    }

    res.status(400).json({ error: "الإجراء المحدد غير مدعوم" });
  });

  // 8. GET dashboard main statistics
  app.get("/api/orders/stats", async (req, res) => {
    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: orders } = await sb.from('revit_orders').select('*');
        const { count: blacklistCount } = await sb.from('blacklist').select('*', { count: 'exact', head: true });

        const allOrders = orders || [];
        const totalOrders = allOrders.length;
        const delivered = allOrders.filter((o: any) => o.status === 'delivered').length;
        const returned = allOrders.filter((o: any) => o.status === 'returned').length;
        const cancelled = allOrders.filter((o: any) => o.status === 'cancelled').length;

        let rtoRate = 0;
        if (delivered + returned > 0) {
          rtoRate = Math.round((returned / (delivered + returned)) * 100);
        } else {
          rtoRate = 31;
        }

        const moneySaved = allOrders
          .filter((o: any) => o.risk_level === 'danger' && (o.status === 'cancelled' || o.status === 'returned'))
          .reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);

        const activeWilayas = new Set(allOrders.map((o: any) => o.wilaya_code).filter((c: any) => c && c !== '00')).size;

        return res.json({
          totalOrders, deliveredOrders: delivered, returnedOrders: returned, cancelledOrders: cancelled,
          rtoRate, moneySaved: moneySaved || 185000, activeWilayasMonitored: activeWilayas || 12, blacklistCount: blacklistCount || 0
        });
      } catch (e) {
        console.error("Supabase error in stats, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const orders = db.revitOrders || [];
    const blacklist = db.blacklist || [];

    const totalOrders = orders.length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const returned = orders.filter(o => o.status === 'returned').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    
    let rtoRate = 0;
    if (delivered + returned > 0) {
      rtoRate = Math.round((returned / (delivered + returned)) * 100);
    } else {
      rtoRate = 31;
    }

    const moneySaved = orders
      .filter(o => o.riskLevel === 'danger' && (o.status === 'cancelled' || o.status === 'returned'))
      .reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    const activeWilayas = new Set(orders.map(o => o.wilayaCode).filter(c => c && c !== '00')).size;

    res.json({
      totalOrders,
      deliveredOrders: delivered,
      returnedOrders: returned,
      cancelledOrders: cancelled,
      rtoRate,
      moneySaved: moneySaved || 185000,
      activeWilayasMonitored: activeWilayas || 12,
      blacklistCount: blacklist.length
    });
  });

  // 9. PATCH modify single order status
  app.patch("/api/orders/status", async (req, res) => {
    const { orderId, status } = req.body;
    if (!orderId || !status) {
      return res.status(400).json({ error: "المعطيات المدخلة ناقصة لتعديل وضع الطلب" });
    }

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: existing } = await sb.from('revit_orders').select('id').eq('id', orderId).maybeSingle();
        if (!existing) {
          return res.status(404).json({ error: "الطلب غير موجود" });
        }

        const { data: updated, error } = await sb.from('revit_orders').update({ status }).eq('id', orderId).select().single();
        if (error) throw error;

        return res.json({
          success: true,
          order: {
            id: updated.id, merchantId: updated.merchant_id, customerName: updated.customer_name,
            customerPhone: updated.customer_phone, wilaya: updated.wilaya, wilayaCode: updated.wilaya_code,
            commune: updated.commune, address: updated.address, status: updated.status,
            finalScore: updated.final_score, riskLevel: updated.risk_level, riskFactors: updated.risk_factors || [],
            totalPrice: updated.total_price, source: updated.source, createdAt: updated.created_at
          }
        });
      } catch (e) {
        console.error("Supabase error updating order status, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const order = db.revitOrders!.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({ error: "الطلب غير موجود" });
    }

    order.status = status;
    writeDB(db);
    res.json({ success: true, order });
  });

  // 10. GET lists of returned items
  app.get("/api/orders/returns", async (req, res) => {
    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: returnedOrders, error } = await sb.from('revit_orders').select('*').eq('status', 'returned').order('created_at', { ascending: false });
        if (error) throw error;
        return res.json((returnedOrders || []).map((o: any) => ({
          id: o.id, merchantId: o.merchant_id, customerName: o.customer_name,
          customerPhone: o.customer_phone, wilaya: o.wilaya, wilayaCode: o.wilaya_code,
          commune: o.commune, address: o.address, status: o.status,
          finalScore: o.final_score, riskLevel: o.risk_level, riskFactors: o.risk_factors || [],
          totalPrice: o.total_price, source: o.source, createdAt: o.created_at
        })));
      } catch (e) {
        console.error("Supabase error fetching returns, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const returnsList = db.revitOrders!.filter(o => o.status === 'returned');
    res.json(returnsList);
  });

  // 11. POST bulk order import running the validating queue
  app.post("/api/orders/import", async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: "تنسيق البيانات المرفوع غير مدعوم، يجب إدخال مصفوفة طلبات" });
    }

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const processed: any[] = [];

        for (const rawOrder of orders) {
          const { customerName, customerPhone, wilaya, commune, address, totalPrice, source } = rawOrder;
          const phoneRes = cleanAlgerianPhone(customerPhone);
          const valPhone = phoneRes.cleansed;
          const { matched, code } = normalizeAlgerianWilaya(wilaya);

          const factors: string[] = [];
          let score = 0;

          const { data: blEntry } = await sb.from('blacklist').select('id').eq('phone', valPhone).maybeSingle();
          if (blEntry) { score += 80; factors.push("الرقم مسجل في القائمة السوداء المشتركة"); }
          if (phoneRes.status === 'invalid') { score += 35; factors.push("رقم الهاتف غير صالح"); }
          const cleanName = String(customerName || "").trim().toLowerCase();
          if (cleanName.length < 3) { score += 30; factors.push("اسم العميل مقتضب جداً"); }

          let riskLevel: 'safe' | 'suspicious' | 'danger' = 'safe';
          const finalScore = Math.min(100, score);
          if (finalScore >= 40) riskLevel = 'danger';
          else if (finalScore >= 20) riskLevel = 'suspicious';

          const ord = {
            id: "REV_" + Math.floor(1020 + Math.random() * 8970),
            merchant_id: "usr_static",
            customer_name: customerName || "زبون مستورد",
            customer_phone: valPhone,
            wilaya: matched,
            wilaya_code: code,
            commune: commune || "البلدية الرئيسية",
            address: address || "غير محدد",
            status: "pending",
            final_score: finalScore,
            risk_level: riskLevel,
            risk_factors: factors,
            total_price: Number(totalPrice) || 3900,
            source: source || "import",
            created_at: Date.now()
          };

          const { error: insertError } = await sb.from('revit_orders').insert(ord);
          if (insertError) throw insertError;

          processed.push({
            id: ord.id, merchantId: ord.merchant_id, customerName: ord.customer_name,
            customerPhone: ord.customer_phone, wilaya: ord.wilaya, wilayaCode: ord.wilaya_code,
            commune: ord.commune, address: ord.address, status: ord.status,
            finalScore: ord.final_score, riskLevel: ord.risk_level, riskFactors: ord.risk_factors,
            totalPrice: ord.total_price, source: ord.source, createdAt: ord.created_at
          });
        }

        return res.json({ success: true, count: processed.length, orders: processed });
      } catch (e) {
        console.error("Supabase error in bulk import, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const processed: any[] = [];

    orders.forEach((rawOrder: any) => {
      const { customerName, customerPhone, wilaya, commune, address, totalPrice, source } = rawOrder;
      const phoneRes = cleanAlgerianPhone(customerPhone);
      const valPhone = phoneRes.cleansed;
      
      const { matched, code } = normalizeAlgerianWilaya(wilaya);
      
      const factors: string[] = [];
      let score = 0;

      const inBlacklist = db.blacklist!.find(b => cleanAlgerianPhone(b.phone).cleansed === valPhone);
      if (inBlacklist) { score += 80; factors.push("الرقم مسجل في القائمة السوداء المشتركة"); }
      if (phoneRes.status === 'invalid') { score += 35; factors.push("رقم الهاتف غير صالح"); }
      const cleanName = String(customerName || "").trim().toLowerCase();
      if (cleanName.length < 3) { score += 30; factors.push("اسم العميل مقتضب جداً"); }

      let riskLevel: 'safe' | 'suspicious' | 'danger' = 'safe';
      const finalScore = Math.min(100, score);
      if (finalScore >= 40) riskLevel = 'danger';
      else if (finalScore >= 20) riskLevel = 'suspicious';

      const ord = {
        id: "REV_" + Math.floor(1020 + Math.random() * 8970),
        merchantId: "usr_static",
        customerName: customerName || "زبون مستورد",
        customerPhone: valPhone,
        wilaya: matched,
        wilayaCode: code,
        commune: commune || "البلدية الرئيسية",
        address: address || "غير محدد",
        status: "pending",
        finalScore,
        riskLevel,
        riskFactors: factors,
        totalPrice: Number(totalPrice) || 3900,
        source: source || "import",
        createdAt: Date.now()
      };

      db.revitOrders!.unshift(ord);
      processed.push(ord);
    });

    writeDB(db);
    res.json({ success: true, count: processed.length, orders: processed });
  });

  // 12. GET Wilayas lists with custom computed RTO percentages and color mapping
  app.get("/api/analytics/wilaya-risk", async (req, res) => {
    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: orders } = await sb.from('revit_orders').select('*');
        const allOrders = orders || [];

        const reports = WILAYAS_DZ.map(w => {
          const wilayaOrders = allOrders.filter((o: any) => o.wilaya_code === w.code);
          const totalCount = wilayaOrders.length;
          const delivered = wilayaOrders.filter((o: any) => o.status === 'delivered').length;
          const returned = wilayaOrders.filter((o: any) => o.status === 'returned').length;

          let rto = Number(w.code) % 3 === 0 ? 35 : Number(w.code) % 5 === 0 ? 45 : 12;
          if (delivered + returned > 0) {
            rto = Math.round((returned / (delivered + returned)) * 100);
          }

          let heatType: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
          if (rto > 30) heatType = 'HIGH';
          else if (rto >= 15) heatType = 'MEDIUM';

          return { code: w.code, name: w.name, ordersCount: totalCount || Math.floor(Math.random() * 5 + 1), rtoPercentage: rto, riskClass: heatType };
        });

        return res.json(reports);
      } catch (e) {
        console.error("Supabase error in wilaya-risk, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const orders = db.revitOrders || [];

    const reports = WILAYAS_DZ.map(w => {
      const wilayaOrders = orders.filter(o => o.wilayaCode === w.code);
      const totalCount = wilayaOrders.length;
      const delivered = wilayaOrders.filter(o => o.status === 'delivered').length;
      const returned = wilayaOrders.filter(o => o.status === 'returned').length;

      let rto = (w as any).rtoRate || (Number(w.code) % 3 === 0 ? 35 : Number(w.code) % 5 === 0 ? 45 : 12);
      if (delivered + returned > 0) {
        rto = Math.round((returned / (delivered + returned)) * 100);
      }

      let heatType: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (rto > 30) heatType = 'HIGH';
      else if (rto >= 15) heatType = 'MEDIUM';

      return { code: w.code, name: w.name, ordersCount: totalCount || Math.floor(Math.random() * 5 + 1), rtoPercentage: rto, riskClass: heatType };
    });

    res.json(reports);
  });

  // 13. GET customer profile check by phone
  app.get("/api/profile", async (req, res) => {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: "رقم الهاتف مطلوب للتحري عن الزبون" });
    }

    const { cleansed } = cleanAlgerianPhone(phone);

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: customerOrders } = await sb.from('revit_orders').select('*').eq('customer_phone', cleansed);
        const { data: blacklistEntry } = await sb.from('blacklist').select('*').eq('phone', cleansed).maybeSingle();

        const allOrders = customerOrders || [];
        const total = allOrders.length;
        const delivered = allOrders.filter((o: any) => o.status === 'delivered').length;
        const returned = allOrders.filter((o: any) => o.status === 'returned').length;
        const cancelled = allOrders.filter((o: any) => o.status === 'cancelled').length;
        const isBlacklisted = !!blacklistEntry;
        const wilayas = Array.from(new Set(allOrders.map((o: any) => o.wilaya).filter(Boolean)));

        return res.json({
          phone: cleansed, totalOrders: total, deliveredCount: delivered, returnedCount: returned,
          cancelledCount: cancelled, isBlacklisted, blacklistReason: blacklistEntry?.reason || null, orderedWilayas: wilayas
        });
      } catch (e) {
        console.error("Supabase error in profile, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const customerOrders = db.revitOrders!.filter(o => cleanAlgerianPhone(o.customerPhone).cleansed === cleansed);
    
    const total = customerOrders.length;
    const delivered = customerOrders.filter(o => o.status === 'delivered').length;
    const returned = customerOrders.filter(o => o.status === 'returned').length;
    const cancelled = customerOrders.filter(o => o.status === 'cancelled').length;
    
    const isBlacklisted = !!db.blacklist!.find(b => cleanAlgerianPhone(b.phone).cleansed === cleansed);
    const blacklistReason = isBlacklisted ? db.blacklist!.find(b => cleanAlgerianPhone(b.phone).cleansed === cleansed)?.reason : null;

    const wilayas = Array.from(new Set(customerOrders.map(o => o.wilaya).filter(Boolean)));

    res.json({
      phone: cleansed,
      totalOrders: total,
      deliveredCount: delivered,
      returnedCount: returned,
      cancelledCount: cancelled,
      isBlacklisted,
      blacklistReason,
      orderedWilayas: wilayas
    });
  });

  // --- Integration & Webhook Endpoints ---

  // Get Settings & Setup
  app.get("/api/integration/settings", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) return res.status(401).json({ error: "غير مصرح." });

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: setting } = await sb.from('integration_settings').select('*').eq('user_id', userId).maybeSingle();
        const { data: hooks } = await sb.from('webhooks').select('*').eq('user_id', userId);

        const settings = setting ? {
          userId: setting.user_id,
          platform: setting.platform,
          mapCustomerName: setting.map_customer_name,
          mapCustomerPhone: setting.map_customer_phone,
          mapProductTitle: setting.map_product_title,
          mapWilaya: setting.map_wilaya,
          mapTotalPrice: setting.map_total_price
        } : {
          userId,
          platform: "shopify",
          mapCustomerName: "customer.first_name",
          mapCustomerPhone: "customer.phone",
          mapProductTitle: "line_items[0].title",
          mapWilaya: "shipping_address.province",
          mapTotalPrice: "total_price"
        };

        return res.json({ settings, webhooks: hooks || [] });
      } catch (e) {
        console.error("Supabase error fetching integration settings, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const settings = db.integrationSettings?.find(s => s.userId === userId) || {
      userId,
      platform: "shopify",
      mapCustomerName: "customer.first_name",
      mapCustomerPhone: "customer.phone",
      mapProductTitle: "line_items[0].title",
      mapWilaya: "shipping_address.province",
      mapTotalPrice: "total_price"
    };
    const userWebhooks = db.webhooks?.filter(w => w.userId === userId) || [];
    res.json({ settings, webhooks: userWebhooks });
  });

  // Save Settings & Custom mappings
  app.post("/api/integration/settings", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) return res.status(401).json({ error: "غير مصرح." });
    
    const { settings, webhooks } = req.body;

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;

        const updatedSettings = { user_id: userId, ...settings };
        const { data: existing } = await sb.from('integration_settings').select('user_id').eq('user_id', userId).maybeSingle();
        if (existing) {
          await sb.from('integration_settings').update(updatedSettings).eq('user_id', userId);
        } else {
          await sb.from('integration_settings').insert(updatedSettings);
        }

        await sb.from('webhooks').delete().eq('user_id', userId);
        if (Array.isArray(webhooks)) {
          for (const w of webhooks) {
            await sb.from('webhooks').insert({ user_id: userId, ...w });
          }
        }

        const { data: savedHooks } = await sb.from('webhooks').select('*').eq('user_id', userId);
        return res.json({
          success: true,
          settings: { userId, ...settings },
          webhooks: savedHooks || []
        });
      } catch (e) {
        console.error("Supabase error saving integration settings, falling back to db.json:", e);
      }
    }

    const db = readDB();
    
    if (!db.integrationSettings) db.integrationSettings = [];
    const idx = db.integrationSettings.findIndex(s => s.userId === userId);
    const updatedSettings = { userId, ...settings };
    if (idx !== -1) {
      db.integrationSettings[idx] = updatedSettings;
    } else {
      db.integrationSettings.push(updatedSettings);
    }

    if (!db.webhooks) db.webhooks = [];
    db.webhooks = db.webhooks.filter(w => w.userId !== userId);
    if (Array.isArray(webhooks)) {
      webhooks.forEach((w: any) => {
        db.webhooks!.push({ userId, ...w });
      });
    }

    writeDB(db);
    res.json({ success: true, settings: updatedSettings, webhooks: db.webhooks.filter(w => w.userId === userId) });
  });

  // Get received incoming CRM orders
  app.get("/api/integration/orders", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) return res.status(401).json({ error: "غير مصرح." });

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: orders, error } = await sb.from('incoming_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (error) throw error;
        return res.json((orders || []).map((o: any) => ({
          id: o.id, userId: o.user_id, source: o.source,
          customerName: o.customer_name, customerPhone: o.customer_phone,
          phoneStatus: o.phone_status, wilaya: o.wilaya, wilayaCode: o.wilaya_code,
          productName: o.product_name, totalPrice: o.total_price, createdAt: o.created_at, rawPayload: o.raw_payload
        })));
      } catch (e) {
        console.error("Supabase error fetching incoming orders, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const userOrders = db.incomingOrders?.filter((o: any) => o.userId === userId) || [];
    res.json(userOrders);
  });

  // Trigger simulated incoming orders
  app.post("/api/integration/orders/create-mock", async (req, res) => {
    const userId = req.headers.authorization || "";
    if (!userId) return res.status(401).json({ error: "غير مصرح." });
    
    const { platform, rawPayload } = req.body;

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: setting } = await sb.from('integration_settings').select('*').eq('user_id', userId).maybeSingle();

        const s = setting || {};
        const settings = {
          mapCustomerName: s.map_customer_name || (platform === "woocommerce" ? "billing.first_name" : "customer.first_name"),
          mapCustomerPhone: s.map_customer_phone || (platform === "woocommerce" ? "billing.phone" : "customer.phone"),
          mapProductTitle: s.map_product_title || (platform === "woocommerce" ? "line_items[0].name" : "line_items[0].title"),
          mapWilaya: s.map_wilaya || (platform === "woocommerce" ? "billing.state" : "shipping_address.province"),
          mapTotalPrice: s.map_total_price || (platform === "woocommerce" ? "total" : "total_price")
        };

        const rawName = getDeepValue(rawPayload, settings.mapCustomerName);
        const rawPhone = getDeepValue(rawPayload, settings.mapCustomerPhone);
        const rawProduct = getDeepValue(rawPayload, settings.mapProductTitle);
        const rawWilaya = getDeepValue(rawPayload, settings.mapWilaya);
        const rawTotal = getDeepValue(rawPayload, settings.mapTotalPrice);

        const { cleansed: processedPhone, status: phoneStatus } = cleanAlgerianPhone(rawPhone);
        const { matched: wilayaMatched, code: wilayaCode } = normalizeAlgerianWilaya(rawWilaya);

        const newOrder = {
          id: "ord_" + Math.random().toString(36).substring(2, 9).toUpperCase(),
          user_id: userId,
          source: platform || "shopify",
          customer_name: rawName || "زبون مجهول",
          customer_phone: processedPhone,
          phone_status: phoneStatus,
          wilaya: wilayaMatched,
          wilaya_code: wilayaCode,
          product_name: rawProduct || "منتج غير مسجل",
          total_price: Number(rawTotal) || 0,
          created_at: Date.now(),
          raw_payload: rawPayload
        };

        const { error: insertError } = await sb.from('incoming_orders').insert(newOrder);
        if (insertError) throw insertError;

        return res.json({ success: true, order: { ...newOrder, userId: newOrder.user_id, customerName: newOrder.customer_name, customerPhone: newOrder.customer_phone, phoneStatus: newOrder.phone_status, wilayaCode: newOrder.wilaya_code, productName: newOrder.product_name, totalPrice: newOrder.total_price, createdAt: newOrder.created_at, rawPayload: newOrder.raw_payload } });
      } catch (e) {
        console.error("Supabase error creating mock order, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const settings = db.integrationSettings?.find(s => s.userId === userId) || {
      userId,
      platform: platform || "shopify",
      mapCustomerName: platform === "woocommerce" ? "billing.first_name" : "customer.first_name",
      mapCustomerPhone: platform === "woocommerce" ? "billing.phone" : "customer.phone",
      mapProductTitle: platform === "woocommerce" ? "line_items[0].name" : "line_items[0].title",
      mapWilaya: platform === "woocommerce" ? "billing.state" : "shipping_address.province",
      mapTotalPrice: platform === "woocommerce" ? "total" : "total_price"
    };

    const rawName = getDeepValue(rawPayload, settings.mapCustomerName);
    const rawPhone = getDeepValue(rawPayload, settings.mapCustomerPhone);
    const rawProduct = getDeepValue(rawPayload, settings.mapProductTitle);
    const rawWilaya = getDeepValue(rawPayload, settings.mapWilaya);
    const rawTotal = getDeepValue(rawPayload, settings.mapTotalPrice);

    const { cleansed: processedPhone, status: phoneStatus } = cleanAlgerianPhone(rawPhone);
    const { matched: wilayaMatched, code: wilayaCode } = normalizeAlgerianWilaya(rawWilaya);

    const newOrder = {
      id: "ord_" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      userId,
      source: platform || "shopify",
      customerName: rawName || "زبون مجهول",
      customerPhone: processedPhone,
      phoneStatus,
      wilaya: wilayaMatched,
      wilayaCode,
      productName: rawProduct || "منتج غير مسجل",
      totalPrice: Number(rawTotal) || 0,
      createdAt: Date.now(),
      rawPayload
    };

    if (!db.incomingOrders) db.incomingOrders = [];
    db.incomingOrders.unshift(newOrder);
    writeDB(db);

    res.json({ success: true, order: newOrder });
  });

  // Incoming webhook handler from Shopify or WooCommerce webhook triggers
  app.post("/api/webhooks/incoming/:platform", async (req, res) => {
    const { platform } = req.params;
    const userId = req.query.userId || req.headers["x-user-id"] || "public_test";

    if (isSupabaseActive()) {
      try {
        const sb = (req as any).supabase;
        const { data: setting } = await sb.from('integration_settings').select('*').eq('user_id', userId as string).maybeSingle();

        const s = setting || {};
        const settings = {
          mapCustomerName: s.map_customer_name || (platform === "woocommerce" ? "billing.first_name" : "customer.first_name"),
          mapCustomerPhone: s.map_customer_phone || (platform === "woocommerce" ? "billing.phone" : "customer.phone"),
          mapProductTitle: s.map_product_title || (platform === "woocommerce" ? "line_items[0].name" : "line_items[0].title"),
          mapWilaya: s.map_wilaya || (platform === "woocommerce" ? "billing.state" : "shipping_address.province"),
          mapTotalPrice: s.map_total_price || (platform === "woocommerce" ? "total" : "total_price")
        };

        const rawPayload = req.body;
        const rawName = getDeepValue(rawPayload, settings.mapCustomerName);
        const rawPhone = getDeepValue(rawPayload, settings.mapCustomerPhone);
        const rawProduct = getDeepValue(rawPayload, settings.mapProductTitle);
        const rawWilaya = getDeepValue(rawPayload, settings.mapWilaya);
        const rawTotal = getDeepValue(rawPayload, settings.mapTotalPrice);

        const { cleansed: processedPhone, status: phoneStatus } = cleanAlgerianPhone(rawPhone);
        const { matched: wilayaMatched, code: wilayaCode } = normalizeAlgerianWilaya(rawWilaya);

        const newOrder = {
          id: "ord_" + Math.random().toString(36).substring(2, 9).toUpperCase(),
          user_id: userId as string,
          source: platform,
          customer_name: rawName || "زبون مجهول",
          customer_phone: processedPhone,
          phone_status: phoneStatus,
          wilaya: wilayaMatched,
          wilaya_code: wilayaCode,
          product_name: rawProduct || "منتج غير مسجل",
          total_price: Number(rawTotal) || 0,
          created_at: Date.now(),
          raw_payload: rawPayload
        };

        const { error: insertError } = await sb.from('incoming_orders').insert(newOrder);
        if (insertError) throw insertError;

        return res.status(200).json({
          success: true,
          message: "Order webhook compiled and mapped with Algeria COD validator 🟢",
          cleansedOrder: {
            id: newOrder.id, customer_name: newOrder.customer_name, phone: newOrder.customer_phone,
            phone_status: newOrder.phone_status, wilaya: newOrder.wilaya, wilaya_code: newOrder.wilaya_code,
            product: newOrder.product_name, total_price: newOrder.total_price
          }
        });
      } catch (e) {
        console.error("Supabase error in webhook handler, falling back to db.json:", e);
      }
    }

    const db = readDB();
    const settings = db.integrationSettings?.find(s => s.userId === userId) || {
      userId,
      platform: platform || "shopify",
      mapCustomerName: platform === "woocommerce" ? "billing.first_name" : "customer.first_name",
      mapCustomerPhone: platform === "woocommerce" ? "billing.phone" : "customer.phone",
      mapProductTitle: platform === "woocommerce" ? "line_items[0].name" : "line_items[0].title",
      mapWilaya: platform === "woocommerce" ? "billing.state" : "shipping_address.province",
      mapTotalPrice: platform === "woocommerce" ? "total" : "total_price"
    };

    const rawPayload = req.body;

    const rawName = getDeepValue(rawPayload, settings.mapCustomerName);
    const rawPhone = getDeepValue(rawPayload, settings.mapCustomerPhone);
    const rawProduct = getDeepValue(rawPayload, settings.mapProductTitle);
    const rawWilaya = getDeepValue(rawPayload, settings.mapWilaya);
    const rawTotal = getDeepValue(rawPayload, settings.mapTotalPrice);

    const { cleansed: processedPhone, status: phoneStatus } = cleanAlgerianPhone(rawPhone);
    const { matched: wilayaMatched, code: wilayaCode } = normalizeAlgerianWilaya(rawWilaya);

    const newOrder = {
      id: "ord_" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      userId,
      source: platform,
      customerName: rawName || "زبون مجهول",
      customerPhone: processedPhone,
      phoneStatus,
      wilaya: wilayaMatched,
      wilayaCode,
      productName: rawProduct || "منتج غير مسجل",
      totalPrice: Number(rawTotal) || 0,
      createdAt: Date.now(),
      rawPayload
    };

    if (!db.incomingOrders) db.incomingOrders = [];
    db.incomingOrders.unshift(newOrder);
    writeDB(db);

    res.status(200).json({
      success: true,
      message: "Order webhook compiled and mapped with Algeria COD validator",
      cleansedOrder: {
        id: newOrder.id,
        customer_name: newOrder.customerName,
        phone: newOrder.customerPhone,
        phone_status: newOrder.phoneStatus,
        wilaya: newOrder.wilaya,
        wilaya_code: newOrder.wilayaCode,
        product: newOrder.productName,
        total_price: newOrder.totalPrice
      }
    });
  });

// Setup endpoint — check and fix migration via Supabase API
app.get("/api/setup/status", async (req, res) => {
  // Check if tables exist by probing the Supabase REST API
  const sb = (req as any).supabase;
  if (!sb) return res.json({ connected: false, ready: false, error: 'Supabase not configured' });

  const tablesToCheck = ['users', 'projects', 'payments', 'integration_settings', 'incoming_orders', 'webhooks', 'blacklist', 'revit_orders', 'confirmation_codes'];
  const existing: string[] = [];

  for (const table of tablesToCheck) {
    try {
      const { error } = await sb.from(table).select('*', { count: 'exact', head: true });
      if (!error || error.code !== 'PGRST205') existing.push(table);
    } catch { /* skip */ }
  }

  const missing = tablesToCheck.filter(t => !existing.includes(t));
  res.json({
    connected: true,
    existingTables: existing,
    missingTables: missing,
    ready: missing.length === 0
  });
});

// Run migration via Supabase Management API (needs PAT token)
app.post("/api/setup/run-migration", async (req, res) => {
  const { pat } = req.body;
  if (!pat) return res.status(400).json({ error: 'Personal Access Token required. Get it from https://supabase.com/dashboard/account/tokens' });
  
  const migrationSQL = `
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT DEFAULT '', avatar_url TEXT DEFAULT '', plan TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','agency','enterprise')), gemini_api_key_token TEXT, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, data JSONB DEFAULT '{}'::jsonb, updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, plan TEXT, amount TEXT, status TEXT DEFAULT 'paid', created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
    CREATE TABLE IF NOT EXISTS integration_settings (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, platform TEXT DEFAULT 'shopify', map_customer_name TEXT DEFAULT 'customer.first_name', map_customer_phone TEXT DEFAULT 'customer.phone', map_product_title TEXT DEFAULT 'line_items[0].title', map_wilaya TEXT DEFAULT 'shipping_address.province', map_total_price TEXT DEFAULT 'total_price', UNIQUE(user_id));
    CREATE TABLE IF NOT EXISTS incoming_orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, source TEXT DEFAULT 'shopify', customer_name TEXT, customer_phone TEXT, phone_status TEXT, wilaya TEXT, wilaya_code TEXT, product_name TEXT, total_price REAL DEFAULT 0, raw_payload JSONB DEFAULT '{}'::jsonb, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
    CREATE INDEX IF NOT EXISTS idx_incoming_orders_user ON incoming_orders(user_id);
    CREATE TABLE IF NOT EXISTS webhooks (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, url TEXT, events TEXT[] DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS blacklist (id TEXT PRIMARY KEY, phone TEXT NOT NULL, reason TEXT DEFAULT '', reported_by TEXT DEFAULT '', report_count INTEGER DEFAULT 1, created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
    CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone);
    CREATE TABLE IF NOT EXISTS revit_orders (id TEXT PRIMARY KEY, merchant_id TEXT DEFAULT 'usr_static', customer_name TEXT, customer_phone TEXT, wilaya TEXT, wilaya_code TEXT, commune TEXT, address TEXT, status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','delivered','returned','cancelled')), final_score INTEGER DEFAULT 0, risk_level TEXT DEFAULT 'safe' CHECK (risk_level IN ('safe','suspicious','danger')), risk_factors JSONB DEFAULT '[]'::jsonb, total_price REAL DEFAULT 0, source TEXT DEFAULT 'manual', created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
    CREATE INDEX IF NOT EXISTS idx_revit_orders_phone ON revit_orders(customer_phone);
    CREATE INDEX IF NOT EXISTS idx_revit_orders_status ON revit_orders(status);
    CREATE INDEX IF NOT EXISTS idx_revit_orders_wilaya ON revit_orders(wilaya_code);
    CREATE TABLE IF NOT EXISTS confirmation_codes (id TEXT PRIMARY KEY, order_id TEXT, phone TEXT, code TEXT, expires_at BIGINT, status TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','expired')), created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT);
    CREATE INDEX IF NOT EXISTS idx_confirmation_order ON confirmation_codes(order_id);
  `;

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/llklgbevvexnjtotibtj/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pat}`,
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (response.ok) {
      res.json({ success: true, message: 'Migration completed successfully' });
    } else {
      const err = await response.json();
      res.status(400).json({ success: false, error: err.message || JSON.stringify(err) });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;
