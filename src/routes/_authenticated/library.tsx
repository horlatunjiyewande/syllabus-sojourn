import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Download, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const searchSchema = z.object({ category: z.string().optional() });

export const Route = createFileRoute("/_authenticated/library")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Library — Studyshelf" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const { category } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, slug").order("name");
      if (error) throw error;
      return data;
    },
  });

  const activeCategory = categories.find((c) => c.slug === category);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials", activeCategory?.id ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("materials")
        .select("id, title, description, author, file_path, file_name, file_size, mime_type, created_at, category_id, categories(name, slug)")
        .order("created_at", { ascending: false });
      if (activeCategory?.id) query = query.eq("category_id", activeCategory.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filtered = materials.filter((m) =>
    !q.trim() ? true : [m.title, m.author, m.description].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
  );

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("materials").createSignedUrl(path, 60, { download: name });
    if (error || !data) return toast.error("Could not generate download link");
    window.location.href = data.signedUrl;
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl font-semibold">Library</h1>
            <p className="mt-1 text-muted-foreground">
              {activeCategory ? activeCategory.name : "All subjects"} · {filtered.length} item{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author…" className="pl-9" />
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <CategoryChip active={!category} onClick={() => navigate({ search: {} })} label="All" />
          {categories.map((c) => (
            <CategoryChip key={c.id} active={c.slug === category} onClick={() => navigate({ search: { category: c.slug } })} label={c.name} />
          ))}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">No materials yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon, or ask an admin to upload some.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <article key={m.id} className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
                <div className="mb-4 flex h-32 items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-accent/30">
                  <FileText className="h-12 w-12 text-primary/70" />
                </div>
                {m.categories && (
                  <span className="mb-2 text-xs font-medium uppercase tracking-wide text-primary/70">
                    {(m.categories as { name: string }).name}
                  </span>
                )}
                <h3 className="font-display text-lg font-semibold leading-snug">{m.title}</h3>
                {m.author && <p className="mt-0.5 text-sm text-muted-foreground">by {m.author}</p>}
                {m.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{m.description}</p>}
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatBytes(m.file_size)}</span>
                  <span>{m.mime_type?.includes("pdf") ? "PDF" : "DOC"}</span>
                </div>
                <Button onClick={() => download(m.file_path, m.file_name)} className="mt-4 w-full">
                  <Download className="h-4 w-4" /> Download
                </Button>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );
}

function formatBytes(b: number) {
  if (!b) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
