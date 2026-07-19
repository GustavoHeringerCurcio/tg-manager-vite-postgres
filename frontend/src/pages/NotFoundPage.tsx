import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 bg-dot-pattern pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] bg-gradient-to-br from-primary/10 via-transparent to-transparent blur-3xl pointer-events-none" />

      <div className="relative text-center animate-fade-up">
        <p
          className="text-[140px] font-black leading-none tracking-tighter text-foreground/5 select-none"
          style={{ WebkitTextStroke: "1px hsl(var(--primary) / 0.2)" }}
        >
          404
        </p>
        <div className="-mt-12 space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button render={<Link to="/manager" />} className="shadow-glow-primary">
            <Home className="mr-2 size-4" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
