import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

const ROUTES = ["/", "/dashboard", "/upload", "/jobs", "/roadmap", "/quiz", "/assistant", "/profile", "/auth"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return ROUTES.map((p) => ({
    url: `${base}${p === "/" ? "" : p}`,
    lastModified: now,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1 : 0.7,
  }));
}
