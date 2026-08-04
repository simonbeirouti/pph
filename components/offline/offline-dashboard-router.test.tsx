import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  CachedDashboardRoutes,
  OfflineDashboardBoundary,
} from "@/components/offline/offline-dashboard-router"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  state: {
    currentPath: "/dashboard",
    navigate: vi.fn(),
    repositoryState: "preparing" as
      "locked" | "preparing" | "ready" | "unavailable",
    snapshot: null,
    status: "preparing" as "cold" | "preparing",
    viewSource: "server" as "cache" | "server",
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock("@/components/offline/offline-v2-provider", () => ({
  useOfflineV2: () => mocks.state,
}))

afterEach(() => {
  cleanup()
  mocks.refresh.mockClear()
  mocks.state.repositoryState = "preparing"
  mocks.state.status = "preparing"
  mocks.state.viewSource = "server"
})

describe("OfflineDashboardBoundary", () => {
  it("keeps cold SSR visible and usable while the workspace is preparing", () => {
    render(
      <OfflineDashboardBoundary>
        <button type="button">Create job</button>
      </OfflineDashboardBoundary>
    )

    expect(screen.getByRole("status")).toHaveTextContent("Preparing workspace")
    const content = screen.getByRole("button", {
      name: "Create job",
    }).parentElement
    expect(content).not.toHaveAttribute("aria-busy")
    expect(content).not.toHaveAttribute("inert")
  })

  it("keeps content mounted and interactive once the repository is ready", () => {
    mocks.state.repositoryState = "ready"
    const { rerender } = render(
      <OfflineDashboardBoundary>
        <button type="button">Create job</button>
      </OfflineDashboardBoundary>
    )

    const button = screen.getByRole("button", { name: "Create job" })
    expect(button.parentElement).not.toHaveAttribute("inert")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    rerender(
      <OfflineDashboardBoundary>
        <button type="button">Create job</button>
      </OfflineDashboardBoundary>
    )
    expect(screen.getByRole("button", { name: "Create job" })).toBe(button)
  })

  it("does not show a cold-device message while IndexedDB is opening", () => {
    render(<CachedDashboardRoutes />)

    expect(screen.getByRole("status")).toHaveTextContent("Opening workspace")
    expect(
      screen.queryByText("Connect once to prepare this device")
    ).not.toBeInTheDocument()
  })

  it("shows the cold-device message only when preparation is unavailable", () => {
    mocks.state.status = "cold"
    render(<CachedDashboardRoutes />)

    expect(
      screen.getByText("Connect once to prepare this device")
    ).toBeInTheDocument()
  })
})
