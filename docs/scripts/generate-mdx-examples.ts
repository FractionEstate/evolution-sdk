#!/usr/bin/env tsx

// MDX Documentation Generator
// Automatically generates MDX documentation pages from TypeScript example files.
// Usage: tsx scripts/generate-mdx-examples.ts (run from docs package)
//
// Each .ts/.tsx file in examples/ becomes a corresponding .mdx page.
// Files can use directives for metadata:
//   // @title: Page Title
//   // @description: Page description
//   // @region: custom (defaults to "main")
//
// Code extraction:
//   - Uses #region markers if present (// #region name ... // #endregion)
//   - Falls back to entire file content (with directives stripped)

import * as fs from "fs/promises"
import * as path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// docs/ directory
const DOCS_ROOT = path.resolve(__dirname, "..")
const EXAMPLES_DIR = path.resolve(DOCS_ROOT, "examples")
const PAGES_DIR = path.resolve(DOCS_ROOT, "content/docs")

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Extract a region from a TS file using // #region <name> markers */
async function extractRegion(filePath: string, region: string): Promise<string> {
  const content = await fs.readFile(filePath, "utf8")
  const escaped = escapeRegex(region)
  const startRe = new RegExp(`^\\s*\/\/\\s*#region\\s+${escaped}.*$`, "m")
  const startMatch = startRe.exec(content)
  if (!startMatch) throw new Error(`Region '${region}' not found in ${filePath}`)
  const afterStartLineIdx = content.indexOf("\n", startMatch.index)
  const codeStart = afterStartLineIdx === -1 ? content.length : afterStartLineIdx + 1

  const endRe = new RegExp(`^\\s*\/\/\\s*#endregion\\s+${escaped}.*$`, "m")
  const endSlice = content.slice(codeStart)
  const endMatch = endRe.exec(endSlice)
  if (!endMatch) throw new Error(`End of region '${region}' not found in ${filePath}`)
  const codeEnd = codeStart + endMatch.index
  return content.slice(codeStart, codeEnd)
}

async function main() {
  // Clean content/docs but preserve the modules directory
  await cleanPagesExceptModules()

  // Ensure getting-started output dir exists
  const gettingStartedDir = path.join(PAGES_DIR, "getting-started")
  try {
    await fs.rm(gettingStartedDir, { recursive: true, force: true })
    console.log(`Cleaned existing directory: ${gettingStartedDir}`)
  } catch (e) {
    // ignore
  }
  await fs.mkdir(gettingStartedDir, { recursive: true })

  let changed = 0
  const errors: string[] = []

  // Auto-generate pages by mirroring the examples/ directory recursively
  const created = await generateFromExamples(EXAMPLES_DIR, "").catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    const error = `Error generating examples: ${msg}`
    console.error(error)
    errors.push(error)
    process.exitCode = 1
    return 0
  })
  if (created > 0) changed += created

  console.log(`\nGeneration complete. Updated ${changed} file(s).`)
  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} error(s) occurred:`)
    errors.forEach((e) => console.error(`  - ${e}`))
  }
}

main()

/**
 * Remove all files and directories under PAGES_DIR except the 'modules' directory.
 * This is intentionally conservative: it will only remove direct children of PAGES_DIR
 * except when the child is named 'modules'.
 */
async function cleanPagesExceptModules() {
  try {
    const entries = await fs.readdir(PAGES_DIR, { withFileTypes: true })
    for (const e of entries) {
      const name = e.name
      // Preserve important top-level files/directories.
      // Don't remove the 'modules' folder and keep a root index.mdx if present.
      if (name === "modules" || name === "index.mdx") continue
      const target = path.join(PAGES_DIR, name)
      try {
        await fs.rm(target, { recursive: true, force: true })
        console.log(`Removed: ${target}`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Failed to remove ${target}: ${msg}`)
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Failed to clean pages dir ${PAGES_DIR}: ${msg}`)
  }
}

function toTitleCase(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m: string) => m.toUpperCase())
}

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

async function readText(p: string): Promise<string> {
  return fs.readFile(p, "utf8")
}

function extractDirective(content: string, name: string): string | null {
  // Looks for // @name: value or /* @name: value */ in the file
  // Searches entire file to handle files with long header comments
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const m1 = line.match(new RegExp(`^\\s*\\/\\/\\s*@${name}:\\s*(.+)$`))
    if (m1) return m1[1].trim()

    const m2 = line.match(new RegExp(`\\/\\*\\s*@${name}:\\s*([^*]+)\\*\\/`))
    if (m2) return m2[1].trim()
  }
  return null
}

interface GroupManifest {
  title: string
  description?: string
  output: string
  steps?: boolean // Enable Steps component for sequential workflows
  tabs?: Array<{
    // Enable Tabs component for alternative implementations
    name: string
    file: string
  }>
  files?: Array<{
    file: string
    heading?: string
    description?: string
    accordion?: boolean // Wrap section in Accordion (collapsible)
  }>
}

async function processGroup(manifestPath: string, srcDir: string, outDir: string): Promise<number> {
  const manifestContent = await readText(manifestPath)
  const manifest: GroupManifest = JSON.parse(manifestContent)

  // Build frontmatter
  const frontmatter = [
    "---",
    `title: "${manifest.title.replace(/"/g, '\\"')}"`,
    ...(manifest.description ? [`description: "${manifest.description.replace(/"/g, '\\"')}"`] : []),
    "---",
    ""
  ].join("\n")

  // Process each file in the group
  const sections: string[] = [frontmatter]

  // Handle Tabs mode (alternative implementations)
  if (manifest.tabs) {
    sections.push("import { Tab, Tabs } from 'fumadocs-ui/components/tabs'\n")
    sections.push(`<Tabs items={[${manifest.tabs.map((t) => `'${t.name}'`).join(", ")}]}>\n`)

    for (const tab of manifest.tabs) {
      const filePath = path.join(srcDir, tab.file)
      const code = await getExampleCodeForFile(filePath)

      sections.push(`<Tab value="${tab.name}">\n`)
      sections.push("```typescript twoslash")
      sections.push(code)
      sections.push("```\n")
      sections.push("</Tab>\n")
    }

    sections.push("</Tabs>\n")
  }
  // Handle Steps mode (sequential workflow) or regular files mode
  else if (manifest.files) {
    // Check if any file uses accordion
    const hasAccordion = manifest.files.some((f) => f.accordion)

    // Add imports
    const imports: string[] = []
    if (manifest.steps) {
      imports.push("import { Steps, Step } from 'fumadocs-ui/components/steps'")
    }
    if (hasAccordion) {
      imports.push("import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'")
    }
    if (imports.length > 0) {
      sections.push(imports.join("\n") + "\n")
    }

    // Add Steps opening tag if enabled
    if (manifest.steps) {
      sections.push("<Steps>\n")
    }

    // Track if we're inside an Accordions wrapper
    let inAccordionsBlock = false

    for (const fileSpec of manifest.files) {
      const filePath = path.join(srcDir, fileSpec.file)
      const code = await getExampleCodeForFile(filePath)

      // Open Accordions wrapper if this is the first accordion and we haven't opened it yet
      if (fileSpec.accordion && !inAccordionsBlock) {
        sections.push("<Accordions>\n")
        inAccordionsBlock = true
      }
      // Close Accordions wrapper if this is not an accordion and we're in an accordion block
      else if (!fileSpec.accordion && inAccordionsBlock) {
        sections.push("</Accordions>\n")
        inAccordionsBlock = false
      }

      // Wrap in Accordion if specified
      if (fileSpec.accordion && fileSpec.heading) {
        sections.push(`<Accordion title="${fileSpec.heading}">\n`)
      }
      // Otherwise add heading if specified (use ### for Steps auto-numbering, ## otherwise)
      else if (fileSpec.heading) {
        const headingLevel = manifest.steps ? "###" : "##"
        sections.push(`${headingLevel} ${fileSpec.heading}\n`)
      }

      // Add description if specified
      if (fileSpec.description) {
        sections.push(`${fileSpec.description}\n`)
      }

      // Add code block (complete and independent)
      sections.push("```typescript twoslash")
      sections.push(code)
      sections.push("```\n")

      // Close Accordion if it was opened
      if (fileSpec.accordion) {
        sections.push("</Accordion>\n")
      }
    }

    // Close Accordions wrapper if still open at the end
    if (inAccordionsBlock) {
      sections.push("</Accordions>\n")
    }

    // Close Steps component if enabled
    if (manifest.steps) {
      sections.push("</Steps>\n")
    }
  }

  // Write grouped MDX
  const mdx = sections.join("\n")
  const outFile = path.join(outDir, manifest.output)

  let shouldWrite = true
  try {
    const existing = await fs.readFile(outFile, "utf8")
    if (existing === mdx) shouldWrite = false
  } catch {}

  if (shouldWrite) {
    await fs.writeFile(outFile, mdx)
    return 1
  }

  return 0
}

// Note: Section parsing logic removed - we now use one file per section approach.
// Each .ts file should either have a #region main or be a complete standalone example.

async function getExampleCodeForFile(filePath: string): Promise<string> {
  const content = await readText(filePath)
  const regionName = extractDirective(content, "region") || "main"

  try {
    return await extractRegion(filePath, regionName)
  } catch {
    // No region found - strip directive comments and region markers from the entire file
    const lines = content.split("\n")
    const filtered = lines.filter((line) => {
      const trimmed = line.trim()
      // Remove directive lines
      if (trimmed.startsWith("// @title:")) return false
      if (trimmed.startsWith("// @description:")) return false
      if (trimmed.startsWith("// @skip-check:")) return false
      if (trimmed.startsWith("// @region:")) return false
      // Remove region markers
      if (trimmed.startsWith("// #region")) return false
      if (trimmed.startsWith("// #endregion")) return false
      return true
    })
    return filtered.join("\n").trimEnd()
  }
}

// Note: generateGroupPages function removed - superseded by generateFromExamples recursive approach

/**
 * Recursively mirror the examples directory structure into PAGES_DIR.
 * For each directory, create an index.mdx listing files and subdirectories.
 * For each .ts/.tsx file, create a corresponding .mdx with frontmatter and the example code.
 * Supports grouping files via .group.json manifest files.
 */
async function generateFromExamples(srcDir: string, relativeOutDir: string): Promise<number> {
  let created = 0
  const absSrc = path.join(srcDir, relativeOutDir)
  let entries: import("fs").Dirent[] = []
  try {
    entries = await fs.readdir(absSrc, { withFileTypes: true })
  } catch {
    return 0
  }

  const outDir = path.join(PAGES_DIR, relativeOutDir)
  await fs.mkdir(outDir, { recursive: true })

  // 1. Find and process group manifests first
  const groupManifests: string[] = []
  const groupedFiles = new Set<string>()
  const groupOutputs: Array<{ title: string; slug: string }> = []

  for (const e of entries) {
    if (e.isFile() && e.name.endsWith(".group.json")) {
      const manifestPath = path.join(absSrc, e.name)
      groupManifests.push(manifestPath)

      // Track which files are in groups
      const manifestContent = await readText(manifestPath)
      const manifest: GroupManifest = JSON.parse(manifestContent)

      // Add files from tabs or files array
      if (manifest.tabs) {
        manifest.tabs.forEach((t) => groupedFiles.add(t.file))
      } else if (manifest.files) {
        manifest.files.forEach((f) => groupedFiles.add(f.file))
      }

      // Process the group
      const groupCreated = await processGroup(manifestPath, absSrc, outDir)
      created += groupCreated

      // Track for index generation
      const slug = toSlug(manifest.output.replace(/\.mdx$/i, ""))
      groupOutputs.push({ title: manifest.title, slug })
    }
  }

  // 2. Collect standalone files and directories (excluding grouped files and manifests)
  const files: string[] = []
  const dirs: string[] = []
  for (const e of entries) {
    if (e.isDirectory()) {
      dirs.push(e.name)
    } else if (e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx"))) {
      if (!groupedFiles.has(e.name)) {
        files.push(e.name)
      }
    }
  }

  // Cache for file content and directives to avoid re-reading
  const fileCache = new Map<string, { title: string; desc: string | null }>()

  // Create MDX for each file
  for (const f of files) {
    const abs = path.join(absSrc, f)
    const content = await readText(abs)
    const title = extractDirective(content, "title") || toTitleCase(f.replace(/\.(ts|tsx)$/i, ""))
    const desc = extractDirective(content, "description")
    const slug = toSlug(f.replace(/\.(ts|tsx)$/i, ""))

    // Cache for index generation
    fileCache.set(f, { title, desc })

    const frontmatter = [
      "---",
      `title: "${title.replace(/"/g, '\\"')}"`,
      ...(desc ? [`description: "${desc.replace(/"/g, '\\"')}"`] : []),
      "---",
      ""
    ].join("\n")

    // Simplified: Always extract code and use single block
    const code = await getExampleCodeForFile(abs)
    const mdx = [frontmatter, "```typescript twoslash", code, "```", ""].join("\n")

    const outFile = path.join(outDir, `${slug}.mdx`)
    let shouldWrite = true
    try {
      const existing = await fs.readFile(outFile, "utf8")
      if (existing === mdx) shouldWrite = false
    } catch {}
    if (shouldWrite) {
      await fs.writeFile(outFile, mdx)
      created++
    }
  }

  // Recurse into subdirectories
  for (const d of dirs) {
    const subCreated = await generateFromExamples(srcDir, path.join(relativeOutDir, d))
    created += subCreated
  }

  // Create or refresh index.mdx for this directory (skip root level)
  if (relativeOutDir !== "") {
    const indexTitle = toTitleCase(path.basename(relativeOutDir))
    const indexLines: string[] = []
    // YAML frontmatter with title required by fumadocs-mdx
    indexLines.push("---")
    indexLines.push(`title: "${indexTitle.replace(/"/g, '\\"')}"`)
    indexLines.push("---")
    indexLines.push("")
    indexLines.push(`import { Card, Cards } from 'fumadocs-ui/components/card'`)
    indexLines.push("")
    indexLines.push(`# ${indexTitle}`)
    indexLines.push("")
    indexLines.push("<Cards>")

    // Add subdirectories as cards
    for (const d of dirs) {
      const dirTitle = toTitleCase(d)
      const dirPath = path.relative(PAGES_DIR, path.join(outDir, d)).replace(/\\/g, "/")
      indexLines.push(`  <Card title="${dirTitle}" href="/docs/${dirPath}" />`)
    }

    // Add grouped pages as cards
    for (const group of groupOutputs) {
      const groupPath = path.relative(PAGES_DIR, path.join(outDir, group.slug)).replace(/\\/g, "/")
      indexLines.push(`  <Card title="${group.title}" href="/docs/${groupPath}" />`)
    }

    // Add standalone files as cards
    for (const f of files) {
      const cached = fileCache.get(f)
      const name = f.replace(/\.(ts|tsx)$/i, "")
      const title = cached?.title || toTitleCase(name)
      const desc = cached?.desc || ""
      const slug = toSlug(name)
      const filePath = path.relative(PAGES_DIR, path.join(outDir, slug)).replace(/\\/g, "/")

      if (desc) {
        indexLines.push(
          `  <Card title="${title}" description="${desc.replace(/"/g, '\\"')}" href="/docs/${filePath}" />`
        )
      } else {
        indexLines.push(`  <Card title="${title}" href="/docs/${filePath}" />`)
      }
    }

    indexLines.push("</Cards>")
    indexLines.push("")

    const indexPath = path.join(outDir, "index.mdx")
    const indexContent = indexLines.join("\n")
    try {
      const existing = await fs.readFile(indexPath, "utf8")
      if (existing !== indexContent) {
        await fs.writeFile(indexPath, indexContent)
        created++
      }
    } catch {
      await fs.writeFile(indexPath, indexContent)
      created++
    }
  }

  return created
}
