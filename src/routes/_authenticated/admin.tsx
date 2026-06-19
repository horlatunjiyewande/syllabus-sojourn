import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, Upload, Shield, X, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type Category = { id: string; name: string; slug: string; description: string | null };
type Material = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  category_id: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  created_at: string;
  categories: { name: string } | null;
};

function AdminPage() {
  const { isAdmin, loading } = useAuth();

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

  return (
    <Shell>
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="categories">Subjects</TabsTrigger>
        </TabsList>
        <TabsContent value="materials" className="mt-6">
          <MaterialsTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function MaterialsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, slug, description").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["admin-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, title, author, description, category_id, file_path, file_name, file_size, created_at, categories(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Material[];
    },
  });

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a file");
    if (!ALLOWED.includes(file.type)) return toast.error("Only PDF, DOCX, or PPTX files allowed");
    if (file.size > 50 * 1024 * 1024) return toast.error("Max file size 50MB");
    if (!title.trim()) return toast.error("Title required");
    if (!categoryId) return toast.error("Choose a subject");

    setBusy(true);
    const ext = file.name.split(".").pop();
    const path = `${categoryId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("materials").upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (upErr) { setBusy(false); return toast.error(upErr.message); }

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
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <section className="rounded-xl border border-border bg-card p-6 h-fit">
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
                {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
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
                  {m.categories?.name ?? "—"} · {m.file_name}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(m.id, m.file_path)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <EditMaterialDialog material={editing} categories={categories} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditMaterialDialog({
  material, categories, onClose,
}: { material: Material | null; categories: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (material) {
      setTitle(material.title);
      setAuthor(material.author ?? "");
      setDescription(material.description ?? "");
      setCategoryId(material.category_id ?? "");
    }
  }, [material]);

  async function save() {
    if (!material) return;
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const { error } = await supabase
      .from("materials")
      .update({
        title: title.trim(),
        author: author.trim() || null,
        description: description.trim() || null,
        category_id: categoryId || null,
      })
      .eq("id", material.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["admin-materials"] });
    qc.invalidateQueries({ queryKey: ["materials"] });
    onClose();
  }

  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit material</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>Author</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function CategoriesTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, slug, description").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({
      name: name.trim(),
      slug: slugify(name),
      description: description.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Subject added");
    setName(""); setDescription("");
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["categories-public"] });
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("categories")
      .update({ name: editName.trim(), slug: slugify(editName), description: editDesc.trim() || null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["categories-public"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this subject? Materials in it will become uncategorized.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["categories-public"] });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <section className="rounded-xl border border-border bg-card p-6 h-fit">
        <h2 className="font-display text-2xl font-semibold">Add a subject</h2>
        <p className="mt-1 text-sm text-muted-foreground">Subjects are how materials are grouped on the library and home page.</p>
        <form onSubmit={add} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Organic Chemistry" required />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} rows={3} />
          </div>
          <Button type="submit" className="w-full"><Plus className="h-4 w-4" /> Add subject</Button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold">All subjects ({categories.length})</h2>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4">
              {editingId === c.id ? (
                <div className="space-y-3">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={240} rows={2} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(c.id)}>
                      <Check className="h-4 w-4" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    {c.description && <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setEditName(c.name); setEditDesc(c.description ?? ""); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
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
