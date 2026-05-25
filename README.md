# Marketing Master — AI Marketing OS Hub

منصة SaaS ذكية متكاملة لتحليل المنتجات وبناء الحملات الإعلانية للسوق الجزائري (COD).

## المميزات

- **8 مراحل إنتاج إعلاني**: تحليل المنتج ← بناء الجماهير ← بطاقة ذكاء المنتج ← 5 بروبمنتات إعلانية ← Landing Page ← Video Workflow ← Meta Ads Strategy ← Scaling
- **REVIT Fraud Detection**: نظام كشف الاحتيال بـ 7 طبقات للطلبات COD (قائمة سوداء مشتركة، تحليل رقم الهاتف، كشف البوتات، تحليل السرعة)
- **SaaS Billing**: نظام اشتراكات (Free/Pro/Agency/Enterprise) مع محاكاة دفع Chargily
- **تكامل Webhook**: يستقبل طلبات من Shopify و WooCommerce
- **تحليل 58 ولاية**: دعم كامل لخرائط الولايات الجزائرية مع تحليل RTO
- **Gemini AI**: يستخدم Google Gemini API (gemini-3.5-flash) لتوليد المحتوى الإبداعي
- **PDF Export**: تصدير التقارير كـ PDF بجودة عالية

## المتطلبات

- Node.js 18+
- مفتاح Google Gemini API

## التشغيل المحلي

1. انسخ ملف البيئة:
   ```bash
   cp .env.example .env.local
   ```

2. ضع مفتاح Gemini API في `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```

3. ثبت الاعتماديات:
   ```bash
   npm install
   ```

4. شغل المشروع:
   ```bash
   npm run dev
   ```

   السيرفر يشتغل على: `http://localhost:3000`

## البناء للإنتاج

```bash
npm run build
npm start
```

## هيكل المشروع

```
├── src/
│   ├── components/     # مكونات React (SaaS, UI, Phases)
│   ├── lib/            # AI logic, mindset, fraud detection, Algeria data
│   ├── context/        # AuthContext
│   ├── App.tsx         # التطبيق الرئيسي
│   ├── main.tsx        # نقطة الدخول
│   └── types.ts        # TypeScript types
├── server.ts           # Express backend (API, Auth, Orders, Webhooks)
├── db.json             # قاعدة بيانات JSON (محلية)
├── app/                # سكربتات مساعدة
├── AGENTS.md           # تكوين opencode agents
├── GEMINI.md           # نظام GEMINI الذكي للمساعد
└── .env.example        # قالب ملف البيئة
```

## التكنولوجيا

- **Frontend**: React 19, Vite 6, Tailwind CSS 4, Motion, Lucide
- **Backend**: Express, dotenv, esbuild
- **AI**: @google/genai
- **PDF**: html2pdf.js
- **الخطوط**: Cairo (عربي), IBM Plex Mono (إنجليزي)

## الترخيص

MIT
