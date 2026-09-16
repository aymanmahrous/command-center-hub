type Area = {
  id: string;
  icon: string;
  ar: string;
  en: string;
  sections: string[];
};

const AREAS: Area[] = [
  { id: 'home', icon: '⌂', ar: 'الرئيسية', en: 'Home', sections: ['dashboard'] },
  { id: 'customers', icon: '👥', ar: 'العملاء', en: 'Customers', sections: ['crm', 'inbox', 'radar'] },
  { id: 'growth', icon: '📣', ar: 'النمو', en: 'Growth', sections: ['content', 'media', 'analytics'] },
  { id: 'bookings', icon: '📅', ar: 'الحجوزات', en: 'Bookings', sections: ['planner'] },
  { id: 'more', icon: '☰', ar: 'المزيد', en: 'More', sections: ['automations', 'integrations', 'archive'] },
];

const SECTION_IDS = ['dashboard', 'inbox', 'crm', 'automations', 'content', 'planner', 'media', 'archive', 'analytics', 'integrations', 'radar'];

window.CC_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
window.CC_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let sectionButtons = new Map<string, HTMLButtonElement>();
let desktopNav: HTMLElement | null = null;
let mobileNav: HTMLElement | null = null;
let mobileSub: HTMLSelectElement | null = null;

const isArabic = () => document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar';
const label = (area: Area) => (isArabic() ? area.ar : area.en);

function currentSection() {
  for (const [id, button] of sectionButtons) {
    if (button.isConnected && button.classList.contains('active')) return id;
  }
  return 'dashboard';
}

function currentArea() {
  const section = currentSection();
  return AREAS.find((area) => area.sections.includes(section)) || AREAS[0];
}

function go(section: string) {
  sectionButtons.get(section)?.click();
}

function createSubmenu(area: Area, className: string) {
  const select = document.createElement('select');
  select.className = className;
  select.setAttribute('aria-label', label(area));
  area.sections.forEach((id) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = sectionButtons.get(id)?.textContent?.trim() || id;
    select.append(option);
  });
  select.value = currentSection();
  select.onchange = () => go(select.value);
  return select;
}

function installStyles() {
  if (document.getElementById('cc-five-style')) return;
  const style = document.createElement('style');
  style.id = 'cc-five-style';
  style.textContent = `
    .cc-five-nav{display:grid;gap:6px;margin-top:14px}
    .cc-five-nav button,.cc-five-mobile button,.cc-sub,.cc-mobile-sub{font:inherit}
    .cc-five-nav button{display:flex;gap:9px;align-items:center;padding:11px 12px;border:0;border-radius:12px;background:transparent;color:inherit;text-align:start;cursor:pointer}
    .cc-five-nav button.active,.cc-five-nav button:hover{background:rgba(255,255,255,.1)}
    .cc-sub{margin:0 8px 6px;padding:8px;border-radius:9px}
    .cc-five-mobile{display:none}
    @media(max-width:800px){
      .cc-five-nav{display:none}
      .cc-five-mobile{position:fixed;z-index:1000;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);padding:6px 5px max(6px,env(safe-area-inset-bottom));background:#0f172af5}
      .cc-five-mobile button{min-height:52px;border:0;border-radius:10px;background:transparent;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
      .cc-five-mobile button.active{background:#ffffff1f}
      .cc-five-mobile b{font-size:18px}.cc-five-mobile span{font-size:11px}
      .cc-mobile-sub{position:fixed;z-index:1001;left:8px;right:8px;bottom:72px;width:calc(100% - 16px);padding:9px;background:#0f172af7;color:#fff;border-radius:12px}
      .workspace{padding-bottom:88px!important}
    }
  `;
  document.head.append(style);
}

function draw() {
  if (!desktopNav || !mobileNav) return;
  const activeArea = currentArea();
  desktopNav.replaceChildren(...AREAS.map((area) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<span>${area.icon}</span><span>${label(area)}</span>`;
    button.className = area.id === activeArea.id ? 'active' : '';
    button.onclick = () => go(area.sections[0]);
    return button;
  }));

  mobileNav.replaceChildren(...AREAS.map((area) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<b>${area.icon}</b><span>${label(area)}</span>`;
    button.className = area.id === activeArea.id ? 'active' : '';
    button.onclick = () => go(area.sections[0]);
    return button;
  });

  mobileSub?.remove();
  mobileSub = null;
  if (activeArea.sections.length > 1) {
    mobileSub = createSubmenu(activeArea, 'cc-mobile-sub');
    document.body.append(mobileSub);
  }

  if (activeArea.id === 'home') ensureCoachBrainButton();
  else document.getElementById('cc-cb-launch')?.remove();
}

function ensureCoachBrainButton() {
  if (document.getElementById('cc-cb-launch')) return;
  const button = document.createElement('button');
  button.id = 'cc-cb-launch';
  button.type = 'button';
  button.textContent = '🧠 Coach Brain';
  button.style.cssText = 'position:fixed;z-index:1002;bottom:76px;inset-inline-end:12px;border:0;border-radius:999px;padding:9px 14px;background:#0ea5e9;color:#fff;font:700 13px inherit;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer';
  button.onclick = openCoachBrain;
  document.body.append(button);
}

function openCoachBrain() {
  if (document.getElementById('cc-coach-brain')) return;
  const overlay = document.createElement('div');
  overlay.id = 'cc-coach-brain';
  overlay.dir = isArabic() ? 'rtl' : 'ltr';
  overlay.innerHTML = `
    <div class="cc-cb-backdrop"></div>
    <section class="cc-cb-panel" role="dialog" aria-modal="true" aria-labelledby="cc-cb-title">
      <button class="cc-cb-close" type="button" aria-label="Close">×</button>
      <div class="cc-cb-head"><strong id="cc-cb-title">🧠 Coach Brain</strong><span>بحث آمن بمصادر حديثة</span></div>
      <textarea class="cc-cb-input" maxlength="5000" rows="6" placeholder="اكتب أي سؤال عن السباحة أو التدريب أو اللياقة المائية..."></textarea>
      <button class="cc-cb-search" type="button">ابحث وحلل</button>
      <div class="cc-cb-status" aria-live="polite"></div><article class="cc-cb-answer"></article><div class="cc-cb-sources"></div>
    </section>`;
  const style = document.createElement('style');
  style.textContent = `.cc-cb-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.72);z-index:2000}.cc-cb-panel{position:fixed;z-index:2001;inset:5vh 5vw;max-width:1100px;margin:auto;overflow:auto;padding:22px;border-radius:22px;background:#0f172a;color:#fff;box-shadow:0 20px 70px rgba(0,0,0,.4)}.cc-cb-close{position:absolute;inset-inline-end:14px;top:10px;border:0;background:transparent;color:inherit;font-size:30px;cursor:pointer}.cc-cb-head{display:grid;gap:5px;margin-bottom:14px;padding-inline-end:35px}.cc-cb-head strong{font-size:24px}.cc-cb-head span{opacity:.7}.cc-cb-input{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.35);border-radius:14px;background:#020617;color:inherit;padding:14px;font:inherit;line-height:1.6}.cc-cb-search{margin-top:12px;border:0;border-radius:12px;padding:12px 18px;background:#0ea5e9;color:#fff;font:inherit;font-weight:700;cursor:pointer}.cc-cb-search:disabled{opacity:.5}.cc-cb-status{min-height:28px;margin-top:12px;opacity:.75}.cc-cb-answer{white-space:pre-wrap;line-height:1.75;margin-top:10px}.cc-cb-sources{display:grid;gap:8px;margin-top:18px}.cc-cb-sources a{display:grid;gap:3px;padding:10px;border-radius:10px;background:rgba(148,163,184,.1);color:inherit;text-decoration:none}.cc-cb-sources small{opacity:.65;overflow-wrap:anywhere}@media(max-width:800px){.cc-cb-panel{inset:2vh 10px;padding:16px}.cc-cb-search{width:100%}}`;
  document.head.append(style);
  document.body.append(overlay);
  const close = () => overlay.remove();
  overlay.querySelector<HTMLButtonElement>('.cc-cb-close')!.onclick = close;
  overlay.querySelector<HTMLElement>('.cc-cb-backdrop')!.onclick = close;
  const input = overlay.querySelector<HTMLTextAreaElement>('.cc-cb-input')!;
  const status = overlay.querySelector<HTMLElement>('.cc-cb-status')!;
  const answer = overlay.querySelector<HTMLElement>('.cc-cb-answer')!;
  const sources = overlay.querySelector<HTMLElement>('.cc-cb-sources')!;
  const search = overlay.querySelector<HTMLButtonElement>('.cc-cb-search')!;
  search.onclick = async () => {
    const question = input.value.trim();
    if (!question) return;
    const raw = sessionStorage.getItem('relaxfix-command-session');
    let token = '';
    try { token = JSON.parse(raw || '{}').accessToken || ''; } catch {}
    const base = String(window.CC_SUPABASE_URL || '').replace(/\/$/, '');
    const key = String(window.CC_SUPABASE_KEY || '');
    if (!token || !base || !key) { status.textContent = 'تعذر التحقق من جلسة الموظف.'; return; }
    search.disabled = true; answer.textContent = ''; sources.replaceChildren(); status.textContent = 'جاري البحث في المصادر وتحليل الأدلة...';
    try {
      const response = await fetch(`${base}/functions/v1/coach-brain-research`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${token}` }, body: JSON.stringify({ question }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error();
      answer.textContent = payload.answer || 'لم تصل إجابة.';
      (payload.sources || []).slice(0, 8).forEach((source: { url?: string; title?: string }) => {
        const link = document.createElement('a'); link.href = source.url || '#'; link.target = '_blank'; link.rel = 'noreferrer';
        const strong = document.createElement('strong'); strong.textContent = source.title || source.url || '';
        const small = document.createElement('small'); small.textContent = source.url || '';
        link.append(strong, small); sources.append(link);
      });
      status.textContent = 'تم البحث والتحليل. السؤال لا يُحفظ في سجل سباح.';
    } catch { status.textContent = 'تعذر تنفيذ البحث الآن. لم يتم إنشاء سجل للسباح.'; }
    finally { search.disabled = false; }
  };
  input.focus();
}

function install() {
  const oldNav = document.querySelector('.app-shell aside nav') as HTMLElement | null;
  if (!oldNav) return false;
  const buttons = [...oldNav.querySelectorAll('button')].slice(0, SECTION_IDS.length) as HTMLButtonElement[];
  if (buttons.length !== SECTION_IDS.length) return false;
  sectionButtons = new Map(SECTION_IDS.map((id, index) => [id, buttons[index]]));
  oldNav.hidden = true;
  if (!desktopNav || !desktopNav.isConnected) {
    desktopNav = document.createElement('nav'); desktopNav.className = 'cc-five-nav'; desktopNav.setAttribute('aria-label', isArabic() ? 'الأقسام الرئيسية' : 'Main areas'); oldNav.after(desktopNav);
  }
  if (!mobileNav || !mobileNav.isConnected) {
    mobileNav = document.createElement('nav'); mobileNav.className = 'cc-five-mobile'; mobileNav.setAttribute('aria-label', isArabic() ? 'التنقل الرئيسي' : 'Main navigation'); document.body.append(mobileNav);
  }
  installStyles();
  draw();
  return true;
}

const observer = new MutationObserver(() => { if (install()) draw(); });
observer.observe(document.body, { childList: true, subtree: true });
[50, 500, 1500].forEach((delay) => setTimeout(() => { install(); draw(); }, delay));
