type Parameters = Array<string | number | null>;
export type QueryResult = {rows: Record<string, unknown>[]; count: number};
export type Executor = (text:string, values:Parameters)=>Promise<QueryResult>;
// SQL comes only from application source. Values always remain separate parameters.
export function postgresQuery(source:string) {
 let parameter=0;
 const sql=source.replace(/'(?:''|[^'])*'|\?|\bend\b/gi,token=>{
  if(token.startsWith("'"))return token;
  return token==='?'?'$'+(++parameter):'"end"';
 });
 return {sql,parameterCount:parameter};
}
export function createDatabase(execute:Executor){
 return {prepare(source:string){
  const {sql,parameterCount}=postgresQuery(source);
  function statement(values:Parameters){
   async function query(){if(values.length!==parameterCount)throw new Error('SQL parameter count mismatch');return execute(sql,values);}
   return {
    bind(...bound:Parameters){return statement(bound);},
    async all(){const result=await query();return {results:result.rows};},
    async first<T=Record<string,unknown>>(){const result=await query();return (result.rows[0]??null) as T|null;},
    async run(){const result=await query();return {meta:{changes:result.count}};}
   };
  }
  return statement([]);
 }};
}

