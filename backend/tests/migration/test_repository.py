import ast
from pathlib import Path
import pytest
from postgres_store import COLLECTIONS, Collection, compile_query, apply_update, project


def test_all_runtime_collections_supported():
    used = set()
    root = Path(__file__).resolve().parents[2]
    for p in [root/'server.py', root/'shared.py', *list((root/'routes').glob('*.py')), root/'onboarding_logic.py', root/'training_service.py', root/'audit_log.py']:
        for n in ast.walk(ast.parse(p.read_text())):
            if isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name) and n.value.id == 'db':
                used.add(n.attr)
    assert used - {"list_collection_names"} <= COLLECTIONS


def test_query_parameters_never_interpolated():
    attack = "'; drop table users; --"
    sql, values = compile_query({'email': attack})
    assert attack not in sql
    assert values[0].obj == attack


@pytest.mark.parametrize('query', [{'$where': 'dangerous'}, {'field': {'$unknown': True}}, {"x');drop table t;--": 'a'}])
def test_unknown_query_rejected(query):
    with pytest.raises(ValueError):
        compile_query(query)


def test_unknown_table_rejected():
    with pytest.raises(ValueError):
        Collection('users;drop table users')


def test_nested_update_and_no_input_mutation():
    before = {'usage': {'hires': 1}, 'items': []}
    after = apply_update(before, {'$inc': {'usage.hires': 1}, '$push': {'items': {'name': 'task'}}, '$set': {'profile.city': 'Nashville'}})
    assert after == {'usage': {'hires': 2}, 'items': [{'name': 'task'}], 'profile': {'city': 'Nashville'}}
    assert before == {'usage': {'hires': 1}, 'items': []}


def test_sensitive_field_projection():
    doc = {'id': 'one', 'password': 'secret', '_id': 'legacy', 'email': 'a@example.com'}
    assert project(doc, {'password': 0, '_id': 0}) == {'id': 'one', 'email': 'a@example.com'}
    assert project(doc, {'_id': 0, 'id': 1}) == {'id': 'one'}


def test_query_null_and_empty_set():
    assert 'IS NULL' in compile_query({'status': None})[0]
    assert 'FALSE' in compile_query({'id': {'$in': []}})[0]
    assert 'NOT COALESCE' in compile_query({'id': {'$nin': []}})[0]
