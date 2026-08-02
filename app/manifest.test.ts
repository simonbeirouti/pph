import { describe, expect, it } from "vitest"

import manifest from "@/app/manifest"

describe("PWA manifest", () => {
  it("publishes the install metadata and icon contract", () => {
    expect(manifest()).toEqual({
      name: "Pure Peninsula Honey",
      short_name: "PPH",
      description:
        "Roster employees, assign operational jobs, and review completed work.",
      start_url: "/dashboard",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#ffffff",
      theme_color: "#facc15",
      categories: ["business", "productivity"],
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
        {
          src: "/icons/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    })
  })
})
