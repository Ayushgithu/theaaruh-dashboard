import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { AnnouncementAdmin } from "@/components/admin/announcement-admin";
import { mockFetch, sentBody, sentMethod } from "../helpers";

const a1 = { id: "64b7f0c2a1b2c3d4e5f60301", text: "Free delivery on every order", active: true };
const a2 = { id: "64b7f0c2a1b2c3d4e5f60302", text: "Festive bundle", href: "/shop", active: false };

describe("<AnnouncementAdmin /> (Top bar CRUD)", () => {
  it("lists messages with live/hidden state", () => {
    render(<AnnouncementAdmin initial={[a1, a2]} />);
    expect(screen.getByRole("switch", { name: /Hide Free delivery/ })).toBeChecked();
    expect(screen.getByRole("switch", { name: /Show Festive bundle/ })).not.toBeChecked();
    expect(screen.getByText("/shop")).toBeInTheDocument();
  });

  it("only previews the active messages", () => {
    render(<AnnouncementAdmin initial={[a2]} />);
    expect(screen.getByText(/No active messages/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no messages", () => {
    render(<AnnouncementAdmin initial={[]} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("CREATE: validates, then POSTs and lists the new message", async () => {
    const user = userEvent.setup();
    const created = { id: "64b7f0c2a1b2c3d4e5f60399", text: "Diwali sale: extra 10% off", active: true };
    const fetchMock = mockFetch(() => ({ status: 201, body: created }));
    render(<AnnouncementAdmin initial={[]} />);
    await user.click(screen.getAllByRole("button", { name: "Add message" })[0]);
    const form = screen.getByRole("dialog", { name: "Add message" });

    await user.click(within(form).getByRole("button", { name: "Add message" }));
    expect(await within(form).findByText(/at least 3 characters/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText("Message"), "Diwali sale: extra 10% off");
    await user.click(within(form).getByRole("button", { name: "Add message" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/announcements");
    expect(sentMethod(fetchMock)).toBe("POST");
    expect(sentBody(fetchMock)).toEqual({ text: "Diwali sale: extra 10% off", active: true });
    expect((await screen.findAllByText("Diwali sale: extra 10% off")).length).toBeGreaterThan(0);
  });

  it("CREATE: rejects a link that is not a path or https URL", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<AnnouncementAdmin initial={[]} />);
    await user.click(screen.getAllByRole("button", { name: "Add message" })[0]);
    const form = screen.getByRole("dialog", { name: "Add message" });
    await user.type(within(form).getByLabelText("Message"), "Big sale today");
    await user.type(within(form).getByLabelText("Link (optional)"), "javascript:alert(1)");
    await user.click(within(form).getByRole("button", { name: "Add message" }));
    expect(await within(form).findByText(/page path/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("UPDATE: edits a message with PUT", async () => {
    const user = userEvent.setup();
    const updated = { ...a1, text: "Free delivery all over India" };
    const fetchMock = mockFetch(() => ({ body: updated }));
    render(<AnnouncementAdmin initial={[a1]} />);
    await user.click(screen.getByRole("button", { name: `Edit ${a1.text}` }));
    const form = screen.getByRole("dialog", { name: "Edit message" });
    const input = within(form).getByLabelText("Message");
    expect(input).toHaveValue(a1.text);
    await user.clear(input);
    await user.type(input, "Free delivery all over India");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/admin/announcements/${a1.id}`);
    expect(sentMethod(fetchMock)).toBe("PUT");
    expect(sentBody(fetchMock)).toMatchObject({ text: "Free delivery all over India", active: true });
    expect((await screen.findAllByText("Free delivery all over India")).length).toBeGreaterThan(0);
  });

  it("UPDATE: the live/hidden switch sends only { active }", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<AnnouncementAdmin initial={[a1]} />);
    await user.click(screen.getByRole("switch", { name: /Hide Free delivery/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock)).toEqual({ active: false });
    expect(toast.success).toHaveBeenCalledWith("Message hidden from website");
  });

  it("UPDATE: rolls the switch back when the server fails", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 500, body: { error: "Nope" } }));
    render(<AnnouncementAdmin initial={[a1]} />);
    await user.click(screen.getByRole("switch", { name: /Hide Free delivery/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not update", { description: "Nope" }));
    expect(screen.getByRole("switch", { name: /Hide Free delivery/ })).toBeChecked();
  });

  it("DELETE: asks first, then removes via DELETE", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<AnnouncementAdmin initial={[a1, a2]} />);
    await user.click(screen.getByRole("button", { name: `Delete ${a1.text}` }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete message" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: `Edit ${a1.text}` })).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/announcements/${a1.id}`, expect.objectContaining({ method: "DELETE" }));
    expect(screen.getByRole("button", { name: `Edit ${a2.text}` })).toBeInTheDocument();
  });
});