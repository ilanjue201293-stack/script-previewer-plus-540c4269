import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { badgeClass } from "@/lib/site-utils";

export const Route = createFileRoute("/sources")({ component: SourcesPage });

function SourcesPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isDetailRoute = pathname !== "/sources";

  if (isDetailRoute) {
    return <Outlet />;
  }

  const { data } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => (await supabase.from("sources").select("id,name,slug,description,screenshots,discord_url,tags,status,access_method,sellauth_url,paypal_url,ltc_address,discord_redirect_url,views,created_at,updated_at").order("created_at", { ascending: false })).data ?? [],
  });
  const free = (data ?? []).filter((s: any) => s.access_method === "free");
  const paid = (data ?? []).filter((s: any) => s.access_method !== "free");
  const defaultTab = free.length > 0 ? "free" : "paid";

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-bold mb-6">Sources</h1>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="free">Free Sources ({free.length})</TabsTrigger>
          <TabsTrigger value="paid">Paid Sources ({paid.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="free"><Grid items={free} /></TabsContent>
        <TabsContent value="paid"><Grid items={paid} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Grid({ items }: { items: any[] }) {
  if (!items.length) return <div className="card-elevated p-10 text-center text-muted-foreground mt-4">Nothing here yet.</div>;
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {items.map(s => (
        <Link key={s.id} to="/sources/$slug" params={{ slug: s.slug }} className="card-elevated p-5 glow-hover block">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{s.name}</div>
            <span className={`text-[10px] px-2 py-1 rounded border ${badgeClass(String(s.status).replace(/_/g," ").toUpperCase())}`}>{String(s.status).replace(/_/g," ").toUpperCase()}</span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{s.description}</p>
          <div className="text-xs text-primary uppercase">{s.access_method}</div>
        </Link>
      ))}
    </div>
  );
}
