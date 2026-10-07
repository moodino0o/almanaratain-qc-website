type EntryField = HTMLInputElement | HTMLTextAreaElement;

const nonEntryTypes = new Set([
  "hidden", "button", "submit", "reset", "checkbox", "radio", "file", "range", "color", "image",
]);

function isEditableEntryField(element: Element): element is EntryField {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return false;
  if (element instanceof HTMLInputElement && nonEntryTypes.has(element.type)) return false;
  return !element.readOnly &&
    !element.matches(":disabled") &&
    element.getAttribute("aria-disabled") !== "true" &&
    !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === "visible";
}

export function handleEntryEnter(event: KeyboardEvent) {
  if (
    event.key !== "Enter" ||
    event.defaultPrevented ||
    event.isComposing ||
    event.keyCode === 229 ||
    event.shiftKey || event.ctrlKey || event.altKey || event.metaKey ||
    !(event.target instanceof Element) ||
    !isEditableEntryField(event.target)
  ) return;

  const current = event.target;
  // Keep open autocomplete menus' Enter-to-choose behavior intact.
  if (current.getAttribute("aria-expanded") === "true") return;

  // Dialogs and forms are independent scopes; tables without a form use the page.
  // Query order follows the forms' row-major grids and tables, without buttons.
  const scope = current.closest('form, [role="dialog"], [data-entry-scope]') ??
    current.closest("main");
  if (!scope) return;
  const fields = Array.from(scope.querySelectorAll("input, textarea"))
    .filter(isEditableEntryField);
  const index = fields.indexOf(current);
  if (index === -1) return;

  // Enter is navigation, never implicit submission (including at the last field).
  event.preventDefault();
  const next = fields.slice(index + 1).find((field) => field.dataset.enterSkip !== "true");
  if (!next) return;
  next.focus();
  if (next.value !== "") next.select();
}
