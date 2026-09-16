import { openCommandCenterWorkspace } from './command-center-workspace';

type Area = { id: string; icon: string; ar: string; en: string; sections: string[] };
const AREAS: Area[] = [
  { id: 'home', icon: '⌂', ar: 'الرئيسية', en: 'Home', sections: ['dashboard'] },
  { id: 'customers', icon: '👥', ar: 'العملاء', en: 'Customers', sections: ['crm', 'inbox', 'radar'] },
  { id: 'growth', icon: '📣', ar: 'النمو', en: 'Growth', sections: ['content', 'media', 'analytics'] },
  { id: 'bookings', icon: '📅', ar: 'الحجوزات', en: 'Bookings', sections: ['planner'] },
  { id: 'more', icon: '☰', ar: 'المزيد', en: 'More', sections: ['automations', 'integrations', 'archive'] },
];
const SECTION_IDS = ['dashboard', 'inbox', 'crm', 'automations', 'content', 'planner', 'media', 'archive', 'analytics', 'integrations', 'radar'];
const ICON_CLASSES: Record<string, string> = {
  dashboard: 'lucide-layout-dashboard', inbox: 'lucide-inbox', crm: 'lucide-contact-round', automations: 'lucide-workflow',
  content: 'lucide-bot', planner: 'lucide-calendar-days', media: 'lucide-library', archive: 'lucide-library', analytics: 'lucide-bar-chart-3',
  integrations: 'lucide-settings-2', radar: 'lucide-shield-alert',
};
const TEXT_LABELS: Record<string, string[]> = { media: ['مكتبة الوسائط', 'Media Library'], archive: ['الأرشيف الضخم', 'Massive Archive'] };
window.CC_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
window.CC_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
let sectionButtons = new Map<string, HTMLButtonElement>();
let desktopNav: HTMLElement | null = null;
let mobileNav: HTMLElement | null = null;
let legacyNav: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let timer = 0;
const isArabic = () => document.documentElement.dir === 'rtl' || document.documentElement.lang === 'ar';
const label = (area: Area) => isArabic() ? area.ar : area.en;
function currentSection() { for (const [id, button] of sectionButtons) if (button.isConnected && button.classList.contains('active')) return id; return 'dashboard'; }
function currentArea() { const section = currentSection(); return AREAS.find((area) => area.sections.includes(section)) || AREAS[0]; }
function go(section: string) { sectionButtons.get(section)?.click(); }
function findButton(nav: HTMLElement, id: string) {
  const icon = ICON_CLASSES[id];
  const byIcon = [...nav.querySelectorAll('button')].find((button) => button.querySelector(`svg.${icon}`)) as HTMLButtonElement | undefined;
  if (byIcon) return byIcon;
  return [...nav.querySelectorAll('button')].find((button) => (TEXT_LABELS[id] || []).some((text) => button.textContent?.includes(text))) as HTMLButtonElement | undefined || null;
}
function bind(nav: HTMLElement) {
  const next = new Map<string, HTMLButtonElement>();
  for (const id of SECTION_IDS) { const button = findButton(nav, id); if (!button) return false; next.set(id, button); }
  sectionButtons = next; return true;
}
function installStyles() {
  if (document.getElementById('cc-five-style')) return;
  const style = document.createElement('style'); style.id = 'cc-five-style'; style.textContent = `
    .cc-five-nav{display:grid;gap:6px;margin-top:14px}.cc-five-nav button,.cc-five-mobile button{font:inherit}.cc-five-nav button{display:flex;gap:9px;align-items:center;padding:11px 12px;border:0;border-radius:12px;background:transparent;color:inherit;text-align:start;cursor:pointer}.cc-five-nav button.active,.cc-five-nav button:hover{background:rgba(255,255,255,.1)}.cc-five-mobile{display:none}@media(max-width:800px){.cc-five-nav{display:none}.cc-five-mobile{position:fixed;z-index:1000;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);padding:6px 5px max(6px,env(safe-area-inset-bottom));background:#0f172af5}.cc-five-mobile button{min-height:52px;border:0;border-radius:10px;background:transparent;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}.cc-five-mobile button.active{background:#ffffff1f}.cc-five-mobile b{font-size:18px}.cc-five-mobile span{font-size:11px}.workspace{padding-bottom:88px!important}}
  `; document.head.append(style);
}
function draw() {
  if (!desktopNav || !mobileNav) return;
  const active = currentArea();
  desktopNav.replaceChildren(...AREAS.map((area) => { const b = document.createElement('button'); b.type='button'; b.innerHTML=`<span>${area.icon}</span><span>${label(area)}</span>`; b.className=area.id===active.id?'active':''; b.onclick=()=>go(area.sections[0]); return b; }));
  mobileNav.replaceChildren(...AREAS.map((area) => { const b=document.createElement('button'); b.type='button'; b.innerHTML=`<b>${area.icon}</b><span>${label(area)}</span>`; b.className=area.id===active.id?'active':''; b.onclick=()=>go(area.sections[0]); return b; }));
  if (active.id === 'home' && !document.getElementById('cc-cb-launch')) {
    const brain=document.createElement('button'); brain.id='cc-cb-launch'; brain.type='button'; brain.textContent='🧠 Coach Brain'; brain.style.cssText='position:fixed;z-index:1002;bottom:76px;inset-inline-end:12px;border:0;border-radius:999px;padding:9px 14px;background:#0ea5e9;color:#fff;font:700 13px inherit;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer'; brain.onclick=()=>openCommandCenterWorkspace(isArabic()?'ar':'en'); document.body.append(brain);
  } else if (active.id !== 'home') document.getElementById('cc-cb-launch')?.remove();
}
function install(nav: HTMLElement) {
  if (!bind(nav)) return;
  nav.hidden=true; legacyNav=nav; installStyles();
  if (!desktopNav?.isConnected) { desktopNav=document.createElement('nav'); desktopNav.className='cc-five-nav'; desktopNav.setAttribute('aria-label',isArabic()?'الأقسام الرئيسية':'Main areas'); nav.after(desktopNav); }
  if (!mobileNav?.isConnected) { mobileNav=document.createElement('nav'); mobileNav.className='cc-five-mobile'; mobileNav.setAttribute('aria-label',isArabic()?'التنقل الرئيسي':'Main navigation'); document.body.append(mobileNav); }
  draw(); observer?.disconnect(); observer=new MutationObserver(()=>{ window.clearTimeout(timer); timer=window.setTimeout(()=>{ if(legacyNav?.isConnected && bind(legacyNav)) draw(); },80); }); observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
function attempt() { const nav=document.querySelector('.app-shell aside nav') as HTMLElement | null; if(nav && nav!==legacyNav) install(nav); else if(nav && !sectionButtons.size) install(nav); }
[50,500,1500,3000].forEach((delay)=>window.setTimeout(attempt,delay));
new MutationObserver(()=>{ window.clearTimeout(timer); timer=window.setTimeout(attempt,100); }).observe(document.body,{childList:true,subtree:true});
new MutationObserver(()=>{ window.clearTimeout(timer); timer=window.setTimeout(draw,50); }).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
