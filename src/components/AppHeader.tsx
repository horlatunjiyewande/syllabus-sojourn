import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, LogOut, Shield, LibraryBig } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Studyshelf</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/library">
                <LibraryBig className="h-4 w-4" /> Library
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <Shield className="h-4 w-4" /> Admin
              </Link>
            </Button>
          )}
          {loading ? null : user ? (
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
