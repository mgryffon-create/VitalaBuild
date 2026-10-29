"""Postgres repository preserving existing API document shapes during migration.

Tables live in the unexposed app_private schema. Only the backend database role
can access them; browser clients must use authenticated API routes. JSONB keeps
nested profile/offer structures intact while SQL handles filtering and locking.
"""
import copy
import json
import os
import re
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace

import psycopg
from psycopg.types.json import Jsonb

# Explicit allowlist: never interpolate a client-provided table or column name.
COLLECTIONS = frozenset('''assignment_feedback audit_logs business_email_verifications
compliance_baselines compliance_requirements documents employer_billing
employer_browse_actions employer_integrations employment_documents employment_offers
employment_reviews employments external_systems facility_metrics facility_responses
feed_comments feed_likes feed_posts hiring_documents interview_requests job_documents
jobs license_verifications matches messages notification_logs notification_preferences
offers onboarding_cases onboarding_checklists onboarding_requirements onboarding_tasks
payment_transactions pipeline_stages policy_documents policy_signatures portable_references
poster_profiles push_subscriptions references reply_time_stats requirement_document_matches
resume_parses seeker_licenses seeker_profiles swipes training_assignments training_courses
users vault_documents webhook_events'''.split())


def field_path(field):
    parts = field.split('.')
    if not all(re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', p) for p in parts):
        raise ValueError('Invalid field path')
    # Validated identifiers contain no quotes, braces, commas, or SQL operators.
    return "'{" + ','.join(parts) + "}'"


def compile_query(query):
    """Compile the query operators actually used by the legacy application.

    Values always remain parameters. Unsupported operators fail closed.
    Equality supports Mongo's scalar-to-array containment behavior.
    """
    clauses, params = [], []
    for key, value in (query or {}).items():
        if key in ('$or', '$and'):
            pieces = []
            for item in value:
                expr, vals = compile_query(item)
                pieces.append('(' + expr + ')')
                params.extend(vals)
            clauses.append((' OR ' if key == '$or' else ' AND ').join(pieces) or ('FALSE' if key == '$or' else 'TRUE'))
            continue
        path = field_path(key)
        expr = f'data #> {path}'
        text = f'data #>> {path}'
        operators = value if isinstance(value, dict) and any(k.startswith('$') for k in value) else {'$eq': value}
        for operator, operand in operators.items():
            if operator == '$options':
                continue
            if operator in ('$eq', '$ne'):
                if operand is None:
                    cond = f'({expr} IS NULL OR {expr} = \'null\'::jsonb)'
                else:
                    cond = f'({expr} = %s::jsonb OR (jsonb_typeof({expr}) = \'array\' AND {expr} @> %s::jsonb))'
                    params.extend([Jsonb(operand), Jsonb([operand])])
                if operator == '$ne':
                    cond = f'NOT COALESCE(({cond}), FALSE)'
                clauses.append(cond)
            elif operator in ('$in', '$nin'):
                expr2, vals = compile_query({'$or': [{key: v} for v in operand]})
                params.extend(vals)
                clauses.append(('NOT COALESCE((' + expr2 + '), FALSE)') if operator == '$nin' else '(' + expr2 + ')')
            elif operator == '$exists':
                clauses.append(f'{expr} IS ' + ('NOT NULL' if operand else 'NULL'))
            elif operator == '$regex':
                flags = '~*' if 'i' in operators.get('$options', '') else '~'
                clauses.append(f'{text} {flags} %s')
                params.append(operand)
            elif operator in ('$gt', '$gte', '$lt', '$lte'):
                sqlop = {'$gt': '>', '$gte': '>=', '$lt': '<', '$lte': '<='}[operator]
                clauses.append(f'{expr} {sqlop} %s::jsonb')
                params.append(Jsonb(operand))
            else:
                raise ValueError(f'Unsupported query operator {operator}')
    return ' AND '.join('(' + c + ')' for c in clauses) or 'TRUE', params


def project(document, projection):
    doc = copy.deepcopy(document)
    doc.pop('_id', None)
    if not projection:
        return doc
    included = [k for k, v in projection.items() if v and k != '_id']
    if included:
        return {k: doc[k] for k in included if k in doc}
    for key, value in projection.items():
        if not value:
            doc.pop(key, None)
    return doc


def apply_update(document, update):
    doc = copy.deepcopy(document)
    for op, fields in update.items():
        if op not in ('$set', '$inc', '$push', '$unset', '$setOnInsert'):
            raise ValueError(f'Unsupported update operator {op}')
        if op == '$setOnInsert':
            continue
        for field, value in fields.items():
            parts = field.split('.')
            field_path(field)
            target = doc
            for part in parts[:-1]:
                target = target.setdefault(part, {})
            leaf = parts[-1]
            if op == '$set':
                target[leaf] = value
            elif op == '$inc':
                target[leaf] = target.get(leaf, 0) + value
            elif op == '$push':
                target.setdefault(leaf, []).append(value)
            elif op == '$unset':
                target.pop(leaf, None)
    return doc


@asynccontextmanager
async def connection():
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise RuntimeError('DATABASE_URL is not configured')
    # Supavisor transaction mode must not use prepared statements.
    conn = await psycopg.AsyncConnection.connect(url, prepare_threshold=None, connect_timeout=10)
    try:
        async with conn.transaction():
            await conn.execute("SET LOCAL statement_timeout = '15s'")
            yield conn
    finally:
        await conn.close()


class Cursor:
    def __init__(self, collection, query, projection):
        self.collection, self.query, self.projection = collection, query, projection
        self.order, self.offset, self.maximum = [], 0, None

    def sort(self, key, direction=1):
        self.order = key if isinstance(key, list) else [(key, direction)]
        return self

    def skip(self, count):
        self.offset = max(0, int(count))
        return self

    def limit(self, count):
        self.maximum = max(0, int(count))
        return self

    async def to_list(self, length=None):
        maximum = min(int(length or 10000), self.maximum if self.maximum is not None else 10000)
        where, params = compile_query(self.query)
        order = ', '.join(f'data #> {field_path(key)} ' + ('DESC NULLS LAST' if direction == -1 else 'ASC NULLS FIRST') for key, direction in self.order)
        sql = f'SELECT data FROM {self.collection.table} WHERE {where}'
        if order:
            sql += ' ORDER BY ' + order
        sql += ' LIMIT %s OFFSET %s'
        params += [maximum, self.offset]
        async with connection() as conn:
            cursor = await conn.execute(sql, params)
            return [project(row[0], self.projection) for row in await cursor.fetchall()]


class Collection:
    def __init__(self, name):
        if name not in COLLECTIONS:
            raise ValueError(f'Unknown collection {name}')
        self.name = name
        self.table = f'app_private."{name}"'

    def find(self, query=None, projection=None):
        return Cursor(self, query or {}, projection)

    async def find_one(self, query=None, projection=None):
        rows = await self.find(query, projection).to_list(1)
        return rows[0] if rows else None

    async def count_documents(self, query):
        where, params = compile_query(query)
        async with connection() as conn:
            cur = await conn.execute(f'SELECT count(*) FROM {self.table} WHERE {where}', params)
            return (await cur.fetchone())[0]

    async def insert_one(self, document):
        result = await self.insert_many([document])
        return SimpleNamespace(inserted_id=result.inserted_ids[0])

    async def insert_many(self, documents):
        ids = []
        async with connection() as conn:
            for document in documents:
                doc = copy.deepcopy(document)
                doc.pop('_id', None)
                row_id = doc.get('id') or str(uuid.uuid4())
                await conn.execute(f'INSERT INTO {self.table} (id, data) VALUES (%s, %s)', (row_id, Jsonb(doc)))
                ids.append(row_id)
        return SimpleNamespace(inserted_ids=ids)

    async def _update(self, query, update, upsert, many):
        where, params = compile_query(query)
        matched, changed, upserted = 0, 0, None
        async with connection() as conn:
            # Serialize read-modify-write/upsert for this collection. Transactions
            # release the lock even when a writer fails; no process-local locks.
            await conn.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))', (self.name,))
            cur = await conn.execute(f'SELECT id, data FROM {self.table} WHERE {where}' + ('' if many else ' LIMIT 1') + ' FOR UPDATE', params)
            rows = await cur.fetchall()
            matched = len(rows)
            for row_id, doc in rows:
                updated = apply_update(doc, update)
                if updated != doc:
                    await conn.execute(f'UPDATE {self.table} SET data = %s WHERE id = %s', (Jsonb(updated), row_id))
                    changed += 1
            if not rows and upsert:
                doc = {k: v for k, v in query.items() if not k.startswith('$') and not isinstance(v, dict)}
                doc.update(update.get('$setOnInsert', {}))
                doc = apply_update(doc, update)
                upserted = doc.get('id') or str(uuid.uuid4())
                await conn.execute(f'INSERT INTO {self.table} (id, data) VALUES (%s, %s)', (upserted, Jsonb(doc)))
        return SimpleNamespace(matched_count=matched, modified_count=changed, upserted_id=upserted)

    async def update_one(self, query, update, upsert=False):
        return await self._update(query, update, upsert, False)

    async def update_many(self, query, update, upsert=False):
        return await self._update(query, update, upsert, True)

    async def _delete(self, query, many):
        where, params = compile_query(query)
        async with connection() as conn:
            sql = f'DELETE FROM {self.table} WHERE {where}' if many else f'DELETE FROM {self.table} WHERE id IN (SELECT id FROM {self.table} WHERE {where} LIMIT 1)'
            cur = await conn.execute(sql, params)
            return SimpleNamespace(deleted_count=cur.rowcount)

    async def delete_one(self, query):
        return await self._delete(query, False)

    async def delete_many(self, query):
        return await self._delete(query, True)


class Database:
    async def list_collection_names(self):
        async with connection() as conn:
            cursor = await conn.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'app_private'")
            return sorted(row[0] for row in await cursor.fetchall())

    def __getattr__(self, name):
        return Collection(name)

    def __getitem__(self, name):
        return Collection(name)


db = Database()
