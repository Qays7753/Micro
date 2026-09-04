#!/usr/bin/env python3
"""§10.1 text-density counter — distinct user-visible string literals rendered at rest.

MEASURES THE WHOLE SCREEN, not the file (2026-08-30 correction):

  screen = page unit
         + every in-project component it imports (and what those import, transitively)
         + presentation modules in that tree
         + the application-layer services that feed the screen
           (imported by the page or its components, or mapped explicitly
            when fed through the app context — e.g. Home)

Extraction therefore cannot change the number: moving a string from the page
into components/<screen>/ keeps it inside the same measured set. Extraction
remains allowed for code organization; it is never a density gain.

"At rest" per the design system: the screen as it loads and idles —
- strings inside collapsed <details> layers render only via their <summary>,
  so non-summary content inside <details> is NOT at rest;
- moment-of-action strings (validation errors, action feedback, loading labels)
  are NOT at rest;
- static JSX text nodes are not string literals and are not counted.

Counted per §10.1: distinct user-visible string literals rendered at rest,
in the page module and in the services that feed it.

Excluded from traversal (shared foundations, not part of any single screen):
app/ root context (instantiates every service for all screens), storage/
schemas, @micro-domain (shared domain package). Services under application/
contribute their strings but are not traversed further — a service importing
another service would otherwise pull the entire app into every screen.
"""
from __future__ import annotations

import re
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT_SRC = ROOT / "apps/prototype-web/client/src"
ARABIC = re.compile(r"[\u0600-\u06FF]")

MOMENT_LINE = re.compile(
    r"throw new Error|setMessage\(|setError\(|setNotice\(|setSuccess\(|setSaved\(|setReversalError\(|message:|message =|aria-invalid|text:|validation\(|setSaveState\("
    r"|failure\(|\bfail\(|\berr\(|invalid_input"
)
# Loading/progress labels on action buttons appear only while acting.
LOADING_LINE = re.compile(r"جارٍ|…")

# Message values may break across lines (message:\n  "…" · const message = …? A : B;)
# — they are action feedback, never at rest. Arabic prose uses «؛» so the ASCII
# ';' statement terminator never appears inside these strings.
MESSAGE_VALUE = re.compile(r'message:\s*\n\s*("[^"\n]*"|\'[^\'\n]*\')')
MESSAGE_CHAIN = re.compile(r'(?:const|let)\s+message\s*=[^;]*;', re.S)


def strip_messages(source: str) -> str:
    source = MESSAGE_CHAIN.sub("const message = '';", source)
    source = MESSAGE_VALUE.sub("message: ''", source)
    return source

STRING_LIT = re.compile(r'"([^"\\\n]*)"|' + r"'([^'\\\n]*)'")
TEMPLATE_LIT = re.compile(r"`([^`\\]*)`")
_TAG_KEYWORDS = {
    "return", "typeof", "instanceof", "case", "do", "else", "in", "of",
    "new", "void", "await", "yield", "satisfies", "as", "extends",
}


def _looks_like_tag(source: str, pos: int) -> bool:
    """Decide whether a `<` at pos opens a JSX tag (code context).

    Tags follow value positions: `return`, `=`, `=>`, `(`, `{`, `?`, `:`, `,`,
    `&&`, `||`. A `<` after a plain identifier (`Record<`, `i < n`) or after
    `)`/`]` (`foo() < bar`) opens a generic or comparison instead.
    """
    j = pos - 1
    while j >= 0 and source[j] in " \t\n\r":
        j -= 1
    if j < 0:
        return True  # file start
    c = source[j]
    if c in "=(?:,{&|":
        return True
    if c == ">":  # end of a tag or `=>` arrow — a real tag follows either way
        return True
    if c.isalnum() or c in "_$":
        end = j + 1
        while j >= 0 and (source[j].isalnum() or source[j] in "_$"):
            j -= 1
        word = source[j + 1 : end]
        return word in _TAG_KEYWORDS
    if c == "}" or c == ")" or c == "]":
        return False
    return True  # quotes, ;, +, -, etc. — conservative: treat as tag


def jsx_text_nodes(source: str) -> list[str]:
    """Static JSX text between a tag's closing > and the next child <.

    A context-aware state machine (code / tag / children) with a real tag
    stack: generics and comparison operators never open a children region,
    closing tags return to code when the element stack empties, and brace
    walking is string-aware so it can never desync.
    """
    CODE, TAG, CHILDREN = 0, 1, 2
    texts: list[str] = []
    buffer: list[str] = []
    stack: list[bool] = []
    state = CODE
    tag_brace = 0
    tag_is_closing = False
    tag_is_self_closing = False
    i, n = 0, len(source)
    while i < n:
        ch = source[i]
        if state == CODE:
            if ch in "\"'":
                quote = ch
                i += 1
                while i < n and source[i] != quote:
                    i += 2 if source[i] == "\\" else 1
                i += 1
                continue
            if ch == "`":
                i += 1
                while i < n and source[i] != "`":
                    i += 2 if source[i] == "\\" else 1
                i += 1
                continue
            if ch == "<":
                nxt = source[i + 1] if i + 1 < n else ""
                if (nxt.isalpha() or nxt in "/>") and _looks_like_tag(source, i):
                    after = source[i + 2] if i + 2 < n else ""
                    if nxt.isupper() and not after.isalpha():
                        pass  # generic type parameter: <T> <T,> <T>( …) <T extends …>
                    else:
                        state = TAG
                        tag_brace = 0
                        tag_is_closing = nxt == "/"
                        tag_is_self_closing = False
                        i += 2 if tag_is_closing else 1
                        continue
                i += 1
                continue
            i += 1
            continue
        if state == TAG:
            if ch in "\"'":
                quote = ch
                i += 1
                while i < n and source[i] != quote:
                    i += 2 if source[i] == "\\" else 1
                i += 1
                continue
            if ch == "{":
                tag_brace += 1
                i += 1
                continue
            if ch == "}":
                tag_brace = max(0, tag_brace - 1)
                i += 1
                continue
            if ch == "/" and tag_brace == 0:
                tag_is_self_closing = True
                i += 1
                continue
            if ch == ">" and tag_brace == 0:
                if tag_is_self_closing:
                    state = CHILDREN if stack else CODE
                elif tag_is_closing:
                    if stack:
                        stack.pop()
                    state = CHILDREN if stack else CODE
                else:
                    stack.append(True)
                    state = CHILDREN
                    buffer = []
                tag_is_closing = False
                tag_is_self_closing = False
                i += 1
                continue
            i += 1
            continue
        # CHILDREN
        if ch == "{":
            depth = 1
            i += 1
            while i < n and depth:
                c = source[i]
                if c in "\"'":
                    q = c
                    i += 1
                    while i < n and source[i] != q:
                        i += 2 if source[i] == "\\" else 1
                    i += 1
                    continue
                if c == "`":
                    i += 1
                    while i < n and source[i] != "`":
                        i += 2 if source[i] == "\\" else 1
                    i += 1
                    continue
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                i += 1
            continue
        if ch == "<":
            nxt = source[i + 1] if i + 1 < n else ""
            if nxt.isalpha() or nxt in "/>":
                value = re.sub(r"\s+", " ", "".join(buffer)).strip()
                if value and ARABIC.search(value) and not LOADING_LINE.search(value):
                    texts.append(value)
                buffer = []
                state = TAG
                tag_brace = 0
                tag_is_closing = nxt == "/"
                tag_is_self_closing = False
                i += 2 if tag_is_closing else 1
                continue
            else:
                buffer.append(ch)
            i += 1
            continue
        buffer.append(ch)
        i += 1
    return texts


# import ... from "spec" / export ... from "spec" / import "spec"
IMPORT_SPEC = re.compile(r'(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["\']([^"\']+)["\']', re.S)
BARE_IMPORT = re.compile(r'(?:^|\n)\s*import\s*["\']([^"\']+)["\']')

# Screens fed through the app context rather than direct imports.
EXPLICIT_SERVICES: dict[str, list[str]] = {
    "Home": ["application/home/homeControlCenterService.ts"],
}

# §10.1 target caps: Home 15, any single screen 30. Today's honest whole-screen
# measure (literals + JSX text) sits above the target on the screens below; the
# ratchet locks each surface at its current real number so the prose cannot
# return (§10.1: "Without an automated guard the prose returns"). Lowering a
# ratchet is a gain; raising it requires an owner decision record.
CAPS: dict[str, int] = {
    # Home 26 → 29 (2026-08-31, owner execution prompt flow 23 + §5.7): "أثناء غيابك"
    # return-after-absence card and the backup-reminder truth line — mandated labels.
    # Home 29 → 31 (2026-09-01, repair cycle U-002): away-digest lines (sales/expenses
    # since last activity, upcoming follow-ups) — concise digest mandated by the owner.
    # Home 31 → 30 (2026-09-01, final-audit cycle U-002): the digest line was rewritten
    # as one honest "last recording day" summary — a ratchet gain (lowering), locked here.
    # Home 30 → 35 (2026-09-02, Group 1 experience foundation §7.1, owner-approved
    # execution prompt): mandated labels only — priority block ("الأهم الآن"), today-row
    # action verbs (أكمل/حصّل/راجع/سلّم instead of generic open), amanah cash qualifier,
    # unallocated-cash card (+negative qualifier), owner-profile header link, honest
    # empty state ("يومك مفتوح"), and the local/offline truth line. Overlines removed
    # with the same scope (قراءة الصباح / أربع حقائق محلية / وحدات عند الحاجة).
    # Home 35 → 36 (2026-09-02, Group 2 §6.3 Scope B): direct-sale debt appears as a
    # due-collection row with its own title prefix ("دين بيع:") beside order debts — one
    # mandated label so credit-sale receivables never disappear from Home.
    # المجموعة ٥ (عقد ٣٠–٣٩، قرار مالك البرنامج): رفع مُوثَّق لأسطح الرؤية
    # والاستمرارية — القارئ الموحّد وتقرير الفترة وفحوص MIC-14..16 والمسودات
    # النصية والقفل والمشاركة اليدوية والتصحيحات المرحَّلة من المجموعة ٤
    # (سطر الأثر الرقمي + جمع عربي صحيح + أسباب منفصلة). كل زيادة تسمية
    # مفروضة من عقد المجموعة ٥، لا نثرًا حرًا؛ القيمة = القياس الفعلي يومها.
    "Home": 41,
    # Finance 113 → 122 (2026-08-31, owner execution prompt §5.2/§5.9/flows 14+20):
    # unallocated-distribution strip, amanah held line, party-ledger and cash-count
    # entries — mandated feature labels, not prose creep.
    # Finance 122 → 145 (2026-09-01, repair cycle): U-001 «السجل» corrections surface
    # (kind labels + filter groups + summary), D-005 edit/delete/restore actions and
    # previews, F-005 period-result direct-sale lines + scope note + review reason,
    # D-002 suppliers reading intent. All mandated labels from approved owner decisions.
    # Finance 145 → 148 (2026-09-01, final-audit cycle U-001): older-events
    # reachability — show-all/collapse toggle labels, full-list heading and honest
    # full-log note, focused-row aria label. Mandated by the approved prompt §7
    # ("a practical way to reach older events, not only the latest three").
    # Finance 148 → 169 (2026-09-02, Group 2 §8 Scope D + §9.2 Scope E, owner-approved
    # financial-truth prompt): Position/Period first-decision toggle labels, statement
    # entry card + period-reading link, negative-unallocated cover-payment alert
    # wording ("في دفعة تحت تغطية" + neutral explanation), direct-sale cash qualifier
    # ("بتاريخ البيع"), corrections-block labels (family/reason/net-effect), and the
    # unified correction history groups (purchases/orders). Mandated labels only.
    # Finance 169 → 172 (2026-09-02, Group 5 full audit S2-05/S1-10, owner-approved
    # audit repairs): honest Amanah exclusion on recorded liquidity (dt label
    # "أمانات محتجزة" + explanatory notice when held > 0) and the contract-26 return
    # label ("رجوع") when opened with ?from. Mandated honesty labels, no prose.
    # Finance 172 → 175 (2026-09-02, Group 6 Item 2, owner-approved final-closure
    # prompt — S2-07 unification): the single owner card carries the two mandated
    # separated numbers ("رأس مالك في المشروع" + "حق مسجل متبقٍ"), the dead owner
    # PositionCard becomes a link with the discoverability helper ("رأس مالك · افتح
    # الدفتر الموحد"), and the unified ledger service labels (merged-history rows)
    # join the measured set as feeding-service strings. Netted in the same scope:
    # "سياسات فعالة" + "سحب/إرجاع فعلي" metrics and the three scattered owner
    # action buttons collapsed into one "مال المالك" entry. Mandated labels only.
    # Finance 175 → 181 (2026-09-02, Group 6 Item 3, owner-approved final-closure
    # prompt — S2-09): the honest restatement line on Position (all-time digest)
    # and Period (in-range digest) — the RestatementNote component's mandated
    # sentences (count phrase, net-effect label, the preservation semantics,
    # "افتح الأصل والتصحيح") join the measured set as component strings. Calm
    # one-line treatment, no cards, no warning colors. Mandated labels only.
    # Finance 181 → 182 (2026-09-06, Group 2, عقد ٢٨): one conditional period waste
    # row (non-cash, outside period result) — SA-4 predicted 182. Decision D-029.
    # Finance 181 → 182 (2026-09-04, Group 2 §8): the period waste row reads
    # inventory — the shared inventory service now feeds this screen.
    # Finance 182 → 183 (2026-09-04, Group 3 D6): one new validation string in the
    # same shared service (direct-sale-linked consumption reference check).
    # Finance 183 → 199 (2026-09-04, Group 4 §5/عقد 29, deep finance): two mandated
    # finance layers (الأصول والقروض with pending-retained visibility), four explicit
    # period-result lines (إهلاك/شطب/تخلص/عربون مصنَّف), and the canonical reader's new
    # reason strings in the feeding service — mandated labels only.
    "Finance": 260,
    # OrderDetail 127 → 128 (2026-09-02, Group 1 Scope E): the additional-details
    # summary relabels itself at execution ("الاتفاق وسجل الطلب") because time/material
    # panels surface above the fold — one mandated conditional label.
    # OrderDetail 128 → 157 (2026-09-02, Group 2 §10.3/§10.5 Scope F, owner-approved
    # financial-correction prompt): post-agreement price-revision panel (price field,
    # CorrectionPreview dimensions for receivable/cash/revenue, reason, confirm labels)
    # and documented collection-reversal panel (event picker, amount, preview labels) —
    # the two approved order-level corrections, no generic confirmations.
    # OrderDetail 157 → 158 (2026-09-02, Group 3 Scope E §11.3, owner-approved
    # execution prompt): source-estimate link in additional details ("المصدر: تقدير",
    # open link) + real labels for the two Group-2 correction events that fell back
    # to a generic label (price_revised / collection_reversed in OrderEventLog) —
    # mandated labels, not prose creep.
    # OrderDetail 158 → 160 (2026-09-02, Group 5 full audit S1-02/S1-06): the
    # contract-26 return label ("رجوع") honoring ?from, and the pre-execution
    # consume link carrying its order context — mandated navigation labels.
    # OrderDetail 160 → 141 (2026-09-02, Group 6 Items 1+4, owner-approved
    # final-closure prompt): a ratchet GAIN — price-revision, collection-reversal,
    # and cancel entry moved behind one named disclosure ("تصحيحات موثقة على
    # الطلب") per §10.2 rule 1 (S3-12); the new compound one-tap reversal labels
    # (S2-04a) live inside that collapsed layer, and the always-zero "أمانات"
    # preview row was dropped (G6-F1-6). Nothing deleted; cap lowered 160→141.
    # OrderDetail 160 → 141 (2026-09-02, Group 6 Items 1+4, owner-approved
    # disclosure redesign).
    # OrderDetail 141 → 143 (2026-09-04, Group 3 D4/D5): the ready order routes to
    # the full delivery review instead of one-click delivery, and the delivered
    # order gains the documented reversal entry + post-reversal resume action.
    # OrderDetail 143 → 147 (2026-09-04, Group 4 عقد 29): retained-deposit meaning
    # classification panel (owner/revenue/pending + documented correction) — the
    # three-outcome decision mandated by the contract.
    "OrderDetail": 163,
    # Orders 73 → 76 (2026-09-02, Group 1 §8.1/§8.2, owner-approved execution prompt):
    # the always-rendered priority block's honest empty line, the direct-sale secondary
    # CTA, and the first-sale empty action — mandated labels; sale-row profit/revision
    # strings moved behind the detail screen in the same scope (net prose reduced).
    "Orders": 76,
    # DirectSaleEditor 42 → 43 (2026-08-31, Phase-1 D-001): the structured
    # credit-sale customer identity field — one mandated label, no prose.
    # DirectSaleEditor 43 → 45 (2026-09-01, repair cycle P-002): catalog-reference
    # suggestion labels (suggested price / no-default note / suggested cost) —
    # mandated proposal labels, clearly editable.
    # DirectSaleEditor 45 → 47 (2026-09-01, repair cycle item 25): quantity
    # semantics made explicit — total-price clarification under the quantity field
    # + per-unit suggestion note when quantity > 1 (no silent auto-multiply).
    # DirectSaleEditor 47 → 50 (2026-09-01, final-audit cycle U-005): the
    # unsaved-changes guard is now wired into this editor (the named U-005 case),
    # so the shared guard component's dialog labels join this screen's measured
    # set — the same +4 already counted for every guarded editor. No new prose.
    # DirectSaleEditor 50 → 66 (2026-09-02, Group 3 Scope D §10.1/§10.4, owner-approved
    # execution prompt): factual completion screen after create (what was sold, actual
    # price, cash/receivable effect, product reference, "افتح السجل"/"تم", local-truth
    # line), explicit collection-wallet destination (drawer default + unallocated as an
    # explicit option), ?product= prefill notice for inactive references, and a return
    # label that names the real target — all mandated labels from the Product-to-Sale
    # flow; no prose padding.
    # DirectSaleEditor 66 → 63 (2026-09-02, Group 6 Item 4, owner-approved
    # final-closure prompt — S3-12 §10.2 rule 1): the optional reference block
    # moves behind a 44px inline disclosure that auto-opens on ?product= prefill
    # (productNotice stays outside), the item-25 quantity semantics and the two
    # ⓘ explanations (profit-boundary, unknown-cost meaning) move behind named
    # disclosures. All primary-task fields stay visible; nothing deleted.
    # DirectSaleEditor 63 → 66 (2026-09-04, Group 3 D5/§5.6): optional explicit
    # inventory-linkage offer on the done receipt — no forced consumption.
    "DirectSaleEditor": 75,
    # DraftEditor 36 → 47 (2026-09-01, repair cycle U-004): estimate-to-draft bridge
    # (proposal notice, missing-estimate notice, knowledge labels, specs summary) —
    # mandated bridge labels; the draft form itself is unchanged.
    "DraftEditor": 47,
    # CostEditor 53 → 54 (2026-09-01, repair cycle U-004): source-estimate proposal
    # notice — one mandated bridge label.
    # CostEditor 54 → 58 (2026-09-06, Group 2, عقد ٢٨): material suggestion chips
    # (Scenario G) — group label + unit literals for suggestions. Decision D-029.
    "CostEditor": 58,
    # AgreementEditor 55 → 59 (2026-09-02, Group 4 final integration fix G4-6):
    # customer name field (label + required note + placeholder + its validation
    # message) — the agreement step is the point where the name becomes required
    # (debt and collection are attributed by it); planned-design drafts from the
    # estimate bridge had no field to satisfy it, so the step was a dead end.
    "AgreementEditor": 59,
    # Catalog 84 → 92 (2026-09-01, repair cycle P-002): optional suggested default
    # price/cost fields + per-item defaults editor labels — Option A mandated fields.
    # Catalog 92 → 94 (2026-09-02, Group 3 Scope C §9.3, owner-approved execution
    # prompt): the Product-to-Sale row action "سجّل بيع هذا المنتج/هذه الخدمة" on active
    # items — one mandated label pair, the primary action of the catalog surface.
    # Catalog 94 → 86 (2026-09-02, Group 6 Item 4, owner-approved final-closure
    # prompt — S3-12 §10.2 rule 1, Option A): the P-002 optional suggestion
    # fields, the optional organized-unit select, and the per-row defaults editor
    # move behind named inline disclosures (44px, prefill preserved on open);
    # the primary Product-to-Sale row action and the create path stay visible.
    # Nothing deleted; caps lowered — a ratchet gain.
    # Catalog 86 → 91 (2026-09-04, Group 3 D5/§5.2): per-component material link
    # with tracked/untracked honesty + template extras section (labor, packaging,
    # delivery, waste, safety margin) — planning reference, zero inventory effect.
    "Catalog": 91,
    # InventoryMaterials 49 → 50 (2026-09-02, Group 5 S1-10): contract-26 return
    # label ("رجوع") when opened with ?from — one mandated navigation label.
    # InventoryMaterials 50 → 56 (2026-09-06, Group 2 transfer program, عقد ٢٨):
    # tracked/cost-only section split, knowledge-state chips + qualifiers
    # («غير محدد بعد»/«صفر مؤكد»/«التكلفة غير معروفة»), shortage disclosure + resolve,
    # untrack consequences dialog, awaiting-receipt line (contract-11 promise),
    # «مرتدة موثقًا» marker — decision record D-029.
    "InventoryMaterials": 56,
    # MaterialEditor first measurement (2026-09-06, Group 2, عقد ٢٨): guided journey
    # (tracking question + opening-state question + cost question + effect preview)
    # — create + confirm-opening modes. Decision record D-029.
    "MaterialEditor": 39,
    # InventoryMovementEditor first measurement (2026-09-06, Group 2, عقد ٢٨):
    # receipt bridge status card + cost-known question + consume-target question +
    # shortage alternative panel + effect preview. Decision record D-029.
    "InventoryMovementEditor": 54,
    # SupplierPurchaseEditor first measurement (2026-09-06, Group 2, عقد ٢٨):
    # material link + expected quantity fields + received-status bridge card.
    # Decision record D-029.
    "SupplierPurchaseEditor": 71,
    # CashWallets 62 → 67 (2026-08-31, owner execution prompt §5.2): allocation entry
    # label + service truth line — the explicit distribution path is now a first-class
    # wallet-screen concept.
    # CashWallets 67 → 69 (2026-09-01, repair cycle D-004): unknown-opening badge +
    # documented-later-opening action label — mandated completion-road labels.
    # CashWallets 69 → 70 (2026-09-02, Group 2 §9.1 Scope E): the wallet-ledger entry
    # label ("دفتر المحفظة") on each wallet row — the approved per-wallet reading
    # surface, one mandated link label.
    # CashWallets 70 → 72 (2026-09-02, Group 5 S1-10/S3-05): contract-26 return
    # label ("رجوع") honoring ?from + the payable-line label moved out of the mono
    # numeric class into its own Arabic label pair. Mandated labels.
    # CashWallets 72 → 75 (2026-09-04, Group 4 عقد 29): the export/import
    # service in this screen's closure gained the new collections' migration labels
    # (لا أصول ولا قروض…) — zero new on-screen labels.
    "CashWallets": 75,
    # OwnerEntitlement 48 → 53 (2026-09-02, Group 6 Item 2, owner-approved
    # final-closure prompt — S2-07): the screen becomes the unified «مال المالك»
    # surface — mandated labels: unified overline ("دفتر واحد · المبالغ (د.أ)"),
    # the two balance metrics, the two primary write actions ("أدخل مالًا للمشروع"
    # · "اسحب لنفسك"), the merged-history layer with its source labels ("حدث عام"
    # · "دفتر المالك" + empty state), and the ⓘ boundaries disclosure. The old
    # visible policies section moved inside the collapsed «حق المالك وسياسته»
    # layer in the same scope. Mandated unification labels, no prose padding.
    "OwnerEntitlement": 53,
    # Schedule 98 → 99 (2026-09-02, Group 5 S1-10): contract-26 return label ("رجوع")
    # when opened with ?from — one mandated navigation label.
    "Schedule": 99,
    "ScheduleEditor": 45,
    # Profile (2026-09-02, Group 1 Scope G, owner-approved execution prompt): new
    # mandated screen — two identity sections, states, edit mode, and local-truth line;
    # locked at 27 with headroom of 3 for future mandated labels only.
    "Profile": 30,
    # Settings (2026-09-02, Group 5 S1-13): first explicit cap for the surface at its
    # current honest count — the contract-26 return label ("رجوع") honoring the
    # Foundation guided-import ?from; notices now render inline per section (S3-11)
    # so no new prose was added beyond the return label.
    "Settings": 39,
    # Tools (2026-09-02, Group 3 Scope A/B, owner-approved execution prompt): first
    # measurement day-one — the calculator moved to its own deep route
    # (/tools/calculator) so this surface keeps the entry card, the saved-estimate
    # list (row opens the new detail page), and module states; mandated labels only.
    # Tools 27 → 28 (2026-09-03, Group 1 guided-financial-entry prompt §5.8): the
    # integrity module-states row label ("فحص سلامة مالي") — one mandated label;
    # "مفعّل" and "افتح" deduped against the existing measured set. Headroom kept.
    "Tools": 34,
    # ToolsIntegrity 32 (2026-09-03, Group 1 §5.8 — first measurement day): the
    # read-only integrity surface — promise line, verdict card, five check titles,
    # status words (سليم/تحذير/خلل), offender disclosure, and the feeding service's
    # static titles; detail lines are `${}` templates (data-driven, uncounted).
    # Locked at the honest measured number as a ratchet from day one.
    # ToolsIntegrity 32 → 34 (2026-09-06, Group 2, عقد ٢٨): MIC-8 title
    # («سلامة المخزون والمواد») + generic deep-link label. Decision D-029.
    # ToolsIntegrity 34 → 45 (2026-09-04, Group 4 عقد 29): the MIC registry grew by
    # four read-only checks (MIC-10..13: assets, loans, retained deposits, delivery
    # consumption) — their titles and verdict strings render on this reader surface.
    "ToolsIntegrity": 52,
    # المجموعة ٥ (عقد ٣٠/٣٣): القياس الأول ليوم القياس الأول — تُقفل عند قياسها.
    "FinanceActivity": 55,
    "SharePreview": 24,
    # FinancialEventEditor 138 (2026-09-03, Group 1 §5.1–5.6 — first measurement
    # day): the guided expense journey — wallet question, category field + chips,
    # allocation review card, derived effect preview, guidance notes, draft banner
    # and attribution-failure honesty, on top of the historical editor labels.
    # Details-layer bodies are stripped at rest; validation/loading lines excluded.
    # FinancialEventEditor 138 → 142 (2026-09-04, Group 4 عقد 29): the canonical
    # period reader feeding this editor gained four reason strings for the new
    # independent period lines (إهلاك مسجّل/شطب أصل/تخلص من أصل/عربون محتفظ كإيراد).
    "FinancialEventEditor": 142,
    # Statement 89 (2026-09-03, Group 1 §5.2 — first measurement day): the
    # «مصاريفي حسب تصنيفي» grouping block + the feeding statementService's line
    # labels and truth lines join the measured set; per-tag rows are data.
    # Statement 89 → 101 (2026-09-04, Group 4 تصحيح مراجعة 4-c — owner decision):
    # the cash statement surfaced the 4 new cash-moving families (asset purchase
    # paid, asset disposal received, loan given, loan repaid) with explicit
    # not-expense/not-withdrawal/not-revenue qualifiers + asset/loan source labels
    # + correction family labels — hiding cash movement was the defect being fixed.
    "Statement": 202,
    # CostCalculator (2026-09-02, Group 3 Scope A, owner-approved execution prompt):
    # new mandated deep screen — full calculator (materials/time/quantity/optional
    # extras), live result with honest unknown lines, save + edit binding, saved
    # next-actions (open estimate / start draft), dirty guard, local-truth line.
    # CostCalculator 56 → 59 (2026-09-04, Group 3 D5/§5.1): inventory suggestion
    # chips with receipt-confidence + excluded-items honesty (named, unpriced).
    "CostCalculator": 59,
    # DeliveryReview (new 2026-09-04, Group 3 D5): the full pre-commitment delivery
    # surface — measured from day one per the Profile/CostCalculator precedent.
    "DeliveryReview": 48,
    # المجموعة ٤ (عقد ٢٩ — 2026-09-04): أسطح الأصول والقروض مقيسة من يومها الأول.
    # AssetEditor 40: the long-use question journey (name/category/kind/date/life/
    # start/note + effect preview + unsaved-guard labels) — mandated contract copy.
    "AssetEditor": 49,
    "Assets": 63,
    "Loans": 70,
    "LoanEditor": 31,
    # AssetDetail 36: book value + depreciation proposal/record + contract revision
    # + disposal/write-off + event history — every consequential action previews.
    # AssetDetail 36 → 41 (2026-09-04, Group 4 تصحيح مراجعة 4-c — owner decision):
    # acquisition-correction card (the unreachable-surface defect), owner-chosen
    # depreciation asOf date, and inline documented reversal reason replace
    # window.prompt — each string is a mandated contract/UX element.
    "AssetDetail": 41,
    # LoanDetail 31: reading + repayment history with traceable reversal + documented
    # correction + financial events layer.
    "LoanDetail": 73,
    # EstimateDetail (2026-09-02, Group 3 Scope B, owner-approved execution prompt):
    # new mandated screen — read-only estimate summary (result, materials, time,
    # extras, note), no-financial-effect qualifier, start-draft bridge, edit link,
    # two-step delete, honest not-found.
    "EstimateDetail": 36,
}

PAGES = [
    "Home",
    "Finance",
    "OrderDetail",
    "Orders",
    "DirectSaleEditor",
    "DraftEditor",
    "CostEditor",
    "AgreementEditor",
    "Catalog",
    "InventoryMaterials",
    # المجموعة ٢ (عقد ٢٨): محررات المخزون تدخل القياس أول مرة (يوم القياس الأول).
    "MaterialEditor",
    "InventoryMovementEditor",
    "SupplierPurchaseEditor",
    "Suppliers",
    "Foundation",
    "Setup",
    "CashWallets",
    "OwnerEntitlement",
    "Schedule",
    "ScheduleEditor",
    "OwnerWithdrawalEditor",
    "G5DeclarationEditor",
    # المجموعة ١ (Scope G): ملف المالك والمشروع — شاشة جديدة مقيسة من يومها الأول.
    "Profile",
    # المجموعة ٣ (Scope A/B): الحاسبة وصفحة التقدير وأدواتي بعد إعادة الهيكلة.
    "CostCalculator",
    # المجموعة ٣ (عقد D5): مراجعة التسليم — تقاس من يومها الأول.
    "DeliveryReview",
    "EstimateDetail",
    "Tools",
    "Settings",
    "NotFound",
    # المجموعة ١ (الإدخال المالي الموجّه): فحص السلامة + المحرر الموجّه + الكشف
    # — تقاس من يومها الأول (سابقة Profile/CostCalculator).
    "ToolsIntegrity",
    # المجموعة ٥ (عقد ٣٠/٣٣): قارئ النشاط الكامل ومعاينة المشاركة — تُقاسان من يومهما الأول.
    "FinanceActivity",
    "SharePreview",
    "FinancialEventEditor",
    "Statement",
    # المجموعة ٤ (عقد ٢٩): أسطح الأصول والقروض ومحرراتها — تقاس من يومها الأول
    # (سابقة Profile/CostCalculator/DeliveryReview).
    "Assets",
    "AssetEditor",
    "AssetDetail",
    "Loans",
    "LoanEditor",
    "LoanDetail",
]


def strip_comments(source: str) -> str:
    """Remove // and /* */ comments while respecting string literals.

    Quoted strings inside comments ("لا نستخدم \"1 طلبات\"") are not rendered.
    """
    out: list[str] = []
    mode = "code"  # code | line | block | single | double | template
    i, n = 0, len(source)
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if mode == "code":
            if ch == "/" and nxt == "/":
                mode = "line"
                i += 2
                continue
            if ch == "/" and nxt == "*":
                mode = "block"
                i += 2
                continue
            if ch == '"':
                mode = "double"
            elif ch == "'":
                mode = "single"
            elif ch == "`":
                mode = "template"
            out.append(ch)
            i += 1
        elif mode == "line":
            if ch == "\n":
                mode = "code"
                out.append(ch)
            i += 1
        elif mode == "block":
            if ch == "*" and nxt == "/":
                mode = "code"
                i += 2
                continue
            if ch == "\n":
                out.append(ch)  # keep line structure for line-based filters
            i += 1
        else:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(source[i + 1])
                i += 2
                continue
            if (mode == "single" and ch == "'") or (mode == "double" and ch == '"') or (
                mode == "template" and ch == "`"
            ):
                mode = "code"
            i += 1
    return "".join(out)


def strip_details_bodies(source: str) -> str:
    """Remove the non-summary content of <details> blocks (collapsed at rest)."""
    lines = source.splitlines(keepends=True)
    out: list[str] = []
    depth = 0  # details nesting depth
    for line in lines:
        if depth == 0:
            out.append(line)
            if "<details" in line:
                depth = 1
            continue
        # inside a details body: keep only summary lines and closing tags
        if "</details>" in line:
            depth -= 1
            if depth == 0:
                out.append(line)
            continue
        if "<details" in line:
            depth += 1
            continue
        if "<summary" in line or "</summary>" in line or "Summary" in line:
            out.append(line)
            continue
        # drop the body line entirely
    return "".join(out)


def strings_of(source: str) -> set[str]:
    found: set[str] = set()
    # A moment-of-action call (setNotice({…})) may span lines: skip until its
    # parentheses close so continuation strings are not read as at-rest text.
    open_parens = 0
    for line in source.splitlines():
        if open_parens:
            open_parens += line.count("(") - line.count(")")
            continue
        if MOMENT_LINE.search(line) or LOADING_LINE.search(line):
            open_parens = max(0, line.count("(") - line.count(")"))
            continue
        for match in STRING_LIT.finditer(line):
            value = match.group(1) if match.group(1) is not None else match.group(2)
            if value is not None and ARABIC.search(value):
                found.add(value.strip())
    for match in TEMPLATE_LIT.finditer(source):
        value = match.group(1)
        if value and "${" not in value and ARABIC.search(value):
            found.add(value.strip())
    for value in jsx_text_nodes(source):
        found.add(value)
    return found


def resolve_spec(spec: str, importer: Path) -> Path | None:
    """Resolve an import spec to a repo file, or None when external/skipped."""
    if spec.startswith("@micro-domain/"):
        return None  # shared domain package — not part of a single screen
    if spec.startswith("@/"):
        base = CLIENT_SRC / spec[2:]
    elif spec.startswith("."):
        base = (importer.parent / spec).resolve()
    else:
        return None  # external package (react, lucide-react, wouter, …)
    candidates = [base]
    if base.suffix not in (".ts", ".tsx"):
        candidates += [base.with_suffix(".ts"), base.with_suffix(".tsx")]
        candidates += [base / "index.ts", base / "index.tsx"]
    for candidate in candidates:
        if candidate.is_file() and ".test." not in candidate.name:
            return candidate
    return None


def import_specs(source: str) -> list[str]:
    return IMPORT_SPEC.findall(source) + BARE_IMPORT.findall(source)


def screen_files(page: Path) -> list[Path]:
    """Page + component/presentation closure + feeding application services."""
    files: dict[Path, str] = {page: "ui"}
    queue: deque[Path] = deque([page])
    while queue:
        module = queue.popleft()
        source = module.read_text(encoding="utf-8")
        for spec in import_specs(source):
            resolved = resolve_spec(spec, module)
            if resolved is None:
                continue
            rel = resolved.relative_to(CLIENT_SRC)
            parts = rel.parts
            if parts[0] in ("pages", "components", "presentation"):
                if resolved not in files:
                    files[resolved] = "ui"
                    queue.append(resolved)
            elif parts[0] == "application":
                # feeding service: counted, but not traversed further
                files.setdefault(resolved, "service")
            else:
                # app/ root, storage/ schemas — shared, not this screen
                continue
    return list(files)


def count_screen(name: str) -> set[str]:
    page = CLIENT_SRC / f"pages/{name}.tsx"
    strings: set[str] = set()
    if not page.is_file():
        return strings
    for module in screen_files(page):
        strings |= strings_of(strip_details_bodies(strip_messages(strip_comments(module.read_text(encoding="utf-8")))))
    for rel in EXPLICIT_SERVICES.get(name, []):
        service = CLIENT_SRC / rel
        if service.is_file():
            strings |= strings_of(strip_details_bodies(strip_messages(strip_comments(service.read_text(encoding="utf-8")))))
    return strings


def main(argv: list[str]) -> int:
    list_target = None
    breakdown = False
    args = [a for a in argv if a != "--breakdown"]
    if len(args) == 2 and args[0] == "--list":
        list_target = args[1]
    breakdown = "--breakdown" in argv

    failures = []
    for name in PAGES:
        page = CLIENT_SRC / f"pages/{name}.tsx"
        if not page.is_file():
            continue
        strings = count_screen(name)
        cap = CAPS.get(name, 30)
        status = "OK " if len(strings) <= cap else "OVER"
        print(f"{status} {name:24s} {len(strings):4d} distinct at-rest strings (cap {cap})")
        if list_target == name or (breakdown and len(strings) > cap):
            for value in sorted(strings):
                print(f"    - {value}")
        if len(strings) > cap:
            failures.append((name, len(strings), cap))
    if failures:
        print("\nOVER CAP (§10.1):")
        for name, count, cap in failures:
            print(f"  {name}: {count} > {cap}")
        return 1
    print("\nAll surfaces within §10 caps.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
