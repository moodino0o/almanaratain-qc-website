import assert from "node:assert/strict";

/**
 * Browser regression for the real Vite-served Enter handler.
 * Call with a Playwright Page already open to the app's root preview.
 * It creates an isolated same-origin iframe fixture and does not submit
 * app forms or modify app records, accounts, or roles.
 */
export async function runEnterNavigationBrowserRegression(page) {
  await page.evaluate(() => {
    document.querySelector("#enter-navigation-regression")?.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "enter-navigation-regression";
    iframe.name = "enter-navigation-regression";
    iframe.title = "Temporary Enter navigation regression fixture";
    iframe.style = "display:block;width:100%;height:900px;border:2px solid #666";
    iframe.srcdoc = `<!doctype html><html><head><style>
      body{font:15px Arial;padding:12px} input,textarea{box-sizing:border-box;padding:6px}
      #fixture{display:block} section,form,main,[role=dialog]{margin:10px 0;padding:8px;border:1px solid #bbb}
      #formgrid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:6px}
      #gridcells{display:grid;grid-template-columns:repeat(2,220px);gap:6px}
      .hidden{display:none} #lastForm{border-color:#b44}
    </style></head><body><h2>Enter navigation fixture</h2><div id="fixture"></div></body></html>`;
    document.body.append(iframe);
  });
  const frame = page.frames().find((candidate) => candidate.name() === "enter-navigation-regression");
  assert.ok(frame, "fixture iframe should be present");
  await frame.locator("body").waitFor();

  const loaded = await frame.evaluate(async () => {
    const { handleEntryEnter } = await import("/src/lib/enter-navigation.ts");
    document.addEventListener("keydown", handleEntryEnter);
    document.querySelector("#fixture").innerHTML = `
      <form id="mainform"><h3>Form fields</h3><div id="formgrid">
        <label for="a">A</label><input id="a" value="alpha"><button id="btn" type="button">Button</button>
        <input id="b" type="number" value="17"><input id="empty">
        <input id="ro" value="read" readonly><input id="disabled" value="disabled" disabled>
        <fieldset disabled><input id="fieldsetDisabled" value="fieldset"></fieldset>
        <input id="hiddenType" type="hidden" value="secret"><input id="cssHidden" class="hidden" value="css">
        <div hidden><input id="ancestorHidden" value="ancestor"></div>
        <input id="date" type="date" value="2024-01-02"><textarea id="ta">initial</textarea>
      </div><button id="formSubmit" type="submit">Submit</button><output id="formStatus">submit=0</output></form>
      <section data-entry-scope id="grid"><h3>Editable dimensions</h3><div id="gridcells">
        <input id="g1" value="row1-col1"><input id="g2" value="row1-col2">
        <input id="g3" value="row2-col1"><input id="g4" value="row2-col2">
      </div></section>
      <section data-entry-scope id="skipDimensions"><h3>Results with skipped dimensions</h3>
        <input id="s1" value="row1 load">
        <input id="sLength" data-enter-skip="true" value="100">
        <input id="sWidth" data-enter-skip="true" value="100">
        <input id="sHeight" data-enter-skip="true" value="100">
        <input id="s2" value="row2 weight">
      </section>
      <main><form id="under"><input id="underInput" value="underlying"></form>
        <div role="dialog" id="dialog"><input id="d1" value="dialog1">
          <button type="button">Ignored dialog control</button><input id="d2" value="dialog2">
        </div></main>
      <form id="lastForm"><input id="lastOnly" value="last"><button type="submit">Save</button>
        <output id="lastStatus">submit=0</output></form>`;
    window.fixtureEvents = [];
    window.buttonClicks = 0;
    document.querySelector("#mainform").addEventListener("submit", (event) => {
      event.preventDefault();
      document.querySelector("#formStatus").textContent = "submit=1";
    });
    document.querySelector("#lastForm").addEventListener("submit", (event) => {
      event.preventDefault();
      document.querySelector("#lastStatus").textContent = "submit=1";
    });
    document.querySelector("#btn").addEventListener("click", () => window.buttonClicks++);
    for (const id of ["a", "b"]) for (const type of ["input", "change"]) {
      document.querySelector(`#${id}`).addEventListener(type, () => window.fixtureEvents.push(`${id}:${type}`));
    }
    return typeof handleEntryEnter;
  });
  assert.equal(loaded, "function", "real Vite handler should dynamically import");

  const active = () => frame.evaluate(() => document.activeElement.id);
  await frame.locator("#a").focus();
  await page.keyboard.press("Enter");
  assert.equal(await active(), "b");
  assert.deepEqual(await frame.evaluate(() => window.fixtureEvents), [], "focus movement should not fire input/change");
  await page.keyboard.type("42");
  assert.equal(await frame.locator("#b").inputValue(), "42", "number selection should allow full replacement");
  await page.keyboard.press("Enter");
  assert.equal(await active(), "empty");
  await page.keyboard.press("Enter");
  assert.equal(await active(), "date", "readonly/disabled/hidden inputs should be skipped");
  await page.keyboard.press("Enter");
  assert.equal(await active(), "ta", "native date input should focus without exception");

  await page.keyboard.press("Enter");
  assert.equal(await frame.locator("#ta").inputValue(), "initial", "last textarea Enter should not replace contents");
  await frame.locator("#ta").focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Enter");
  assert.equal(await frame.locator("#ta").inputValue(), "initial\n", "Shift+Enter should insert a newline");

  await frame.locator("#a").focus();
  await page.keyboard.press("Tab");
  assert.equal(await active(), "btn", "Tab should retain native focus order");
  await page.keyboard.press("Enter");
  assert.equal(await frame.evaluate(() => window.buttonClicks), 1, "Enter on button should activate it");

  const gridOrder = [];
  await frame.locator("#g1").focus();
  for (let i = 0; i < 4; i++) {
    gridOrder.push(await active());
    await page.keyboard.press("Enter");
  }
  gridOrder.push(await active());
  assert.deepEqual(gridOrder, ["g1", "g2", "g3", "g4", "g4"]);

  await frame.locator("#s1").focus();
  await page.keyboard.press("Enter");
  assert.equal(await active(), "s2", "Enter skips all three marked dimensions across rows");
  await frame.locator("#sLength").focus();
  await page.keyboard.press("Enter");
  assert.equal(await active(), "s2", "Enter from a manually focused dimension still advances");
  await frame.locator("#s1").focus();
  await page.keyboard.press("Tab");
  assert.equal(await active(), "sLength", "skipped dimensions remain reachable with Tab");

  await frame.locator("#d1").focus();
  await page.keyboard.press("Enter");
  assert.equal(await active(), "d2");
  await page.keyboard.press("Enter");
  assert.equal(await active(), "d2", "dialog last field must not navigate to the underlying page");
  assert.equal(await frame.locator("#underInput").inputValue(), "underlying");

  await frame.locator("#lastOnly").focus();
  await page.keyboard.press("Enter");
  assert.equal(await active(), "lastOnly");
  assert.equal(await frame.locator("#lastStatus").textContent(), "submit=0");
  assert.equal(await frame.locator("#formStatus").textContent(), "submit=0");
  return { module: "/src/lib/enter-navigation.ts", gridOrder, numberValue: "42", submitCount: 0 };
}
