from pathlib import Path

import fitz


pdf_path = Path("attached_assets/4''_Hollow_Plain_Block_()_1790069959446.pdf")
output_dir = Path(".agents/outputs/block_report_pdf")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(pdf_path)
for page_number, page in enumerate(document, start=1):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pixmap.save(output_dir / f"page-{page_number}.png")
    print(f"Rendered page {page_number}: {page.rect.width:g} x {page.rect.height:g} points")