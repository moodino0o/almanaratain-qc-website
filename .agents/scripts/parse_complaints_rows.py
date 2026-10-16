from __future__ import annotations

from datetime import datetime
from pathlib import Path
import json
import re

import fitz


SOURCE = Path("attached_assets/Complaints_Tracking_-_Google_Sheets_1789886106926.pdf")
OUTPUT = Path(".agents/outputs/complaints_pdf/complaints_rows.json")

# These are the fixed Google Sheets column boundaries visible in the PDF.
X_BOUNDS = [
    50.2, 87.7, 125.0, 162.3, 204.7, 254.9, 314.7, 352.0, 389.3,
    426.6, 469.4, 511.9, 549.2, 586.4, 638.9, 679.1, 716.4, 753.7, 791.1,
]

DATE_COLUMNS = {0, 1, 17}
DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")


def horizontal_table_lines(page: fitz.Page) -> list[float]:
    values: list[float] = []
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] != "l":
                continue
            (x0, y0), (x1, y1) = item[1], item[2]
            if abs(y1 - y0) < 1 and abs(x1 - x0) > 700:
                values.append((y0 + y1) / 2)
    return sorted(set(round(value, 1) for value in values))


def format_cell(words: list[tuple]) -> str:
    if not words:
        return ""
    ordered = sorted(words, key=lambda word: (word[1], word[0]))
    lines: list[str] = []
    current_y: float | None = None
    current: list[str] = []
    for word in ordered:
        x0, y0, x1, y1, text = word[:5]
        if current_y is None or abs(y0 - current_y) <= 2.5:
            current.append(text)
            if current_y is None:
                current_y = y0
        else:
            lines.append(" ".join(current))
            current = [text]
            current_y = y0
    if current:
        lines.append(" ".join(current))
    return "\n".join(line.strip() for line in lines if line.strip()).strip()


def cell_text(words: list[tuple], row_top: float, row_bottom: float, column: int) -> str:
    left, right = X_BOUNDS[column], X_BOUNDS[column + 1]
    selected = [
        word for word in words
        if row_top < (word[1] + word[3]) / 2 < row_bottom
        and left <= (word[0] + word[2]) / 2 < right
    ]
    return format_cell(selected)


def normalized_date(value: str) -> str | None:
    value = value.strip()
    if not DATE_RE.match(value):
        return None
    return datetime.strptime(value, "%d/%m/%Y").date().isoformat()


document = fitz.open(SOURCE)
rows: list[dict] = []

for page_index, page in enumerate(document):
    lines = horizontal_table_lines(page)
    words = page.get_text("words")
    for row_index, (top, bottom) in enumerate(zip(lines, lines[1:])):
        # Page 1 has the column headings in its first band.
        if page_index == 0 and row_index == 0:
            continue
        cells = [cell_text(words, top, bottom, column) for column in range(18)]
        # Google Sheets repeats the frozen header after a row that crosses a
        # printed page. It is another bordered band, not a complaint record.
        header_text = " ".join(cells).upper().replace("\n", " ")
        if "CUSTOMER NAME" in header_text or "DATE OF COMPLAINT" in header_text:
            continue
        # Blank Google Sheets rows still have table borders; ignore them.
        if not any(cells):
            continue
        if not any(cells[column] for column in range(0, 11)):
            continue
        rows.append({
            "sourcePage": page_index + 1,
            "sourceRow": row_index + 1,
            "dateOfComplaint": normalized_date(cells[0]),
            "dateOfIssue": normalized_date(cells[1]),
            "complaintClosed": cells[2],
            "customerName": cells[3],
            "salesman": cells[4],
            "customerType": cells[5],
            "orderNo": cells[6],
            "issueType": cells[7],
            "department": cells[8],
            "site": cells[9],
            "affectedProduct": cells[10],
            "salesNotes": cells[11],
            "departmentNotes": cells[12],
            "qcNotes": cells[13],
            "currentStatus": cells[14],
            "customerOutcome": cells[15],
            "stepsTaken": cells[16],
            "dateClosed": normalized_date(cells[17]),
            "rawCells": cells,
        })

OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"rows={len(rows)} output={OUTPUT}")
for row in rows[:5]:
    print(json.dumps({key: value for key, value in row.items() if key != "rawCells"}, ensure_ascii=False))