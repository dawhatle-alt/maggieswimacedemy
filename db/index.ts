import postgres from 'postgres';
import { createDatabase } from './adapter';
let client: ReturnType<typeof postgres> | undefined;
export function storageConfigured(){return !!process.env.DATABASE_URL;}
export function database() {
 const url=process.env.DATABASE_URL;
 if(!url)throw Object.assign(new Error('Booking storage is not configured yet.'),{status:503});
 client??=postgres(url,{prepare:false,max:3,idle_timeout:20,connect_timeout:10,
  ssl:process.env.DATABASE_SSL_CA?{rejectUnauthorized:true,ca:process.env.DATABASE_SSL_CA}:true});
 const sql=client;
 return createDatabase(async(text,values)=>{
  // Scope every query to the private app schema, including through a transaction pooler.
  return sql.begin(async tx=>{
   await tx.unsafe('SET LOCAL search_path = maggie, pg_catalog');
   const rows=await tx.unsafe(text,values);
   return {rows:Array.from(rows),count:rows.count};
  });
 });
}

