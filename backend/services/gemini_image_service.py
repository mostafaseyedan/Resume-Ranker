"""
Gemini Image Generation Service
Visual Knowledge Architect - Transforms content into presentations and infographics
"""
import os
import asyncio
from typing import Dict, Any, Optional, List

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()


class GeminiImageService:
    """Image generation service using Gemini with Visual Knowledge Architect system"""

    STYLE_PRESET_DIRECTIVES = {
        "Executive One-Pager": (
            "Create an executive one-pager designed for leadership review and rapid decision-making.\n\n"
            "PAGE STYLE:\n"
            "- White or very light warm-gray (#F8F8F6) canvas with generous margins.\n"
            "- Dark navy (#1B2A4A) header bar spanning full width at top, containing white title text.\n"
            "- Accent color: teal (#0A7E8C) for highlights, callout borders, and key metric numbers.\n"
            "- Secondary accent: muted gold (#C5A356) used sparingly for recommendation badges or stars.\n"
            "- Subtle light-gray (#EBEBEB) horizontal rule separators between sections.\n"
            "- Very faint drop shadow (2px, 8% opacity) on the three finding cards.\n\n"
            "TYPOGRAPHY:\n"
            "- Title: bold sans-serif, 28-32pt, white on navy bar.\n"
            "- Section headers: semi-bold sans-serif, 16pt, dark navy.\n"
            "- Body text: regular sans-serif, 11-12pt, charcoal (#333333).\n"
            "- Key metric numbers: bold, 36-48pt, teal accent.\n"
            "- All text must be crisp and legible at projection distance.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Top: full-width navy header bar with concise title and one-line context in smaller white text.\n"
            "- Middle: exactly 3 key findings in white rounded-corner cards (8px radius) with light border, arranged in a row.\n"
            "- Each card has a small teal icon or number badge at top-left, a bold finding title, and 1-2 lines of evidence.\n"
            "- Centerpiece: one primary visual (bar chart, donut, or simple diagram) below the cards with thin axis lines and labeled data points.\n"
            "- Bottom: light-gray recommendation strip with a gold star icon, bold action statement, and owner placeholder tag.\n\n"
            "VISUAL RULES:\n"
            "- Maximum two accent colors (teal + gold) beyond navy/white/gray.\n"
            "- No decorative illustrations, swooshes, or abstract shapes.\n"
            "- Directional cues: small arrows or callout lines pointing from data to insight.\n"
            "- Chart style: flat bars or clean donut with value labels directly on segments.\n"
            "- Card shadows should be subtle, not dramatic.\n\n"
            "MUST INCLUDE:\n"
            "- Navy header bar with executive title.\n"
            "- Three distinct finding cards with icon badges.\n"
            "- One central evidence chart or diagram.\n"
            "- Gold-accented recommendation strip at bottom.\n"
            "- Date stamp or review period tag in top-right corner of header."
        ),
        "Proposal Infographic": (
            "Create a proposal infographic optimized for RFP narrative clarity and evaluator readability.\n\n"
            "PAGE STYLE:\n"
            "- White canvas with a narrow vertical accent stripe (4px) in deep blue (#1A3A6B) along the left edge.\n"
            "- Section blocks separated by thin light-gray (#E0E0E0) horizontal dividers.\n"
            "- Each section has a colored left border (6px) using a gradient from deep blue at top to steel blue (#4682B4) at bottom.\n"
            "- Background of section headers: very light blue tint (#F0F5FA).\n"
            "- Accent color: deep blue (#1A3A6B) for headers and icons; secondary: warm orange (#E07A2F) for outcome highlights.\n\n"
            "TYPOGRAPHY:\n"
            "- Proposal title: bold sans-serif, 26-30pt, deep blue, left-aligned with a thin underline rule.\n"
            "- Section headers: semi-bold sans-serif, 16pt, deep blue, with a small numbered circle badge (white number on blue disc).\n"
            "- Body text: regular sans-serif, 11pt, dark charcoal (#2D2D2D).\n"
            "- Differentiator labels: medium weight, 12pt, with a small checkmark icon in orange.\n"
            "- Metric values: bold, 28-36pt, orange accent.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Section 1: Client challenge block with a red-tinted (#FFF0F0) callout box and a small warning-triangle icon.\n"
            "- Section 2: Solution framework shown as a horizontal process flow with 3-5 rounded rectangles connected by arrows.\n"
            "- Section 3: Differentiators as a vertical list with orange checkmark bullets and short one-line descriptions.\n"
            "- Section 4: Outcomes row with 2-4 metric tiles (white cards with orange top border, large number, small label).\n"
            "- Section 5: Compliance strip at bottom with green (#2E7D32) check badges for each requirement met.\n\n"
            "VISUAL RULES:\n"
            "- Process flow arrows: solid medium-gray with pointed heads, 2px stroke.\n"
            "- Rounded rectangles in flow: white fill, 1px blue border, 6px radius, blue header text inside.\n"
            "- Icons: simple line-style in circles (24x24px), deep blue stroke.\n"
            "- Metric tiles: subtle shadow (2px, 6% opacity), white background, orange top accent bar (3px).\n"
            "- Keep all text blocks to 2 lines max; use bullet fragments, not paragraphs.\n\n"
            "MUST INCLUDE:\n"
            "- Numbered section headers with circle badges.\n"
            "- Problem callout box with warning icon.\n"
            "- Horizontal solution process flow with arrows.\n"
            "- Orange-accented differentiator checklist.\n"
            "- Metric outcome tiles with large numbers.\n"
            "- Green compliance badges at bottom."
        ),
        "Competitive Battlecard": (
            "Create a competitive battlecard for sales conversations and objection handling.\n\n"
            "PAGE STYLE:\n"
            "- Dark charcoal (#1E1E2A) header band with bold white title text and a thin red (#E04040) underline accent.\n"
            "- Body background: very light gray (#F5F5F7) with two-column card layout.\n"
            "- Left column card: white background with a green (#1B8C4E) left border (4px) for 'Our Strengths'.\n"
            "- Right column card: white background with a red (#CC3333) left border (4px) for 'Competitor'.\n"
            "- Bottom section: medium-gray (#EAEAEA) strip for rebuttals and talk tracks.\n\n"
            "TYPOGRAPHY:\n"
            "- Title: bold sans-serif, 24-28pt, white on charcoal band.\n"
            "- Column headers: semi-bold, 16pt, green for left column, red for right column.\n"
            "- Comparison row text: regular, 11pt, dark gray (#333).\n"
            "- Badge labels: bold, 9pt, uppercase, white text on colored pill backgrounds.\n"
            "- Rebuttal section: medium italic, 11pt, dark charcoal.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Top: charcoal header with 'Us vs [Competitor]' title, red accent underline.\n"
            "- Middle: side-by-side comparison table with alternating row tinting (white / #F9F9F9).\n"
            "- Each row: category label in bold on the left edge, then our position (green column), then their position (red column).\n"
            "- Inline badges: green pill 'STRENGTH', amber pill (#D4930D) 'NEUTRAL', red pill 'RISK' next to each point.\n"
            "- Bottom strip: numbered rebuttal cards (white cards on gray strip) with objection in bold and counter-message below.\n"
            "- Footer: small caution callout with amber triangle icon and one-line over-claiming warning.\n\n"
            "VISUAL RULES:\n"
            "- Table rows have 1px light-gray bottom borders as dividers.\n"
            "- Badge pills: rounded corners (12px), 6px horizontal padding, colored fill with white text.\n"
            "- Green = advantage, amber = neutral, red = risk -- no other status colors.\n"
            "- Each comparison point must be one short line, never wrapping to a second line.\n"
            "- Rebuttal cards: white, 6px radius, light shadow (2px, 5% opacity).\n"
            "- No decorative imagery; every element serves the comparison.\n\n"
            "MUST INCLUDE:\n"
            "- Charcoal header band with versus title and red underline.\n"
            "- Side-by-side comparison table with green/red column borders.\n"
            "- Color-coded badge pills on each comparison point.\n"
            "- Numbered rebuttal/objection cards in bottom strip.\n"
            "- Amber caution callout for over-claiming.\n"
            "- Positioning statement in a highlighted box."
        ),
        "Timeline & Milestones": (
            "Create a timeline and milestones visual for project planning, execution tracking, and stakeholder alignment.\n\n"
            "PAGE STYLE:\n"
            "- White or very light gray (#FAFAFA) canvas with a single bold horizontal timeline spine.\n"
            "- Timeline spine: 3px solid line in slate blue (#3A5A8C), running left-to-right across the center of the canvas.\n"
            "- Phase bands: alternating soft color fills below the spine -- light blue (#E8F0FE), light lavender (#F0E8FE), light mint (#E8FEF0) -- to visually separate phases.\n"
            "- Milestone markers: diamond shapes (rotated squares), 16x16px, filled deep blue (#1A3A6B) for completed, outlined for planned.\n"
            "- Dependency arrows: dashed gray (#999) curved lines connecting related milestones.\n\n"
            "TYPOGRAPHY:\n"
            "- Project title: bold sans-serif, 24-28pt, dark navy (#1B2A4A), top-left.\n"
            "- Phase labels: semi-bold, 14pt, placed inside or above each phase band.\n"
            "- Milestone labels: regular, 10-11pt, dark charcoal, positioned above or below the diamond marker with a thin leader line.\n"
            "- Date labels: light weight, 9pt, medium gray (#777), directly under milestone markers.\n"
            "- Owner tags: small rounded pill badges (colored background, white text, 8pt bold) attached to each phase.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Top: project title and date range or status legend.\n"
            "- Main area: horizontal spine with phases laid out left-to-right in chronological order.\n"
            "- Each phase is a colored band segment along the spine with its label and duration.\n"
            "- Milestones sit on the spine as diamond markers with labels above and dates below.\n"
            "- Owner pill badges anchored to each phase band.\n"
            "- Status indicators: filled diamond = completed, outlined diamond = planned, half-filled = in progress.\n\n"
            "VISUAL RULES:\n"
            "- Spine must be perfectly horizontal with equal spacing between phases.\n"
            "- Phase bands use muted pastel fills, never saturated colors.\n"
            "- Diamond milestones must visually stand out from the phase bands.\n"
            "- Dependency dashes: 4px dash, 4px gap, gray, with small arrowhead at target.\n"
            "- Leader lines from labels to markers: thin (1px), light gray, straight or single-bend.\n"
            "- No decorative imagery or background patterns.\n\n"
            "MUST INCLUDE:\n"
            "- Project title and date range header.\n"
            "- Horizontal spine with colored phase bands.\n"
            "- Diamond milestone markers with labels and dates.\n"
            "- Owner pill badges per phase.\n"
            "- Status legend (filled/outlined/half-filled diamond meanings).\n"
            "- At least one dependency arrow if phases are related."
        ),
        "Pricing & ROI Snapshot": (
            "Create a pricing and ROI snapshot for business case and budget decision discussions.\n\n"
            "PAGE STYLE:\n"
            "- Clean white canvas with a thin dark-navy (#1B2A4A) top border strip (8px).\n"
            "- Cost section background: very faint red tint (#FFF8F8) to subtly signal spend.\n"
            "- Value section background: very faint green tint (#F5FFF5) to subtly signal return.\n"
            "- ROI headline area: white card with prominent green (#1B8C4E) large number and dark border.\n"
            "- Assumptions strip: light warm-gray (#F5F3EF) background with small italic text.\n\n"
            "TYPOGRAPHY:\n"
            "- Page title: bold sans-serif, 24-28pt, dark navy, top-left.\n"
            "- Section headers: semi-bold, 15pt, dark navy with a small colored square icon (red for costs, green for value).\n"
            "- Cost line items: regular, 11pt, charcoal; dollar amounts right-aligned, medium weight.\n"
            "- Value line items: regular, 11pt, charcoal; amounts right-aligned, medium weight.\n"
            "- ROI headline number: bold, 48-56pt, green (#1B8C4E) for positive, red (#CC3333) for negative.\n"
            "- ROI subtitle: regular, 12pt, medium gray, e.g. 'Estimated 18-month payback'.\n"
            "- Assumption text: light italic, 10pt, warm gray (#6B6356).\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Top: title and timeframe label.\n"
            "- Left column: cost breakdown as a vertical stacked bar chart or itemized table with red-tinted background.\n"
            "- Right column: value/benefit breakdown as matching bar chart or table with green-tinted background.\n"
            "- Center hero block: large ROI or payback metric in a bordered card, green number, subtitle below.\n"
            "- Bottom strip: assumptions in numbered list on warm-gray background.\n"
            "- Optional: small red/amber/green traffic-light dots for risk/confidence next to each assumption.\n\n"
            "VISUAL RULES:\n"
            "- Bar charts: flat filled bars, no 3D effects; cost bars in muted coral (#E88888), value bars in muted green (#7BC88F).\n"
            "- Dollar/currency symbols and unit labels on every axis and value.\n"
            "- ROI card: 1px dark border, 8px radius, subtle shadow (2px, 6% opacity).\n"
            "- Number formatting: consistent decimal places, thousands separators.\n"
            "- Missing values shown as '--' or 'TBD' in amber (#D4930D) text.\n"
            "- No decorative imagery; every element supports the financial narrative.\n\n"
            "MUST INCLUDE:\n"
            "- Red-tinted cost breakdown section with itemized amounts.\n"
            "- Green-tinted value breakdown section with itemized benefits.\n"
            "- Large hero ROI/payback card with prominent green number.\n"
            "- Warm-gray assumptions strip with numbered notes.\n"
            "- Explicit TBD/placeholder markers for any missing data.\n"
            "- Currency and timeframe labels throughout."
        ),
        "Process Flow": (
            "Create a process flow diagram for operational handoff and execution clarity.\n\n"
            "PAGE STYLE:\n"
            "- White canvas with optional light-gray (#F7F7F7) horizontal swimlane bands to separate ownership zones.\n"
            "- Swimlane labels on the left edge: bold, 12pt, dark blue (#1A3A6B), rotated 90 degrees or horizontal in a narrow column.\n"
            "- Flow direction: left-to-right as primary, top-to-bottom for branches.\n"
            "- Background of each swimlane alternates white and very light gray for visual separation.\n\n"
            "SHAPE LANGUAGE:\n"
            "- Process steps: rounded rectangles (8px radius), white fill, 1.5px solid blue (#3A5A8C) border, action label centered inside.\n"
            "- Decision points: diamond shapes, white fill, 1.5px solid amber (#D4930D) border, question text centered inside.\n"
            "- Start node: rounded pill shape, filled green (#1B8C4E), white 'Start' text.\n"
            "- End node: rounded pill shape, filled dark navy (#1B2A4A), white 'End' text.\n"
            "- Data/document nodes: rectangle with wavy bottom edge, light blue (#E8F0FE) fill, thin blue border.\n"
            "- Exception/escalation: octagon shape, red (#CC3333) border, 'Escalate' label.\n\n"
            "TYPOGRAPHY:\n"
            "- Process title: bold sans-serif, 22-26pt, dark navy, top-left.\n"
            "- Step labels inside shapes: regular, 10-11pt, dark charcoal, action-verb format ('Validate input', 'Send notification').\n"
            "- Decision branch labels: bold, 9pt, placed on arrows ('Yes' / 'No'), green for yes path, red for no path.\n"
            "- Ownership tags: small colored pill badges (8pt, white text) attached below each step.\n\n"
            "ARROW STYLES:\n"
            "- Primary flow arrows: 2px solid medium-gray (#666), pointed arrowhead, straight or single right-angle bend.\n"
            "- Yes-path arrows from decisions: green (#1B8C4E) with 'Yes' label.\n"
            "- No-path arrows from decisions: red (#CC3333) with 'No' label.\n"
            "- Exception path: dashed red line, 3px dash, pointed arrowhead.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Start with green pill 'Start' node on the left.\n"
            "- Sequential process steps connected by gray arrows.\n"
            "- At least one diamond decision node with yes/no branching.\n"
            "- End with navy pill 'End' node on the right.\n"
            "- Ownership pill badges on each step.\n"
            "- One escalation/exception path branching off with dashed red arrow.\n\n"
            "MUST INCLUDE:\n"
            "- Process title at top.\n"
            "- Green start and navy end nodes.\n"
            "- Rounded-rectangle process steps with action labels.\n"
            "- Diamond decision point with color-coded yes/no branches.\n"
            "- Ownership pill badges per step.\n"
            "- Dashed-red exception/escalation path.\n"
            "- Swimlane labels if multiple teams are involved."
        ),
        "Org & Responsibility Map": (
            "Create an org and responsibility map for governance, accountability, and escalation clarity.\n\n"
            "PAGE STYLE:\n"
            "- White canvas with team zones shown as large rounded-corner containers (12px radius).\n"
            "- Each team container has a colored header bar: e.g., blue (#3A5A8C) for Engineering, green (#2E7D32) for Operations, purple (#6A1B9A) for Leadership, teal (#00796B) for Client-facing.\n"
            "- Container body: very light tint of the header color (10% opacity) as background fill.\n"
            "- Connectors between roles/teams show reporting and collaboration relationships.\n\n"
            "ROLE CARD DESIGN:\n"
            "- Each role: small white card (120x60px approx), 6px radius, 1px border matching team color.\n"
            "- Role title: bold, 11pt, dark charcoal, centered.\n"
            "- Person name or 'TBD': regular, 9pt, medium gray, below role title.\n"
            "- Small colored dot (6px circle) in top-left corner of card matching team color for quick scanning.\n\n"
            "TYPOGRAPHY:\n"
            "- Map title: bold sans-serif, 24-28pt, dark navy (#1B2A4A), top-left.\n"
            "- Team container headers: bold, 14pt, white text on colored bar.\n"
            "- Role card text: as described in card design above.\n"
            "- Legend labels: regular, 10pt, dark gray.\n\n"
            "CONNECTOR STYLES:\n"
            "- Reporting lines (authority): solid 2px dark-gray (#444) lines with small arrow at subordinate end.\n"
            "- Collaboration lines: dashed 1.5px medium-gray (#888) lines, no arrowhead, small handshake icon at midpoint.\n"
            "- Escalation path: solid 2px red (#CC3333) line with upward arrow, labeled 'Escalate' in small red text.\n"
            "- Route connectors to avoid crossings; use single right-angle bends when needed.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Top tier: leadership/executive roles in purple container.\n"
            "- Middle tier: functional team containers side by side (engineering, operations, etc.).\n"
            "- Within each container: role cards arranged hierarchically or in a grid.\n"
            "- Solid lines connecting reporting relationships between tiers.\n"
            "- Dashed lines for cross-team collaboration.\n"
            "- Red escalation path from bottom-tier roles up to leadership.\n"
            "- Legend in bottom-right corner explaining line styles.\n\n"
            "MUST INCLUDE:\n"
            "- Map title at top.\n"
            "- Color-coded team containers with header bars.\n"
            "- Role cards with title, name, and team-color dot.\n"
            "- Solid reporting lines with arrows.\n"
            "- Dashed collaboration lines.\n"
            "- Red escalation path.\n"
            "- Legend box explaining solid/dashed/red line meanings."
        ),
        "Data Story Dashboard": (
            "Create a data story dashboard that combines KPI monitoring with narrative insight.\n\n"
            "PAGE STYLE:\n"
            "- Light dashboard background: white (#FFFFFF) or very light gray (#F5F5F7).\n"
            "- KPI tiles: white card surfaces with subtle 1px border (#E0E0E0) and minimal shadow (clean, flat look).\n"
            "- Accent colors: electric teal (#00E5CC) for positive trend indicators, coral red (#FF6B6B) for negative, amber (#FFB347) for warnings.\n"
            "- Chart area: white surface with thin grid lines in light gray (#E6E6E6).\n\n"
            "KPI TILE DESIGN:\n"
            "- Each tile: rounded rectangle (8px radius), white fill, 1px subtle border.\n"
            "- Metric label: regular, 10pt, medium gray (#666666), top of tile.\n"
            "- Metric value: bold, 32-40pt, dark charcoal (#222222), center of tile.\n"
            "- Trend indicator: small arrow (up/down) + percentage in teal (positive) or coral (negative), bottom of tile.\n"
            "- Optional sparkline: tiny 30px-tall line chart in teal/coral below the value, showing recent trend.\n\n"
            "TYPOGRAPHY:\n"
            "- Dashboard title: bold sans-serif, 22-26pt, dark charcoal (#222222), top-left.\n"
            "- Timeframe label: regular, 11pt, medium gray (#666666), next to title.\n"
            "- Chart axis labels: regular, 9pt, gray (#666666).\n"
            "- Insight callout text: medium, 12pt, dark charcoal (#222222) on a teal-bordered callout card.\n"
            "- Alert text: medium, 11pt, amber or coral depending on severity.\n\n"
            "CHART STYLE:\n"
            "- Line charts: 2.5px smooth lines, teal for primary metric, dark gray for secondary, with small circle dots at data points.\n"
            "- Bar charts: flat filled bars with 4px radius top corners, teal fill, 60% opacity for comparison bars.\n"
            "- Grid lines: 1px dashed, light gray (#E6E6E6), horizontal only.\n"
            "- Data point labels: small dark text above significant points.\n"
            "- Annotation callouts: thin gray leader line from data point to callout box with teal left border.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Top row: 4-6 KPI tiles in a horizontal row with equal spacing.\n"
            "- Main area: one large chart (line or bar) taking ~50% of canvas height.\n"
            "- Right sidebar or bottom panel: insight callout card with teal left border, dark text, 1-3 interpretation sentences.\n"
            "- Optional alert strip: horizontal bar below chart with amber/coral warning icons and short alert messages.\n"
            "- Footer: small gray text with data source, definitions, and timeframe.\n\n"
            "MUST INCLUDE:\n"
            "- Light-themed dashboard with high-contrast title and timeframe.\n"
            "- KPI tiles with large values, trend arrows, and optional sparklines.\n"
            "- One main chart with annotation callouts.\n"
            "- Teal-bordered insight callout card with interpretation.\n"
            "- Trend colors: teal for positive, coral for negative, amber for warning.\n"
            "- Missing-data markers shown as dashed segments or '--' values."
        ),
        "Cendien Corporate": (
            "Create a Cendien corporate visual suitable for executive meetings, client-facing decks, and formal internal updates.\n\n"
            "PAGE STYLE:\n"
            "- White (#FFFFFF) canvas with a top header block in Cendien navy (#14213D).\n"
            "- Thin accent rule (2px) in steel blue (#4A7FB5) below the header block.\n"
            "- Content areas use white backgrounds with generous padding (40px+ margins).\n"
            "- Section dividers: 1px light gray (#D9D9D9) horizontal lines.\n"
            "- Takeaway strip at bottom: light warm-gray (#F2F0EC) background.\n"
            "- Overall feel: conservative, polished, Fortune-500 boardroom quality.\n\n"
            "TYPOGRAPHY:\n"
            "- Title: bold serif or semi-bold sans-serif, 28-32pt, white on navy header block.\n"
            "- Subtitle/date: regular, 13pt, steel blue (#4A7FB5), inside header block below title.\n"
            "- Section headers: semi-bold sans-serif, 16pt, Cendien navy (#14213D), with a thin steel-blue underline (1px, 40px wide).\n"
            "- Body text: regular sans-serif, 11-12pt, charcoal (#333333), generous line height (1.5x).\n"
            "- Key numbers or metrics: bold, 36pt, Cendien navy.\n"
            "- Takeaway text: medium, 13pt, dark charcoal on warm-gray strip.\n\n"
            "COLOR PALETTE (strict):\n"
            "- Primary: Cendien navy (#14213D) -- headers, key text, primary elements.\n"
            "- Secondary: steel blue (#4A7FB5) -- accent rules, subtle highlights, secondary icons.\n"
            "- Neutral: charcoal (#333333) for body, medium gray (#888888) for captions, light gray (#D9D9D9) for dividers.\n"
            "- Background accent: warm gray (#F2F0EC) for emphasis strips only.\n"
            "- No other colors permitted. No red, green, orange, or bright accents.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Top: navy header block (full-width, ~80px tall) with white title and steel-blue subtitle.\n"
            "- Middle: 2-3 content sections, each with a navy section header and thin underline accent.\n"
            "- Content blocks use two-column or single-column layout with strict left alignment.\n"
            "- If data is present: simple navy-colored flat bar chart or clean table with alternating white/#FAFAFA rows.\n"
            "- Bottom: warm-gray takeaway strip with a single key message and optional action item.\n\n"
            "VISUAL RULES:\n"
            "- No gradients, no shadows, no rounded corners on content blocks (sharp, precise edges).\n"
            "- No decorative icons, illustrations, or abstract shapes.\n"
            "- Charts: flat bars in navy and steel blue only, thin 1px gray axis lines, value labels in navy.\n"
            "- Tables: 1px gray borders, navy header row with white text, alternating row tint.\n"
            "- Whitespace is a design element; do not fill empty space.\n"
            "- Everything must be legible when projected at 10+ feet.\n\n"
            "MUST INCLUDE:\n"
            "- Navy header block with white title.\n"
            "- Steel-blue accent rule below header.\n"
            "- Section headers with thin underline accents.\n"
            "- Clean body text in charcoal.\n"
            "- Warm-gray takeaway strip at bottom.\n"
            "- Strict navy/steel-blue/gray palette with no other colors."
        ),
        "Lightweight Social Card": (
            "Create a lightweight social-style update card optimized for quick scanning and high visual impact.\n\n"
            "PAGE STYLE:\n"
            "- Card format with fixed aspect ratio (close to 1.91:1 or 4:5 depending on content).\n"
            "- Background: solid vibrant gradient from deep indigo (#2D1B69) at top-left to rich blue (#1A3A8C) at bottom-right.\n"
            "- Alternative backgrounds (pick based on content mood): warm sunset gradient (#FF6B35 to #FF2D6B), cool teal gradient (#0A6E5C to #1A8FBA).\n"
            "- Card has rounded corners (16px radius) and a thin white inner border (1px, 15% opacity) for a polished edge.\n"
            "- Overall feel: punchy, scroll-stopping, social-media native.\n\n"
            "TYPOGRAPHY:\n"
            "- Headline: extra-bold sans-serif, 36-48pt, pure white (#FFFFFF), max 2 lines, centered or left-aligned.\n"
            "- Support line: regular, 14-16pt, white at 80% opacity, 1 line max, below headline.\n"
            "- Metric callout (if present): bold, 56-72pt, white, with a subtle text-shadow (2px, 20% black).\n"
            "- Tag/label: bold uppercase, 9pt, white text on a semi-transparent white pill (20% opacity background), in corner.\n"
            "- Date stamp: light, 10pt, white at 60% opacity, bottom corner.\n\n"
            "VISUAL ELEMENTS:\n"
            "- One bold icon or simple illustration: white outline style (2px stroke, no fill), ~64x64px, positioned to anchor the composition.\n"
            "- Optional: single mini chart (white line on transparent, 3px stroke) as a background texture element at ~20% opacity.\n"
            "- Optional: large semi-transparent geometric shape (circle or triangle) as background depth element at 8-12% white opacity.\n"
            "- Subtle noise/grain texture overlay at 3-5% opacity for tactile quality.\n\n"
            "STRUCTURE REQUIREMENTS:\n"
            "- Visual focal point in the upper or center third of the card.\n"
            "- Headline and support line grouped together with tight leading.\n"
            "- One visual anchor element (icon, metric, or mini chart).\n"
            "- Tag pill in top-right or top-left corner.\n"
            "- Date or source stamp in bottom corner.\n"
            "- Generous padding: at least 32px from all card edges to content.\n\n"
            "VISUAL RULES:\n"
            "- Maximum 3 text elements total (headline + support + one label).\n"
            "- No tables, no bullet lists, no dense text blocks.\n"
            "- White is the only text and icon color on gradient backgrounds.\n"
            "- Gradient must be smooth, no banding or hard color stops.\n"
            "- Icon must be simple enough to read at thumbnail size.\n"
            "- The card should look complete and professional at 400x400px.\n\n"
            "MUST INCLUDE:\n"
            "- Vibrant gradient background with rounded card edges.\n"
            "- Bold white headline (2 lines max).\n"
            "- One support line in lighter white.\n"
            "- One visual anchor (icon, metric, or mini chart).\n"
            "- Tag pill or date stamp.\n"
            "- Clean padding and balanced composition."
        ),
        "Student Handwritten Notes": (
            "Create an image that looks like a student's handwritten study notes.\n\n"
            "PAPER STYLE:\n"
            "- Cream/off-white paper background with subtle notebook texture or college-ruled lines.\n"
            "- Slightly aged paper look with gentle coffee stain or dog-eared corner optional.\n\n"
            "HANDWRITING STYLE REQUIREMENTS:\n"
            "- Use multiple pen colors: blue for main text, black for headers, red for warnings/important items, "
            "green for tips/memory aids, purple for mnemonics.\n"
            "- Hand-drawn appearance with slight imperfections (like real handwriting).\n"
            "- Mix of print and cursive writing styles.\n"
            "- Include underlines, arrows, stars, and margin annotations.\n"
            "- Draw small aviation doodles (aircraft silhouettes, instruments, cockpit elements).\n"
            "- Use boxes, clouds, and circles around key terms.\n"
            "- Add numbered lists and bullet points for procedures.\n"
            "- Include 'Remember!' and 'Test Tip!' callouts in colored bubbles or boxes.\n"
            "- Write mnemonics in boxed sections with memory aid symbols.\n"
            "- Headers should be bold, underlined, or in all caps.\n"
            "- Add circled numbers for step-by-step procedures.\n"
            "- Include small checkboxes next to important items.\n"
            "- Add sticky note or highlighter overlays for emphasis.\n\n"
            "MUST INCLUDE:\n"
            "- The topic/chapter title as a bold header at the top.\n"
            "- At least one mnemonic or memory trick highlighted.\n"
            "- At least one procedural checklist if applicable.\n"
            "- Small relevant aviation sketches or diagrams.\n"
            "- Color-coded highlighting of critical information.\n"
            "- Date or 'Study Session' notation in corner like real notes."
        ),
    }

    SYSTEM_INSTRUCTION = """You are the Visual Knowledge Architect, a specialized infographic design engine. Your purpose is to transform unstructured text into high-utility, information-dense visual assets optimized for visual learners.

CORE DESIGN PHILOSOPHY:
- Information density without clutter
- Conceptual clarity over decoration
- Every visual element must serve a learning function
- No decorative swooshes or abstract shapes that do not convey meaning

CRITICAL OUTPUT RULES (STRICT):
- You may receive input with sections wrapped in XML-like tags: <IMAGE_REQUEST>, <SOURCE_NOTES>, and <TECHNICAL_METADATA>.
- <TECHNICAL_METADATA> is NON-DISPLAY configuration only. NEVER render any text from <TECHNICAL_METADATA> into the image.
- NEVER display technical specifications as literal text, including (but not limited to): font sizes (e.g., '32pt'), pixel sizes (e.g., '2px', '120x60px'), opacity percentages, aspect ratios, or measurement units.
- NEVER display hex color codes (e.g., '#1A3A6B') or palette lists.
- NEVER display instruction headings like 'TYPOGRAPHY', 'PAGE STYLE', 'VISUAL RULES', 'STRUCTURE REQUIREMENTS', 'MUST INCLUDE'.
- The only text allowed to appear in the generated image is semantic infographic content (titles, labels, captions, and short bullets) derived from the <IMAGE_REQUEST> (and optionally inferred from <SOURCE_NOTES>), but never copied from <TECHNICAL_METADATA>.
- If a conflict exists between aesthetic specs and these rules, prioritize NOT rendering any technical/instructional text.
"""

    def __init__(self, project_id: Optional[str] = None):
        """
        Initialize Gemini Image Service

        Args:
            project_id: Google Cloud project ID
        """
        self.project_id = project_id or os.getenv("GCLOUD_PROJECT")
        self.api_key = (
            os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("GOOGLE_CLOUD_API_KEY")
        )

        if not self.api_key:
            raise ValueError("Missing required configuration: GEMINI_API_KEY")

        try:
            self.client = genai.Client(vertexai=False, api_key=self.api_key)
            print("Initialized Gemini Image Service via Gemini API")
        except Exception as e:
            print(f"Error initializing Gemini Image Service: {e}")
            raise

        # Optional Vertex AI client (used for models that are only available on Vertex).
        self.vertex_client = None
        use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").strip().lower() in ("1", "true", "yes")
        if use_vertex:
            try:
                location = (
                    os.getenv("GOOGLE_CLOUD_LOCATION")
                    or os.getenv("VERTEX_AI_LOCATION")
                    or "us-central1"
                )
                if not self.project_id:
                    raise ValueError("Missing required configuration for Vertex: GCLOUD_PROJECT")
                self.vertex_client = genai.Client(
                    vertexai=True,
                    project=self.project_id,
                    location=location,
                )
                print(f"Initialized Gemini Image Service via Vertex AI ({location})")
            except Exception as e:
                print(f"Warning: Vertex client disabled: {e}")

        self.model_default = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3-pro-image-preview")
        self.model_fast = os.getenv("GEMINI_IMAGE_MODEL_FAST", "").strip() or self.model_default
        # Backward-compatible alias
        self.model = self.model_default
        self.connected = True

    def _resolve_model(self, *, model_variant: Optional[str] = None, model: Optional[str] = None) -> str:
        if model:
            return model
        variant = (model_variant or "").strip().lower()
        if variant in ("fast", "flash"):
            return self.model_fast
        return self.model_default

    def _build_generation_config(
        self,
        aspect_ratio: Optional[str] = None,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None,
    ) -> types.GenerateContentConfig:
        """Build configuration for image generation with 2K resolution and Google Search"""
        model_name = (model or "").lower()
        is_image_model = "image" in model_name

        # Some image models reject tools and/or TEXT modality.
        # Keep config conservative to avoid INVALID_ARGUMENT.
        response_modalities = ["IMAGE"] if is_image_model else ["IMAGE", "TEXT"]

        # High-res size can be rejected by faster/older image models; only force it
        # for the default "quality" model.
        image_config_kwargs = {}
        if is_image_model and model and (model == getattr(self, "model_default", None)):
            image_config_kwargs["image_size"] = "2K"
        if aspect_ratio:
            image_config_kwargs["aspect_ratio"] = aspect_ratio

        effective_system_instruction = system_instruction or self.SYSTEM_INSTRUCTION

        return types.GenerateContentConfig(
            response_modalities=response_modalities,
            temperature=1,
            system_instruction=effective_system_instruction,
            image_config=types.ImageConfig(**image_config_kwargs) if is_image_model else None,
            tools=[],
        )

    def _resolve_client(self, model: str):
        """Pick Vertex client for Vertex-only models when available."""
        m = (model or "").lower()
        if self.vertex_client and (
            "flash-image" in m
            or "2.5" in m
            or m.startswith("projects/")
            or m.startswith("publishers/")
        ):
            return self.vertex_client
        return self.client

    def _build_prompt(
        self,
        *,
        user_prompt: str,
        conversation_context: Optional[str],
        style_name: str,
    ) -> str:
        """Build a structured prompt that separates display intent from technical metadata."""
        sections: List[str] = [
            "<IMAGE_REQUEST>",
            user_prompt.strip(),
            "</IMAGE_REQUEST>",
        ]

        if conversation_context:
            sections.extend(
                [
                    "<SOURCE_NOTES>",
                    conversation_context.strip(),
                    "</SOURCE_NOTES>",
                ]
            )

        return "\n".join(sections).strip() + "\n"

    async def generate_image(
        self,
        user_prompt: str,
        conversation_context: Optional[str] = None,
        style_preset: Optional[str] = None,
        aspect_ratio: Optional[str] = None,
        model_variant: Optional[str] = None,
        model: Optional[str] = None,
        input_image_bytes: Optional[bytes] = None,
        input_image_mime: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate an image using the Visual Knowledge Architect system

        Args:
            user_prompt: User's description of what they want to generate
            conversation_context: Optional conversation history for context continuity
            aspect_ratio: Optional aspect ratio (1:1, 3:4, 4:3, 9:16, 16:9)
            **kwargs: Additional arguments (ignored for backward compatibility)

        Returns:
            Dictionary with image data and metadata
        """
        try:
            style_name = style_preset if style_preset in self.STYLE_PRESET_DIRECTIVES else "Executive One-Pager"
            full_prompt = self._build_prompt(
                user_prompt=user_prompt,
                conversation_context=conversation_context,
                style_name=style_name,
            )

            print(f"Debug: Using image style preset: {style_name}")
            if conversation_context:
                print(f"Debug: Generating image with context ({len(conversation_context)} chars)")

            model_to_use = self._resolve_model(model_variant=model_variant, model=model)
            print(
                f"Debug: Generating image with prompt: '{user_prompt[:100]}...', aspect_ratio: {aspect_ratio}, model: {model_to_use}"
            )

            # Put technical style specs into the system instruction (not the user prompt)
            # to reduce the likelihood they will be treated as literal text to render.
            style_system_block = (
                "\n\n"
                "<TECHNICAL_METADATA purpose=\"rendering_configuration\" do_not_render=\"true\">\n"
                f"STYLE_PRESET_NAME: {style_name}\n"
                "STYLE_PRESET_SPEC:\n"
                f"{self.STYLE_PRESET_DIRECTIVES[style_name]}\n"
                "</TECHNICAL_METADATA>\n"
            )
            effective_system_instruction = self.SYSTEM_INSTRUCTION + style_system_block

            config = self._build_generation_config(
                aspect_ratio=aspect_ratio,
                system_instruction=effective_system_instruction,
                model=model_to_use,
            )

            parts = [types.Part.from_text(text=full_prompt)]
            if input_image_bytes:
                mime = input_image_mime or "image/png"
                parts.append(types.Part.from_bytes(data=input_image_bytes, mime_type=mime))
                print(f"Debug: Included input image for edit ({len(input_image_bytes)} bytes, {mime})")

            # The SDK call is synchronous; run it in a worker thread to avoid
            # blocking the event loop when this async method is awaited.
            client = self._resolve_client(model_to_use)
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=model_to_use,
                contents=[types.Content(role="user", parts=parts)],
                config=config,
            )

            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]

                if candidate.content and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            image_data = part.inline_data.data
                            mime_type = part.inline_data.mime_type

                            if image_data is None:
                                continue

                            print(f"Debug: Generated image successfully, size: {len(image_data)} bytes")

                            return {
                                "success": True,
                                "image_data": image_data,
                                "mime_type": mime_type,
                                "prompt": user_prompt,
                                "model": model_to_use,
                            }

            return {
                "success": False,
                "error": "No image data found in response"
            }

        except Exception as e:
            error_msg = f"Error generating image: {str(e)}"
            print(error_msg)
            return {
                "success": False,
                "error": error_msg
            }

    def get_service_info(self) -> Dict[str, Any]:
        """Get service information for status display"""
        return {
            "service_type": "Gemini Image Generation (Gemini API)",
            "project_id": self.project_id,
            "model": self.model,
            "connected": self.connected,
            "capabilities": [
                "Visual Knowledge Architect",
                "Presentation Mode (Slide Decks)",
                "Infographic Mode (One-Pagers)",
                "Auto Aspect Ratio",
            ]
        }


def create_gemini_image_service() -> GeminiImageService:
    """Factory function to create Gemini Image Service"""
    try:
        service = GeminiImageService()
        if service.connected:
            print("SUCCESS: Gemini Image Service initialized successfully")
            return service
        else:
            raise RuntimeError("Failed to connect to Gemini Image Service")
    except Exception as e:
        print(f"ERROR: Failed to initialize Gemini Image Service: {str(e)}")
        raise


if __name__ == "__main__":
    import asyncio

    async def test():
        try:
            service = create_gemini_image_service()

            print("\n=== Testing Image Generation ===")
            result = await service.generate_image(
                user_prompt="Run Infographic Mode: A one-pager comparing Serverless vs VMs for cloud deployment"
            )

            if result["success"]:
                print(f"Image generated successfully!")
                print(f"Image size: {len(result['image_data'])} bytes")
                print(f"MIME type: {result['mime_type']}")

                with open("test_image.png", "wb") as f:
                    f.write(result['image_data'])
                print("Saved test image to test_image.png")
            else:
                print(f"Image generation failed: {result.get('error')}")

        except Exception as e:
            print(f"Test failed: {str(e)}")

    asyncio.run(test())
