import {env} from 'cloudflare:workers';
export function logicDatabase(){const db=(env as unknown as {DB?:D1Database}).DB;if(!db)throw Error('逻辑证据数据库尚未配置');return db;}
