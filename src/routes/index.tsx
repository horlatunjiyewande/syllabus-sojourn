import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Download, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studyshelf — Course Materials Library" },
      { name: "description", content: "Browse and download curated course materials by subject." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-24">
        <section className="py-16 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" /> A quiet place to study
          </span>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Your course library,
            <span className="italic text-primary"> beautifully organized.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Browse curated PDFs and documents by subject. Sign in to read online or download for offline study.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#subjects">Browse subjects</a>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Download className="h-4 w-4" /> Direct downloads</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Members-only access</span>
            <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> PDF & DOCX supported</span>
          </div>
        </section>

        <section id="subjects" className="pt-8">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold">Subjects</h2>
            <Link to="/library" className="text-sm text-primary hover:underline">
              Open library →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/library"
                search={{ category: c.slug }}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-semibold">{c.name}</h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                {c.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Studyshelf
      </footer>
    </div>
  );
}
