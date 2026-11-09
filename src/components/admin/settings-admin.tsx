"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, KeyRound, Moon, Palette, Sun, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { newAdminSchema, passwordSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ACCENTS } from "@/hooks/accents";
import { useAccent } from "@/hooks/use-accent";
import { useTheme } from "@/hooks/use-theme";
import { resetNavOrder } from "@/hooks/use-nav-order";
import { AdminPageHeader } from "./shell";

type PwValues = z.infer<typeof passwordSchema>;
type AdminValues = z.infer<typeof newAdminSchema>;
interface Admin { id: string; name: string; email: string }

function AppearanceCard() {
  const { accent, setAccent } = useAccent();
  const { theme, setTheme } = useTheme();
  return (
    <section className="rounded-sm border border-line bg-card p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-lg"><Palette className="h-5 w-5 text-primary" /> Appearance</h2>
      <p className="mt-1 text-sm">Pick the colour of buttons, menus and links. It is saved in this browser and applies to the whole dashboard.</p>

      <div role="radiogroup" aria-label="Theme colour" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACCENTS.map((a) => {
          const on = accent === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setAccent(a.id)}
              className={cn(
                "flex items-center gap-3 rounded-sm border p-3 text-left transition",
                on ? "border-primary bg-primary-faint" : "border-line hover:border-primary/50 hover:bg-primary-faint",
              )}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: a.color }}>
                {on && <Check className="h-5 w-5" aria-hidden />}
              </span>
              <span className="text-sm font-semibold text-ink">{a.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <p className="text-sm font-semibold text-ink">Mode</p>
        <div className="mt-3 inline-flex rounded-sm border border-line p-1" role="radiogroup" aria-label="Light or dark mode">
          {([["light", "Light", Sun], ["dark", "Dark", Moon]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              onClick={() => setTheme(id)}
              className={cn("flex min-h-9 items-center gap-2 rounded-sm px-4 text-sm font-medium transition", theme === id ? "bg-primary text-white" : "text-body hover:bg-primary-faint hover:text-primary")}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <p className="text-sm font-semibold text-ink">Menu order</p>
        <p className="mt-1 text-sm">On desktop, drag the pages in the sidebar to put them in the order you like. With the keyboard, focus a page and press Alt + ↑ or ↓.</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => { resetNavOrder(); toast.success("Menu order reset"); }}>Reset menu order</Button>
      </div>
    </section>
  );
}

export function SettingsAdmin({ initial, meId }: { initial: Admin[]; meId: string }) {
  const [admins, setAdmins] = React.useState<Admin[]>(initial);

  const pw = useForm<PwValues>({ resolver: zodResolver(passwordSchema) });
  const na = useForm<AdminValues>({ resolver: zodResolver(newAdminSchema) });

  const changePw = async (v: PwValues) => {
    try {
      await postJson("/api/admin/password", v);
      toast.success("Password changed");
      pw.reset();
    } catch (e) {
      toast.error("Could not change password", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };
  const addAdmin = async (v: AdminValues) => {
    try {
      const created = await postJson<Admin>("/api/admin/admins", v);
      setAdmins((c) => [...c, created]);
      toast.success("Admin added", { description: v.email });
      na.reset();
    } catch (e) {
      toast.error("Could not add admin", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };
  const removeAdmin = async (a: Admin) => {
    try {
      await postJson(`/api/admin/admins/${a.id}`, {}, "DELETE");
      setAdmins((c) => c.filter((x) => x.id !== a.id));
      toast.success("Admin removed", { description: a.email });
    } catch (e) {
      toast.error("Could not remove admin", { description: e instanceof Error ? e.message : "Please try again." });
    }
  };

  return (
    <>
      <AdminPageHeader title="Settings" description="Manage appearance, your password and who can access this dashboard." />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="xl:col-span-2"><AppearanceCard /></div>
        <section className="rounded-sm border border-line bg-card p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" /> Change password</h2>
          <form onSubmit={pw.handleSubmit(changePw)} noValidate className="mt-5 space-y-4">
            <Field label="Current password" error={pw.formState.errors.current?.message}><Input type="password" autoComplete="current-password" {...pw.register("current")} /></Field>
            <Field label="New password" error={pw.formState.errors.next?.message} hint="At least 8 characters"><Input type="password" autoComplete="new-password" {...pw.register("next")} /></Field>
            <Field label="Confirm new password" error={pw.formState.errors.confirm?.message}><Input type="password" autoComplete="new-password" {...pw.register("confirm")} /></Field>
            <Button type="submit" disabled={pw.formState.isSubmitting}>{pw.formState.isSubmitting ? "Saving…" : "Update password"}</Button>
          </form>
        </section>

        <section className="rounded-sm border border-line bg-card p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-primary" /> Admin accounts</h2>
          <ul className="mt-4 divide-y divide-line rounded-sm border border-line">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{a.name[0]}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{a.name}</p><p className="truncate text-xs">{a.email}</p></div>
                {a.id === meId ? (
                  <span className="rounded-full bg-primary-faint px-2.5 py-1 text-xs font-semibold text-primary">You</span>
                ) : (
                  <Button variant="dangerSoft" size="icon" aria-label={`Remove ${a.name}`} onClick={() => removeAdmin(a)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={na.handleSubmit(addAdmin)} noValidate className="mt-6 space-y-4 border-t border-line pt-6">
            <p className="text-sm font-semibold text-ink">Add a new admin</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={na.formState.errors.name?.message}><Input {...na.register("name")} /></Field>
              <Field label="Email" error={na.formState.errors.email?.message}><Input type="email" {...na.register("email")} /></Field>
            </div>
            <Field label="Temporary password" error={na.formState.errors.password?.message} hint="They can change it after signing in"><Input type="password" autoComplete="new-password" {...na.register("password")} /></Field>
            <Button type="submit" disabled={na.formState.isSubmitting}>{na.formState.isSubmitting ? "Adding…" : "Add admin"}</Button>
          </form>
        </section>
      </div>
    </>
  );
}
