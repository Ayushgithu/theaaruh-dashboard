"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, GalleryHorizontal, ImageIcon, Inbox, SlidersHorizontal, Undo2, Shirt, LayoutDashboard, LogOut, Megaphone, Menu, Settings, Headphones, ExternalLink, ShoppingBag, ShoppingCart, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import { LogoMark } from "@/components/ui/icons";
import { brandName } from "@/lib/brand";
import { postJson } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { NotificationBell } from "./notification-bell";
import { AdminAccountMenu } from "./account-menu";
import { useAdminBadges, type BadgeKey, type Badges } from "./use-admin-badges";

const WEBSITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || "/";

function Logo() {
  return (
    <Link href="/admin" aria-label={`${brandName} admin home`} className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-9 shrink-0" />
      <span className="text-lg font-extrabold tracking-tight text-ink">
        {brandName}
      </span>
    </Link>
  );
}

const items: { label: string; href: string; Icon: typeof LayoutDashboard; badge?: BadgeKey }[] = [
  { label: "Dashboard", href: "/admin", Icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", Icon: ShoppingBag, badge: "orders" },
  { label: "Returns", href: "/admin/returns", Icon: Undo2, badge: "returns" },
  { label: "Carts", href: "/admin/carts", Icon: ShoppingCart, badge: "carts" },
  { label: "Customers", href: "/admin/customers", Icon: Users },
  { label: "Clothing", href: "/admin/clothing", Icon: Shirt },
  { label: "Accessories", href: "/admin/accessories", Icon: Headphones },
  { label: "Top bar", href: "/admin/announcements", Icon: Megaphone },
  { label: "Hero carousel", href: "/admin/slides", Icon: GalleryHorizontal },
  { label: "Banners", href: "/admin/banners", Icon: ImageIcon },
  { label: "Enquiries", href: "/admin/enquiries", Icon: Inbox, badge: "enquiries" },
  { label: "Insights", href: "/admin/insights", Icon: BarChart3 },
  { label: "Notifications", href: "/admin/notifications", Icon: Bell },
  { label: "Store rules", href: "/admin/rules", Icon: SlidersHorizontal },
  { label: "Settings", href: "/admin/settings", Icon: Settings },
];

function NavList({ pathname, badges, onNavigate }: { pathname: string; badges: Badges; onNavigate?: () => void }) {
  const active = (h: string) => (h === "/admin" ? pathname === "/admin" : pathname.startsWith(h));
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {items.map(({ label, href, Icon, badge }) => {
        const n = badge ? badges[badge] : 0;
        return (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={active(href) ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors",
            active(href) ? "bg-primary text-white shadow-sm" : "text-body hover:bg-primary-faint hover:text-primary",
          )}
        >
          <Icon className="h-[18px] w-[18px]" /> {label}
          {n > 0 && (
            <span aria-label={`${n} new`} className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-sm">
              {n > 99 ? "99+" : n}
            </span>
          )}
        </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children, admin }: { children: React.ReactNode; admin: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = React.useState(false);
  const email = admin.email;
  const badges = useAdminBadges(pathname);
  const anyNew = badges.orders + badges.carts + badges.enquiries > 0;

  const logout = async () => {
    try { await postJson("/api/admin/logout", {}); } catch {}
    toast("Signed out");
    router.replace("/login");
    router.refresh();
  };

  const footer = (
    <div className="border-t border-line pt-4">
      <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="mb-2 flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-body hover:bg-primary-faint hover:text-primary">
        <ExternalLink className="h-[18px] w-[18px]" /> View website
      </a>
      <div className="flex items-center gap-3 px-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-blue-700">{(email[0] ?? "A").toUpperCase()}</span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{email || "admin"}</p>
        <ThemeToggle className="h-11 w-11" />
        <button onClick={logout} aria-label="Sign out" className="flex h-11 w-11 items-center justify-center rounded-xl text-body hover:bg-red-50 hover:text-red-600"><LogOut className="h-[18px] w-[18px]" /></button>
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr]">
      <aside data-lenis-prevent className="sticky top-0 hidden h-dvh flex-col justify-between self-start overflow-y-auto border-r border-line bg-card p-4 lg:flex">
        <div>
          <div className="px-2 pb-6 pt-2"><Logo /><p className="mt-1 pl-[46px] text-xs">Admin</p></div>
          <NavList pathname={pathname} badges={badges} />
        </div>
        {footer}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-line bg-card/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="lg:hidden"><Logo /></div>
            <p className="hidden truncate text-sm font-medium text-ink lg:block">Admin panel</p>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <ThemeToggle />
            <AdminAccountMenu name={admin.name} email={admin.email} onLogout={logout} />
            <button onClick={() => setMenu(true)} aria-label="Open admin menu" className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface lg:hidden">
              <Menu className="h-6 w-6" />
              {anyNew && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-card" aria-hidden />}
            </button>
          </div>
        </header>
        <Drawer open={menu} onClose={() => setMenu(false)} title="Admin menu" side="left" footer={footer}>
          <NavList pathname={pathname} badges={badges} onNavigate={() => setMenu(false)} />
        </Drawer>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function AdminPageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ConfirmDialogBody({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed">{children}</p>;
}
