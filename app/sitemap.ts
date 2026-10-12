import type { MetadataRoute } from "next";

const ROUTES = ["/", "/dashboard", "/upload", "/jobs", "/roadmap", "/quiz", "/assistant", "/profile", "/auth"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  return ROUTES.map((p) => ({
    url: `${base}${p === "/" ? "" : p}`,
    lastModified: now,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1 : 0.7,
  }));
}
