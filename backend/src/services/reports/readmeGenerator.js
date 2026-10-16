/**
 * Re:Code — Suggested README Generator
 *
 * Generates standard GitHub-flavored Markdown for audited repositories:
 * - Project Name & Health Badges (Health Score, Grade, OWASP Compliance)
 * - Project Overview narrative
 * - Architecture & Analyzed Source Files breakdown
 * - Automated Security & Quality Audit Findings
 * - Suggested Setup & Getting Started instructions
 * - Attribution & Verification Footer
 *
 * @param {Object} reviewData - Canonical or persisted review payload
 * @returns {string} Generated Markdown content
 */
function generateSuggestedReadme(reviewData = {}) {
  const projectName =
    reviewData.project_name || reviewData.projectName || 'Project';
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Number(reviewData.health_score ?? reviewData.healthScore ?? reviewData.score ?? 100)
      )
    )
  );
  const grade = reviewData.grade || 'A+';
  const sourceType =
    reviewData.source_type || reviewData.sourceType || 'direct';
  const repoUrl = reviewData.repo_url || reviewData.repoUrl || '';
  const createdAt =
    reviewData.created_at || reviewData.createdAt || new Date().toISOString();
  const dateFormatted = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const files = Array.isArray(reviewData.files) ? reviewData.files : [];
  const issues = Array.isArray(reviewData.issues) ? reviewData.issues : [];

  // Badge color based on health score tier
  let badgeColor = '27C93F';
  if (score < 50) badgeColor = 'FF4D4D';
  else if (score < 70) badgeColor = 'FFA116';
  else if (score < 85) badgeColor = '02C8F0';
  else if (score < 95) badgeColor = '78DFFF';

  const primaryLanguage =
    files.length > 0 && files[0].language ? files[0].language : 'JavaScript';

  // Severity counts
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const iss of issues) {
    const sev = String(iss.severity || 'MEDIUM').toUpperCase().trim();
    if (severityCounts[sev] !== undefined) severityCounts[sev]++;
  }

  // Files table rows
  let filesTable = '';
  if (files.length > 0) {
    filesTable = files
      .map(
        (f) =>
          `| \`${f.file_path || f.path || 'snippet.js'}\` | ${f.language || 'JavaScript'} | ${f.lines_count || f.linesCount || 0} | ${f.issues_count || 0} issue(s) |`
      )
      .join('\n');
  } else {
    filesTable = `| \`snippet.js\` | ${primaryLanguage} | Evaluated | ${issues.length} issue(s) |`;
  }

  // Key Findings Section
  let findingsSection = '';
  if (issues.length === 0) {
    findingsSection = `> ✨ **No vulnerabilities or anti-patterns detected.** This codebase achieves a **Grade ${grade}** pristine benchmark.\n`;
  } else {
    findingsSection = issues
      .slice(0, 10)
      .map((iss, idx) => {
        const sev = String(iss.severity || 'MEDIUM').toUpperCase();
        const sevBadge =
          sev === 'CRITICAL'
            ? '🔴 CRITICAL'
            : sev === 'HIGH'
            ? '🟠 HIGH'
            : sev === 'MEDIUM'
            ? '🟡 MEDIUM'
            : '🔵 LOW';
        const file = iss.file || iss.file_path || 'source';
        const line = iss.line || iss.line_number || 1;
        const diffBlock = iss.diff_after
          ? `\n\`\`\`${primaryLanguage.toLowerCase()}\n// Suggested Remediated Fix:\n${iss.diff_after}\n\`\`\``
          : '';

        return `### ${idx + 1}. [${sevBadge}] ${iss.title || 'Review Finding'}\n- **Rule ID**: \`${iss.ruleId || iss.rule_id || 'GENERAL'}\`\n- **Location**: \`${file}:${line}\`\n- **Details**: ${iss.description || iss.explanation || 'No description provided.'}${diffBlock}\n`;
      })
      .join('\n');
  }

  // Setup instructions tailored to primary language
  let setupSteps = '';
  const langLower = primaryLanguage.toLowerCase();
  if (
    langLower.includes('script') ||
    langLower.includes('node') ||
    langLower === 'js' ||
    langLower === 'ts'
  ) {
    setupSteps = `\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run automated test suites
npm test
\`\`\``;
  } else if (langLower.includes('python') || langLower === 'py') {
    setupSteps = `\`\`\`bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\\venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt

# Run application
python main.py
\`\`\``;
  } else if (langLower.includes('go') || langLower === 'golang') {
    setupSteps = `\`\`\`bash
# Download Go dependencies
go mod tidy

# Run application
go run main.go
\`\`\``;
  } else if (
    langLower === 'java' ||
    langLower.startsWith('java ') ||
    langLower.includes('spring')
  ) {
    setupSteps = `\`\`\`bash
# Build with Maven
./mvnw clean install

# Run application
./mvnw spring-boot:run
\`\`\``;
  } else {
    setupSteps = `\`\`\`bash
# Install dependencies
npm install

# Start development server
npm start
\`\`\``;
  }

  return `# ${projectName}

[![Re:Code Health Score](https://img.shields.io/badge/Re%3ACode%20Health-${score}%2F100%20(${encodeURIComponent(grade)})-${badgeColor}?style=flat-square&logo=shield)](https://recode.dev)
[![Compliance Status](https://img.shields.io/badge/Security%20Audit-Verified-27C93F?style=flat-square)](https://recode.dev)
[![Engine](https://img.shields.io/badge/Engine-AST%20Static%20%2B%20Gemini%20AI-02C8F0?style=flat-square)](https://recode.dev)

> Automated code audit conducted by **{ Re:Code }** on ${dateFormatted}.

---

## 📌 Project Overview
**${projectName}** has been inspected using the **Re:Code Automated Code Review Platform**.
- **Overall Health Score**: **${score} / 100** (Grade **${grade}**)
- **Source**: ${sourceType === 'github' ? `[GitHub Repository](${repoUrl})` : 'Pasted Code Snippet'}
- **Evaluated Files**: ${files.length || 1} file(s)
- **Primary Runtime**: ${primaryLanguage}

### Executive Assessment
${reviewData.summary || `Code health evaluation reflects a Grade ${grade} rating with ${issues.length} detected code issue(s) across evaluated units.`}

---

## 🏗️ Architecture & Evaluated Units

| File Path | Language | Lines | Findings |
| :--- | :--- | :---: | :---: |
${filesTable}

### Health Score Breakdown
- **Critical Vulnerabilities**: ${severityCounts.CRITICAL}
- **High Severity Warnings**: ${severityCounts.HIGH}
- **Medium / Quality Smells**: ${severityCounts.MEDIUM}
- **Low / Style Optimizations**: ${severityCounts.LOW}

---

## 🛡️ Recommended Security & Quality Fixes

${findingsSection}

---

## 🚀 Getting Started & Local Setup

### Prerequisites
Ensure you have the latest stable runtime for **${primaryLanguage}** installed.

### Installation Steps
${setupSteps}

---

## 📄 Verification & Credits
- **Audited with**: [{ Re:Code } — Read. Review. Refine.](https://recode.dev)
- **Engine Capabilities**: Deterministic Abstract Syntax Tree (AST) analysis & Google Gemini generative diagnostics.
- **Project Author**: Shivam Vishwakarma
`;
}

module.exports = {
  generateSuggestedReadme,
};
