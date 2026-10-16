const request = require('supertest');
const app = require('../../src/app');
const { executeReviewPipeline } = require('../../src/services/orchestrator');

describe('Module 11: End-to-End Code Review Pipeline Integration', () => {
  // ============================================================================
  // Test Case 1: Pasted snippet with SQL injection returns CWE-89 & score < 85
  // ============================================================================
  it('Test Case 1: Pasted snippet with SQL injection returns CWE-89 finding and score < 85', async () => {
    const sqlInjectionSnippet = `
      const express = require('express');
      const app = express();
      const db = require('./db');

      app.get('/users', async (req, res) => {
        const userId = req.query.id;
        const result = await db.query("SELECT * FROM users WHERE id = " + userId);
        return res.json(result);
      });

      module.exports = app;
    `;

    // 1. Test via HTTP endpoint POST /api/v1/reviews/run
    const res = await request(app)
      .post('/api/v1/reviews/run')
      .send({
        sourceType: 'direct',
        content: sqlInjectionSnippet,
        language: 'javascript',
        projectName: 'sql-vuln-service',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');

    const review = res.body.data;

    // Must be COMPLETED
    expect(review.status).toBe('COMPLETED');
    expect(review.sourceType).toBe('direct');
    expect(review.projectName).toBe('sql-vuln-service');

    // Health score must be strictly < 85 (CRITICAL penalty = -20 pts -> score <= 80)
    expect(review.healthScore).toBeLessThan(85);
    expect(review.healthScore).toBeLessThanOrEqual(80);
    expect(['B+', 'B', 'C', 'D', 'F']).toContain(review.grade);

    // Verify finding details: SQL Injection (CWE-89)
    expect(Array.isArray(review.issues)).toBe(true);
    expect(review.issues.length).toBeGreaterThanOrEqual(1);

    const sqlIssue = review.issues.find(
      (i) =>
        i.ruleId === 'SQL_INJECTION' ||
        (i.title && i.title.toLowerCase().includes('sql')) ||
        (i.description && (i.description.includes('CWE-89') || i.description.includes('SQL')))
    );

    expect(sqlIssue).toBeDefined();
    expect(sqlIssue.category).toBe('SECURITY');
    expect(sqlIssue.severity).toBe('CRITICAL');
    expect(sqlIssue.line).toBe(8); // Exact AST line of db.query(...)
    expect(sqlIssue.evidence).toContain('db.query("SELECT * FROM users WHERE id = " + userId)');

    // Security health percentage must reflect deduction
    expect(review.categoryScores.securityHealth).toBeLessThanOrEqual(80);
  });

  // ============================================================================
  // Test Case 2: Broken syntax code returns PARSER_ERROR finding & high warning banner
  // ============================================================================
  it('Test Case 2: Broken syntax code returns PARSER_ERROR finding and high warning banner', async () => {
    const brokenSyntaxSnippet = `
      function brokenFunction(param1, param2 {
        return param1 + param2;
      }
    `;

    const res = await request(app)
      .post('/api/v1/reviews/run')
      .send({
        sourceType: 'direct',
        content: brokenSyntaxSnippet,
        language: 'javascript',
        projectName: 'broken-code',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const review = res.body.data;
    expect(review.status).toBe('COMPLETED');

    // Must return PARSER_ERROR finding
    const parserError = review.issues.find(
      (i) => i.ruleId === 'PARSER_ERROR' || i.category === 'SYNTAX'
    );
    expect(parserError).toBeDefined();
    expect(parserError.category).toBe('SYNTAX');
    expect(parserError.severity).toBe('HIGH');
    expect(parserError.source).toBe('STATIC');
    expect(parserError.description).toContain('Unexpected token');

    // High warning banner must be present
    expect(review.warningBanner).toBeDefined();
    expect(review.warningBanner).not.toBeNull();
    expect(review.warningBanner.level).toBe('HIGH');
    expect(review.warningBanner.title).toContain('Syntax');
    expect(review.warningBanner.message).toContain('syntax errors');

    // Bugs health must drop due to 30 pts syntax penalty
    expect(review.categoryScores.bugsHealth).toBe(70);
    expect(review.healthScore).toBeLessThanOrEqual(70);
    expect(review.grade).toBe('C');
  });

  // ============================================================================
  // Test Case 3: Valid BFS algorithm returns Grade A/A+ with clean checks
  // ============================================================================
  it('Test Case 3: Valid BFS algorithm returns Grade A/A+ with clean checks', async () => {
    const bfsSnippet = `
      /**
       * Breadth-First Search (BFS) graph traversal algorithm
       *
       * @param {Map<string, string[]>} graph - Adjacency list representation
       * @param {string} startNode - Starting vertex
       * @returns {string[]} Traversal order
       */
      function breadthFirstSearch(graph, startNode) {
        if (!graph || !graph.has(startNode)) {
          return [];
        }

        const visited = new Set();
        const queue = [startNode];
        const traversalOrder = [];

        visited.add(startNode);

        while (queue.length > 0) {
          const currentNode = queue.shift();
          traversalOrder.push(currentNode);

          const neighbors = graph.get(currentNode) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }

        return traversalOrder;
      }

      module.exports = { breadthFirstSearch };
    `;

    const res = await request(app)
      .post('/api/v1/reviews/run')
      .send({
        sourceType: 'direct',
        content: bfsSnippet,
        language: 'javascript',
        projectName: 'clean-bfs-algorithm',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const review = res.body.data;
    expect(review.status).toBe('COMPLETED');

    // Score must be in Grade A/A+ range (>= 90)
    expect(review.healthScore).toBeGreaterThanOrEqual(90);
    expect(['A+', 'A']).toContain(review.grade);

    // Clean checks across all categories
    expect(review.categoryScores.bugsHealth).toBe(100);
    expect(review.categoryScores.securityHealth).toBe(100);
    expect(review.categoryScores.qualityHealth).toBe(100);
    expect(review.categoryScores.optimizationHealth).toBe(100);

    // No high/critical warning banner (unlike syntax error in Test Case 2)
    if (review.warningBanner) {
      expect(review.warningBanner.level).not.toBe('HIGH');
    }

    // Zero critical and zero high issues
    expect(review.metrics.criticalCount).toBe(0);
    expect(review.metrics.highCount).toBe(0);
    expect(review.issues).toHaveLength(0);
  });

  // ============================================================================
  // Additional Pipeline Validation Tests
  // ============================================================================
  describe('Pipeline Validation & Error Handling', () => {
    it('should reject requests missing sourceType with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/reviews/run')
        .send({
          content: 'console.log("hello");',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('sourceType');
    });

    it('should reject direct snippets exceeding maximum character limit with HTTP 400', async () => {
      const oversized = 'const a = 1;\n'.repeat(5000); // > 50,000 chars

      const res = await request(app)
        .post('/api/v1/reviews/run')
        .send({
          sourceType: 'direct',
          content: oversized,
          language: 'javascript',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('50,000');
    });

    it('should direct orchestrator function executeReviewPipeline directly', async () => {
      const cleanCode = 'function multiply(a, b) { return a * b; } module.exports = { multiply };';
      const result = await executeReviewPipeline({
        sourceType: 'direct',
        content: cleanCode,
        language: 'javascript',
        projectName: 'multiply-helper',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('healthScore', 100);
      expect(result).toHaveProperty('grade', 'A+');
      expect(result.files).toHaveLength(1);
      expect(result.issues).toHaveLength(0);
    });
  });
});
