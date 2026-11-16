import { mediaResponse } from "@/lib/media-response";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return mediaResponse((await params).id, "video");
}
