import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);`);
await db.exec(fs.readFileSync(process.argv[2],'utf8'));
const id='11111111-1111-4111-8111-111111111111';
await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)`,[id,'test@example.com',JSON.stringify({requested_role:'admin',full_name:'Test'})]);
const user=(await db.query(`select data from app_private.users where id=$1`,[id])).rows[0].data;
if(user.role!=='seeker')throw Error('Role escalation');
await db.exec('set role authenticated');
let denied=false;
try{await db.query('select * from app_private.users');}catch{denied=true;}
if(!denied)throw Error('Browser access was not denied');
await db.exec('reset role');
const publicBucket=(await db.query(`select public from storage.buckets where id='documents'`)).rows[0].public;
if(publicBucket)throw Error('Bucket must be private');
for(const fixture of JSON.parse(fs.readFileSync(process.argv[3],'utf8'))){
 await db.exec('delete from app_private.jobs');
 for(const doc of fixture.docs)await db.query('insert into app_private.jobs(id,data) values($1,$2)',[doc.id,JSON.stringify(doc)]);
 const rows=(await db.query(`select data from app_private.jobs where ${fixture.sql}`,fixture.params)).rows.map(r=>r.data.id).sort();
 if(JSON.stringify(rows)!==JSON.stringify(fixture.expected.sort()))throw Error(`${fixture.name}: ${JSON.stringify(rows)}`);
}
const tables=(await db.query(`select count(*)::int as n from pg_tables where schemaname='app_private'`)).rows[0].n;
console.log(`Schema verified: ${tables} tables, signup trigger, no self-assigned admin, browser denied, private bucket, query fixtures passed.`);
await db.close();
