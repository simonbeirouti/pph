import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  type BeforeInstallPromptEvent,
  PWA_INSTALL_DISMISSAL_KEY,
  PwaInstallCard,
} from "@/components/pwa-install-card"

const originalUserAgent = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "userAgent"
)
const originalPlatform = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "platform"
)
const originalMaxTouchPoints = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "maxTouchPoints"
)
const originalStandalone = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "standalone"
)

function setNavigatorValue(property: string, value: unknown) {
  Object.defineProperty(Navigator.prototype, property, {
    configurable: true,
    get: () => value,
  })
}

function mockDisplayMode(standalone = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQuery = {
    addEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      }
    ),
    dispatchEvent: vi.fn(),
    matches: standalone,
    media: "(display-mode: standalone)",
    onchange: null,
    removeEventListener: vi.fn(
      (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      }
    ),
  } as unknown as MediaQueryList

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mediaQuery)
  )
}

beforeEach(() => {
  localStorage.clear()
  mockDisplayMode()
  setNavigatorValue("userAgent", "Mozilla/5.0 Chrome/140")
  setNavigatorValue("platform", "Linux x86_64")
  setNavigatorValue("maxTouchPoints", 0)
  setNavigatorValue("standalone", false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()

  for (const [property, descriptor] of [
    ["userAgent", originalUserAgent],
    ["platform", originalPlatform],
    ["maxTouchPoints", originalMaxTouchPoints],
    ["standalone", originalStandalone],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(Navigator.prototype, property, descriptor)
    } else {
      Reflect.deleteProperty(Navigator.prototype, property)
    }
  }
})

describe("PWA install guidance", () => {
  it("shows browser-independent guidance without requiring an install event", async () => {
    render(<PwaInstallCard />)

    const guidance = await screen.findByRole("region", {
      name: "Install Pure Peninsula Honey",
    })

    expect(guidance).toBeVisible()
    expect(guidance).toHaveClass(
      "fixed",
      "inset-x-4",
      "bottom-4",
      "mx-auto",
      "max-w-md",
      "sm:left-auto"
    )
    expect(screen.getByText(/from your browser menu/i)).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Install app" })
    ).not.toBeInTheDocument()
  })

  it("uses the iOS Share to Home Screen flow", async () => {
    setNavigatorValue(
      "userAgent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"
    )

    render(<PwaInstallCard />)

    expect(await screen.findByText(/tap share/i)).toHaveTextContent(
      /Add to Home Screen/
    )
  })

  it("does not render in standalone mode", async () => {
    mockDisplayMode(true)

    render(<PwaInstallCard />)

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Install Pure Peninsula Honey" })
      ).not.toBeInTheDocument()
    )
  })

  it("remembers an explicit dismissal on this browser", async () => {
    const user = userEvent.setup()
    const firstRender = render(<PwaInstallCard />)

    await user.click(
      await screen.findByRole("button", {
        name: "Dismiss install guidance",
      })
    )
    expect(localStorage.getItem(PWA_INSTALL_DISMISSAL_KEY)).toBe("dismissed")
    firstRender.unmount()

    render(<PwaInstallCard />)
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Install Pure Peninsula Honey" })
      ).not.toBeInTheDocument()
    )
  })

  it("gently reminds the employee every 30 seconds while visible", async () => {
    vi.useFakeTimers()
    render(<PwaInstallCard />)

    await act(async () => {
      await Promise.resolve()
    })
    const guidance = screen.getByRole("region", {
      name: "Install Pure Peninsula Honey",
    })

    expect(guidance).not.toHaveClass("motion-safe:animate-bounce")

    act(() => vi.advanceTimersByTime(30_000))
    expect(guidance).toHaveClass("motion-safe:animate-bounce")

    act(() => vi.advanceTimersByTime(1_000))
    expect(guidance).not.toHaveClass("motion-safe:animate-bounce")
    vi.useRealTimers()
  })

  it("offers and completes the captured browser install prompt", async () => {
    const user = userEvent.setup()
    const prompt = vi.fn().mockResolvedValue(undefined)
    render(<PwaInstallCard />)
    await screen.findByRole("region", { name: "Install Pure Peninsula Honey" })

    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt,
      userChoice: Promise.resolve({
        outcome: "accepted" as const,
        platform: "web",
      }),
    }) as BeforeInstallPromptEvent
    fireEvent(window, event)

    await user.click(await screen.findByRole("button", { name: "Install app" }))

    expect(prompt).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Install Pure Peninsula Honey" })
      ).not.toBeInTheDocument()
    )
  })

  it("hides after installation and never requests notification permission", async () => {
    const requestPermission = vi.fn()
    vi.stubGlobal("Notification", { requestPermission })
    render(<PwaInstallCard />)
    await screen.findByRole("region", { name: "Install Pure Peninsula Honey" })

    fireEvent(window, new Event("appinstalled"))

    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Install Pure Peninsula Honey" })
      ).not.toBeInTheDocument()
    )
    expect(requestPermission).not.toHaveBeenCalled()
  })
})
