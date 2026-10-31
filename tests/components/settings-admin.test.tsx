import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { SettingsAdmin } from "@/components/admin/settings-admin";
import { mockFetch, sentBody, sentMethod } from "../helpers";

const admins = [
  { id: "a1", name: "Store owner", email: "owner@shop.com" },
  { id: "a2", name: "Sales manager", email: "sales@shop.com" },
];

describe("<SettingsAdmin /> password", () => {
  it("blocks mismatched passwords without calling the server", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<SettingsAdmin initial={admins} meId="a1" />);
    await user.type(screen.getByLabelText("Current password"), "oldpassword");
    await user.type(screen.getByLabelText("New password"), "brandnewpass");
    await user.type(screen.getByLabelText("Confirm new password"), "different123");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("changes the password and clears the form", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<SettingsAdmin initial={admins} meId="a1" />);
    await user.type(screen.getByLabelText("Current password"), "oldpassword");
    await user.type(screen.getByLabelText("New password"), "brandnewpass");
    await user.type(screen.getByLabelText("Confirm new password"), "brandnewpass");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Password changed"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/password");
    expect(sentBody(fetchMock)).toEqual({ current: "oldpassword", next: "brandnewpass", confirm: "brandnewpass" });
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("shows the server's message when the current password is wrong", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 400, body: { error: "Your current password is incorrect." } }));
    render(<SettingsAdmin initial={admins} meId="a1" />);
    await user.type(screen.getByLabelText("Current password"), "wrongpass");
    await user.type(screen.getByLabelText("New password"), "brandnewpass");
    await user.type(screen.getByLabelText("Confirm new password"), "brandnewpass");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not change password", { description: "Your current password is incorrect." }));
  });
});

describe("<SettingsAdmin /> admin accounts", () => {
  it("marks the signed-in admin as 'You' and gives them no remove button", () => {
    render(<SettingsAdmin initial={admins} meId="a1" />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Store owner" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Sales manager" })).toBeInTheDocument();
  });

  it("adds an admin and lists them", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({ status: 201, body: { id: "a3", name: "New Admin", email: "new@shop.com" } }));
    render(<SettingsAdmin initial={admins} meId="a1" />);
    await user.type(screen.getByLabelText("Name"), "New Admin");
    await user.type(screen.getByLabelText("Email"), "new@shop.com");
    await user.type(screen.getByLabelText("Temporary password"), "temporary123");
    await user.click(screen.getByRole("button", { name: "Add admin" }));
    expect(await screen.findByText("new@shop.com")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/admins");
    expect(sentMethod(fetchMock)).toBe("POST");
  });

  it("shows a duplicate-email error from the server", async () => {
    const user = userEvent.setup();
    mockFetch(() => ({ status: 409, body: { error: "An admin with this email already exists." } }));
    render(<SettingsAdmin initial={admins} meId="a1" />);
    await user.type(screen.getByLabelText("Name"), "Copy");
    await user.type(screen.getByLabelText("Email"), "sales@shop.com");
    await user.type(screen.getByLabelText("Temporary password"), "temporary123");
    await user.click(screen.getByRole("button", { name: "Add admin" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not add admin", { description: "An admin with this email already exists." }));
  });

  it("removes another admin", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(() => ({}));
    render(<SettingsAdmin initial={admins} meId="a1" />);
    await user.click(screen.getByRole("button", { name: "Remove Sales manager" }));
    await waitFor(() => expect(screen.queryByText("sales@shop.com")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/admins/a2", expect.objectContaining({ method: "DELETE" }));
    expect(within(screen.getByRole("list")).getByText("owner@shop.com")).toBeInTheDocument();
  });
});
