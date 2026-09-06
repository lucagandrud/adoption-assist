"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup";

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const isSignUp = mode === "signup";

  function switchTo(next: Mode) {
    setMode(next);
    setErrors({});
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});

    const form = new FormData(event.currentTarget);
    const payload = isSignUp
      ? {
          intent: "signup",
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          agency: String(form.get("agency") ?? ""),
          password: String(form.get("password") ?? ""),
        }
      : {
          intent: "signin",
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        };

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrors(
          data.errors ?? { _form: data.error ?? "Sign-in failed. Try again." },
        );
        setPending(false);
        return;
      }

      router.replace("/cases");
      router.refresh();
    } catch {
      setErrors({ _form: "Could not reach the server. Is it still running?" });
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {isSignUp ? (
        <>
          <Field
            id="name"
            label="Full name"
            placeholder="Dana Whitfield"
            autoComplete="name"
            error={errors.name}
          />
          <Field
            id="agency"
            label="Agency or county office"
            placeholder="Sacramento County DCFAS"
            autoComplete="organization"
            optional
            error={errors.agency}
          />
        </>
      ) : null}

      <Field
        id="email"
        label="Work email"
        type="email"
        placeholder="d.whitfield@dss.ca.gov"
        autoComplete="email"
        error={errors.email}
      />

      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        hint={isSignUp ? "At least 8 characters." : undefined}
        error={errors.password}
      />

      {errors._form ? (
        <p
          role="alert"
          className="border border-destructive/40 bg-state-defect-bg px-3 py-2 text-sm text-destructive"
        >
          {errors._form}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full bg-navy-800 text-beige-100 hover:bg-navy-700"
      >
        {pending
          ? isSignUp
            ? "Creating account…"
            : "Signing in…"
          : isSignUp
            ? "Create account"
            : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already registered?" : "No account yet?"}{" "}
        <button
          type="button"
          onClick={() => switchTo(isSignUp ? "signin" : "signup")}
          className="font-medium text-navy-700 underline underline-offset-4 hover:text-navy-800"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </button>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  optional,
  hint,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  hint?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id} className="text-navy-800">
          {label}
        </Label>
        {optional ? (
          <span className="text-xs text-muted-foreground">Optional</span>
        ) : null}
      </div>
      <Input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="h-11 border-navy-800/20 bg-beige-50"
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
