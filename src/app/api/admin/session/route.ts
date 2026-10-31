import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Lets the public navbar know whether to show "Admin" (login) or "Dashboard". */
export async function GET() {
  let session = null;
  try { session = await getSession(); } catch { /* database/env problem: treat as signed out */ }
  return Response.json(
    { signedIn: !!session, name: session?.name ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
