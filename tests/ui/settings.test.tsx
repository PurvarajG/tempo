import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import CalendarFeed from "@/components/settings/CalendarFeed";
import ICloudStatus from "@/components/settings/ICloudStatus";

describe("calendar feed settings", () => {
  test("explains the setup instead of showing a URL when the secret is unset", () => {
    render(<CalendarFeed token={null} />);

    expect(screen.getByText(/CALENDAR_FEED_SECRET/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });

  test("shows a subscribable URL carrying the token", () => {
    render(<CalendarFeed token="s3cret-token" />);

    const field = screen.getByRole("textbox") as HTMLInputElement;
    expect(field.value).toBe(
      `${window.location.protocol}//${window.location.host}/api/calendar-feed?token=s3cret-token`,
    );
    expect(field).toHaveAttribute("readonly");
  });

  test("percent-encodes a token with URL-significant characters", () => {
    render(<CalendarFeed token="a b&c=d" />);

    const field = screen.getByRole("textbox") as HTMLInputElement;
    expect(field.value).toContain("token=a%20b%26c%3Dd");
  });

  test("copies the URL to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CalendarFeed token="s3cret-token" />);
    await userEvent.click(screen.getByRole("button", { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.protocol}//${window.location.host}/api/calendar-feed?token=s3cret-token`,
    );
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  test("warns that the URL is a credential", () => {
    render(<CalendarFeed token="s3cret-token" />);
    expect(screen.getByText(/anyone with this link/i)).toBeInTheDocument();
  });
});

describe("icloud status", () => {
  test("says connected and read-only when configured", () => {
    render(<ICloudStatus configured />);
    expect(screen.getByText("Connected.")).toBeInTheDocument();
    expect(screen.getByText(/never written back/i)).toBeInTheDocument();
    expect(screen.queryByText(/ICLOUD_APPLE_ID/)).not.toBeInTheDocument();
  });

  test("explains how to connect when not configured", () => {
    render(<ICloudStatus configured={false} />);
    expect(screen.getByText(/aren't connected yet/i)).toBeInTheDocument();
    expect(screen.getByText("ICLOUD_APPLE_ID")).toBeInTheDocument();
    expect(screen.getByText(/app-specific password/i)).toBeInTheDocument();
  });
});
