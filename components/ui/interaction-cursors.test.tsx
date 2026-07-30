import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

afterEach(cleanup)

describe("shared interaction cursors", () => {
  it("marks buttons and tabs as clickable while retaining disabled cursors", () => {
    render(
      <>
        <Button>Save</Button>
        <Button disabled>Disabled save</Button>
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger disabled value="two">
              Two
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </>
    )

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "cursor-pointer"
    )
    expect(
      screen.getByRole("button", { name: "Disabled save" })
    ).toHaveClass("cursor-pointer", "disabled:cursor-not-allowed")
    expect(screen.getByRole("tab", { name: "One" })).toHaveClass(
      "cursor-pointer"
    )
    expect(screen.getByRole("tab", { name: "Two" })).toHaveClass(
      "disabled:cursor-not-allowed"
    )
  })

  it("marks select triggers and options as clickable", async () => {
    const user = userEvent.setup()
    render(
      <Select defaultValue="one">
        <SelectTrigger aria-label="Choice">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one">One</SelectItem>
          <SelectItem value="two">Two</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByRole("combobox", { name: "Choice" })
    expect(trigger).toHaveClass("cursor-pointer")
    await user.click(trigger)
    expect(await screen.findByRole("option", { name: "Two" })).toHaveClass(
      "cursor-pointer"
    )
  })
})
