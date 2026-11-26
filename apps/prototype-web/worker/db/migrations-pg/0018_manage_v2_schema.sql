-- M2.1 (Manage v2 phase 2, wave E) — the §3 schema of the Manage financial
-- core, exactly as specified in docs/manage-v2/micro-manage-spec-final.md
-- (v1.1, binding): tables 3.1-3.10 with their exact fields, types, keys and
-- constraints; database-level append-only enforcement for the two ledger
-- tables (3.8); indexes for the read paths the spec implies.
--
-- Repository migration ONLY — applied by the repository's two migration
-- runners on disposable databases (worker/tests/harness.ts applyMigrations
-- with its exact statement split, and scripts/rtl-review-server.mjs applying
-- each file as one call). Production application stays the operator's own
-- documented step, like every migration before this one.
--
-- Why every statement is a plain CREATE (no ALTER, no DROP, no DML):
--   the §3 columns that reference other §3 rows are exactly the ones §3 marks
--   with "FK" (product_component.product_id, sale_line.sale_id,
--   balance_line.origin_operation_id, ledger_entry.operation_id,
--   ledger_posting.entry_id, reconciliation_box.reconciliation_id and
--   reconciliation_box.box_id) plus the §3 preamble's project scoping
--   (project_id on every table except the root `project` itself). Those
--   targets all exist before their referrers in the creation order below, so
--   the graph is acyclic and needs no deferred constraints. Columns §3 does
--   NOT mark with FK (operation.box_id/sale_id/balance_line_id/
--   corrects_operation_id/reversed_by_operation_id, sale_line.product_id,
--   balance_line.sale_id, ledger_entry.reverses_entry_id, ledger_posting.ref_id)
--   stay plain references: their referential discipline is the operation
--   handler's job (M2.4+) and ledger_posting.ref_id is polymorphic by account
--   (BOX->box.id, AR/AP->balance_line.id, PRE/REV->sale.id), which no single
--   FK can express.
--
-- Idempotent re-application: every CREATE TABLE is IF NOT EXISTS and every
-- index is CREATE INDEX IF NOT EXISTS, so re-running this file through either
-- runner on an already-migrated database is a no-op. This is required by the
-- M2.1 acceptance ("applies cleanly on an empty database and is re-application
-- safe under the repo's migration runner") and it costs nothing on the fresh
-- path, which is the only path the runners use (they apply every file in
-- sorted order to a fresh per-file database).
--
-- APPEND-ONLY (§3.8, §14.4 R-11) — the choice and why:
--   Task M2.1 offers "trigger or revoked grants". Grants CANNOT express the
--   rule for this repository: PostgreSQL table owners keep implicit rights on
--   their own tables (REVOKE from the owner is ineffective), the production
--   app user is the table owner, and the repository test harness connects as
--   the embedded server's superuser — so revoked grants would protect
--   nothing on any path this code exercises. A TRIGGER rejects everyone.
--
--   The trigger shape is a BEFORE UPDATE OR DELETE row trigger whose WHEN
--   expression deterministically ERRORS before any mutation happens: the
--   expression casts a non-numeric text (the row value concatenated with the
--   full rejection notice) to int4, so PostgreSQL raises
--   "invalid input syntax for type integer" carrying the notice verbatim and
--   the statement aborts. The EXECUTE FUNCTION clause references the benign
--   catalog builtin pg_catalog.suppress_redundant_updates_trigger() — a
--   trigger must name some trigger-returning function, and this built-in one
--   is the only generic catalog function of that kind; it NEVER runs, because
--   the WHEN expression errors first (it cannot evaluate to true).
--
--   Why not the obvious RAISE EXCEPTION trigger function: the repo's primary
--   migration runner splits each file on every ';' after stripping '--'
--   lines, so any function body containing a statement separator (every
--   plpgsql body needs one) is split into invalid fragments — verified live:
--   a plpgsql body dies with "unterminated dollar-quoted string", and a
--   LANGUAGE sql function cannot even be declared RETURNS trigger
--   ("SQL functions cannot return type trigger"). The WHEN-guard form below
--   is plain DDL: it is expressible under BOTH runners, needs no function
--   body, and rejects UPDATE and DELETE on both ledger tables for every
--   role including the owner and superusers.
--
--   Semantics verified by experiment (scratch PostgreSQL 17 instances):
--   UPDATE or DELETE matching >= 1 row aborts with the notice; UPDATE
--   matching zero rows succeeds (nothing was mutated); INSERT is untouched;
--   TRUNCATE is untouched (the harness reset path keeps working); a
--   cascading delete into a guarded table aborts the same way; and
--   ALTER TABLE ... DISABLE/ENABLE TRIGGER inside a transaction restores
--   mutation — that is the documented forward path for the §14.6 deletion
--   hook (M2.12): the one internal function allowed to delete ledger rows
--   will disable this guard inside its single transaction and re-enable it
--   before commit. Nothing else may do so.
--
-- PER-ENTRY BALANCE RULE (§3.8) — the equation
--   sum(BOX) + sum(AR) - sum(AP) - sum(PRE)
--     = sum(OPEN) + sum(OWN_IN) - sum(OWN_OUT) + sum(REV) - sum(EXP) + sum(UNEXP)
--   aggregates across the rows of an entry, which no per-row CHECK can
--   express and no validation function can be written to under the runner's
--   statement split (a multi-statement function body is inexpressible, as
--   above). Per task M2.1's escape clause, the equation is enforced in M2.2's
--   entry builder (INV-10) with a test proving a bad entry is rejected before
--   it can reach the database. What IS expressible declaratively here is
--   enforced here: delta_minor <> 0, the account enumeration, the EXP-only
--   category rule with the R-10 fixed enum, the REV-only rev_kind rule, the
--   account-scoped ref_id shape, the Q1-Q20 enumeration and the Q20-only
--   reversal column.
--
-- Interpretation decisions (spec text, applied uniformly):
--   * §3 marks NULL-ability explicitly wherever a column may be NULL; every
--     column without an explicit NULL mark is NOT NULL (id, direction, kind,
--     positions, origin_operation_id, ended_on, counted_minor, recorded_minor,
--     performed_on, context, created_at, created_by_account_id, ...).
--   * "All tables carry project_id" (§3 preamble) — every table except the
--     root `project` itself, which IS the scope; each carries an FK to it.
--   * sale.registered_on "default today" and sale.tracked "default: true if
--     planned_delivery_on > today else false" are RULES, not constants
--     (Amman-local dates, R-4; row-dependent), so they stay defaults of the
--     operation layer (M2.4+), which owns the clock — a server-timezone
--     CURRENT_DATE default would be wrong by timezone. quantity_milli's
--     "default 1000" IS a constant and lives here as a column default.
--   * created_at/updated_at on product and sale: created_at NOT NULL like
--     every other table; updated_at nullable (no invented rule — it is set
--     when an edit happens).
--   * reconciliation_box has no id column in §3.10: its natural key is
--     (reconciliation_id, box_id), declared as the composite primary key.
--   * R-9 (max one cash and one account box per project) is the
--     UNIQUE (project_id, kind) constraint; merged rows keep their row
--     (§5 OP-MERGE/SPLIT reactivates the same row), so the constraint is
--     total, not partial.
--   * operation.created_by_account_id is the §14.5 forward-compatible field,
--     TEXT NOT NULL (in v1 it always equals the owner's app account id).

CREATE TABLE IF NOT EXISTS project (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  owner_account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT manage_v2_project_owner_unique UNIQUE (owner_account_id),
  CONSTRAINT manage_v2_project_name_nonempty CHECK (length(btrim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS box (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  opening_status TEXT NOT NULL,
  created_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT manage_v2_box_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_box_kind_check CHECK (kind IN ('cash', 'account')),
  CONSTRAINT manage_v2_box_status_check CHECK (status IN ('active', 'merged')),
  CONSTRAINT manage_v2_box_opening_status_check CHECK (opening_status IN ('known', 'unknown')),
  CONSTRAINT manage_v2_box_project_kind_unique UNIQUE (project_id, kind)
);

CREATE TABLE IF NOT EXISTS product (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  unit_label TEXT,
  unit_price_minor BIGINT NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ,
  CONSTRAINT manage_v2_product_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_product_unit_price_nonneg CHECK (unit_price_minor >= 0)
);

CREATE TABLE IF NOT EXISTS product_component (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  product_id UUID NOT NULL,
  name TEXT NOT NULL,
  cost_minor BIGINT NOT NULL,
  position INT NOT NULL,
  CONSTRAINT manage_v2_product_component_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_product_component_product_fkey FOREIGN KEY (product_id) REFERENCES product (id),
  CONSTRAINT manage_v2_product_component_cost_nonneg CHECK (cost_minor >= 0)
);

CREATE TABLE IF NOT EXISTS sale (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  customer_name TEXT,
  registered_on DATE NOT NULL,
  planned_delivery_on DATE NOT NULL,
  final_price_minor BIGINT,
  cancelled_on DATE,
  tracked BOOLEAN NOT NULL,
  hidden_from_tracker BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ,
  CONSTRAINT manage_v2_sale_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_sale_final_price_positive CHECK (final_price_minor IS NULL OR final_price_minor > 0)
);

CREATE TABLE IF NOT EXISTS operation (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  kind TEXT NOT NULL,
  effective_on DATE NOT NULL,
  status TEXT NOT NULL,
  corrects_operation_id UUID,
  reversed_by_operation_id UUID,
  box_id UUID,
  sale_id UUID,
  balance_line_id UUID,
  counterparty_name TEXT,
  category TEXT,
  amount_minor BIGINT,
  delivery_cost_minor BIGINT,
  payload JSON,
  note TEXT,
  created_by_account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT manage_v2_operation_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_operation_kind_check CHECK (kind IN (
    'OP-SETUP', 'OP-ADD-BOX', 'OP-ADD-PRIOR-BALANCE',
    'OP-SALE-CREATE', 'OP-PREPAYMENT', 'OP-SALE-DELIVERY-COST', 'OP-DELIVER',
    'OP-CANCEL-SALE', 'OP-RETURN', 'OP-PRICE-CORRECTION', 'OP-UNDO-DELIVERY',
    'OP-COLLECT', 'OP-WRITE-OFF', 'OP-PAY', 'OP-EXPENSE',
    'OP-OWNER-DEPOSIT', 'OP-OWNER-WITHDRAWAL', 'OP-TRANSFER',
    'OP-MERGE-BOXES', 'OP-SPLIT-BOXES', 'OP-TRACKER-HIDE', 'OP-TRACKER-ADD',
    'OP-RECONCILE', 'OP-RETURN-AFTER-ABSENCE', 'OP-CORRECT', 'OP-CANCEL-OPERATION')),
  CONSTRAINT manage_v2_operation_status_check CHECK (status IN ('active', 'reversed')),
  CONSTRAINT manage_v2_operation_category_check CHECK (category IS NULL OR category IN (
    'materials_packaging', 'utilities', 'gas', 'rent', 'transport', 'ads',
    'tools', 'equipment', 'other', 'sale_delivery'))
);

CREATE TABLE IF NOT EXISTS sale_line (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  position INT NOT NULL,
  product_id UUID,
  description TEXT NOT NULL,
  quantity_milli INT NOT NULL DEFAULT 1000,
  unit_price_minor BIGINT,
  unit_cost_minor BIGINT,
  components_snapshot JSON,
  CONSTRAINT manage_v2_sale_line_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_sale_line_sale_fkey FOREIGN KEY (sale_id) REFERENCES sale (id),
  CONSTRAINT manage_v2_sale_line_quantity_positive CHECK (quantity_milli > 0)
);

CREATE TABLE IF NOT EXISTS balance_line (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  direction TEXT NOT NULL,
  kind TEXT NOT NULL,
  counterparty_name TEXT,
  origin_on DATE NOT NULL,
  sale_id UUID,
  origin_operation_id UUID NOT NULL,
  CONSTRAINT manage_v2_balance_line_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_balance_line_operation_fkey
    FOREIGN KEY (origin_operation_id) REFERENCES operation (id),
  CONSTRAINT manage_v2_balance_direction_check CHECK (direction IN ('to_me', 'by_me')),
  CONSTRAINT manage_v2_balance_kind_check CHECK (kind IN (
    'sale_remainder', 'prior_receivable', 'loan_given',
    'supplier', 'prior_payable', 'borrowed', 'customer_refund')),
  CONSTRAINT manage_v2_balance_direction_kind_check CHECK (
    (direction = 'to_me' AND kind IN ('sale_remainder', 'prior_receivable', 'loan_given'))
    OR (direction = 'by_me' AND kind IN ('supplier', 'prior_payable', 'borrowed', 'customer_refund'))),
  CONSTRAINT manage_v2_balance_counterparty_check CHECK (
    kind IN ('sale_remainder', 'customer_refund') OR counterparty_name IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS ledger_entry (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  operation_id UUID NOT NULL,
  entry_type TEXT NOT NULL,
  effective_on DATE NOT NULL,
  reverses_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT manage_v2_ledger_entry_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_ledger_entry_operation_fkey FOREIGN KEY (operation_id) REFERENCES operation (id),
  CONSTRAINT manage_v2_entry_type_check CHECK (entry_type IN (
    'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10',
    'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20')),
  CONSTRAINT manage_v2_entry_reversal_q20_check CHECK (
    (entry_type = 'Q20' AND reverses_entry_id IS NOT NULL)
    OR (entry_type <> 'Q20' AND reverses_entry_id IS NULL))
);

CREATE TABLE IF NOT EXISTS ledger_posting (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  entry_id UUID NOT NULL,
  account TEXT NOT NULL,
  ref_id UUID,
  category TEXT,
  rev_kind TEXT,
  delta_minor BIGINT NOT NULL,
  CONSTRAINT manage_v2_ledger_posting_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_ledger_posting_entry_fkey FOREIGN KEY (entry_id) REFERENCES ledger_entry (id),
  CONSTRAINT manage_v2_posting_account_check CHECK (account IN (
    'BOX', 'AR', 'AP', 'PRE', 'REV', 'EXP', 'OPEN', 'OWN_IN', 'OWN_OUT', 'UNEXP')),
  CONSTRAINT manage_v2_posting_delta_nonzero CHECK (delta_minor <> 0),
  CONSTRAINT manage_v2_posting_category_exp_check CHECK (
    (account = 'EXP' AND category IS NOT NULL AND category IN (
      'materials_packaging', 'utilities', 'gas', 'rent', 'transport', 'ads',
      'tools', 'equipment', 'other', 'sale_delivery'))
    OR (account <> 'EXP' AND category IS NULL)),
  CONSTRAINT manage_v2_posting_rev_kind_rev_check CHECK (
    (account = 'REV' AND rev_kind IS NOT NULL AND rev_kind IN (
      'delivery', 'kept_prepayment', 'overpayment', 'return', 'write_off'))
    OR (account <> 'REV' AND rev_kind IS NULL)),
  CONSTRAINT manage_v2_posting_ref_id_check CHECK (
    (account IN ('BOX', 'AR', 'AP', 'PRE') AND ref_id IS NOT NULL)
    OR (account = 'REV')
    OR (account IN ('OPEN', 'OWN_IN', 'OWN_OUT', 'EXP', 'UNEXP') AND ref_id IS NULL))
);

CREATE TABLE IF NOT EXISTS absence_event (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  started_on DATE NOT NULL,
  ended_on DATE NOT NULL,
  complete BOOLEAN,
  CONSTRAINT manage_v2_absence_event_project_fkey FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE TABLE IF NOT EXISTS reconciliation (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  performed_on DATE NOT NULL,
  context TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT manage_v2_reconciliation_project_fkey FOREIGN KEY (project_id) REFERENCES project (id),
  CONSTRAINT manage_v2_reconciliation_context_check CHECK (context IN (
    'routine', 'return_after_absence', 'first_unknown_opening'))
);

CREATE TABLE IF NOT EXISTS reconciliation_box (
  reconciliation_id UUID NOT NULL,
  box_id UUID NOT NULL,
  project_id UUID NOT NULL,
  recorded_minor BIGINT NOT NULL,
  counted_minor BIGINT NOT NULL,
  PRIMARY KEY (reconciliation_id, box_id),
  CONSTRAINT manage_v2_reconciliation_box_reconciliation_fkey
    FOREIGN KEY (reconciliation_id) REFERENCES reconciliation (id),
  CONSTRAINT manage_v2_reconciliation_box_box_fkey FOREIGN KEY (box_id) REFERENCES box (id),
  CONSTRAINT manage_v2_reconciliation_box_project_fkey FOREIGN KEY (project_id) REFERENCES project (id)
);

-- Read-path indexes (§8/§8.2 figure sums, period figures, activity log,
-- sale status derivation inputs, party and oldest-first allocation):
-- sale status itself is DERIVED (§6) — no column to index — so the sale
-- indexes cover its derivation inputs (planned_delivery_on, cancelled_on
-- scans go through project_id + planned_delivery_on).

CREATE INDEX IF NOT EXISTS idx_manage_v2_ledger_entry_project_date ON ledger_entry (project_id, effective_on);
CREATE INDEX IF NOT EXISTS idx_manage_v2_ledger_entry_operation ON ledger_entry (operation_id);
CREATE INDEX IF NOT EXISTS idx_manage_v2_ledger_posting_entry ON ledger_posting (entry_id);
CREATE INDEX IF NOT EXISTS idx_manage_v2_ledger_posting_account ON ledger_posting (project_id, account, ref_id);
CREATE INDEX IF NOT EXISTS idx_manage_v2_operation_project_date ON operation (project_id, effective_on);
CREATE INDEX IF NOT EXISTS idx_manage_v2_sale_project_planned ON sale (project_id, planned_delivery_on);
CREATE INDEX IF NOT EXISTS idx_manage_v2_sale_line_sale ON sale_line (sale_id);
CREATE INDEX IF NOT EXISTS idx_manage_v2_balance_line_party ON balance_line (project_id, counterparty_name);
CREATE INDEX IF NOT EXISTS idx_manage_v2_balance_line_origin ON balance_line (project_id, origin_on);
CREATE INDEX IF NOT EXISTS idx_manage_v2_balance_line_sale ON balance_line (sale_id);
CREATE INDEX IF NOT EXISTS idx_manage_v2_product_project ON product (project_id);
CREATE INDEX IF NOT EXISTS idx_manage_v2_product_component_product ON product_component (product_id);
CREATE INDEX IF NOT EXISTS idx_manage_v2_reconciliation_project ON reconciliation (project_id, performed_on);
CREATE INDEX IF NOT EXISTS idx_manage_v2_reconciliation_box_box ON reconciliation_box (box_id);

-- Append-only guards (see the header above for the full rationale).

CREATE OR REPLACE TRIGGER manage_ledger_entry_append_only
  BEFORE UPDATE OR DELETE ON ledger_entry
  FOR EACH ROW
  WHEN ((OLD.created_at::text || ' — ledger_entry is append-only (Manage §3.8): UPDATE and DELETE are rejected at the database level')::pg_catalog.int4 IS NULL)
  EXECUTE FUNCTION pg_catalog.suppress_redundant_updates_trigger();

CREATE OR REPLACE TRIGGER manage_ledger_posting_append_only
  BEFORE UPDATE OR DELETE ON ledger_posting
  FOR EACH ROW
  WHEN ((OLD.id::text || ' — ledger_posting is append-only (Manage §3.8): UPDATE and DELETE are rejected at the database level')::pg_catalog.int4 IS NULL)
  EXECUTE FUNCTION pg_catalog.suppress_redundant_updates_trigger();
