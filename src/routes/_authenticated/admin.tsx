import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Studyshelf" }] }),
  component: AdminPage,
});

const ALLOWED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-powerpoint",
];

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const { data: materials = [] } = useQuery({
    queryKey: ["admin-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, file_path, file_name, file_size, created_at, categories(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (loading) return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  if (!isAdmin) {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 font-display text-2xl font-semibold">Admins only</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is restricted. Ask the first registered user (the admin) to grant you access.
          </p>
          <Button asChild className="mt-6"><Link to="/library">Back to library</Link></Button>
        </div>
      </Shell>
    );
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a file");
    if (!ALLOWED.includes(file.type)) return toast.error("Only PDF, DOCX, or PPTX files allowed");
    if (file.size > 50 * 1024 * 1024) return toast.error("Max file size 50MB");
    if (!title.trim()) return toast.error("Title required");
    if (!categoryId) return toast.error("Choose a subject");

    setBusy(true);
    setProgress(10);
    const ext = file.name.split(".").pop();
    const path = `${categoryId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("materials").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    setProgress(70);

    const { error: insErr } = await supabase.from("materials").insert({
      title: title.trim(),
      author: author.trim() || null,
      description: description.trim() || null,
      category_id: categoryId,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id,
    });
    setBusy(false);
    setProgress(0);
    if (insErr) {
      await supabase.storage.from("materials").remove([path]);
      return toast.error(insErr.message);
    }
    toast.success("Uploaded");
    setTitle(""); setAuthor(""); setDescription("");
    if (fileRef.current) fileRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["admin-materials"] });
    qc.invalidateQueries({ queryKey: ["materials"] });
  }

  async function remove(id: string, path: string) {
    if (!confirm("Delete this material?")) return;
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("materials").remove([path]);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-materials"] });
    qc.invalidateQueries({ queryKey: ["materials"] });
  }

  return (
    <Shell>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl font-semibold">Upload material</h2>
          <p className="mt-1 text-sm text-muted-foreground">PDF, DOCX, or PPTX up to 50MB.</p>
          <form onSubmit={onUpload} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="author">Author / Instructor (optional)</Label>
              <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file">File</Label>
              <Input ref={fileRef} id="file" type="file" accept=".pdf,.docx,.pptx,.doc,.ppt" required />
            </div>
            {busy && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload material"}
            </Button>
          </form>
        </section>

        <section>
          <h2 className="mb-4 font-display text-2xl font-semibold">All materials ({materials.length})</h2>
          <div className="space-y-2">
            {materials.length === 0 && <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>}
            {materials.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {(m.categories as { name: string } | null)?.name ?? "—"} · {m.file_name}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(m.id, m.file_path)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="mb-8 font-display text-4xl font-semibold">Admin</h1>
        {children}
      </main>
    </div>
  );
}
