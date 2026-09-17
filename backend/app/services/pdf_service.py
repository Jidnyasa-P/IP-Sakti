"""
Server-side PDF export for the Product Analyzer and TK/ABS decision
engines (app/services/decision_engines.py).

Generates a PDF *from the actual stored/generated backend result* — never
from raw JSON dumped into a .pdf extension, and never inventing content
that the engine did not produce. Used by:

    GET /api/products/{product_id}/pdf   (app/api/routes/products.py)
    GET /api/tk-abs/{analysis_id}/pdf    (app/api/routes/products.py)

Uses reportlab (pure Python, no system/OS-level dependency such as
wkhtmltopdf or a headless browser) so PDF generation keeps working in the
same zero-external-setup DEMO MODE as the rest of this backend — it needs
no external service and has no online/offline fallback distinction to
make, unlike Gemini/Qdrant/Neo4j/Bhashini.
"""
import io
from datetime import datetime, timezone
from typing import Any, Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_styles = getSampleStyleSheet()
_TITLE = ParagraphStyle("IPSAKTITitle", parent=_styles["Title"], fontSize=18, spaceAfter=4)
_SUBTITLE = ParagraphStyle("IPSAKTISubtitle", parent=_styles["Normal"], textColor=colors.HexColor("#475569"), spaceAfter=14)
_H2 = ParagraphStyle("IPSAKTIH2", parent=_styles["Heading2"], fontSize=12.5, spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#065f46"))
_H3 = ParagraphStyle("IPSAKTIH3", parent=_styles["Heading3"], fontSize=10.5, spaceBefore=8, spaceAfter=3, textColor=colors.HexColor("#0f172a"))
_BODY = ParagraphStyle("IPSAKTIBody", parent=_styles["Normal"], fontSize=9.5, leading=13.5)
_META = ParagraphStyle("IPSAKTIMeta", parent=_styles["Normal"], fontSize=8.5, textColor=colors.HexColor("#64748b"))


def _safe_text(value: Any, fallback: str = "Not specified") -> str:
    """Handles missing/None optional fields gracefully; escapes the handful
    of characters reportlab's Paragraph mini-markup treats specially so
    stored free text can never break PDF layout."""
    if value is None or value == "":
        return fallback
    text = str(value)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _para(value: Any, style: ParagraphStyle = _BODY, fallback: str = "Not specified") -> Paragraph:
    return Paragraph(_safe_text(value, fallback), style)


def _bullet_list(items: Iterable[Any], style: ParagraphStyle = _BODY) -> ListFlowable | Paragraph:
    items = [i for i in (items or []) if i not in (None, "")]
    if not items:
        return Paragraph("None recorded.", style)
    return ListFlowable(
        [ListItem(Paragraph(_safe_text(i), style), leftIndent=4) for i in items],
        bulletType="bullet",
        start="circle",
        leftIndent=12,
    )


def _key_value_rows(pairs: list[tuple[str, Any]]) -> Table:
    data = [[Paragraph(f"<b>{_safe_text(k)}</b>", _BODY), _para(v)] for k, v in pairs]
    table = Table(data, colWidths=[45 * mm, 120 * mm])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
    ]))
    return table


def _citations_flowable(citations: list[dict]) -> ListFlowable | Paragraph:
    citations = citations or []
    if not citations:
        return Paragraph("No supporting citations were retrieved for this result.", _BODY)
    rows = []
    for c in citations[:12]:
        title = c.get("title") or c.get("document_title") or c.get("source") or "Untitled source"
        authority = c.get("authority") or ""
        chunk_id = c.get("chunk_id") or c.get("id") or ""
        label = f"{title}" + (f" — {authority}" if authority else "") + (f" ({chunk_id})" if chunk_id else "")
        rows.append(ListItem(Paragraph(_safe_text(label), _BODY), leftIndent=4))
    return ListFlowable(rows, bulletType="bullet", start="circle", leftIndent=12)


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#94a3b8"))
    canvas.drawString(18 * mm, 12 * mm, "IP-SAKTI Sahayak — generated decision-support document. Not formal legal counsel.")
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _build(title: str, subtitle: str, body_flowables: list) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
        title=title,
    )
    generated_at = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    flow = [
        Paragraph(_safe_text(title), _TITLE),
        Paragraph(_safe_text(subtitle), _SUBTITLE),
        Paragraph(f"Generated: {generated_at}", _META),
        Spacer(1, 8),
        *body_flowables,
    ]
    doc.build(flow, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()


def generate_product_analysis_pdf(record: dict) -> bytes:
    """`record` is the persisted product_analyses document shape produced by
    app/models/product.py:to_dict() — i.e. the exact result already
    returned by POST /api/products/analyze, never re-derived."""
    product = record.get("product_information") or {}
    confidence = record.get("confidence") or {}
    tk_abs = record.get("traditional_knowledge_abs_flags") or {}
    ipr = record.get("ipr_considerations") or {}

    flow: list = []

    flow.append(Paragraph("Product Information", _H2))
    flow.append(_key_value_rows([
        ("Product name", product.get("product_name")),
        ("Product type", product.get("product_type")),
        ("Dosage form", product.get("dosage_form")),
        ("Ingredients", product.get("ingredients")),
        ("Classical reference", product.get("classical_reference")),
        ("Intended use", product.get("intended_use")),
        ("Claims made", product.get("claims")),
        ("Target market", product.get("target_market")),
    ]))

    flow.append(Paragraph("Likely Category &amp; Reasoning", _H2))
    flow.append(_key_value_rows([
        ("Likely category", record.get("likely_category")),
        ("Confidence level", confidence.get("level")),
        ("Confidence score", confidence.get("score")),
    ]))
    flow.append(_para(record.get("category_reasoning")))
    if confidence.get("reasons"):
        flow.append(Paragraph("Confidence reasoning", _H3))
        flow.append(_bullet_list(confidence.get("reasons")))

    flow.append(Paragraph("Regulatory Considerations", _H2))
    for item in record.get("regulatory_considerations") or []:
        flow.append(Paragraph(_safe_text(item.get("title", "Requirement")), _H3))
        flow.append(_key_value_rows([
            ("Description", item.get("description")),
            ("Governing statute", item.get("governing_statute")),
            ("Actionable requirement", item.get("actionable_requirement")),
        ]))
    if not record.get("regulatory_considerations"):
        flow.append(Paragraph("None recorded.", _BODY))

    flow.append(Paragraph("IPR Considerations", _H2))
    flow.append(_key_value_rows([
        ("Patent assessment", ipr.get("patent_assessment")),
        ("Section 3(p) TK bar", ipr.get("section_3p_tk_bar")),
        ("Section 3(e) admixture bar", ipr.get("section_3e_admixture_bar")),
        ("Trademark recommendation", ipr.get("trademark_recommendation")),
        ("Industrial design", ipr.get("industrial_design")),
        ("Trade secret potential", ipr.get("trade_secret_potential")),
    ]))

    flow.append(Paragraph("Traditional Knowledge / ABS Flags", _H2))
    flow.append(_key_value_rows([
        ("TK prior-art risk", tk_abs.get("tk_prior_art_risk")),
        ("TK details", tk_abs.get("tk_details")),
        ("Biological resource status", tk_abs.get("biological_resource_status")),
        ("NBA / ABS requirements", tk_abs.get("nba_abs_requirements")),
        ("Forms required", tk_abs.get("form_required")),
    ]))

    flow.append(Paragraph("Recommended Next Steps", _H2))
    flow.append(_bullet_list(record.get("recommended_next_steps")))

    flow.append(Paragraph("Evidence &amp; Citations", _H2))
    flow.append(_citations_flowable(record.get("evidence")))

    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        f"Analysis ID: {_safe_text(record.get('id') or record.get('_id'))} &nbsp;|&nbsp; "
        f"Engine: {_safe_text(record.get('engine'), 'rule_based_v1')} &nbsp;|&nbsp; "
        f"Analyzed: {_safe_text(record.get('created_at'))}",
        _META,
    ))

    subtitle = f"Product Analyzer result for \"{_safe_text(product.get('product_name'), 'Unnamed product')}\""
    return _build("IP-SAKTI Product Analyzer Report", subtitle, flow)


def generate_tk_abs_pdf(record: dict) -> bytes:
    """`record` is the persisted tk_abs_analyses document (see
    app/models/tk_abs_analysis.py:to_dict()) — its `request` is the original
    TKABSRequest input and `result` is decision_engines.evaluate_tk_abs()'s
    output, unchanged."""
    request = record.get("request") or {}
    result = record.get("result") or {}
    abs_considerations = result.get("abs_considerations") or {}

    flow: list = []

    flow.append(Paragraph("Biological Resource / Traditional Knowledge Input", _H2))
    flow.append(_key_value_rows([
        ("Biological resource", request.get("biological_resource")),
        ("Plant material", request.get("plant_material")),
        ("Geographic origin", request.get("geographic_origin")),
        ("Traditional use", request.get("traditional_use")),
        ("Source community information", request.get("source_community_info")),
        ("Intended use", request.get("intended_use")),
    ]))

    flow.append(Paragraph("Traditional Knowledge Overview", _H2))
    flow.append(_para(result.get("traditional_knowledge_overview")))

    flow.append(Paragraph("Biological Resource Assessment", _H2))
    flow.append(_para(result.get("biological_resource_assessment")))

    flow.append(Paragraph("ABS Considerations", _H2))
    flow.append(_key_value_rows([
        ("NBA approval needed", abs_considerations.get("nba_approval_needed")),
        ("SBB notification needed", abs_considerations.get("sbb_notification_needed")),
        ("Benefit-sharing rate", abs_considerations.get("benefit_sharing_rate")),
        ("Exemptions applicable", abs_considerations.get("exemptions_applicable")),
    ]))
    if abs_considerations.get("statutory_sections"):
        flow.append(Paragraph("Statutory sections", _H3))
        flow.append(_bullet_list(abs_considerations.get("statutory_sections")))

    flow.append(Paragraph("Prior-Art / TK Considerations", _H2))
    flow.append(_para(result.get("prior_art_tk_considerations")))

    flow.append(Paragraph("Potential IP Implications", _H2))
    flow.append(_bullet_list(result.get("potential_ip_implications")))

    flow.append(Paragraph("Recommended Next Steps", _H2))
    flow.append(_bullet_list(result.get("recommended_next_steps")))

    flow.append(Paragraph("Evidence &amp; Citations", _H2))
    flow.append(_citations_flowable(result.get("sources")))

    flow.append(Spacer(1, 10))
    flow.append(Paragraph(
        f"Analysis ID: {_safe_text(record.get('id') or record.get('_id'))} &nbsp;|&nbsp; "
        f"Engine: {_safe_text(result.get('engine'), 'rule_based_v1')} &nbsp;|&nbsp; "
        f"Analyzed: {_safe_text(record.get('created_at'))}",
        _META,
    ))

    subtitle = f"TK / ABS analysis for \"{_safe_text(request.get('biological_resource') or request.get('plant_material'), 'Unspecified biological resource')}\""
    return _build("IP-SAKTI TK / ABS Analysis Report", subtitle, flow)
