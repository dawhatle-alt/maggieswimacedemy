import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {createDatabase,postgresQuery} from '../db/adapter.ts';
import {centralToUtc,transitionAllowed} from '../lib/domain.ts';
test('Central Time and state rules',()=>{
 assert.equal(centralToUtc('2027-07-10T09:00'),'2027-07-10T14:00:00.000Z');
 assert.equal(centralToUtc('2027-12-10T09:00'),'2027-12-10T15:00:00.000Z');
 assert.throws(()=>centralToUtc('2027-03-14T02:30'));
 assert.throws(()=>centralToUtc('2026-11-01T01:30'));
 assert.equal(transitionAllowed('confirmed','cancelled',true,'UNPAID'),false);
 assert.equal(transitionAllowed('confirmed','cancelled',true,'CANCELED'),true);
});
test('SQL conversion preserves quoted text and separate parameters',()=>{
 assert.deepEqual(postgresQuery("SELECT '?' AS note, s.end FROM slots s WHERE id=?"),{sql:'SELECT \'?\' AS note, s."end" FROM slots s WHERE id=$1',parameterCount:1});
});
test('PostgreSQL schema, application queries and booking invariants',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec(readFileSync('db/postgres.sql','utf8'));
  await pg.exec('SET search_path=maggie,pg_catalog');
  const db=createDatabase(async(sql,values)=>{const r=await pg.query(sql,values);return {rows:r.rows,count:r.affectedRows??r.rows.length};});
  await db.prepare('INSERT INTO services(id,name,description,duration,price,active) VALUES(?,?,?,?,?,?)').bind('lesson','Private lesson','Test',30,4500,1).run();
  const slot='INSERT INTO slots(id,service_id,start,end,blocked_until,location,active) SELECT ?,?,?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM slots WHERE active=1 AND start<? AND blocked_until>?)';
  const start='2027-09-10T14:00:00.000Z',end='2027-09-10T14:30:00.000Z',buffer='2027-09-10T14:45:00.000Z';
  assert.equal((await db.prepare(slot).bind('slot','lesson',start,end,buffer,'both',buffer,start).run()).meta.changes,1);
  assert.equal((await db.prepare(slot).bind('overlap','lesson',end,buffer,'2027-09-10T15:00:00Z','both','2027-09-10T15:00:00Z',end).run()).meta.changes,0);
  await assert.rejects(()=>pg.query("INSERT INTO slots VALUES('direct-overlap','lesson',$1,$2,$3,'both',1)",[end,buffer,'2027-09-10T15:00:00Z']),e=>e.code==='23P01');
  const source=readFileSync('app/api/bookings/route.ts','utf8');
  const insert=source.match(/\x60(INSERT INTO bookings[\s\S]*?)\x60/)[1];
  const values=['booking','family-one','parent@example.test','Test Parent','Swimmer','5551234567','home','Test address','','2026-09-08T12:00:00Z','slot','2026-09-08T12:00:00Z','home'];
  assert.equal((await db.prepare(insert).bind(...values).run()).meta.changes,1);
  await assert.rejects(()=>db.prepare(insert).bind('duplicate',...values.slice(1)).run(),e=>e.code==='23505');
  assert.equal((await db.prepare('SELECT * FROM bookings WHERE user_id=?').bind('family-two').all()).results.length,0);
  await db.prepare('UPDATE services SET price=? WHERE id=?').bind(6000,'lesson').run();
  assert.equal((await db.prepare('SELECT price FROM bookings WHERE id=?').bind('booking').first()).price,4500);
  await assert.rejects(()=>pg.query("UPDATE slots SET active=0 WHERE id='slot'"),e=>e.code==='P0001');
  await db.prepare('UPDATE bookings SET status=? WHERE id=?').bind('cancelled','booking').run();
  await db.prepare(insert).bind('replacement',...values.slice(1)).run();
  const tables=await pg.query("SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='maggie'::regnamespace AND relkind='r'");
  assert.equal(tables.rows.length,4);assert.ok(tables.rows.every(t=>t.relrowsecurity));
  const paths=readdirSync('app/api',{recursive:true}).filter(p=>p.endsWith('.ts')).map(p=>'app/api/'+p).concat('lib/server.ts');
  let count=0;
  for(const path of paths){const src=readFileSync(path,'utf8');for(const m of src.matchAll(/\.prepare\(\s*(['"\x60])([\s\S]*?)\1\s*[,)]/g)){
   const {sql}=postgresQuery(m[2]);await pg.exec('PREPARE check_'+count+' AS '+sql);count++;
  }}
  assert.ok(count>=20);console.log('Validated '+count+' production queries and PostgreSQL integrity rules.');
 }finally{await pg.close();}
});
