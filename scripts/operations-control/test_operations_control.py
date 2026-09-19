from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


VALIDATOR = load_module('operations_control_validate', ROOT / 'scripts/operations-control/validate.py')
GENERATOR = load_module('operations_control_generate', ROOT / 'scripts/operations-control/generate_tracker.py')
ITEM_SCHEMA = json.loads((ROOT / 'docs/operations/control/schemas/item.schema.json').read_text(encoding='utf-8'))


class OperationsControlTests(unittest.TestCase):
    def base_item(self) -> dict:
        return {
            'id': 'TEST-001',
            'title': 'اختبار',
            'type': 'QUALITY',
            'status': 'READY',
            'priority': 'P2',
            'stage': 'test',
            'summary': 'سجل اختبار',
            'finding_classification': 'NEW_FINDING',
            'finding_state': 'UNVERIFIED',
            'classification': 'FIX_BEFORE_PILOT',
            'gate_classification': 'NOT_APPLICABLE',
            'root_cause': '',
            'owner': 'test-owner',
            'tests_required': ['يمر'],
            'layers': ['test'],
            'source': {'report': 'test', 'discovered_at_sha': '1234567', 'evidence': []},
            'acceptance': ['يمر'],
            'areas': ['test'],
            'contracts': [],
            'evidence': [],
            'dependencies': [],
            'related_items': [],
            'owner_decision': '',
            'merge_sha': '',
            'verified_on_main_sha': '',
            'updated_at': '2026-09-19',
            'status_history': [{'status': 'READY', 'changed_at': '2026-09-19', 'actor': 'test', 'reason': 'fixture'}],
            'migration_baseline': True,
            'next_action': 'نفذ الاختبار',
        }

    def test_schema_accepts_current_shape(self):
        self.assertEqual(VALIDATOR.validate_schema(self.base_item(), ITEM_SCHEMA, 'fixture'), [])

    def test_schema_rejects_unknown_property_and_bad_nested_history(self):
        item = self.base_item()
        item['unexpected'] = True
        item['status_history'][0]['status'] = 'NOPE'
        errors = VALIDATOR.validate_schema(item, ITEM_SCHEMA, 'fixture')
        self.assertTrue(any('unknown property unexpected' in error for error in errors))
        self.assertTrue(any('status_history[0].status' in error for error in errors))

    def test_status_transition_is_closed(self):
        errors: list[str] = []
        item = self.base_item()
        item['status_history'] = [
            {'status': 'READY', 'changed_at': '2026-09-19', 'actor': 'test', 'reason': 'fixture'},
            {'status': 'VERIFIED', 'changed_at': '2026-09-19', 'actor': 'test', 'reason': 'illegal fixture'},
        ]
        item['status'] = 'VERIFIED'
        VALIDATOR.validate_history(item, VALIDATOR.ITEM_STATUSES, VALIDATOR.ITEM_TRANSITIONS, 'TEST-001', errors)
        self.assertTrue(any('illegal status transition' in error for error in errors))

    def test_parent_child_claim_overlap_is_detected(self):
        self.assertTrue(VALIDATOR.scopes_overlap('docs/operations', 'docs/operations/control/items'))
        self.assertTrue(VALIDATOR.scopes_overlap('docs\\operations\\control', 'docs/operations'))
        self.assertFalse(VALIDATOR.scopes_overlap('reports', 'src/domain'))

    def test_markdown_cells_escape_structural_characters(self):
        item = self.base_item()
        item['title'] = 'عنوان | سطر\nثانٍ `مهم`'
        rendered = GENERATOR.table([item])
        self.assertIn('عنوان \\| سطر<br>ثانٍ \\`مهم\\`', rendered)

    def test_current_source_digest_is_deterministic(self):
        first = GENERATOR.source_digest()
        second = GENERATOR.source_digest()
        self.assertEqual(first, second)
        self.assertGreater(len(first[0]), 20)
        self.assertIn('docs/operations/control/releases/pre-pilot.json', first[1])

    def test_excel_provenance_is_current(self):
        self.assertEqual(GENERATOR.check_metadata(), [])


if __name__ == '__main__':
    unittest.main()
