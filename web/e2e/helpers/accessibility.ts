import { Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

/**
 * Run axe accessibility checks on a page and return violations
 * Configured to test WCAG 2.0/2.1 Level A & AA
 */
export async function checkAccessibility(page: Page, context?: string) {
  const axeResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()

  return {
    violations: axeResults.violations,
    passes: axeResults.passes.length,
    incomplete: axeResults.incomplete.length,
  }
}

/**
 * Assert that page has no serious or critical accessibility violations
 * @param page Playwright page
 * @param context Optional context description for better error messages
 */
export async function assertNoA11yViolations(page: Page, context = "") {
  const { violations } = await checkAccessibility(page, context)
  
  // Filter to serious and critical issues only
  const criticalViolations = violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  )

  if (criticalViolations.length > 0) {
    const message = [
      `${context ? `${context}: ` : ""}Found ${criticalViolations.length} critical/serious accessibility violations:`,
      ...criticalViolations.map((v) => 
        `  - ${v.id} (${v.impact}): ${v.description}\n    ${v.nodes.length} node(s) affected`
      ),
    ].join("\n")
    throw new Error(message)
  }
}
