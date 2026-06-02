import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Star, TrendingUp, Eye, Heart } from "lucide-react";
import { badgeClass, computeBadges } from "@/lib/site-utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAB Scripting by Nalyy — Premium Scripts & Sources" },
      { name: "description", content: "Premium, verified scripts and sources by Nalyy. Updated daily." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data } = useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      const [scripts, sources, reviews, likes] = await Promise.all([
        supabase.from("scripts").select("id,name,slug,description,features,screenshots,youtube_url,discord_url,tags,status,is_premium,payment_method,sellauth_url,paypal_url,ltc_address,verified_by_nalyy,badges,views,developer,created_at,updated_at").order("views", { ascending: false }).limit(6),
        supabase.from("sources").select("id,name,slug,description,screenshots,discord_url,tags,status,access_method,sellauth_url,paypal_url,ltc_address,discord_redirect_url,views,created_at,updated_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("reviews").select("*, scripts(name,slug)").order("created_at", { ascending: false }).limit(6),
        supabase.from("likes").select("script_id"),
      ]);
      const popular = (scripts.data ?? []).slice(0, 3);
      const latest = [...(scripts.data ?? [])].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6);
      return {
        popular, latest, sources: sources.data ?? [], reviews: reviews.data ?? [],
        stats: {
          scripts: scripts.data?.length ?? 0,
          sources: sources.data?.length ?? 0,
          reviews: reviews.data?.length ?? 0,
          likes: likes.data?.length ?? 0,
        },
      };
    },
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="container mx-auto px-4 py-24 md:py-32 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Verified by Nalyy — trusted by the community</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
              Steal a brainrots scripts<br /><span className="gradient-text">By the players, for the Players</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl">
              SAB Scripting delivers verified, premium scripts and sources — built for performance, polished for production.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/scripts"><Button size="lg" className="gradient-primary text-white border-0 glow-hover">Browse Scripts</Button></Link>
              <a href="https://discord.gg/pmshPYywDD" target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline">Join Discord</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Scripts", value: data?.stats.scripts ?? 0, icon: Zap },
            { label: "Sources", value: data?.stats.sources ?? 0, icon: Sparkles },
            { label: "Reviews", value: data?.stats.reviews ?? 0, icon: Star },
            { label: "Likes", value: data?.stats.likes ?? 0, icon: Heart },
          ].map(s => (
            <div key={s.label} className="card-elevated p-6 text-center glow-hover">
              <s.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-3xl font-black gradient-text">{s.value}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular */}
      <Section title="Popular Scripts" icon={TrendingUp}>
        {data?.popular?.length ? (
          <div className="grid md:grid-cols-3 gap-4">
            {data.popular.map(s => <ScriptCard key={s.id} s={s} />)}
          </div>
        ) : <Empty label="No scripts yet." />}
      </Section>

      {/* Latest Scripts */}
      <Section title="Latest Scripts">
        {data?.latest?.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.latest.map(s => <ScriptCard key={s.id} s={s} />)}
          </div>
        ) : <Empty label="No scripts yet." />}
      </Section>

      {/* Latest Sources */}
      <Section title="Latest Sources">
        {data?.sources?.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.sources.map((s: any) => (
              <Link key={s.id} to="/sources/$slug" params={{ slug: s.slug }} className="card-elevated p-5 glow-hover block">
                <div className="font-semibold mb-1">{s.name}</div>
                <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                <div className="text-xs text-primary mt-3 uppercase">{s.access_method}</div>
              </Link>
            ))}
          </div>
        ) : <Empty label="No sources yet." />}
      </Section>

      {/* Reviews */}
      <Section title="Recent Reviews">
        {data?.reviews?.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {data.reviews.map((r: any) => (
              <div key={r.id} className="card-elevated p-5">
                <div className="flex items-center gap-2 mb-2">
                  {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm mb-3">{r.text || "—"}</p>
                {r.scripts && (
                  <Link to="/scripts/$slug" params={{ slug: r.scripts.slug }} className="text-xs text-primary hover:underline">
                    on {r.scripts.name} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : <Empty label="No reviews yet." />}
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <section className="container mx-auto px-4 py-10">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
        {Icon && <Icon className="h-6 w-6 text-primary" />} {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="card-elevated p-10 text-center text-muted-foreground">{label}</div>;
}

function ScriptCard({ s }: { s: any }) {
  const badges = computeBadges({ is_premium: s.is_premium, verified_by_nalyy: s.verified_by_nalyy, created_at: s.created_at, updated_at: s.updated_at, views: s.views });
  return (
    <Link to="/scripts/$slug" params={{ slug: s.slug }} className="card-elevated p-5 glow-hover block">
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
}
