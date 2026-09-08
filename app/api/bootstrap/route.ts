import {authReady} from '@/lib/auth';
import {api,json,identity,config,settingEnv} from '@/lib/server';
import {database,storageConfigured} from '@/db';
import {DEFAULT_SETTINGS} from '@/lib/domain';
export const dynamic='force-dynamic';
export async function GET(){return api(async()=>{
 const user=await identity();
 const storageReady=storageConfigured();
 const settings=storageReady?await config():DEFAULT_SETTINGS;
 const services=storageReady?(await database().prepare('SELECT * FROM services WHERE active=1 ORDER BY price,name').all()).results:[];
 return json({user,settings,services,storageReady,
 squareReady:!!settingEnv('SQUARE_ACCESS_TOKEN')&&!!settingEnv('SQUARE_LOCATION_ID'),
 adminConfigured:!!settingEnv('ADMIN_EMAILS'),authMode:'supabase',authReady:authReady()});
});}

