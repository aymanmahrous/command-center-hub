import { useState } from "react";
import { Download, Sparkles, Check, Copy, ExternalLink, RefreshCw, Image as ImageIcon } from "lucide-react";
import type { ContentBatchItem } from "./content-batch";

interface BrandedPosterStudioProps {
  item: ContentBatchItem;
  language: "ar" | "en";
  onClose?: () => void;
  onSaveDesign?: (file: File) => Promise<void>;
}

export function BrandedPosterStudio({ item, language, onClose, onSaveDesign }: BrandedPosterStudioProps) {
  const [downloading, setDownloading] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const isAr = language === "ar";

  const caption = item.caption || item.topic || "";
  const lines = caption.split("\n").map((l) => l.trim()).filter(Boolean);
  const hook = item.hook || lines[0] || (isAr ? "أكاديمية ريلاكس فيكس للسباحة — كوتش أيمن" : "Relax Fix Swimming Academy — Coach Ayman");

  const bulletLines = lines
    .filter((l) => l.startsWith("-") || l.startsWith("•") || l.startsWith("🔹") || l.startsWith("*") || /^\d+\)/.test(l))
    .slice(0, 3)
    .map((l) => l.replace(/^[-•🔹*\d\)]+\s*/, ""));

  const keyPoints = bulletLines.length > 0
    ? bulletLines
    : [
        isAr ? "تدريب خاص VIP ومجموعات بحد أقصى 4 أطفال" : "VIP Private & Small Groups (Strict Max 4 Kids)",
        isAr ? "علاج رهبة الماء وتصحيح التكنيك تدريجياً" : "Gentle Aquaphobia & Technique Progression",
        isAr ? "فروع أبوظبي: المشرف، الفلاح، مدينة خليفة، الدانة" : "Abu Dhabi Pools: Al Mushrif, Al Falah, Khalifa City, Al Danah",
      ];

  const isReelOrStory = /reel|story|9:16/i.test(item.contentType || item.platform);
  const ratio = isReelOrStory ? "9:16" : "1:1";

  const handlePosterAction = async (mode: "download" | "save" = "download") => {
    setDownloading(true);
    try {
      const width = 1080;
      const height = ratio === "9:16" ? 1920 : 1080;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // 1. Deep Ocean Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, "#020617");
      bgGrad.addColorStop(0.35, "#082f49");
      bgGrad.addColorStop(0.7, "#0369a1");
      bgGrad.addColorStop(1, "#0284c7");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Ambient Water Glow
      ctx.save();
      ctx.globalAlpha = 0.18;
      const glowGrad = ctx.createRadialGradient(width * 0.5, height * 0.3, 50, width * 0.5, height * 0.3, width * 0.6);
      glowGrad.addColorStop(0, "#38bdf8");
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Ambient decorative curves
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const yOffset = height * 0.45 + i * 140;
        ctx.moveTo(0, yOffset);
        ctx.bezierCurveTo(width * 0.25, yOffset - 60, width * 0.75, yOffset + 60, width, yOffset);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Top Emblem
      const emblemCenterY = height > 1400 ? 220 : 180;
      const emblemRadius = 75;

      ctx.save();
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(width / 2, emblemCenterY, emblemRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#f59e0b"; // Gold accent
      ctx.stroke();
      ctx.restore();

      // Inner cyan circle
      ctx.beginPath();
      ctx.arc(width / 2, emblemCenterY, emblemRadius - 8, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#06b6d4";
      ctx.stroke();

      // Swimmer wave icon
      ctx.save();
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      const headX = width / 2;
      const headY = emblemCenterY - 20;
      ctx.arc(headX, headY, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(width / 2 - 40, emblemCenterY + 10);
      ctx.bezierCurveTo(width / 2 - 20, emblemCenterY + 25, width / 2 + 20, emblemCenterY - 5, width / 2 + 40, emblemCenterY + 10);
      ctx.stroke();
      ctx.restore();

      // Brand Title
      ctx.textAlign = "center";
      ctx.font = "bold 32px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("RELAX FIX UAE SWIMMING ACADEMY", width / 2, emblemCenterY + 115);

      ctx.font = "600 24px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("أكاديمية كابتن أيمن للسباحة · أبوظبي", width / 2, emblemCenterY + 155);

      // Badge pill
      const badgeY = emblemCenterY + 205;
      ctx.save();
      ctx.fillStyle = "rgba(6, 182, 212, 0.25)";
      ctx.strokeStyle = "rgba(6, 182, 212, 0.6)";
      ctx.lineWidth = 2;
      const badgeW = 460;
      const badgeH = 46;
      ctx.beginPath();
      ctx.roundRect((width - badgeW) / 2, badgeY, badgeW, badgeH, 23);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#e0f2fe";
      ctx.fillText(
        isReelOrStory ? "🎯 تصحيح التكنيك وتطوير المهارات" : "🏊‍♂️ تدريب سباحة احترافي في أبوظبي",
        width / 2,
        badgeY + 30
      );
      ctx.restore();

      // 4. Headline
      const hookStartY = badgeY + 110;
      ctx.font = `bold ${height > 1400 ? 54 : 44}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 15;

      const words = hook.split(" ");
      let line = "";
      let curY = hookStartY;
      const maxW = width - 160;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxW && n > 0) {
          ctx.fillText(line.trim(), width / 2, curY);
          line = words[n] + " ";
          curY += height > 1400 ? 75 : 62;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), width / 2, curY);
      ctx.shadowBlur = 0;

      // 5. Card with Key Points
      const cardStartY = curY + 60;
      const cardW = width - 160;
      const cardH = keyPoints.length * 85 + 40;

      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect((width - cardW) / 2, cardStartY, cardW, cardH, 24);
      ctx.fill();
      ctx.stroke();

      keyPoints.forEach((point, idx) => {
        const rowY = cardStartY + 55 + idx * 85;
        ctx.beginPath();
        ctx.arc((width + cardW) / 2 - 50, rowY - 8, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();

        ctx.font = "bold 26px 'Segoe UI', system-ui, sans-serif";
        ctx.fillStyle = "#f8fafc";
        ctx.textAlign = "right";
        ctx.fillText(point, (width + cardW) / 2 - 75, rowY);
      });
      ctx.restore();

      // 6. Branches
      const branchesY = height > 1400 ? height - 320 : height - 260;
      ctx.textAlign = "center";
      ctx.font = "bold 24px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("📍 فروعنا في أبوظبي:", width / 2, branchesY);

      ctx.font = "600 22px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("المشرف  •  الفلاح  •  مدينة خليفة  •  الدانة / النجدة", width / 2, branchesY + 38);

      // 7. WhatsApp CTA Pill
      const ctaY = height - 150;
      const ctaW = width - 180;
      const ctaH = 90;

      ctx.save();
      const ctaGrad = ctx.createLinearGradient((width - ctaW) / 2, 0, (width + ctaW) / 2, 0);
      ctaGrad.addColorStop(0, "#059669");
      ctaGrad.addColorStop(1, "#10b981");
      ctx.fillStyle = ctaGrad;
      ctx.shadowColor = "rgba(16, 185, 129, 0.5)";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.roundRect((width - ctaW) / 2, ctaY, ctaW, ctaH, 45);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.font = "bold 28px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.fillText("📱 احجز تقييم طفلك المجاني: 058 821 9130", width / 2, ctaY + 55);
      ctx.restore();

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setDownloading(false);
          return;
        }
        const fileName = `RelaxFix-CoachAyman-${item.platform}-${ratio.replace(":", "x")}-${Date.now().toString().slice(-4)}.png`;
        try {
          if (mode === "save") {
            if (!onSaveDesign) throw new Error("SAVE_TO_DRAFT_UNAVAILABLE");
            await onSaveDesign(new File([blob], fileName, { type: "image/png" }));
          } else {
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

  const copyCanvaBrief = async () => {
    const briefText = `[Canva Template Design Brief — Relax Fix UAE / Coach Ayman]
Platform: ${item.platform} (${ratio})
Headline: ${hook}
Colors: Deep Navy (#020617), Cyan (#06B6D4), Gold (#F59E0B), White (#FFFFFF)
Branches: Al Mushrif, Al Falah, Khalifa City, Al Danah
Booking CTA: WhatsApp 058 821 9130`;
    await navigator.clipboard.writeText(briefText);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  const openCanvaTool = () => {
    void copyCanvaBrief();
    const canvaUrl = ratio === "9:16"
      ? "https://www.canva.com/create/instagram-stories/"
      : "https://www.canva.com/create/instagram-posts/";
    window.open(canvaUrl, "_blank", "noopener");
  };

  return (
    <div style={{ marginTop: "1rem", padding: "1rem", borderRadius: "12px", background: "rgba(8, 47, 73, 0.4)", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>
            🏊‍♂️ {isAr ? "استوديو البوستر الرسمي للأكاديمية" : "Official Branded Poster Studio"} ({ratio})
          </strong>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
            {isAr ? "بوستر فوري عالي الدقة (1080px) مع شعار Relax Fix وفروع أبوظبي ورقم الواتساب" : "Instant 1080px HD poster with Relax Fix logo, branches & WhatsApp"}
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
            onClick={() => void handlePosterAction("download")}
            disabled={downloading}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
          >
            {downloading ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
            {isAr ? "تحميل بوستر PNG" : "Download Poster PNG"}
          </button>
          {onClose && (
            <button type="button" className="secondary" onClick={onClose} style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem" }}>
              {isAr ? "إغلاق" : "Close"}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.8rem" }}>
        <button type="button" className="secondary" onClick={openCanvaTool} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <ExternalLink size={12} />
          {isAr ? "فتح Canva للمقاس" : "Open Canva for Ratio"}
        </button>
        <button type="button" className="secondary" onClick={() => void copyCanvaBrief()} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          {copiedBrief ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          {isAr ? "نسخ مواصفات التصميم" : "Copy Design Brief"}
        </button>
      </div>
    </div>
  );
}
