import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, Copy, Edit3, FilePlus2, Link2, RefreshCw, RotateCcw, Search, Sparkles, Tag, Trash2 } from "lucide-react";
import type { Language } from "./i18n";
import "./knowledge-management.css";

type Session = { accessToken: string; displayName: string; role: string };
type Entry = { id: string; category: string; question: string | null; content: string; language: "ar" | "en"; is_active: boolean; created_at?: string; updated_at?: string; kind: "article" | "faq"; relationships: Link[] };
type Link = { id: string; category_id: string | null; skill_id: string | null; media_asset_id: string | null; content_item_id: string | null; created_at?: string };
type Taxonomy = { id: string; name: string; slug?: string; description?: string | null; archived_at?: string | null; category?: string | null; level?: string | null };
type Payload = { entries: Entry[]; categories: Taxonomy[]; skills: Taxonomy[]; analytics: { activeEntries: number; archivedEntries: number; linkedMedia: number; linkedContent: number; status: "available" | "incomplete_data" } };
const URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

async function rpc<T>(session: Session, name: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (!URL || !KEY) throw new Error("SETUP_REQUIRED");
  const response = await fetch(`${URL}/rest/v1/rpc/${name}`, { method: "POST", signal, headers: { apikey: KEY, Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) { const text = await response.text(); throw new Error(text.includes("SETUP_REQUIRED") ? "SETUP_REQUIRED" : text.includes("PERMISSION_DENIED") ? "PERMISSION_DENIED" : "MUTATION_FAILED"); }
  return await response.json() as T;
}

export default function KnowledgeManagement({ session, language, onSessionExpired }: { session: Session; language: Language; onSessionExpired: () => void }) {
  const ar = language === "ar";
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [languageFilter, setLanguageFilter] = useState<"all" | "ar" | "en">("all");
  const [tab, setTab] = useState<"entries" | "categories" | "skills">("entries");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [notice, setNotice] = useState("");
  const canWrite = ["super_admin", "admin", "coach", "content_manager"].includes(session.role);

  const load = () => {
    const controller = new AbortController(); setState("loading"); setError("");
    rpc<Payload>(session, "get_staff_knowledge_management", { p_search: query || null, p_language: languageFilter === "all" ? null : languageFilter, p_status: statusFilter }, controller.signal).then((value) => { setData(value); setState("ready"); }).catch((cause) => { if (cause instanceof DOMException && cause.name === "AbortError") return; if (cause instanceof Error && cause.message === "SESSION_EXPIRED") onSessionExpired(); else { setError(ar ? "تعذر تحميل المعرفة الحقيقية." : "The live Knowledge data could not be loaded."); setState("error"); } });
    return () => controller.abort();
  };
  useEffect(() => load(), [session.accessToken, query, statusFilter, languageFilter]);

  async function mutate(name: string, body: Record<string, unknown>, success: string) {
    setNotice("");
    try { await rpc(session, name, body); setNotice(success); load(); } catch (cause) { const code = cause instanceof Error ? cause.message : "MUTATION_FAILED"; if (code === "SESSION_EXPIRED") onSessionExpired(); else setNotice(code === "SETUP_REQUIRED" ? (ar ? "إعداد مطلوب: مزود التوليد غير متصل." : "Setup Required: the generation provider is not connected.") : code === "PERMISSION_DENIED" ? (ar ? "الصلاحية مطلوبة." : "Permission Required.") : (ar ? "فشل التغيير." : "Mutation failed.")); }
  }
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const title = ar ? "إدارة المعرفة" : "Knowledge management";
  return <div className="knowledge-workspace">
    <header className="knowledge-hero"><div><span className="eyebrow">KNOWLEDGE CRUD</span><h2>{title}</h2><p>{ar ? "مقالات وFAQ وتصنيفات ومهارات مرتبطة بالوسائط والمحتوى الحقيقي فقط." : "Articles, FAQs, categories, and skills linked to real media and content only."}</p></div><button type="button" className="refresh" onClick={load} disabled={state === "loading"}><RefreshCw size={16} />{ar ? "تحديث" : "Refresh"}</button></header>
    <div className="knowledge-safety"><strong>{ar ? "RBAC + RLS + سجل التدقيق" : "RBAC + RLS + Audit Log"}</strong><span>{ar ? "لا نشر تلقائي · لا بيانات وهمية" : "No automatic publishing · no fake data"}</span></div>
    {notice && <div className="knowledge-notice" role="status">{notice}</div>}
    <div className="knowledge-tabs" role="tablist">{([["entries", ar ? "المقالات وFAQ" : "Articles + FAQ"], ["categories", ar ? "التصنيفات" : "Categories"], ["skills", ar ? "المهارات" : "Skills"]] as const).map(([id, label]) => <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)}>{id === "entries" ? <FilePlus2 size={16} /> : id === "categories" ? <Tag size={16} /> : <Link2 size={16} />}{label}</button>)}</div>
    {state === "loading" && <p className="muted" role="status">{ar ? "جاري تحميل السجلات الحقيقية..." : "Loading live records..."}</p>}
    {state === "error" && <div className="error-box" role="alert">{error}</div>}
    {state === "ready" && tab === "entries" && <>
      <div className="knowledge-toolbar"><label><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ar ? "ابحث في العنوان والمحتوى والتصنيف" : "Search title, content, category"} /></label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option value="active">{ar ? "النشطة" : "Active"}</option><option value="archived">{ar ? "المؤرشفة" : "Archived"}</option><option value="all">{ar ? "الكل" : "All"}</option></select><select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value as typeof languageFilter)}><option value="all">{ar ? "كل اللغات" : "All languages"}</option><option value="ar">العربية</option><option value="en">English</option></select>{canWrite && <button type="button" onClick={() => setEditing({ id: "", category: "", question: null, content: "", language: language === "ar" ? "ar" : "en", is_active: true, kind: "article", relationships: [] })}><FilePlus2 size={16} />{ar ? "إضافة" : "Create"}</button>}</div>
      <div className="knowledge-metrics"><span>{ar ? "نشطة" : "Active"}: <b>{data?.analytics.activeEntries}</b></span><span>{ar ? "مؤرشفة" : "Archived"}: <b>{data?.analytics.archivedEntries}</b></span><span>{ar ? "وسائط مرتبطة" : "Linked media"}: <b>{data?.analytics.linkedMedia}</b></span><span>{ar ? "محتوى مرتبط" : "Linked content"}: <b>{data?.analytics.linkedContent}</b></span></div>
      <div className="knowledge-list">{entries.length === 0 ? <div className="knowledge-empty">{ar ? "لا توجد سجلات حقيقية بهذه المرشحات." : "No real records match these filters."}</div> : entries.map((entry) => <EntryCard key={entry.id} entry={entry} ar={ar} canWrite={canWrite} onEdit={() => setEditing(entry)} onAction={mutate} />)}</div>
    </>}
    {state === "ready" && tab !== "entries" && <TaxonomyPanel kind={tab} rows={tab === "categories" ? data?.categories ?? [] : data?.skills ?? []} ar={ar} canWrite={canWrite} onMutate={mutate} />}
    {editing && <EntryForm entry={editing} ar={ar} onClose={() => setEditing(null)} onSave={async (values) => { const name = editing.id ? "update_staff_knowledge_entry" : "create_staff_knowledge_entry"; await mutate(name, editing.id ? { p_id: editing.id, ...values } : values, ar ? "تم حفظ المعرفة." : "Knowledge saved."); setEditing(null); }} />}
  </div>;
}

function EntryCard({ entry, ar, canWrite, onEdit, onAction }: { entry: Entry; ar: boolean; canWrite: boolean; onEdit: () => void; onAction: (name: string, body: Record<string, unknown>, success: string) => Promise<void> }) {
  const relationCount = entry.relationships.length;
  return <article className="knowledge-card"><header><div><span className="knowledge-kind">{entry.kind === "faq" ? "FAQ" : "ARTICLE"} · {entry.language.toUpperCase()}</span><h3>{entry.question || entry.category}</h3></div><span className={entry.is_active ? "status-active" : "status-archived"}>{entry.is_active ? (ar ? "نشط" : "Active") : (ar ? "مؤرشف" : "Archived")}</span></header><p className="knowledge-category">{entry.category}</p><p className="knowledge-content">{entry.content}</p><div className="knowledge-relations"><span><Link2 size={14} />{ar ? "العلاقات" : "Relationships"}: {relationCount}</span>{entry.relationships.slice(0, 3).map((link) => <small key={link.id}>{link.media_asset_id ? `Media ${link.media_asset_id.slice(0, 8)}` : link.content_item_id ? `Content ${link.content_item_id.slice(0, 8)}` : link.skill_id ? `Skill ${link.skill_id.slice(0, 8)}` : `Category ${link.category_id?.slice(0, 8)}`}</small>)}</div><footer>{canWrite && <><button type="button" onClick={onEdit}><Edit3 size={14} />{ar ? "تعديل" : "Edit"}</button><button type="button" onClick={() => void onAction("duplicate_staff_knowledge_entry", { p_id: entry.id }, ar ? "تم إنشاء نسخة حقيقية." : "Real duplicate created.")}><Copy size={14} />{ar ? "نسخ" : "Duplicate"}</button><button type="button" onClick={() => void onAction("set_staff_knowledge_entry_archived", { p_id: entry.id, p_archived: entry.is_active }, ar ? (entry.is_active ? "تمت الأرشفة." : "تمت الاستعادة.") : (entry.is_active ? "Archived." : "Restored."))}>{entry.is_active ? <Archive size={14} /> : <RotateCcw size={14} />}{entry.is_active ? (ar ? "أرشفة" : "Archive") : (ar ? "استعادة" : "Restore")}</button><button type="button" onClick={() => void onAction("generate_staff_knowledge_content_draft", { p_entry_id: entry.id }, ar ? "تم إنشاء مسودة." : "Draft created.")}><Sparkles size={14} />{ar ? "توليد مسودة" : "Generate draft"}</button></>}</footer></article>;
}

function EntryForm({ entry, ar, onClose, onSave }: { entry: Entry; ar: boolean; onClose: () => void; onSave: (values: Record<string, unknown>) => Promise<void> }) {
  const [category, setCategory] = useState(entry.category); const [question, setQuestion] = useState(entry.question ?? ""); const [content, setContent] = useState(entry.content); const [lang, setLang] = useState(entry.language); const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setSaving(true); try { await onSave({ p_category: category, p_question: question || null, p_content: content, p_language: lang }); } finally { setSaving(false); } }
  return <div className="knowledge-modal"><form onSubmit={(e) => void submit(e)}><h3>{entry.id ? (ar ? "تعديل المعرفة" : "Edit Knowledge") : (ar ? "إضافة معرفة" : "Create Knowledge")}</h3><label>{ar ? "التصنيف" : "Category"}<input required value={category} onChange={(e) => setCategory(e.target.value)} /></label><label>{ar ? "السؤال (اتركه فارغًا للمقال)" : "Question (blank for article)"}<input value={question} onChange={(e) => setQuestion(e.target.value)} /></label><label>{ar ? "المحتوى" : "Content"}<textarea required rows={8} value={content} onChange={(e) => setContent(e.target.value)} /></label><label>{ar ? "اللغة" : "Language"}<select value={lang} onChange={(e) => setLang(e.target.value as "ar" | "en")}><option value="ar">العربية</option><option value="en">English</option></select></label><div className="knowledge-modal-actions"><button type="button" className="secondary" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</button><button type="submit" disabled={saving}>{saving ? (ar ? "جاري الحفظ" : "Saving") : (ar ? "حفظ" : "Save")}</button></div></form></div>;
}

function TaxonomyPanel({ kind, rows, ar, canWrite, onMutate }: { kind: "categories" | "skills"; rows: Taxonomy[]; ar: boolean; canWrite: boolean; onMutate: (name: string, body: Record<string, unknown>, success: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [description, setDescription] = useState("");
  const create = async (e: FormEvent) => { e.preventDefault(); if (!name.trim()) return; const isCategory = kind === "categories"; await onMutate(isCategory ? "create_staff_knowledge_category" : "create_staff_knowledge_skill", isCategory ? { p_name: name, p_slug: slug || name.toLowerCase().replace(/\s+/g, "-"), p_description: description || null } : { p_name: name, p_category: slug || null, p_level: null, p_description: description || null }, ar ? "تم الحفظ." : "Saved."); setName(""); setSlug(""); setDescription(""); };
  return <section className="taxonomy-panel"><form className="taxonomy-form" onSubmit={(e) => void create(e)}><h3>{kind === "categories" ? (ar ? "التصنيفات" : "Categories") : (ar ? "المهارات" : "Skills")}</h3>{canWrite ? <><input required value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? "الاسم" : "Name"} /><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={kind === "categories" ? "slug" : (ar ? "التصنيف" : "Category")} /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={ar ? "الوصف" : "Description"} /><button type="submit"><FilePlus2 size={15} />{ar ? "إضافة" : "Create"}</button></> : <p>{ar ? "الصلاحية مطلوبة للتعديل." : "Permission Required to edit."}</p>}</form><div className="taxonomy-list">{rows.length === 0 ? <p className="knowledge-empty">{ar ? "لا توجد سجلات حقيقية." : "No real records."}</p> : rows.map((row) => <article key={row.id}><Tag size={16} /><div><strong>{row.name}</strong><small>{row.slug || row.category || (ar ? "لا توجد تفاصيل" : "No additional details")}</small></div>{row.archived_at && <span>{ar ? "مؤرشف" : "Archived"}</span>}</article>)}</div></section>;
}
