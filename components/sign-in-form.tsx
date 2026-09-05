"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      agency: String(form.get("agency") ?? ""),
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
      <Field
        id="name"
        label="Full name"
        placeholder="Dana Whitfield"
        autoComplete="name"
        error={errors.name}
      />
      <Field
        id="email"
        label="Work email"
        type="email"
        placeholder="d.whitfield@dss.ca.gov"
        autoComplete="email"
        error={errors.email}
      />
      <Field
        id="agency"
        label="Agency or county office"
        placeholder="Sacramento County DCFAS"
        autoComplete="organization"
        optional
        error={errors.agency}
      />

      {errors._form ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-state-defect-bg px-3 py-2 text-sm text-destructive"
        >
          {errors._form}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full bg-navy-800 text-beige-100 hover:bg-navy-700"
      >
        {pending ? "Signing in…" : "Sign in to the workbench"}
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Returning users are matched on email address, so your cases come back
        with you. This build stores case data locally on this machine and
        contains synthetic records only.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  optional,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
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
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-11 border-navy-800/20 bg-beige-50"
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
