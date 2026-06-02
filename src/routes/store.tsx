import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

export const Route = createFileRoute("/store")({ component: StorePage });

function StorePage() {
  const { data } = useQuery({
    queryKey: ["store"],
    queryFn: async () => (await supabase.from("store_products").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">Store</h1>
      <p className="text-muted-foreground mb-6">Premium products by Nalyy.</p>
      {(data ?? []).length === 0 ? (
        <div className="card-elevated p-10 text-center text-muted-foreground">No products yet.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data!.map((p: any) => {
            const url = p.payment_method === "sellauth" ? p.sellauth_url : p.payment_method === "paypal" ? p.paypal_url : null;
            return (
              <div key={p.id} className="card-elevated overflow-hidden glow-hover">
                {p.image && <img src={p.image} alt={p.name} className="w-full h-40 object-cover" />}
                <div className="p-5">
                  <div className="font-semibold mb-1">{p.name}</div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{p.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-black gradient-text">${Number(p.price).toFixed(2)}</div>
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer"><Button className="w-full mt-3 gradient-primary text-white border-0">Buy Now</Button></a>
                  ) : p.payment_method === "ltc" && p.ltc_address ? (
                    <Button className="w-full mt-3" variant="outline" onClick={() => { navigator.clipboard.writeText(p.ltc_address); }}>Copy LTC: {p.ltc_address.slice(0, 8)}…</Button>
                  ) : <Button className="w-full mt-3" disabled>Unavailable</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
