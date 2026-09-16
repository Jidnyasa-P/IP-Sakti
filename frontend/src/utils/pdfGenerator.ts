import { jsPDF } from 'jspdf';
import { ProductAnalysisResult, TKABSResult, TKABSQuery } from '../types';

/**
 * IP-SAKTI Sahayak PDF Dossier Generator
 * Engineered with precise mathematical typography, dynamic container heights,
 * reduced 10mm margins, and clean hairline rules to eliminate clutter and overlapping.
 */

export function exportProductAnalysisToPDF(result: ProductAnalysisResult): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm on A4
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = margin + 4;
      // Running top page header (subtle hairline, no bold bar)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text('IP-SAKTI Sahayak • Statutory Assessment Dossier (Continued)', margin, y);
      y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;
    }
  };

  const drawSectionHeader = (title: string, neededHeight = 22) => {
    checkPageBreak(neededHeight);
    y += 2;
    doc.setTextColor(6, 78, 59); // Emerald 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(title, margin, y);
    y += 2.5;

    // Subtle hairline divider (0.25mm, light slate)
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4.5;
  };

  // 1. Top Banner (Clean, compact 20mm height)
  doc.setFillColor(6, 78, 59); // Emerald 900
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(253, 224, 71); // Amber 300
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('IP-SAKTI Sahayak', margin, 9);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Statutory AYUSH & Intellectual Property Decision Support Dossier', margin, 15);

  doc.setFontSize(7.5);
  doc.setTextColor(209, 250, 229);
  const genDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  doc.text(`Generated: ${genDate} | Ref: ${result.id}`, pageWidth - margin, 15, { align: 'right' });

  y = 28;

  // 2. Report Title & Meta
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(result.product_information.product_name || 'Product Evaluation Report', margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Proposed Type: ${result.product_information.product_type}   |   Target Market: ${result.product_information.target_market}   |   Dosage: ${result.product_information.dosage_form || 'Standard'}`,
    margin,
    y
  );
  y += 6.5;

  // 3. Statutory Classification Card (Dynamic Height, No Text Overlap)
  const reasoningLines = doc.splitTextToSize(result.category_reasoning, contentWidth - 10);
  const classCardHeight = 15 + reasoningLines.length * 3.8 + 3;
  checkPageBreak(classCardHeight + 4);

  doc.setFillColor(240, 253, 244); // Emerald 50
  doc.roundedRect(margin, y, contentWidth, classCardHeight, 2, 2, 'F');
  doc.setDrawColor(167, 243, 208); // Emerald 200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, classCardHeight, 2, 2, 'S');

  let cardY = y + 5;
  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('STATUTORY CLASSIFICATION & DETERMINATION', margin + 4, cardY);
  cardY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Likely Category: ${result.likely_category}`, margin + 4, cardY);
  cardY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(reasoningLines, margin + 4, cardY);

  y += classCardHeight + 5;

  // 4. Product Profile & Formulation Details
  drawSectionHeader('1. Product Profile & Formulation Specifications', 35);

  const profileData = [
    ['Dosage Form:', result.product_information.dosage_form],
    ['Manufacturing:', result.product_information.manufacturing_info],
    ['Ingredients:', result.product_information.ingredients],
    ['Biological Sourcing:', result.product_information.biological_source_details || 'Indian botanical resources'],
    ['Intended Use:', result.product_information.intended_use],
    ['Statutory Claims:', result.product_information.claims],
  ];

  profileData.forEach(([label, value]) => {
    const valLines = doc.splitTextToSize(value || 'N/A', contentWidth - 46);
    const rowHeight = Math.max(5, valLines.length * 3.8 + 2.5);
    checkPageBreak(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(label, margin + 2, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(valLines, margin + 46, y + 3.5);

    y += rowHeight;

    // Subtle faint separator
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 1;
  });
  y += 3;

  // 5. Regulatory Considerations & GMP Compliance
  drawSectionHeader('2. Regulatory Considerations & GMP Compliance', 35);

  result.regulatory_considerations.forEach((rc) => {
    const descLines = doc.splitTextToSize(rc.description, contentWidth - 10);
    const reqLines = rc.actionable_requirement
      ? doc.splitTextToSize(`Action Required: ${rc.actionable_requirement}`, contentWidth - 10)
      : [];
    const itemHeight = 11 + descLines.length * 3.7 + reqLines.length * 3.7 + 4;

    checkPageBreak(itemHeight + 3);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, itemHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentWidth, itemHeight, 1.5, 1.5, 'S');

    let innerY = y + 4.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(rc.title, margin + 4, innerY);
    innerY += 4.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(descLines, margin + 4, innerY);
    innerY += descLines.length * 3.7 + 1.5;

    if (reqLines.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(reqLines, margin + 4, innerY);
      innerY += reqLines.length * 3.7 + 1.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(6, 78, 59);
    doc.text(`Governing Statute: ${rc.governing_statute}`, margin + 4, innerY);

    y += itemHeight + 3.5;
  });
  y += 2;

  // 6. Intellectual Property Rights (IPR) Evaluation
  drawSectionHeader('3. Intellectual Property Rights (IPR) Evaluation', 40);

  const iprItems = [
    ['Section 3(p) TK Bar:', result.ipr_considerations.section_3p_tk_bar],
    ['Section 3(e) Synergism:', result.ipr_considerations.section_3e_admixture_bar],
    ['Patent Viability:', result.ipr_considerations.patent_assessment],
    ['Trademark (Class 5):', result.ipr_considerations.trademark_recommendation],
    ['Designs & Trade Secrets:', `${result.ipr_considerations.industrial_design} | ${result.ipr_considerations.trade_secret_potential}`],
  ];

  iprItems.forEach(([label, value]) => {
    const valLines = doc.splitTextToSize(value || 'N/A', contentWidth - 46);
    const rowHeight = Math.max(5, valLines.length * 3.8 + 2.5);
    checkPageBreak(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(label, margin + 2, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(valLines, margin + 46, y + 3.5);

    y += rowHeight;

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 1;
  });
  y += 3;

  // 7. Traditional Knowledge & Biological Diversity (ABS) Mandates
  drawSectionHeader('4. Traditional Knowledge & Biological Diversity (ABS) Mandates', 35);

  const tkItems = [
    ['TK Prior Art Risk Level:', result.traditional_knowledge_abs_flags.tk_prior_art_risk],
    ['TK Reference Details:', result.traditional_knowledge_abs_flags.tk_details],
    ['Biological Resource Status:', result.traditional_knowledge_abs_flags.biological_resource_status],
    ['NBA / SBB Filings:', result.traditional_knowledge_abs_flags.nba_abs_requirements],
    ['Statutory Form Required:', result.traditional_knowledge_abs_flags.form_required],
  ];

  tkItems.forEach(([label, value]) => {
    const valLines = doc.splitTextToSize(value || 'N/A', contentWidth - 46);
    const rowHeight = Math.max(5, valLines.length * 3.8 + 2.5);
    checkPageBreak(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(label, margin + 2, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(valLines, margin + 46, y + 3.5);

    y += rowHeight;

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 1;
  });
  y += 3;

  // 8. Recommended Statutory Action Roadmap
  drawSectionHeader('5. Recommended Statutory Action Roadmap', 35);

  result.recommended_next_steps.forEach((step, idx) => {
    const cleanStep = step.replace(/^\d+\.\s*/, '');
    const stepLines = doc.splitTextToSize(cleanStep, contentWidth - 12);
    const rowHeight = Math.max(5, stepLines.length * 3.8 + 2);
    checkPageBreak(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 78, 59);
    doc.text(`${idx + 1}.`, margin + 2, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(stepLines, margin + 8, y + 3.5);

    y += rowHeight + 1.5;
  });
  y += 3;

  // 9. Authoritative Legal Citations
  if (result.evidence && result.evidence.length > 0) {
    drawSectionHeader('6. Authoritative Legal Citations', 30);

    result.evidence.forEach((ev) => {
      const excerptLines = doc.splitTextToSize(`"${ev.excerpt}"`, contentWidth - 6);
      const evHeight = 8 + excerptLines.length * 3.6 + 3;
      checkPageBreak(evHeight + 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`[${ev.index}] ${ev.section} — ${ev.authority}`, margin + 2, y + 3.5);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(excerptLines, margin + 4, y + 7.5);

      y += evHeight + 1.5;
    });
  }

  // 10. Statutory Footer / Disclaimer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Hairline rule above footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Statutory Advisory: IP-SAKTI Sahayak analytical findings are AI-assisted decision-support dossiers based on indexed statutes. Verify critical submissions with CGPDTM, NBA, or State AYUSH authorities.',
      margin,
      pageHeight - 7.5,
      { maxWidth: contentWidth - 25 }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });
  }

  // Sanitize filename
  const cleanName = (result.product_information.product_name || 'Product')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  doc.save(`Product_Analysis_Dossier_${cleanName}.pdf`);
}

export function exportTKABSToPDF(result: TKABSResult, query: TKABSQuery): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm on A4
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = margin + 4;
      // Running top page header (subtle hairline, no bold bar)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('IP-SAKTI Sahayak • Traditional Knowledge & ABS Dossier (Continued)', margin, y);
      y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;
    }
  };

  const drawSectionHeader = (title: string, neededHeight = 22) => {
    checkPageBreak(neededHeight);
    y += 2;
    doc.setTextColor(6, 78, 59); // Emerald 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(title, margin, y);
    y += 2.5;

    // Subtle hairline divider (0.25mm, light slate)
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4.5;
  };

  // 1. Top Banner (Clean, compact 20mm height)
  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setTextColor(253, 224, 71); // Amber 300
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('IP-SAKTI Sahayak', margin, 9);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Traditional Knowledge & Biological Diversity (ABS) Compliance Dossier', margin, 15);

  doc.setFontSize(7.5);
  doc.setTextColor(209, 250, 229);
  const genDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  doc.text(`Generated: ${genDate}`, pageWidth - margin, 15, { align: 'right' });

  y = 28;

  // 2. Report Title & Meta
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(query.biological_resource || 'Biological Resource Assessment', margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Geographic Origin: ${query.geographic_origin || 'India'}   |   Intended Use: ${query.intended_use}`,
    margin,
    y
  );
  y += 6.5;

  // 3. Biological Resource Parameters
  drawSectionHeader('1. Biological Resource & Provenance Parameters', 35);

  const queryParams = [
    ['Biological Resource:', query.biological_resource],
    ['Plant Material / Part:', query.plant_material],
    ['Geographic Origin:', query.geographic_origin],
    ['Intended Utilization:', query.intended_use],
    ['Traditional Use Record:', query.traditional_use],
    ['BMC / Provenance Info:', query.source_community_info],
  ];

  queryParams.forEach(([label, val]) => {
    const valLines = doc.splitTextToSize(val || 'N/A', contentWidth - 46);
    const rowHeight = Math.max(5, valLines.length * 3.8 + 2.5);
    checkPageBreak(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(label, margin + 2, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(valLines, margin + 46, y + 3.5);

    y += rowHeight;

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 1;
  });
  y += 3;

  // 4. Traditional Knowledge Overview & TKDL Prior Art Bar
  drawSectionHeader('2. Traditional Knowledge Overview & TKDL Prior Art Considerations', 40);

  const tkOverviewLines = doc.splitTextToSize(result.traditional_knowledge_overview, contentWidth - 4);
  checkPageBreak(tkOverviewLines.length * 3.8 + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(tkOverviewLines, margin + 2, y);
  y += tkOverviewLines.length * 3.8 + 4;

  if (result.prior_art_tk_considerations) {
    const paLines = doc.splitTextToSize(result.prior_art_tk_considerations, contentWidth - 10);
    const paHeight = 12 + paLines.length * 3.7 + 3;
    checkPageBreak(paHeight + 2);

    doc.setFillColor(254, 242, 242); // Rose 50
    doc.roundedRect(margin, y, contentWidth, paHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(254, 202, 202);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, y, contentWidth, paHeight, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(159, 18, 57);
    doc.text('Prior Art TK Considerations & TKDL Citations:', margin + 4, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(88, 28, 135);
    doc.text(paLines, margin + 4, y + 9);

    y += paHeight + 4;
  }

  // 5. ABS Statutory Mandates (NBA / SBB)
  drawSectionHeader('3. Access & Benefit Sharing (ABS) Mandates (NBA / SBB)', 40);

  const absItems = [
    [
      'NBA Prior Approval Required:',
      result.abs_considerations.nba_approval_needed
        ? 'YES — Mandatory prior approval under Section 3 / Section 6 (Form I or Form III)'
        : 'No direct NBA approval mandated for pure domestic non-commercial utilization',
    ],
    [
      'State Biodiversity Board (SBB):',
      result.abs_considerations.sbb_notification_needed
        ? 'YES — Prior intimation to State Biodiversity Board under Section 7'
        : 'No SBB intimation required under stated category',
    ],
    ['Statutory Sections:', result.abs_considerations.statutory_sections.join(', ')],
    ['Benefit Sharing Levy Matrix:', result.abs_considerations.benefit_sharing_rate],
    ['2023 Amendment Exemptions:', result.abs_considerations.exemptions_applicable || 'N/A'],
  ];

  absItems.forEach(([label, val]) => {
    const valLines = doc.splitTextToSize(val || 'N/A', contentWidth - 46);
    const rowHeight = Math.max(5, valLines.length * 3.8 + 2.5);
    checkPageBreak(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(label, margin + 2, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(valLines, margin + 46, y + 3.5);

    y += rowHeight;

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentWidth, y);
    y += 1;
  });
  y += 3;

  // 6. Intellectual Property Implications & Patent Strategy
  drawSectionHeader('4. Intellectual Property Implications & Patent Strategy', 35);

  result.potential_ip_implications.forEach((imp) => {
    const impLines = doc.splitTextToSize(imp, contentWidth - 10);
    const rowHeight = Math.max(5, impLines.length * 3.8 + 2);
    checkPageBreak(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 78, 59);
    doc.text('•', margin + 2, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(impLines, margin + 6, y + 3.5);

    y += rowHeight + 1.5;
  });
  y += 3;

  // 7. Compliance & Action Roadmap
  drawSectionHeader('5. Compliance & Action Roadmap', 35);

  result.recommended_next_steps.forEach((step, idx) => {
    const cleanStep = step.replace(/^\d+\.\s*/, '');
    const stepLines = doc.splitTextToSize(cleanStep, contentWidth - 12);
    const rowHeight = Math.max(5, stepLines.length * 3.8 + 2);
    checkPageBreak(rowHeight + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${idx + 1}.`, margin + 2, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(stepLines, margin + 8, y + 3.5);

    y += rowHeight + 1.5;
  });
  y += 3;

  // 8. Sources & Statutory Provisions
  if (result.sources && result.sources.length > 0) {
    drawSectionHeader('6. Authoritative Legal Citations & Provisions', 30);

    result.sources.forEach((s) => {
      const excerptLines = doc.splitTextToSize(`"${s.excerpt}"`, contentWidth - 6);
      const sHeight = 8 + excerptLines.length * 3.6 + 3;
      checkPageBreak(sHeight + 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`[${s.index}] ${s.section} — ${s.title} (${s.authority})`, margin + 2, y + 3.5);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(excerptLines, margin + 4, y + 7.5);

      y += sHeight + 1.5;
    });
  }

  // 9. Statutory Footer / Disclaimer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Statutory Advisory: IP-SAKTI Sahayak ABS evaluations are decision-support dossiers based on the Biological Diversity Act, 2002 and 2023 Amendments. Consult the National Biodiversity Authority (NBA) or State Biodiversity Board for formal compliance determinations.',
      margin,
      pageHeight - 7.5,
      { maxWidth: contentWidth - 25 }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });
  }

  const cleanName = (query.biological_resource || 'Resource')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 30);
  doc.save(`TK_ABS_Compliance_Dossier_${cleanName}.pdf`);
}
