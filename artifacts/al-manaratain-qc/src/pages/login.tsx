import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface LoginProps {
  onLogin: (employeeId: string, password: string) => Promise<string | null>;
}

export default function Login({ onLogin }: LoginProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const message = await onLogin(employeeId, password);
    if (message) setError(message);
    setIsSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
        <img
          src="/al-manaratain-logo.webp"
          alt="Al Manaratain"
          className="mx-auto mb-8 h-12 object-contain"
        />
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Employee access
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Al Manaratain Quality Control
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Enter your registered employee ID to access QC records, reports,
          standards, and the document archive.
        </p>
        <form className="mt-8 space-y-4 text-left" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="employee-id">Employee ID</Label>
            <Input
              id="employee-id"
              inputMode="numeric"
              autoComplete="username"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              placeholder="Enter employee ID"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-password">Password</Label>
            <Input
              id="employee-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
              minLength={8}
              disabled={isSubmitting}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Checking ID…" : "Log in"}
          </Button>
        </form>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          Access is limited to registered employees. Contact your administrator
          if you need an account.
        </p>
      </section>
    </main>
  );
}