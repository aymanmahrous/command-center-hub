import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Sparkles, Check, Copy, ExternalLink, RefreshCw, Save } from "lucide-react";
import type { ContentBatchItem } from "./content-batch";
import { BRAND } from "./content-strategy";

const posterStyles = [
  { id: "luxury", ar: "فاخر حديث", en: "Modern Luxury", paper: "#101f24", ink: "#faf4e5", accent: "#d9ae70" },
  { id: "sport", ar: "رياضي نشيط", en: "Sporty Dynamic", paper: "#05465f", ink: "#ffffff", accent: "#a8ffde" },
  { id: "editorial", ar: "تعليمي نظيف", en: "Clean Editorial", paper: "#f0f5f1", ink: "#133b3e", accent: "#20766f" },
  { id: "family", ar: "عائلي دافئ", en: "Warm Family", paper: "#ffefd9", ink: "#49372f", accent: "#944b36" },
] as const;

type PosterStyle = (typeof posterStyles)[number];
type Ratio = "1:1" | "4:5" | "9:16";

// Wrap first, then reduce the font to keep all copy inside its reserved area.
function drawTextBlock(ctx: CanvasRenderingContext2D, text: string, x: number, top: number, width: number,
  height: number, size: number, weight: number, family: string) {
  const words = text.trim().split(/\s+/);
  for (let fontSize = size; fontSize >= 12; fontSize -= 2) {
    ctx.font = `${weight} ${fontSize}px ${family}`;
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
    const leading = fontSize * 1.35;
    if (lines.length * leading > height && fontSize > 13) continue;
    const step = Math.min(leading, height / lines.length);
    const first = top + (height - lines.length * step) / 2 + step * 0.74;
    lines.forEach((value, index) => ctx.fillText(value, x, first + index * step, width));
    return;
  }
}

function drawPoster(canvas: HTMLCanvasElement, style: PosterStyle, ratio: Ratio, isAr: boolean, headline: string, points: string[]) {
  const width = canvas.width = 1080;
  const height = canvas.height = ratio === "9:16" ? 1920 : ratio === "4:5" ? 1350 : 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const sans = "'Segoe UI', system-ui, sans-serif";
  const centered = style.id === "family";
  const edge = isAr ? width - 96 : 96;
  ctx.fillStyle = style.paper;
  ctx.fillRect(0, 0, width, height);

  switch (style.id) {
    case "luxury":
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(32, 32, width - 64, height - 64);
      ctx.fillStyle = style.accent;
      ctx.fillRect(isAr ? width - 232 : 96, height * 0.22, 136, 4);
      break;
    case "sport": {
      const water = ctx.createLinearGradient(0, height, width, 0);
      water.addColorStop(0, "#062e54");
      water.addColorStop(1, "#007d87");
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#51dbca";
      ctx.lineWidth = 12;
      for (let lane = 0; lane < 3; lane++) {
        const x = isAr ? 210 + lane * 48 : width - 210 - lane * 48;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (isAr ? -230 : 230), height * 0.23);
        ctx.stroke();
      }
      break;
    }
    case "editorial":
      ctx.fillStyle = style.accent;
      ctx.fillRect(0, 0, width, 18);
      ctx.fillRect(72, height * 0.20, width - 144, 2);
      break;
    case "family":
      ctx.fillStyle = "#f8cb8e";
      ctx.beginPath();
      ctx.arc(0, 0, 235, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b7d8cd";
      ctx.beginPath();
      ctx.moveTo(0, height * 0.79);
      ctx.bezierCurveTo(340, height * 0.70, 680, height * 0.87, width, height * 0.76);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      break;
  }

  // Preserve the studio's swimmer-and-wave emblem on each palette.
  const markX = centered ? width / 2 : isAr ? width - 124 : 124;
  const markY = centered ? 78 : height * 0.115;
  ctx.strokeStyle = ctx.fillStyle = style.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(markX, markY, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(markX, markY - 9, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(markX - 23, markY + 8);
  ctx.bezierCurveTo(markX - 9, markY + 20, markX + 9, markY - 2, markX + 23, markY + 8);
  ctx.stroke();

  ctx.textAlign = centered ? "center" : isAr ? "right" : "left";
  const brandX = centered ? width / 2 : edge + (isAr ? -90 : 90);
  ctx.fillStyle = style.ink;
  ctx.font = `700 30px ${sans}`;
  ctx.fillText(BRAND.publicLine, brandX, centered ? 158 : markY - 2);
  ctx.font = `500 24px ${sans}`;
  ctx.fillText("أكاديمية ريلاكس فيكس للسباحة", brandX, centered ? 195 : markY + 36);

  ctx.direction = isAr ? "rtl" : "ltr";
  const titleTop = height * 0.225;
  drawTextBlock(ctx, headline, centered ? width / 2 : edge, titleTop, width - 192, height * 0.205,
    style.id === "sport" ? 84 : 68, style.id === "sport" ? 900 : 650,
    style.id === "luxury" ? "Georgia, 'Segoe UI', serif" : sans);

  const rowHeight = height * 0.092;
  points.forEach((point, index) => {
    const top = height * 0.46 + rowHeight * index;
    if (style.id === "editorial" || centered) {
      ctx.fillStyle = centered ? "#fff7ed" : "#ffffff";
      ctx.beginPath();
      ctx.roundRect(76, top, width - 152, rowHeight - 10, centered ? 38 : 8);
      ctx.fill();
    }
    ctx.fillStyle = style.accent;
    if (style.id === "editorial") {
      ctx.font = `700 29px ${sans}`;
      ctx.fillText(String(index + 1).padStart(2, "0"), edge, top + rowHeight / 2 + 5);
    } else if (!centered) {
      ctx.fillRect(isAr ? edge - 32 : edge, top + rowHeight / 2 - 4, 32, style.id === "sport" ? 9 : 2);
    }
    ctx.fillStyle = style.ink;
    drawTextBlock(ctx, point, centered ? width / 2 : edge + (isAr ? -64 : 64), top, width - 320,
      rowHeight - 10, 34, 500, sans);
  });

  const footerTop = height * 0.80;
  ctx.fillStyle = style.accent;
  ctx.fillRect(96, footerTop, width - 192, 2);
  ctx.fillStyle = style.ink;
  ctx.textAlign = "center";
  ctx.font = `700 30px ${sans}`;
  const location = BRAND.locations.map(place => isAr && place === "Al Mushrif · Abu Dhabi" ? "المشرف · أبوظبي" : place).join(" • ");
  ctx.fillText(location, width / 2, footerTop + (height - footerTop) * 0.27);
  // Isolate the international numbers so Arabic bidirectional layout keeps the leading plus.
  ctx.font = `600 27px ${sans}`;
  const booking = isAr ? "واتساب للرسائل والحجز" : "WhatsApp · messages & booking";
  const calls = isAr ? "هاتف الإدارة للمكالمات فقط" : "Admin · phone calls only";
  ctx.fillText(`${booking}   \u2066${BRAND.whatsapp}\u2069`, width / 2, footerTop + (height - footerTop) * 0.52);
  ctx.fillText(`${calls}   \u2066${BRAND.phone}\u2069`, width / 2, footerTop + (height - footerTop) * 0.74);
}

interface BrandedPosterStudioProps {
  item: ContentBatchItem;
  language: "ar" | "en";
  onClose?: () => void;
  onSaveDesign?: (file: File) => Promise<void>;
}

export function BrandedPosterStudio({ item, language, onClose, onSaveDesign }: BrandedPosterStudioProps) {
  const [downloading, setDownloading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"canva" | "gemini" | "error" | null>(null);
  const isAr = language === "ar";

  const caption = item.caption || item.topic || "";
  const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
  const hook = item.hook || lines[0] || (isAr ? "أكاديمية ريلاكس فيكس للسباحة" : BRAND.publicLine);

  const bulletLines = lines
    .filter((l) => l.startsWith("-") || l.startsWith("•") || l.startsWith("🔹") || l.startsWith("*") || /^\d+\)/.test(l))
    .slice(0, 3)
    .map((l) => l.replace(/^[-•🔹*\d\)]+\s*/, ""));

  const keyPoints = bulletLines.length > 0
    ? bulletLines
    : [
        isAr ? "تدريب خاص ومجموعات صغيرة حتى 4 متدربين" : "Private coaching and small groups up to 4 learners",
        isAr ? "بناء الثقة في الماء وتطوير التكنيك تدريجيًا" : "Build water confidence and improve technique progressively",
        isAr ? `الموقع: ${BRAND.locations.join(" · ")}` : `Location: ${BRAND.locations.join(" · ")}`,
      ];

  const isReelOrStory = /reel|story|9:16/i.test(item.contentType || item.platform);
  const [ratio, setRatio] = useState<"1:1" | "4:5" | "9:16">(isReelOrStory ? "9:16" : "1:1");
  const [style, setStyle] = useState<PosterStyle>(posterStyles[0]);
  const preview = useRef<HTMLCanvasElement>(null);
  const [headline, setHeadline] = useState(hook);
  const [pointsText, setPointsText] = useState(keyPoints.join("\n"));
  const editableKeyPoints = useMemo(() => pointsText.split("\n").map((point) => point.trim()).filter(Boolean).slice(0, 3), [pointsText]);
  useLayoutEffect(() => {
    if (preview.current) drawPoster(preview.current, style, ratio, isAr, headline, editableKeyPoints);
  }, [style, ratio, isAr, headline, editableKeyPoints]);

  const handlePosterAction = async (mode: "download" | "save" | "save-and-download" = "download") => {
    setDownloading(true);
    try {
      const canvas = preview.current;
      if (!canvas) throw new Error("Poster preview unavailable");

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setDownloading(false);
          return;
        }
        const fileName = `RelaxFix-CoachAyman-${item.platform}-${ratio.replace(":", "x")}-${Date.now().toString().slice(-4)}.png`;
        try {
          if (mode !== "download") {
            if (!onSaveDesign) throw new Error("SAVE_TO_DRAFT_UNAVAILABLE");
            await onSaveDesign(new File([blob], fileName, { type: "image/png" }));
          }
          if (mode !== "save") {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          }
        } finally {
          setDownloading(false);
        }
      }, "image/png");
    } catch {
      setDownloading(false);
    }
  };

  const copyText = async (text: string, target: "canva" | "gemini") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(target);
      window.setTimeout(() => setCopyStatus(null), 2500);
    } catch {
      setCopyStatus("error");
    }
  };

  const buildCanvaBrief = () => `[Canva Template Design Brief — ${BRAND.publicLine}]
Platform: ${item.platform}
Format: ${ratio}
Headline: ${headline}
Key points:\n${editableKeyPoints.map((point) => `- ${point}`).join("\n")}
Colors: Deep Navy (#020617), Cyan (#06B6D4), Gold (#F59E0B), White (#FFFFFF)
Locations: ${BRAND.locations.join(", ")}
Booking CTA: WhatsApp ${BRAND.whatsapp}
Policy: Do not add prices, unsupported claims, or extra contact details.`;

  const buildGeminiPrompt = () => [
    `Create one polished, premium social-media poster for ${BRAND.publicLine} in Abu Dhabi.`,
    `Format: ${ratio} for ${item.platform}. Compose the artwork safely inside the crop area.`,
    `Exact headline to render exactly as provided; do not translate or rewrite: «${headline}»`,
    "Supporting points: preserve the original language and wording; use right-to-left layout for Arabic:",
    ...editableKeyPoints.map((point) => `- ${point}`),
    `Footer: ${BRAND.locations.join(" • ")} | WhatsApp: ${BRAND.whatsapp}`,
    "Visual direction: elegant indoor swimming-pool atmosphere, clear blue water, natural premium lighting, confident and welcoming, safe for families; use deep navy, turquoise/cyan, white and restrained gold accents.",
    typeof item.visualPrompt === "string" && item.visualPrompt.trim() ? `Campaign visual direction: ${item.visualPrompt.trim().slice(0, 800)}` : "",
    typeof item.topic === "string" && item.topic.trim() ? `Campaign topic: ${item.topic.trim().slice(0, 300)}` : "",
    "Use clear hierarchy and generous spacing. Do not invent prices, discounts, awards, branches, phone numbers, or extra text. Do not imitate an official logo; use a simple swimming-wave motif only.",
  ].filter(Boolean).join("\n\n");

  const copyCanvaBrief = () => copyText(buildCanvaBrief(), "canva");
  const copyGeminiPrompt = () => copyText(buildGeminiPrompt(), "gemini");

  const openCanvaTool = () => {
    const canvaUrl = ratio === "9:16"
      ? "https://www.canva.com/create/instagram-stories/"
      : "https://www.canva.com/create/instagram-posts/";
    window.open(canvaUrl, "_blank", "noopener,noreferrer");
    void copyCanvaBrief();
  };

  const openGeminiTool = () => {
    window.open("https://gemini.google.com/app", "_blank", "noopener,noreferrer");
    void copyGeminiPrompt();
  };

  return (
    <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: "12px", background: "rgba(8, 47, 73, 0.4)", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>
            🏊‍♂️ {isAr ? "استوديو البوستر الرسمي للأكاديمية" : "Official Branded Poster Studio"} ({ratio})
          </strong>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
            {isAr ? "بوستر فوري عالي الدقة (1080px) مع شعار Relax Fix وموقع المسبح وبيانات التواصل" : "Instant 1080px HD poster with Relax Fix logo, pool location & booking details"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {onSaveDesign && (
            <button
              type="button"
              className="primary-button"
              onClick={() => void handlePosterAction("save")}
              disabled={downloading}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              {downloading ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
              {isAr ? "حفظ وربط بالمسودة" : "Save to draft"}
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={() => void handlePosterAction(onSaveDesign ? "save-and-download" : "download")}
            disabled={downloading}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
          >
            {downloading ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
            {onSaveDesign ? (isAr ? "حفظ وربط وتنزيل PNG" : "Save, link & download PNG") : (isAr ? "تحميل بوستر PNG" : "Download Poster PNG")}
          </button>
          {onClose && (
            <button type="button" className="secondary" onClick={onClose} style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}>
              {isAr ? "إغلاق" : "Close"}
            </button>
          )}
        </div>
      </div>

      <fieldset style={{ margin: "0 0 1rem", padding: "0.6rem", border: "1px solid #475569", borderRadius: 8 }}>
        <legend>{isAr ? "نمط البوستر" : "Poster style"}</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {posterStyles.map(option => (
            <button key={option.id} type="button" aria-pressed={option.id === style.id} onClick={() => setStyle(option)}
              style={{ background: option.paper, color: option.ink, border: `2px solid ${option.accent}`, borderRadius: 8, padding: "0.45rem 0.75rem", cursor: "pointer" }}>
              {option.id === style.id && <Check size={14} aria-hidden="true" />} {isAr ? option.ar : option.en}
            </button>
          ))}
        </div>
      </fieldset>
      <canvas ref={preview} role="img" aria-label={isAr ? `معاينة البوستر: ${style.ar}` : `Poster preview: ${style.en}`}
        style={{ display: "block", margin: "0 auto 1rem", maxWidth: "100%", maxHeight: 420, width: "auto", height: "auto" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem", marginBottom: "0.8rem" }}>
        <label style={{ display: "grid", gap: "0.3rem", color: "#cbd5e1", fontSize: "0.8rem" }}>
          {isAr ? "عنوان التصميم" : "Design headline"}
          <input value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={160} style={{ width: "100%", minWidth: 0, padding: "0.55rem", borderRadius: "8px", border: "1px solid #334155", background: "#081321", color: "#f8fafc" }} />
        </label>
        <label style={{ display: "grid", gap: "0.3rem", color: "#cbd5e1", fontSize: "0.8rem" }}>
          {isAr ? "النقاط الرئيسية (كل نقطة في سطر)" : "Key points (one per line)"}
          <textarea value={pointsText} onChange={(event) => setPointsText(event.target.value)} rows={3} maxLength={600} style={{ width: "100%", minWidth: 0, resize: "vertical", padding: "0.55rem", borderRadius: "8px", border: "1px solid #334155", background: "#081321", color: "#f8fafc" }} />
        </label>
        <label style={{ display: "grid", gap: "0.3rem", color: "#cbd5e1", fontSize: "0.8rem" }}>
          {isAr ? "مقاس التصميم" : "Design format"}
          <select value={ratio} onChange={(event) => setRatio(event.target.value as "1:1" | "4:5" | "9:16")} style={{ width: "100%", padding: "0.55rem", borderRadius: "8px", border: "1px solid #334155", background: "#081321", color: "#f8fafc" }}>
            <option value="1:1">1:1 · Square</option>
            <option value="4:5">4:5 · Portrait</option>
            <option value="9:16">9:16 · Story / Reel</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.8rem" }}>
        <button type="button" className="secondary" onClick={openCanvaTool} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <ExternalLink size={12} />
          {isAr ? "فتح Canva للمقاس" : "Open Canva for Ratio"}
        </button>
        <button type="button" className="secondary" onClick={() => void copyCanvaBrief()} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          {copyStatus === "canva" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          {isAr ? (copyStatus === "canva" ? "تم نسخ مواصفات Canva" : "نسخ مواصفات Canva") : (copyStatus === "canva" ? "Canva brief copied" : "Copy Canva Brief")}
        </button>
        <button type="button" className="secondary" onClick={openGeminiTool} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <Sparkles size={12} />
          {isAr ? "فتح Gemini ونسخ البرومبت" : "Open Gemini & copy prompt"}
        </button>
        <button type="button" className="secondary" onClick={() => void copyGeminiPrompt()} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          {copyStatus === "gemini" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          {isAr ? (copyStatus === "gemini" ? "تم نسخ برومبت Gemini" : "نسخ برومبت Gemini") : (copyStatus === "gemini" ? "Gemini prompt copied" : "Copy Gemini Prompt")}
        </button>
      </div>
      <p role="status" aria-live="polite" style={{ margin: "0.5rem 0 0", color: copyStatus === "error" ? "#fca5a5" : "#94a3b8", fontSize: "0.78rem" }}>
        {copyStatus === "error"
          ? (isAr ? "تعذر نسخ النص. اسمح للموقع بالوصول إلى الحافظة ثم أعد المحاولة." : "Could not copy. Allow clipboard access for this site and try again.")
          : (isAr ? "راجع النص العربي الناتج من Gemini قبل استخدامه؛ Canva أو PNG المحلي أنسب عندما يلزم تطابق النص حرفيًا." : "Review Gemini's Arabic text before use; Canva or the local PNG is better when exact wording matters.")}
      </p>
    </div>
  );
}
