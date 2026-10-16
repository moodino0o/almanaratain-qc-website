from pathlib import Path
import json
import fitz

source = Path("attached_assets/Complaints_Tracking_-_Google_Sheets_1789886106926.pdf")
output = Path(".agents/outputs/complaints_pdf/extracted_pages.json")

document = fitz.open(source)
pages = []
for index, page in enumerate(document):
    pages.append({
        "page": index + 1,
        "text": page.get_text("text"),
        "blocks": page.get_text("blocks"),
        "words": page.get_text("words"),
    })

output.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
print(f"pages={len(pages)} output={output}")
for page in pages[:3]:
    print(f"\n--- page {page['page']} ---")
    print(page["text"][:5000])