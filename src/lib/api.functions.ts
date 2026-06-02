import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

async function sendWebhook(title: string, description: string, url: string) {
  const { data } = await supabaseAdmin.from("site_settings").select("webhook_url").eq("id", 1).maybeSingle();
  if (!data?.webhook_url) return;
  try {
    await fetch(data.webhook_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embeds: [{ title, description, url, color: 9442047 }] }),
    });
  } catch (e) { console.error("webhook failed", e); }
}

/* ---------------- VIEWS ---------------- */
export const incrementScriptViews = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin.from("scripts").select("views").eq("id", data.id).maybeSingle();
    if (row) await supabaseAdmin.from("scripts").update({ views: (row.views ?? 0) + 1 }).eq("id", data.id);
    return { ok: true };
  });

export const incrementSourceViews = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin.from("sources").select("views").eq("id", data.id).maybeSingle();
    if (row) await supabaseAdmin.from("sources").update({ views: (row.views ?? 0) + 1 }).eq("id", data.id);
    return { ok: true };
  });

/* ---------------- ADMIN CODES ---------------- */
export const redeemAdminCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(4).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: code } = await supabaseAdmin.from("admin_codes").select("*").eq("code", data.code).maybeSingle();
    if (!code) throw new Error("Invalid code");
    if (code.revoked) throw new Error("Code revoked");
    if (code.used_by) throw new Error("Code already used");
    await supabaseAdmin.from("admin_codes").update({ used_by: userId, used_at: new Date().toISOString() }).eq("id", code.id);
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    return { ok: true };
  });

export const generateAdminCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const code = "SAB-" + Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 6).toUpperCase()).join("-");
    const { data, error } = await supabaseAdmin.from("admin_codes").insert({ code, created_by: context.userId }).select().single();
    if (error) throw new Error(error.message);
    return data;
  });

export const revokeAdminCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await supabaseAdmin.from("admin_codes").update({ revoked: true }).eq("id", data.id);
    return { ok: true };
  });

/* ---------------- USERS ---------------- */
export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; admin: boolean }) => z.object({ user_id: z.string().uuid(), admin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.admin) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.user_id, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admin");
    }
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, username, avatar_url, created_at").order("created_at", { ascending: false }).limit(500);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const adminIds = new Set((roles ?? []).filter(r => r.role === "admin").map(r => r.user_id));
    return (profiles ?? []).map(p => ({ ...p, is_admin: adminIds.has(p.id) }));
  });

/* ---------------- WEBHOOK ON CONTENT CHANGES ---------------- */
export const notifyContentChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "script" | "source"; slug: string; name: string; action: "created" | "updated" }) =>
    z.object({ kind: z.enum(["script", "source"]), slug: z.string(), name: z.string(), action: z.enum(["created", "updated"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const title = `${data.kind === "script" ? "Script" : "Source"} ${data.action}: ${data.name}`;
    const path = data.kind === "script" ? `/scripts/${data.slug}` : `/sources/${data.slug}`;
    await sendWebhook(title, `A ${data.kind} was ${data.action} on SAB Scripting.`, path);
    return { ok: true };
  });
