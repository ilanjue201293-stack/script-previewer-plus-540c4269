import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

function toArr(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (!v) return [];
  return String(v).split("\n").map(s => s.trim()).filter(Boolean);
}

export function ScreenshotUploader({ value, onChange }: { value: any; onChange: (urls: string[]) => void }) {
  const urls = toArr(value);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next = [...urls];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "png";
        const path = `screenshots/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("media").upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        next.push(data.publicUrl);
      }
      onChange(next);
      toast.success("Uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = (i: number) => onChange(urls.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Upload className="h-4 w-4 mr-1.5" /> {busy ? "Uploading…" : "Upload screenshots"}
      </Button>
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((u, i) => (
            <div key={i} className="relative group">
              <img src={u} alt="" className="rounded border border-border w-full h-24 object-cover" />
              <button type="button" onClick={() => remove(i)} className="absolute top-1 right-1 bg-black/60 rounded p-1 opacity-0 group-hover:opacity-100 transition">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
