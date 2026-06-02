import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { badgeClass, computeBadges } from "@/lib/site-utils";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/scripts")({
  validateSearch: z.object({ q: z.string().optional() }).parse,
  component: ScriptsPage,
});

function ScriptsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isDetailRoute = pathname !== "/scripts";

  if (isDetailRoute) {
    return <Outlet />;
  }

  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const navigate = useNavigate({ from: "/scripts" });
  useEffect(() => { setQ(search.q ?? ""); }, [search.q]);

  const { data: scripts } = useQuery({
    queryKey: ["scripts"],
    queryFn: async () => (await supabase.from("scripts").select("id,name,slug,description,features,screenshots,youtube_url,discord_url,tags,status,is_premium,payment_method,sellauth_url,paypal_url,ltc_address,verified_by_nalyy,badges,views,developer,created_at,updated_at").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = (scripts ?? []).filter(s => {
    if (!q) return true;
    const t = q.toLowerCase();
    return s.name.toLowerCase().includes(t) || (s.tags ?? []).some((x: string) => x.toLowerCase().includes(t)) || (s.features ?? []).some((x: string) => x.toLowerCase().includes(t));
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Scripts</h1>
          <p className="text-muted-foreground text-sm mt-1">Verified premium and free scripts.</p>
        </div>
        <Input value={q} onChange={e => { setQ(e.target.value); navigate({ search: e.target.value ? { q: e.target.value } : {} }); }} placeholder="Search scripts, tags, features…" className="max-w-sm" />
      </div>
      {filtered.length === 0 ? (
        <div className="card-elevated p-10 text-center text-muted-foreground">No scripts match.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s: any) => {
            const badges = computeBadges({ is_premium: s.is_premium, verified_by_nalyy: s.verified_by_nalyy, created_at: s.created_at, updated_at: s.updated_at, views: s.views });
            return (
              <Link key={s.id} to="/scripts/$slug" params={{ slug: s.slug }} className="card-elevated p-5 glow-hover block">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{s.name}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${badgeClass(String(s.status).toUpperCase())}`}>{String(s.status).toUpperCase()}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{s.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {badges.slice(0, 3).map(b => <span key={b} className={`text-[9px] px-2 py-0.5 rounded border ${badgeClass(b)}`}>{b}</span>)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{s.views ?? 0}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
