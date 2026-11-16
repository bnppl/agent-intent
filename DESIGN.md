---
name: Agent Intent
description: A restrained evergreen report workspace for inspecting executable evidence.
colors:
  evergreen: "#173e38"
  passed: "#205545"
  failed: "#a13930"
  ink: "#19332e"
  cream: "#f5f6f1"
  muted: "#53665d"
  border: "#d9e1d6"
  soft-sage: "#edf2e9"
  passed-wash: "#e5f0e7"
  failed-wash: "#fbece8"
  blue: "#245d85"
  amber: "#795126"
  violet: "#714b83"
  white: "#fff"
typography:
  headline:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.5rem"
    lineHeight: 1.35
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: ".85rem"
  source:
    fontFamily: "ui-monospace, monospace"
    fontSize: ".8rem"
    lineHeight: 1.5
  metadata:
    fontFamily: "ui-monospace, monospace"
    fontSize: ".75rem"
    lineHeight: 1.6
rounded:
  badge: "4px"
  button: "5px"
  row: "6px"
  navigation: "8px"
spacing:
  compact: "8px"
  inset: "12px"
  row: "16px"
  section: "20px"
  group: "24px"
  stage: "32px"
  workspace-gap: "40px"
components:
  button:
    backgroundColor: "{colors.white}"
    textColor: "{colors.passed}"
    rounded: "{rounded.button}"
    padding: "8px 13px"
  badge-passed:
    backgroundColor: "{colors.passed-wash}"
    textColor: "{colors.passed}"
    rounded: "{rounded.badge}"
    padding: "3px 9px"
  badge-failed:
    backgroundColor: "{colors.failed-wash}"
    textColor: "{colors.failed}"
    rounded: "{rounded.badge}"
    padding: "3px 9px"
  source-block:
    backgroundColor: "{colors.soft-sage}"
    typography: "{typography.source}"
    padding: "12px"
---

# Design System: Agent Intent

## Overview

**Creative North Star: "The Outline Workspace"**

Agent Intent uses a quiet, flat developer-report language: evergreen navigation, a pale cream canvas, readable report prose and compact technical evidence. Context remains visible while the detail stage follows the reviewer into the next level.

The report treats test outcomes, specification changes and human acceptance as separate information. Visual hierarchy supports inspection without implying that a passing test is an accepted specification.

**Key Characteristics:**
- Persistent outline and shared breadcrumb navigation.
- One selected detail level at a time.
- Flat surfaces with restrained borders and tonal states.
- System UI prose paired with monospace source and evidence.

## Colors

Evergreen anchors navigation; pale cream and sage support long reading sessions. Blue, amber and violet distinguish technical and change information without becoming competing brand accents.

### Primary
- **Evergreen:** brand, selected headings and the shared breadcrumb bar.
- **Passed green:** links, controls and successful execution results.

### Secondary
- **Blue:** drillable requirement headings, added changes and code titles.
- **Amber:** modified changes and numeric source tokens.
- **Violet:** removed changes and source keywords.
- **Failed red:** failed execution and errors, paired with a pale failure wash.

### Neutral
- **Cream:** page canvas.
- **Ink:** report body text.
- **Muted green:** secondary explanation, paths and metadata.
- **Border:** quiet separators and outline branches.
- **Soft sage:** source blocks and alternating evidence rows.
- **White:** conventional button surface and inverse navigation text.

**The Evidence Rule.** Keep execution results visually and semantically separate from specification changes and human acceptance.

## Typography

**Body Font:** system-ui, sans-serif.
**Label/Mono Font:** ui-monospace, monospace.

**Character:** Report hierarchy is compact and practical. Technical material retains source-like spacing; prose and selected detail titles use the system UI stack.

### Hierarchy
- **Headline:** selected requirement, scenario and component detail headings.
- **Title:** selected step heading; brand and smaller section titles use nearby contextual sizes.
- **Body:** the report reading baseline; problem statements are slightly larger (1.05rem) and limited to 72ch.
- **Label:** buttons, navigation and supporting explanation; badges use a smaller size (.8rem) and stronger weight (650).
- **Source:** Gherkin step text, logs and code blocks.
- **Metadata:** lineage, tags and feature paths. Counts use tabular numerals.

The system UI face is a utilitarian reading choice, not a decorative display identity.

## Layout

Desktop uses a centered workspace capped at 1480px with outer padding from the stage spacing token. The outline is a fixed column (260px), separated from a fluid detail stage by the workspace gap. Both columns begin with a shared visual datum (64px): the outline heading and breadcrumb bar.

The outline sticks below the viewport edge (32px) and scrolls independently when needed. The breadcrumb bar sticks near the top (24px). The initial stage presents the problem statement and requirements; selection replaces the stage with the next level. The implemented path continues from intent through requirement, E2E scenario, Components, feature, scenario and captured step evidence, including nested component branches.

**The Context Rule.** Keep the outline and shared breadcrumb bar available while the selected detail owns the stage.

At 960px and below, the layout becomes a single column with a “Browse report” control. Its expanded outline is bounded (55vh) and closes on navigation. Outer padding becomes 20px; below 600px it becomes 16px, breadcrumb ancestors are hidden, and the current label retains the available width. Source comparisons elsewhere in the report become one column below 650px.

Without navigation enhancement, the report remains a readable disclosure document with the outline hidden.

## Elevation & Depth

**The Flat Surface Rule.** Use borders, whitespace and tonal fills to distinguish surfaces; the report does not use drop shadows.

The dark breadcrumb bar provides the strongest tonal layer. Hover and current-location states use pale green fills. Detail changes use a short view transition (180ms, cubic-bezier(.16, 1, .3, 1)); reduced-motion preferences disable it. The root itself does not animate.

## Shapes

Small rounded corners soften controls, source containers and navigation without creating a card-heavy interface. Badges, buttons, rows and the shared bar use the named radii in the frontmatter. Requirement and feature lists are divided by thin rules; outline branches use a vertical rule and indentation rather than enclosing boxes.

## Components

### Buttons

Quiet outlined controls use passed-green text and border on white, with a pale green hover fill. Disabled controls use muted text and a neutral border. Focus is a visible ring (2px) with generous offset (4px). Breadcrumb controls invert onto the dark surface; their focus ring is warm gold. Native approval checkboxes retain browser rendering.

### Result and change badges

Compact labeled badges pair a tinted fill with colored text. Passed, failed and not-run execution outcomes remain independent of added, modified and removed change labels. Badges report state; they are not filter controls.

### Navigation

The outline uses full-width left-aligned buttons, quiet default text, a tonal hover fill and a stronger current-location fill and weight. Requirement names are stronger than scenario entries; deeper scenario and step entries gain indentation. The active Components branch nests its feature, scenario and captured-step destinations beneath its originating outline entry. Active-scenario steps remain available for sibling navigation. The breadcrumb bar combines a Back button and clickable ancestors with an ellipsized current label. Back restores the originating focus and scroll position.

### Requirement, feature and scenario rows

Rows use whitespace and bottom borders, with descriptive headings that wrap rather than clip. Selecting a row promotes its heading into the stage title and suppresses peer detail. Feature paths remain visible in monospace beneath feature names. The same navigation treatment continues through component scenarios and captured steps.

### Source and step evidence

Gherkin and source blocks use pale sage backgrounds and monospace text; code can scroll horizontally. Captured step rows provide a generous target (44px minimum). Selecting a captured step promotes its description to a readable title while preserving the underlying evidence content and disclosure state. Logs remain bounded scroll regions (24rem maximum height).

## Do's and Don'ts

### Do:

- **Do** preserve current location in the outline and breadcrumb bar.
- **Do** retain original evidence nodes, disclosure state, focus and scroll when navigating back.
- **Do** use monospace for source, logs, paths and technical identifiers.
- **Do** retain readable labels alongside result and change colors.

### Don't:

- **Don't** equate passing execution with human acceptance.
- **Don't** turn deeper inspection into a stack of simultaneously visible detail panels.
- **Don't** add ornamental shadows to the flat report surfaces.
