const { generateReviewPdf } = require('../reports/pdfGenerator');

/**
 * Returns HTML/CSS footer template matching Re:Code specifications
 * with clean, text-based branding and crisp vertical alignment.
 *
 * @param {Object} [options]
 * @param {number} [options.pageNumber=1]
 * @param {number} [options.totalPages=1]
 * @returns {string} Rendered HTML string
 */
function getPdfFooterHtml({ pageNumber = 1, totalPages = 1 } = {}) {
  return `<footer class="pdf-footer" style="display: flex; align-items: center; justify-content: space-between; width: 100%; border-top: 0.5px solid #cccccc; padding-top: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box; color: #64748b; font-size: 10px;">
  <div style="vertical-align: middle;">
    { Re:Code } • Read. Review. Refine. | Comprehensive Quality & Reliability Report | OWASP Top 10 Active
  </div>
  <div style="color: #64748b; font-size: 10px; white-space: nowrap; vertical-align: middle;">
    Page ${pageNumber} of ${totalPages}
  </div>
</footer>`;
}

const PDF_FOOTER_HTML_TEMPLATE = getPdfFooterHtml({ pageNumber: 1, totalPages: 1 });

/**
 * Re:Code — Export Service for PDF Reports
 *
 * Provides dynamic, content-adaptive PDF generation eliminating trailing blank pages.
 * - Adaptive A4 margins (16mm)
 * - Atomic finding cards (break-inside: avoid)
 * - Original text-based branding in footer with minimal, crisp styling
 */
module.exports = {
  generateReviewPdf,
  generatePdfReport: generateReviewPdf,
  getPdfFooterHtml,
  PDF_FOOTER_HTML_TEMPLATE,
};
