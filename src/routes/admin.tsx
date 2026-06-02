import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateAdminCode, revokeAdminCode, listUsers, setUserAdmin, notifyContentChange } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { slugify } from "@/lib/site-utils";
import { Trash2, Plus } from "lucide-react";
import { ScreenshotUploader } from "@/components/site/ScreenshotUploader";

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    else if (!loading && user && !isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  if (!isAdmin) return <div className="container mx-auto p-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-bold mb-1">Admin Dashboard</h1>
      <p className="text-muted-foreground mb-6">Manage everything from here. No hardcoding.</p>
      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="codes">Admin Codes</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><DashboardPanel /></TabsContent>
        <TabsContent value="scripts"><ScriptsPanel /></TabsContent>
        <TabsContent value="sources"><SourcesPanel /></TabsContent>
        <TabsContent value="reviews"><ReviewsPanel /></TabsContent>
        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="store"><StorePanel /></TabsContent>
        <TabsContent value="settings"><SettingsPanel /></TabsContent>
        <TabsContent value="codes"><CodesPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function DashboardPanel() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [s, src, r, u] = await Promise.all([
        supabase.from("scripts").select("id", { count: "exact", head: true }),
        supabase.from("sources").select("id", { count: "exact", head: true }),
        supabase.from("reviews").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      return { scripts: s.count ?? 0, sources: src.count ?? 0, reviews: r.count ?? 0, users: u.count ?? 0 };
    },
  });
  return (
    <div className="grid md:grid-cols-4 gap-4 mt-6">
      {Object.entries(data ?? {}).map(([k, v]) => (
        <div key={k} className="card-elevated p-6 text-center">
          <div className="text-3xl font-black gradient-text">{v as number}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{k}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Scripts ---------- */
function ScriptsPanel() {
  const qc = useQueryClient();
  const notify = useServerFn(notifyContentChange);
  const { data: scripts } = useQuery({
    queryKey: ["admin-scripts"],
    queryFn: async () => (await supabase.from("scripts").select("id,name,slug,description,features,screenshots,youtube_url,discord_url,tags,status,is_premium,payment_method,sellauth_url,paypal_url,ltc_address,verified_by_nalyy,badges,views,developer,created_at,updated_at").order("created_at", { ascending: false })).data ?? [],
  });
  const [editing, setEditing] = useState<any>(null);
  const blank = {
    name: "", description: "", features: "", screenshots: "", youtube_url: "", discord_url: "",
    tags: "", status: "working", source_code: "", is_premium: false, payment_method: "",
    sellauth_url: "", paypal_url: "", ltc_address: "", verified_by_nalyy: false, developer: "Nalyy",
  };

  const save = useMutation({
    mutationFn: async (form: any) => {
      const payload = {
        name: form.name, description: form.description,
        features: arr(form.features), screenshots: arr(form.screenshots),
        youtube_url: form.youtube_url || null, discord_url: form.discord_url || null,
        tags: arr(form.tags), status: form.status, source_code: form.source_code,
        is_premium: form.is_premium,
        payment_method: form.payment_method || null,
        sellauth_url: form.sellauth_url || null, paypal_url: form.paypal_url || null, ltc_address: form.ltc_address || null,
        verified_by_nalyy: form.verified_by_nalyy, developer: form.developer || "Nalyy",
      };
      if (form.id) {
        const { error } = await supabase.from("scripts").update(payload).eq("id", form.id);
        if (error) throw error;
        return { slug: form.slug, action: "updated" as const, name: form.name };
      } else {
        const slug = slugify(form.name);
        const { error } = await supabase.from("scripts").insert({ ...payload, slug });
        if (error) throw error;
        return { slug, action: "created" as const, name: form.name };
      }
    },
    onSuccess: async (r) => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-scripts"] });
      try { await notify({ data: { kind: "script", slug: r.slug, name: r.name, action: r.action } }); } catch {}
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("scripts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-scripts"] }); },
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Scripts ({scripts?.length ?? 0})</h2>
        <Button onClick={() => setEditing({ ...blank })} className="gradient-primary text-white border-0"><Plus className="h-4 w-4 mr-1" /> New script</Button>
      </div>
      {editing && (
        <div className="card-elevated p-6 space-y-3">
          <h3 className="font-semibold">{editing.id ? "Edit script" : "New script"}</h3>
          <Field label="Name"><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
          <Field label="Features (one per line)"><Textarea value={Array.isArray(editing.features) ? editing.features.join("\n") : editing.features} onChange={e => setEditing({ ...editing, features: e.target.value })} /></Field>
          <Field label="Screenshots"><ScreenshotUploader value={editing.screenshots} onChange={urls => setEditing({ ...editing, screenshots: urls })} /></Field>
          <Field label="YouTube URL"><Input value={editing.youtube_url ?? ""} onChange={e => setEditing({ ...editing, youtube_url: e.target.value })} /></Field>
          <Field label="Discord URL"><Input value={editing.discord_url ?? ""} onChange={e => setEditing({ ...editing, discord_url: e.target.value })} /></Field>
          <Field label="Tags (comma separated)"><Input value={Array.isArray(editing.tags) ? editing.tags.join(", ") : editing.tags} onChange={e => setEditing({ ...editing, tags: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="working">Working</SelectItem><SelectItem value="patched">Patched</SelectItem><SelectItem value="updating">Updating</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Loader (script code)"><Textarea rows={8} value={editing.source_code} onChange={e => setEditing({ ...editing, source_code: e.target.value })} className="font-mono text-xs" /></Field>
          <div className="flex gap-6">
            <label className="flex items-center gap-2"><Switch checked={editing.is_premium} onCheckedChange={v => setEditing({ ...editing, is_premium: v })} />Premium</label>
            <label className="flex items-center gap-2"><Switch checked={editing.verified_by_nalyy} onCheckedChange={v => setEditing({ ...editing, verified_by_nalyy: v })} />Verified by Nalyy</label>
          </div>
          {editing.is_premium && (
            <>
              <Field label="Payment method">
                <Select value={editing.payment_method || ""} onValueChange={v => setEditing({ ...editing, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="sellauth">SellAuth</SelectItem><SelectItem value="paypal">PayPal</SelectItem><SelectItem value="ltc">LTC</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="SellAuth URL"><Input value={editing.sellauth_url ?? ""} onChange={e => setEditing({ ...editing, sellauth_url: e.target.value })} /></Field>
              <Field label="PayPal URL"><Input value={editing.paypal_url ?? ""} onChange={e => setEditing({ ...editing, paypal_url: e.target.value })} /></Field>
              <Field label="LTC address"><Input value={editing.ltc_address ?? ""} onChange={e => setEditing({ ...editing, ltc_address: e.target.value })} /></Field>
            </>
          )}
          <div className="flex gap-2">
            <Button onClick={() => save.mutate(editing)} className="gradient-primary text-white border-0">Save</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="grid gap-2">
        {(scripts ?? []).map((s: any) => (
          <div key={s.id} className="card-elevated p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-muted-foreground">/{s.slug} · {s.status} · {s.is_premium ? "premium" : "free"}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                const { data } = await supabase.rpc("admin_get_script_source", { _script_id: s.id });
                setEditing({ ...s, source_code: (data as string | null) ?? "" });
              }}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete?")) del.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Sources ---------- */
function SourcesPanel() {
  const qc = useQueryClient();
  const notify = useServerFn(notifyContentChange);
  const { data: items } = useQuery({
    queryKey: ["admin-sources"],
    queryFn: async () => (await supabase.from("sources").select("id,name,slug,description,screenshots,discord_url,tags,status,access_method,sellauth_url,paypal_url,ltc_address,discord_redirect_url,views,created_at,updated_at").order("created_at", { ascending: false })).data ?? [],
  });
  const [editing, setEditing] = useState<any>(null);
  const blank = { name: "", description: "", screenshots: "", discord_url: "", tags: "", status: "ready", source_code: "", access_method: "free", sellauth_url: "", paypal_url: "", ltc_address: "", discord_redirect_url: "" };

  const save = useMutation({
    mutationFn: async (form: any) => {
      const payload = {
        name: form.name, description: form.description,
        screenshots: arr(form.screenshots), discord_url: form.discord_url || null,
        tags: arr(form.tags), status: form.status, source_code: form.source_code,
        access_method: form.access_method,
        sellauth_url: form.sellauth_url || null, paypal_url: form.paypal_url || null,
        ltc_address: form.ltc_address || null, discord_redirect_url: form.discord_redirect_url || null,
      };
      if (form.id) { const { error } = await supabase.from("sources").update(payload).eq("id", form.id); if (error) throw error; return { slug: form.slug, action: "updated" as const, name: form.name }; }
      const slug = slugify(form.name);
      const { error } = await supabase.from("sources").insert({ ...payload, slug });
      if (error) throw error;
      return { slug, action: "created" as const, name: form.name };
    },
    onSuccess: async (r) => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-sources"] }); try { await notify({ data: { kind: "source", ...r } }); } catch {} },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sources").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-sources"] }); },
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Sources ({items?.length ?? 0})</h2>
        <Button onClick={() => setEditing({ ...blank })} className="gradient-primary text-white border-0"><Plus className="h-4 w-4 mr-1" />New source</Button>
      </div>
      {editing && (
        <div className="card-elevated p-6 space-y-3">
          <h3 className="font-semibold">{editing.id ? "Edit source" : "New source"}</h3>
          <Field label="Name"><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
          <Field label="Screenshots"><ScreenshotUploader value={editing.screenshots} onChange={urls => setEditing({ ...editing, screenshots: urls })} /></Field>
          <Field label="Discord URL"><Input value={editing.discord_url ?? ""} onChange={e => setEditing({ ...editing, discord_url: e.target.value })} /></Field>
          <Field label="Tags (comma separated)"><Input value={Array.isArray(editing.tags) ? editing.tags.join(", ") : editing.tags} onChange={e => setEditing({ ...editing, tags: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ready">Ready To Go</SelectItem><SelectItem value="needs_modification">Needs Modification</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Source code"><Textarea rows={8} value={editing.source_code} onChange={e => setEditing({ ...editing, source_code: e.target.value })} className="font-mono text-xs" /></Field>
          <Field label="Access method">
            <Select value={editing.access_method} onValueChange={v => setEditing({ ...editing, access_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="sellauth">SellAuth</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="ltc">LTC</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {editing.access_method === "sellauth" && <Field label="SellAuth URL"><Input value={editing.sellauth_url ?? ""} onChange={e => setEditing({ ...editing, sellauth_url: e.target.value })} /></Field>}
          {editing.access_method === "paypal" && <Field label="PayPal URL"><Input value={editing.paypal_url ?? ""} onChange={e => setEditing({ ...editing, paypal_url: e.target.value })} /></Field>}
          {editing.access_method === "ltc" && <Field label="LTC address"><Input value={editing.ltc_address ?? ""} onChange={e => setEditing({ ...editing, ltc_address: e.target.value })} /></Field>}
          {editing.access_method === "discord" && <Field label="Discord redirect URL"><Input value={editing.discord_redirect_url ?? ""} onChange={e => setEditing({ ...editing, discord_redirect_url: e.target.value })} /></Field>}
          <div className="flex gap-2">
            <Button onClick={() => save.mutate(editing)} className="gradient-primary text-white border-0">Save</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="grid gap-2">
        {(items ?? []).map((s: any) => (
          <div key={s.id} className="card-elevated p-4 flex items-center justify-between">
            <div><div className="font-semibold">{s.name}</div><div className="text-xs text-muted-foreground">/{s.slug} · {s.access_method}</div></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                const { data } = await supabase.rpc("admin_get_source_source", { _source_id: s.id });
                setEditing({ ...s, source_code: (data as string | null) ?? "" });
              }}>Edit</Button>
              <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete?")) del.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Reviews ---------- */
function ReviewsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => (await supabase.from("reviews").select("*, scripts(name), profiles(username)").order("created_at", { ascending: false })).data ?? [],
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("reviews").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-reviews"] }); },
  });
  return (
    <div className="mt-6 space-y-2">
      {(data ?? []).map((r: any) => (
        <div key={r.id} className="card-elevated p-4 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">{r.profiles?.username ?? "user"} → {r.scripts?.name} · {r.rating}★</div>
            <div className="text-xs text-muted-foreground">{r.text}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Users ---------- */
function UsersPanel() {
  const list = useServerFn(listUsers);
  const setAdmin = useServerFn(setUserAdmin);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  return (
    <div className="mt-6 space-y-2">
      {(data ?? []).map((u: any) => (
        <div key={u.id} className="card-elevated p-4 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">{u.username ?? u.id.slice(0, 8)}</div>
            <div className="text-xs text-muted-foreground">{u.is_admin ? "Admin" : "User"} · joined {new Date(u.created_at).toLocaleDateString()}</div>
          </div>
          <label className="flex items-center gap-2 text-xs">Admin
            <Switch checked={!!u.is_admin} onCheckedChange={async (v) => { await setAdmin({ data: { user_id: u.id, admin: v } }); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />
          </label>
        </div>
      ))}
    </div>
  );
}

/* ---------- Store ---------- */
function StorePanel() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-store"], queryFn: async () => (await supabase.from("store_products").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [editing, setEditing] = useState<any>(null);
  const blank = { name: "", description: "", price: 0, image: "", payment_method: "sellauth", sellauth_url: "", paypal_url: "", ltc_address: "" };
  const save = useMutation({
    mutationFn: async (f: any) => {
      const payload = { name: f.name, description: f.description, price: Number(f.price), image: f.image || null, payment_method: f.payment_method, sellauth_url: f.sellauth_url || null, paypal_url: f.paypal_url || null, ltc_address: f.ltc_address || null };
      if (f.id) { const { error } = await supabase.from("store_products").update(payload).eq("id", f.id); if (error) throw error; }
      else { const { error } = await supabase.from("store_products").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-store"] }); },
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("store_products").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-store"] }) });

  return (
    <div className="mt-6 space-y-4">
      <Button onClick={() => setEditing({ ...blank })} className="gradient-primary text-white border-0"><Plus className="h-4 w-4 mr-1" />New product</Button>
      {editing && (
        <div className="card-elevated p-6 space-y-3">
          <Field label="Name"><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
          <Field label="Price (USD)"><Input type="number" step="0.01" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} /></Field>
          <Field label="Image URL"><Input value={editing.image ?? ""} onChange={e => setEditing({ ...editing, image: e.target.value })} /></Field>
          <Field label="Payment method">
            <Select value={editing.payment_method} onValueChange={v => setEditing({ ...editing, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sellauth">SellAuth</SelectItem><SelectItem value="paypal">PayPal</SelectItem><SelectItem value="ltc">LTC</SelectItem></SelectContent>
            </Select>
          </Field>
          {editing.payment_method === "sellauth" && <Field label="SellAuth URL"><Input value={editing.sellauth_url ?? ""} onChange={e => setEditing({ ...editing, sellauth_url: e.target.value })} /></Field>}
          {editing.payment_method === "paypal" && <Field label="PayPal URL"><Input value={editing.paypal_url ?? ""} onChange={e => setEditing({ ...editing, paypal_url: e.target.value })} /></Field>}
          {editing.payment_method === "ltc" && <Field label="LTC address"><Input value={editing.ltc_address ?? ""} onChange={e => setEditing({ ...editing, ltc_address: e.target.value })} /></Field>}
          <div className="flex gap-2"><Button onClick={() => save.mutate(editing)} className="gradient-primary text-white border-0">Save</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
        </div>
      )}
      {(data ?? []).map((p: any) => (
        <div key={p.id} className="card-elevated p-4 flex items-center justify-between">
          <div><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">${Number(p.price).toFixed(2)} · {p.payment_method}</div></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button><Button size="sm" variant="outline" onClick={() => del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Settings ---------- */
function SettingsPanel() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: async () => (await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle()).data });
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  const save = async () => {
    const { error } = await supabase.from("site_settings").update({ discord_url: form.discord_url, webhook_url: form.webhook_url, default_ltc_address: form.default_ltc_address }).eq("id", 1);
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["settings"] }); }
  };
  if (!form) return <div className="mt-6">Loading…</div>;
  return (
    <div className="mt-6 card-elevated p-6 space-y-3 max-w-2xl">
      <Field label="Discord URL"><Input value={form.discord_url ?? ""} onChange={e => setForm({ ...form, discord_url: e.target.value })} /></Field>
      <Field label="Discord webhook URL (for notifications)"><Input value={form.webhook_url ?? ""} onChange={e => setForm({ ...form, webhook_url: e.target.value })} /></Field>
      <Field label="Default LTC address"><Input value={form.default_ltc_address ?? ""} onChange={e => setForm({ ...form, default_ltc_address: e.target.value })} /></Field>
      <Button onClick={save} className="gradient-primary text-white border-0">Save</Button>
    </div>
  );
}

/* ---------- Codes ---------- */
function CodesPanel() {
  const gen = useServerFn(generateAdminCode);
  const rev = useServerFn(revokeAdminCode);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-codes"], queryFn: async () => (await supabase.from("admin_codes").select("*").order("created_at", { ascending: false })).data ?? [] });
  return (
    <div className="mt-6 space-y-3">
      <Button className="gradient-primary text-white border-0" onClick={async () => { await gen(); qc.invalidateQueries({ queryKey: ["admin-codes"] }); toast.success("Code generated"); }}>
        <Plus className="h-4 w-4 mr-1" />Generate admin code
      </Button>
      {(data ?? []).map((c: any) => (
        <div key={c.id} className="card-elevated p-4 flex items-center justify-between">
          <div>
            <code className="font-mono text-sm">{c.code}</code>
            <div className="text-xs text-muted-foreground">{c.revoked ? "Revoked" : c.used_by ? "Used" : "Available"} · {new Date(c.created_at).toLocaleString()}</div>
          </div>
          {!c.revoked && !c.used_by && (
            <Button size="sm" variant="outline" onClick={async () => { await rev({ data: { id: c.id } }); qc.invalidateQueries({ queryKey: ["admin-codes"] }); }}>Revoke</Button>
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}

function arr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (!v) return [];
  return String(v).split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}
