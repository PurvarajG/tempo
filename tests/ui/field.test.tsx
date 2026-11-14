import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Field, SavingInput } from "@/components/ui/Field";

describe("Field", () => {
  test("label is linked to the control via htmlFor", () => {
    render(
      <Field label="Name" htmlFor="n">
        <input id="n" />
      </Field>,
    );
    expect(screen.getByLabelText("Name")).toBe(document.getElementById("n"));
  });
});

describe("SavingInput", () => {
  test("blur saves the typed text", async () => {
    const onSave = vi.fn();
    render(<SavingInput id="a" label="Title" value="old" onSave={onSave} />);
    const input = screen.getByLabelText("Title");
    await userEvent.clear(input);
    await userEvent.type(input, "new");
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith("new");
  });

  test("Enter saves a single-line field", async () => {
    const onSave = vi.fn();
    render(<SavingInput id="a" label="Title" value="old" onSave={onSave} />);
    const input = screen.getByLabelText("Title");
    await userEvent.type(input, "x{Enter}");
    expect(onSave).toHaveBeenCalledWith("oldx");
  });

  test("Enter in a multiline field does not save", async () => {
    const onSave = vi.fn();
    render(<SavingInput id="a" label="Notes" value="" onSave={onSave} multiline />);
    await userEvent.type(screen.getByLabelText("Notes"), "a{Enter}b");
    expect(onSave).not.toHaveBeenCalled();
  });

  test("outside change is taken when not focused", () => {
    const { rerender } = render(<SavingInput id="a" label="Title" value="one" onSave={vi.fn()} />);
    rerender(<SavingInput id="a" label="Title" value="two" onSave={vi.fn()} />);
    expect(screen.getByLabelText("Title")).toHaveValue("two");
  });

  test("outside change is ignored while typing", async () => {
    const onSave = vi.fn();
    const { rerender } = render(<SavingInput id="a" label="Title" value="one" onSave={onSave} />);
    const input = screen.getByLabelText("Title");
    await userEvent.type(input, "!");
    rerender(<SavingInput id="a" label="Title" value="two" onSave={onSave} />);
    expect(input).toHaveValue("one!");
  });
});
