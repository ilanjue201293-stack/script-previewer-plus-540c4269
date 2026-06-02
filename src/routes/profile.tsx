import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { redeemAdminCode } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isAdmin, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [pw, setPw] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const redeem = useServerFn(redeemAdminCode);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => setProfile(data ?? { id: user.id }));
  }, [user]);

  if (!user || !profile) return <div className="container mx-auto p-10">Loading…</div>;

  const save = async () => {
    const { error } = await supabase.from("profiles").update({
      username: profile.username, bio: profile.bio, avatar_url: profile.avatar_url,
    }).eq("id", user.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const changePw = async () => {
    if (pw.length < 6) return toast.error("Min 6 chars");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message); else { toast.success("Password updated"); setPw(""); }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Your profile</h1>
      <div className="card-elevated p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center text-2xl font-bold">{(profile.username ?? "U")[0]?.toUpperCase()}</div>
          <div>
            <p className="font-semibold">{user.email}</p>
            <p className="text-xs text-muted-foreground">Joined {new Date(profile.created_at ?? Date.now()).toLocaleDateString()}</p>
          </div>
        </div>
        <div><Label>Username</Label><Input value={profile.username ?? ""} onChange={e => setProfile({ ...profile, username: e.target.value })} /></div>
        <div><Label>Avatar URL</Label><Input value={profile.avatar_url ?? ""} onChange={e => setProfile({ ...profile, avatar_url: e.target.value })} /></div>
        <div><Label>Bio</Label><Textarea value={profile.bio ?? ""} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={3} /></div>
        <Button onClick={save} className="gradient-primary text-white border-0">Save</Button>
      </div>

      <div className="card-elevated p-6 mt-6 space-y-3">
        <h3 className="font-semibold">Change password</h3>
        <Input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="New password" />
        <Button variant="outline" onClick={changePw}>Update password</Button>
      </div>

      {!isAdmin && (
        <div className="card-elevated p-6 mt-6 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Have an admin code?</h3>
          <p className="text-xs text-muted-foreground">Enter a code to unlock the admin dashboard.</p>
          <Input value={adminCode} onChange={e => setAdminCode(e.target.value)} placeholder="Enter admin code" />
          <Button
            className="gradient-primary text-white border-0"
            onClick={async () => {
              if (!adminCode.trim()) return;
              try {
                await redeem({ data: { code: adminCode.trim() } });
                await refresh();
                toast.success("You are now an admin!");
                setAdminCode("");
                navigate({ to: "/admin" });
              } catch (e: any) { toast.error(e.message); }
            }}
          >Redeem code</Button>
        </div>
      )}
    </div>
  );
}
