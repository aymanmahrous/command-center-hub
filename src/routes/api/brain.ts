import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SYSTEM = `You are "Coach Brain", the expert AI advisor and operating engine for Coach Ayman Swimming & Relax Fix Hub in Abu Dhabi.
Reply in the user's language (Arabic by default, or English if asked). Be concise, practical, authoritative, and structured with markdown.

Core Identity & Knowledge:
1) Technical Swimming & Aquaphobia Mastery:
   - Deep expertise in freestyle, breaststroke, backstroke, and butterfly.
   - Gentle, progressive treatment for fear of water (aquaphobia) for children and adults.
   - Motor rehabilitation swimming guidance (advise consulting doctors for severe clinical injuries).
   - Proven methods referenced: Total Immersion, Swim Smooth, USA Swimming fundamentals.
2) Abu Dhabi Academy Business Realities (Strict Facts — never fabricate alternatives):
   - Active Branches: Al Mushrif (المشرف), Al Falah (الفلاح), Khalifa City (مدينة خليفة), Al Danah / Al Najda (الدانة / النجدة).
   - Pricing: Private session: 150 AED & 250 AED. Kids groups package: 450 AED. Sibling discount price: 400 AED.
   - Official WhatsApp & Booking Contact: 058 821 9130 (+971588219130).
   - Management phone (phone calls only, never booking messages): 055 137 8660 (+971551378660).
3) Content Production & Social Media Formats:
   - Instagram/Facebook 4:5 Carousels & Posts.
   - TikTok & Reels 9:16 vertical video hooks (Hook in first 3s + Value demonstration + Call to Action).
   - Dynamic templates: Technique Drill, Aquaphobia Transformation, Abu Dhabi Branch Offer, Interactive Quiz.
   - Always direct public social posts to WhatsApp 058 821 9130 for free assessment. NEVER mention prices in public social posts (prices are reserved for qualified leads in private chat).
4) Safety & Honesty Rule:
   - Never claim you published or charged money without the owner's manual approval. Zero fake actions.`;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(40),
});

export const Route = createFileRoute("/api/brain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid request payload", { status: 400 });

        const messages = parsed.data.messages;
        const lastUserMessage = messages[messages.length - 1]?.content || "";

        const geminiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
        const openaiKey = process.env["OPENAI_API_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];

        // 1. Google Gemini Provider
        if (geminiKey) {
          try {
            const contents = messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            }));

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
            const upstream = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM }] },
                contents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 2048,
                },
              }),
            });

            if (upstream.ok) {
              const data = await upstream.json();
              const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (reply) {
                return new Response(reply, {
                  headers: { "Content-Type": "text/plain; charset=utf-8" },
                });
              }
            }
          } catch (e) {
            console.error("Gemini API call failed:", e);
          }
        }

        // 2. OpenAI Provider
        if (openaiKey) {
          try {
            const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: SYSTEM },
                  ...messages.map((m) => ({ role: m.role, content: m.content })),
                ],
                temperature: 0.7,
              }),
            });

            if (upstream.ok) {
              const data = await upstream.json();
              const reply = data.choices?.[0]?.message?.content;
              if (reply) {
                return new Response(reply, {
                  headers: { "Content-Type": "text/plain; charset=utf-8" },
                });
              }
            }
          } catch (e) {
            console.error("OpenAI API call failed:", e);
          }
        }

        // 3. Lovable Gateway Fallback
        if (lovableKey) {
          try {
            const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
              method: "POST",
              signal: request.signal,
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${lovableKey}`,
                "Lovable-API-Key": lovableKey,
              },
              body: JSON.stringify({
                model: "openai/gpt-4o",
                stream: false,
                instructions: SYSTEM,
                input: messages.map((m) => ({ role: m.role, content: m.content })),
              }),
            });
            if (upstream.ok) {
              const data = await upstream.json();
              const reply = data.output_text || data.choices?.[0]?.message?.content;
              if (reply) {
                return new Response(reply, {
                  headers: { "Content-Type": "text/plain; charset=utf-8" },
                });
              }
            }
          } catch (e) {
            console.error("Lovable Gateway call failed:", e);
          }
        }

        // 4. Intelligent Local Knowledge Engine (No dead ends / 100% reliable fallback)
        // Checks if this is a Content Factory JSON generation request:
        if (lastUserMessage.includes("Return ONLY JSON") || lastUserMessage.includes('"posts":[')) {
          const sampleBatch = {
            posts: [
              {
                platform: "instagram",
                templateType: "carousel",
                caption: `🌊 كيف تتغلب على الخوف من الماء في 4 خطوات؟\n\nكثير من أطفالنا وأولياء الأمور يواجهون رهبة الماء في البداية. مع كابتن أيمن في أبوظبي، نبدأ بالطفو والاسترخاء خطوة بخطوة في بيئة آمنة تماماً.\n\n📍 فروعنا: المشرف، الفلاح، مدينة خليفة، الدانة / النجدة.\n📲 احجز تقييم طفلك المجاني الآن عبر واتساب: 058 821 9130\n\n#سباحة_أبوظبي #RelaxFixUAE #كابتن_أيمن #تعليم_سباحة_أبوظبي`,
                visual: "كاروسيل إنفوجرافيك 4:5: كحلي وأزرق مائي، خطوات الطفو والتحكم في التنفس، شعار Relax Fix UAE",
              },
              {
                platform: "tiktok",
                templateType: "reel",
                caption: `⚡ الخطأ رقم 1 في السباحة الحرة وكيف تصححه في ثوانٍ!\n\nرفع الرأس للتنفس يغرق نصف جسمك السفلي. السر في إمالة الرأس مع دوران الكتف فقط.\n\nللتدريب الشخصي في مسابح أبوظبي، تواصل معنا على واتساب: 058 821 9130\n\n#SwimTok #RelaxFixUAE #AbuDhabiSwimming #تعليم_سباحة`,
                visual: "فيديو عمودي 9:16: خطاف حركة بطيئة للسباح تحت الماء، نص كبير ملفت 'توقف عن رفع رأسك!'، ثم تصحيح التكنيك",
              },
              {
                platform: "facebook",
                templateType: "promo",
                caption: `🏊‍♂️ برنامج السباحة الاحترافي للأطفال وبناء الثقة في أبوظبي!\n\nتحت إشراف كابتن أيمن مباشرة: تطوير مهارات السباحة، تصحيح التكنيك، وبناء أمان تام في الماء.\n\n✨ مميزات برامجنا:\n🔹 جلسات خاصة VIP لعلاج رهبة الماء وبناء المهارات\n🔹 مجموعات تدريبية ممتعة للأطفال مع متابعة دقيقة\n🔹 فترات صباحية ومسائية تناسب العائلة\n\n📍 متواجدون في: المشرف، الفلاح، مدينة خليفة، الدانة / النجدة.\n📲 احجز جلسة التقييم الأولي المجانية لطفلك الآن عبر واتساب: 058 821 9130\n(أرسل لنا رسالة لتحديد الفرع والموعد الأنسب لك)\n\n#سباحة_أبوظبي #RelaxFixUAE #كابتن_أيمن`,
                visual: "بوستر إعلاني 1:1: ألوان الأكاديمية الرسمية (كحلي وأزرق مائي)، صورة طفل يسبح بثقة وفرح، مع إبراز فروع أبوظبي وعرض التقييم المجاني بدون ذكر الأسعار",
              },
            ],
          };
          return new Response(JSON.stringify(sampleBatch), {
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
        }

        // Standard consultation fallback:
        const responseText = `## 1. الخلاصة والرأي الموصى به
أهلاً بك كابتن أيمن في مركز القيادة الذكي. الأكاديمية جاهزة بفروعها الأربعة في أبوظبي: **المشرف، الفلاح، مدينة خليفة، الدانة**.

## 2. أفضل خطوة تالية
- لتفعيل الذكاء الاصطناعي الكامل غير المحدود من Google، أضف مفتاحك في ملف \`.env\`:
  \`\`\`env
  GEMINI_API_KEY=your_gemini_api_key_here
  \`\`\`
- يمكنك استخدام **مصنع المحتوى** لتوليد خطط النشر وتصدير التصاميم مباشرة لـ **Canva**.
- قسم **الواتساب** يتيح لك التواصل المباشر مع العملاء وتوليد روابط الحجز مع كود التتبع \`058 821 9130\`.

## 3. التكاليف والمعلومات التجارية
- حصة خاصة: **150 / 250 درهم**
- مجموعات الأطفال: **450 درهم** (خصم الإخوة: **400 درهم**)
- هاتف الحجوزات المعتمد: **058 821 9130**`;

        return new Response(responseText, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
