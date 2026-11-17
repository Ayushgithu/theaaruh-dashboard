"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, ShieldCheck, GalleryHorizontal, ImageIcon, Inbox, SlidersHorizontal, Undo2, Shirt, LayoutDashboard, Megaphone, Menu, Settings, Headphones, ExternalLink, ShoppingBag, ShoppingCart, Users, Search, GripVertical, Ruler, LayoutGrid, Clapperboard, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import { LogoMark } from "@/components/ui/icons";
import { brandName } from "@/lib/brand";
import { postJson } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { AdminAccountMenu } from "./account-menu";
import { useNavOrder } from "@/hooks/use-nav-order";
import { useAdminBadges, type BadgeKey, type Badges } from "./use-admin-badges";

const WEBSITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || "/";

function Logo() {
  return (
    <Link href="/admin" aria-label={`${brandName} admin home`} className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-11 shrink-0 sm:h-10 sm:w-12" />
      <span className="hidden min-[26rem]:block">
        <span className="block whitespace-nowrap text-[1.25rem] font-extrabold leading-tight tracking-tight text-ink">{brandName}</span>
        <span className="hidden whitespace-nowrap text-[11px] font-medium uppercase tracking-wider text-ink/40 sm:block">Admin Dashboard</span>
      </span>
    </Link>
  );
}

type NavItem = { label: string; href: string; Icon: typeof LayoutDashboard; badge?: BadgeKey };

// Grouped like the QR printer dashboard: small uppercase section titles with a hairline.
const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", Icon: LayoutDashboard },
      { label: "Insights", href: "/admin/insights", Icon: BarChart3 },
    ],
  },
  {
    title: "Shop",
    items: [
      { label: "Orders", href: "/admin/orders", Icon: ShoppingBag, badge: "orders" },
      { label: "Returns", href: "/admin/returns", Icon: Undo2, badge: "returns" },
      { label: "Carts", href: "/admin/carts", Icon: ShoppingCart, badge: "carts" },
      { label: "Customers", href: "/admin/customers", Icon: Users },
      { label: "Enquiries", href: "/admin/enquiries", Icon: Inbox, badge: "enquiries" },
      { label: "Reviews", href: "/admin/reviews", Icon: Star, badge: "reviews" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { label: "Clothing", href: "/admin/clothing", Icon: Shirt },
      { label: "Accessories", href: "/admin/accessories", Icon: Headphones },
      { label: "Collections", href: "/admin/collections", Icon: LayoutGrid },
      { label: "Videos", href: "/admin/videos", Icon: Clapperboard },
      { label: "Size guides", href: "/admin/size-guides", Icon: Ruler },
    ],
  },
  {
    title: "Storefront",
    items: [
      { label: "Top bar", href: "/admin/announcements", Icon: Megaphone },
      { label: "Hero carousel", href: "/admin/slides", Icon: GalleryHorizontal },
      { label: "Banners", href: "/admin/banners", Icon: ImageIcon },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Notifications", href: "/admin/notifications", Icon: Bell },
      { label: "Store rules", href: "/admin/rules", Icon: SlidersHorizontal },
      { label: "Settings", href: "/admin/settings", Icon: Settings },
    ],
  },
];

function NavList({ pathname, badges, onNavigate, onMove, items: list = sections }: { pathname: string; badges: Badges; onNavigate?: () => void; onMove?: (section: string, from: string, to: string) => void; items?: typeof sections }) {
  const active = (h: string) => (h === "/admin" ? pathname === "/admin" : pathname.startsWith(h));
  const [drag, setDrag] = React.useState<{ title: string; href: string } | null>(null);
  const [over, setOver] = React.useState<string | null>(null);
  const end = () => { setDrag(null); setOver(null); };
  return (
    <nav aria-label="Admin">
      {list.map((section) => (
        <div key={section.title} className="mt-4 first:mt-0">
          <div className="mb-2 flex items-center gap-2 px-2">
            <span className="text-xs font-semibold uppercase tracking-[0.4px] text-ink/40">{section.title}</span>
            <span className="h-px grow bg-ink/10" />
          </div>
          <ul className="space-y-1">
            {section.items.map(({ label, href, Icon, badge }, idx) => {
              const n = badge ? badges[badge] : 0;
              const sameSection = drag?.title === section.title;
              const fromIdx = sameSection ? section.items.findIndex((x) => x.href === drag.href) : -1;
              const target = sameSection && over === href && drag.href !== href;
              const move = (to: number) => { const t = section.items[to]; if (t && onMove) onMove(section.title, href, t.href); };
              return (
                <li
                  key={href}
                  draggable={!!onMove}
                  onDragStart={onMove ? (e) => { setDrag({ title: section.title, href }); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", href); } : undefined}
                  onDragOver={onMove ? (e) => { if (sameSection) { e.preventDefault(); setOver(href); } } : undefined}
                  onDrop={onMove ? (e) => { e.preventDefault(); if (sameSection) onMove(section.title, drag.href, href); end(); } : undefined}
                  onDragEnd={onMove ? end : undefined}
                  className={cn(
                    "group/nav relative",
                    onMove && "cursor-grab active:cursor-grabbing",
                    drag?.href === href && "opacity-40",
                    target && "before:absolute before:inset-x-0 before:h-0.5 before:rounded-full before:bg-primary",
                    target && (fromIdx < idx ? "before:-bottom-[3px]" : "before:-top-[3px]"),
                  )}
                >
                  <Link
                    href={href}
                    draggable={false}
                    onClick={onNavigate}
                    onKeyDown={onMove ? (e) => {
                      if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); move(idx - 1); }
                      if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); move(idx + 1); }
                    } : undefined}
                    aria-current={active(href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-sm px-3 text-[0.9375rem] transition-colors",
                      active(href) ? "bg-primary font-medium text-white" : "text-ink/75 hover:bg-primary-faint hover:text-primary",
                    )}
                  >
                    <Icon className="h-[20px] w-[20px]" /> {label}
                    {n > 0 && (
                      <span aria-label={`${n} new`} className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
                        {n > 99 ? "99+" : n}
                      </span>
                    )}
                  </Link>
                  {onMove && <GripVertical aria-hidden className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 opacity-0 transition-opacity group-hover/nav:opacity-40" />}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ children, admin }: { children: React.ReactNode; admin: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = React.useState(false);
  const [palette, setPalette] = React.useState(false);
  const badges = useAdminBadges(pathname);
  const { sections: menu_, move } = useNavOrder(sections);
  const anyNew = badges.orders + badges.carts + badges.enquiries + badges.returns + badges.reviews > 0;

  const logout = async () => {
    try { await postJson("/api/admin/logout", {}); } catch {}
    toast("Signed out");
    router.replace("/login");
    router.refresh();
  };

  const footer = (
    <div className="border-t border-line pt-4">
      <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-3 rounded-sm px-3 text-sm font-medium text-body hover:bg-primary-faint hover:text-primary">
        <ExternalLink className="h-[18px] w-[18px]" /> View website
      </a>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col self-start overflow-hidden border-r border-line bg-card lg:flex">
        {/* Brand stays pinned; only the menu below scrolls */}
        <div className="flex h-16 shrink-0 items-center border-b border-line px-6"><Logo /></div>
        <div data-lenis-prevent className="nav-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <NavList pathname={pathname} badges={badges} items={menu_} onMove={move} />
        </div>
        <div className="shrink-0 bg-card px-4 pb-4">{footer}</div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-card px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="min-w-0 shrink-0 lg:shrink">
            <div className="lg:hidden"><Logo /></div>
            <p className="hidden items-center gap-2 truncate text-sm font-semibold text-ink lg:flex"><span className="grid h-8 w-8 place-items-center rounded-sm bg-primary/[0.08] text-primary"><ShieldCheck className="h-[18px] w-[18px]" /></span>Admin panel</p>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1.5">
            <button
              type="button"
              onClick={() => setPalette(true)}
              aria-label="Search pages and actions"
              className="flex h-11 w-11 items-center justify-center gap-2 rounded-sm text-sm text-ink/50 hover:bg-primary-faint hover:text-primary sm:h-10 sm:w-auto sm:border sm:border-line sm:px-3"
            >
              <Search className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden />
              <span className="hidden sm:inline">Search…</span>
              <kbd className="ml-4 hidden rounded-sm border border-line px-1.5 text-[11px] sm:inline">Ctrl K</kbd>
            </button>
            <NotificationBell />
            <ThemeToggle className="hidden sm:flex" />
            <AdminAccountMenu name={admin.name} email={admin.email} onLogout={logout} />
            <button onClick={() => setMenu(true)} aria-label="Open admin menu" className="relative flex h-11 w-11 items-center justify-center rounded-sm hover:bg-surface lg:hidden">
              <Menu className="h-6 w-6" />
              {anyNew && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-card" aria-hidden />}
            </button>
          </div>
        </header>
        <CommandPalette open={palette} onOpenChange={setPalette} sections={menu_} websiteUrl={WEBSITE_URL} onLogout={logout} />
        <Drawer open={menu} onClose={() => setMenu(false)} title="Admin menu" side="left" footer={footer}>
          <NavList pathname={pathname} badges={badges} items={menu_} onNavigate={() => setMenu(false)} />
        </Drawer>
        <main className="mx-auto w-full max-w-[1440px] p-4 sm:p-6">{children}</main>
        <footer className="border-t border-line px-4 py-4 text-center text-xs text-ink/50 sm:px-6">
          Created by{" "}
          <a href="https://lexicalsoftware.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
            Lexical Software
          </a>
        </footer>
      </div>
    </div>
  );
}

/** Keep page titles and descriptions available to assistive technology while the visual layout stays compact. */
export function AdminPageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <>
      <div className="sr-only">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="mb-6 flex flex-wrap justify-end gap-4">{action}</div>}
    </>
  );
}
export function ConfirmDialogBody({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed">{children}</p>;
}