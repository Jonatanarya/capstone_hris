# Explainer: CSV exports open as a tidy table

> This doc explains the change on branch `claude/csv-tidy-table` that makes every
> CSV export open as a neat, column-separated table in Excel. Audience: anyone
> touching the HRIS reporting code. The beginner background can be skipped if you
> already know how CSV and Excel interact.

## Background

The HRIS app lets HR and managers download reports — employees, attendance,
leave, payroll, performance — as CSV files. A CSV ("comma-separated values") is
just plain text: one row per line, with cells separated by a delimiter. There is
no font, no column width, no styling — the file only records the raw values and a
delimiter between them.

The program that opens the file decides how to split those cells back into
columns. Here is the catch: **Excel does not always split on a comma.** It splits
on the operating system's _list separator_, which is locale-dependent. On an
English/US machine that separator is a comma, so a comma-delimited file lands
tidily in columns. On an Indonesian (or German, French, …) machine the list
separator is a semicolon `;`, so Excel sees no delimiter it recognizes and dumps
the entire row into a single cell in column A. The file is correct, but it looks
like a wall of text.

> **Why a BOM already existed:** the code already prefixed each file with a UTF-8
> BOM (`\uFEFF`). That byte-order mark tells Excel the text is UTF-8, which keeps
> accented names and `Rp` symbols from turning into mojibake. It does **not**
> affect column splitting.

In this codebase the exports are produced in two places:

- **Demo (client) mode** — `app/hris-app.tsx`, function `download()`. It builds a
  2-D array of rows and turns it into a `Blob` the browser downloads.
- **Live (server) mode** — `app/api/v1/reports/[kind]/route.ts`. Supabase queries
  build the rows and `toCsv()` serializes them into the HTTP response.

Both paths shared the same cell-escaping helper, `csvCell()` in `lib/hris.ts`, but
each stitched the final document together on its own.

## Intuition

There is a little-known directive that Excel honors: if the very first line of the
file is `sep=,`, Excel uses a comma as the delimiter regardless of the machine's
locale. So the fix is one line at the top of the file.

Concretely, imagine a two-row payroll export:

```text
"Nama","Gaji Bersih"
"Rizky","5000000"
```

On an Indonesian Excel this becomes one column: `Nama,Gaji Bersih` in A1. Prepend
the hint:

```text
sep=,
"Nama","Gaji Bersih"
"Rizky","5000000"
```

and Excel now puts `Nama` in A1 and `Gaji Bersih` in B1 — a real table. The data
bytes are unchanged; we only told Excel how to read them.

> ⚠️ The `sep=,` line is an Excel convention. Google Sheets does not understand it
> and will show `sep=,` as a literal first row. For this project the target is
> Excel, which is where the "messy single column" complaint comes from.

## Code

The core idea is to centralize document assembly in one helper so both export
paths behave identically. New function in `lib/hris.ts`, right next to the
existing `csvCell()`:

```ts
export function csvDocument(rows: unknown[][]) {
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return "\uFEFF" + "sep=,\r\n" + body;
}
```

It keeps the BOM, adds the `sep=,` hint, and reuses `csvCell()` so
formula-injection protection (`=`, `+`, `-`, `@`) and quote escaping are
untouched.

The **client** path in `app/hris-app.tsx` now calls the helper instead of
hand-joining and hand-prefixing:

```ts
const u = URL.createObjectURL(
  new Blob([csvDocument(rows)], { type: "text/csv;charset=utf-8" }),
);
```

The **server** path in `app/api/v1/reports/[kind]/route.ts` collapses its local
`toCsv()` onto the same helper (header row first):

```ts
function toCsv(header: string[], rows: unknown[][]) {
  return csvDocument([header, ...rows]);
}
```

The import changed from `csvCell` to `csvDocument` in both files; `csvCell` stays
exported because the new helper and the unit tests still use it.

## Verification

- `npm run typecheck` — passes, no errors.
- `npm run lint -- --max-warnings=0` — clean.
- `npm test` — **171 unit tests pass**, including the `csvCell` formula/quote-escaping
  test and the `export` test.
- Output sanity check: generating a sample document yields `\uFEFF` + `sep=,\r\n`
  followed by the escaped rows, with `=cmd` correctly neutralized to `'=cmd`.

> **Manual QA:** run the app, sign in as HR, open any report card and click
> **Unduh CSV** (or export payroll/attendance). Open the downloaded file in Excel
> on an Indonesian-locale machine: the data should now land in separate columns
> instead of a single column. Repeat in both demo and live modes.

## Alternatives

| Option B — true styled spreadsheet (.xls/.xlsx) | Chosen — `sep=,` + BOM (stay CSV) |
| --- | --- |
| **Pros**<br>• Visually richest: bold headers, borders, auto column widths.<br>• No locale dependency at all. | **Pros**<br>• One-line change, no new dependency, file stays `.csv`.<br>• All existing CSV tests keep passing. |
| **Cons**<br>• Changes the file extension and content type; breaks `.csv` assumptions in e2e tests.<br>• Either a new dependency (SheetJS/ExcelJS) or an HTML-table hack to maintain. | **Cons**<br>• `sep=,` is Excel-specific; Google Sheets shows it as a literal first row.<br>• Still plain text, so no cell styling. |

## Suggested people to talk to

Every recent commit touching `app/hris-app.tsx`,
`app/api/v1/reports/[kind]/route.ts`, and `lib/hris.ts` is authored by **arsant**
(`90704301+Jonatanarya`), who built the Supabase-backed v1 API and the
reporting/export flow. That is the single best person to review this change — they
own both the client download logic and the server report route. No other distinct
contributors appear in the history of these files.

## Quiz

<details>
<summary>1. Why does the current CSV land in a single column on an Indonesian Excel?</summary>

- A) The file is missing a UTF-8 BOM
- B) Excel splits on the locale's list separator, which is `;`, not `,`
- C) The commas are being escaped incorrectly
- D) The rows are joined with `\n` instead of `\r\n`

**Answer: B.** The bytes are a valid comma-delimited file; Excel just uses the OS
list separator (`;` in id-ID) to split, so it finds no delimiter and keeps the row
whole. A is wrong — the BOM was already present and only affects encoding. C/D do
not change column splitting.

</details>

<details>
<summary>2. What exactly does prepending <code>sep=,</code> do?</summary>

- A) Converts the file to real XLSX
- B) Forces Excel to use a comma as the delimiter regardless of locale
- C) Removes the need for the BOM
- D) Tells Google Sheets how to parse the file

**Answer: B.** `sep=,` is an Excel directive on the first line that overrides the
locale's list separator. It is not a format conversion (A), it does not replace
the BOM's encoding role (C), and Google Sheets ignores it (D).

</details>

<details>
<summary>3. Why was the logic centralized in <code>csvDocument()</code> instead of edited in two places?</summary>

- A) To make the client bundle smaller
- B) So the demo and live export paths stay byte-for-byte consistent and the fix lives in one place
- C) Because `csvCell` was going to be deleted
- D) To avoid importing from `lib/hris.ts`

**Answer: B.** Both paths previously assembled the document separately; one shared
helper guarantees identical output and a single future edit point. `csvCell` is
still used and exported (C false). The change actually keeps importing from
`lib/hris.ts` (D false).

</details>

<details>
<summary>4. Is the formula-injection protection affected by this change?</summary>

- A) No — `csvDocument()` still runs every cell through `csvCell()`
- B) Yes — the `sep=,` line disables it
- C) Yes — the BOM now neutralizes formulas
- D) It was removed as unnecessary

**Answer: A.** `csvDocument()` maps each cell through the unchanged `csvCell()`,
which still prefixes a leading `=`, `+`, `-`, or `@` with an apostrophe. The
sanity check confirmed `=cmd` becomes `'=cmd`.

</details>

<details>
<summary>5. Which trade-off did we knowingly accept?</summary>

- A) Larger file size from styling metadata
- B) The `sep=,` line appears as a literal first row if the file is opened in Google Sheets
- C) Accented characters may corrupt
- D) The file extension changes to `.xls`

**Answer: B.** `sep=,` is Excel-only, so Sheets shows it literally. There is no
styling metadata (A), the BOM still protects encoding (C), and we deliberately
kept the `.csv` extension (D).

</details>
