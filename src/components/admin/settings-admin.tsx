"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { newAdminSchema, passwordSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { postJson } from "@/lib/api";
import { AdminPageHeader } from "./shell";

type PwValues = z.infer<typeof passwordSchema>;
type AdminValues = z.infer<typeof newAdminSchema>;
interface Admin { id: string; name: string; email: string }

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
      <AdminPageHeader title="Settings" description="Manage your password and who can access this dashboard." />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" /> Change password</h2>
          <form onSubmit={pw.handleSubmit(changePw)} noValidate className="mt-5 space-y-4">
            <Field label="Current password" error={pw.formState.errors.current?.message}><Input type="password" autoComplete="current-password" {...pw.register("current")} /></Field>
            <Field label="New password" error={pw.formState.errors.next?.message} hint="At least 8 characters"><Input type="password" autoComplete="new-password" {...pw.register("next")} /></Field>
            <Field label="Confirm new password" error={pw.formState.errors.confirm?.message}><Input type="password" autoComplete="new-password" {...pw.register("confirm")} /></Field>
            <Button type="submit" disabled={pw.formState.isSubmitting}>{pw.formState.isSubmitting ? "Saving…" : "Update password"}</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
          <h2 className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-primary" /> Admin accounts</h2>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-blue-700">{a.name[0]}</span>
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
