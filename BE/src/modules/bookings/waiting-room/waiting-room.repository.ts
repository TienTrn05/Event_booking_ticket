import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { redisCommand } from '../../../shared/redis/client.js';

// All keys for one session share a Redis cluster hash tag. A single Lua operation
// serializes join, cleanup and admission across all API instances.
const roomScript = `
local t=redis.call('TIME'); local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
local user=ARGV[1]; local mode=ARGV[2]; local cap=tonumber(ARGV[3]); local maxq=tonumber(ARGV[4])
local lease=tonumber(ARGV[5])*1000; local pace=tonumber(ARGV[6]); local market=ARGV[7]
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',now)
local stale=redis.call('ZRANGEBYSCORE',KEYS[3],'-inf',now,'LIMIT',0,200)
for _,u in ipairs(stale) do redis.call('ZREM',KEYS[1],u); redis.call('ZREM',KEYS[3],u) end
if mode=='leave' then
 redis.call('ZREM',KEYS[1],user);redis.call('ZREM',KEYS[2],user);redis.call('ZREM',KEYS[3],user)
 return {'LEFT',0,0,redis.call('ZCARD',KEYS[1]),redis.call('ZCARD',KEYS[2]),now}
end
if market=='SOLD_OUT' or market=='CLOSED' then
 redis.call('DEL',KEYS[1],KEYS[2],KEYS[3],KEYS[4],KEYS[5]);return {market,0,0,0,0,now}
end
local admitted=redis.call('ZSCORE',KEYS[2],user)
if not admitted and mode=='join' and not redis.call('ZSCORE',KEYS[1],user) then
 if redis.call('ZCARD',KEYS[1])>=maxq then return {'FULL',0,0,maxq,redis.call('ZCARD',KEYS[2]),now} end
 local seq=redis.call('INCR',KEYS[4]);redis.call('ZADD',KEYS[1],seq,user)
end
if redis.call('ZSCORE',KEYS[1],user) then redis.call('ZADD',KEYS[3],now+120000,user) end
if market=='OPEN' then
 local second=math.floor(now/1000); local bucket=redis.call('GET',KEYS[5]);local n=0
 if bucket then local p=string.find(bucket,':'); if tonumber(string.sub(bucket,1,p-1))==second then n=tonumber(string.sub(bucket,p+1)) end end
 local slots=math.min(cap-redis.call('ZCARD',KEYS[2]),pace-n,100)
 if slots>0 then
  local head=redis.call('ZRANGE',KEYS[1],0,slots-1)
  for _,u in ipairs(head) do
   local heartbeat=tonumber(redis.call('ZSCORE',KEYS[3],u) or '0')
   redis.call('ZREM',KEYS[1],u);redis.call('ZREM',KEYS[3],u)
   if heartbeat>now then redis.call('ZADD',KEYS[2],now+lease,u);n=n+1 end
  end
  redis.call('SET',KEYS[5],second..':'..n,'PX',2000)
 end
end
for i=1,4 do redis.call('PEXPIRE',KEYS[i],86400000) end
admitted=redis.call('ZSCORE',KEYS[2],user)
if admitted then return {'ADMITTED',0,tonumber(admitted),redis.call('ZCARD',KEYS[1]),redis.call('ZCARD',KEYS[2]),now} end
local rank=redis.call('ZRANK',KEYS[1],user)
if rank then return {market=='PAUSED' and 'PAUSED' or 'WAITING',rank+1,0,redis.call('ZCARD',KEYS[1]),redis.call('ZCARD',KEYS[2]),now} end
return {'NOT_JOINED',0,0,redis.call('ZCARD',KEYS[1]),redis.call('ZCARD',KEYS[2]),now}
`;
export function roomPrefix(sessionId: string) {
  return `${env.REDIS_PREFIX}:room:{${sessionId}}:`;
}
export type MarketState = 'OPEN' | 'PAUSED' | 'SOLD_OUT' | 'CLOSED';
export async function roomOperation(
  sessionId: string,
  userId: string,
  mode: 'join' | 'status' | 'leave',
  market: MarketState,
) {
  const prefix = roomPrefix(sessionId);
  const result = await redisCommand([
    'EVAL',
    roomScript,
    '5',
    prefix + 'waiting',
    prefix + 'active',
    prefix + 'heartbeat',
    prefix + 'sequence',
    prefix + 'pace',
    userId,
    mode,
    String(env.WAITING_ROOM_CAPACITY),
    String(env.WAITING_ROOM_MAX_QUEUE),
    String(env.WAITING_ROOM_LEASE_SECONDS),
    String(env.WAITING_ROOM_ADMIT_PER_SECOND),
    market,
  ]);
  if (!Array.isArray(result) || typeof result[0] !== 'string')
    throw new AppError(503, 'ADMISSION_UNAVAILABLE', 'Phòng chờ tạm thời không khả dụng.');
  if (result[0] === 'FULL')
    throw new AppError(
      429,
      'WAITING_ROOM_FULL',
      'Phòng chờ đạt giới hạn cấu hình; vui lòng thử lại sau.',
    );
  return {
    status: result[0],
    position: Number(result[1]) || null,
    admissionExpiresAt: Number(result[2]) ? new Date(Number(result[2])) : null,
    waiting: Number(result[3]),
    active: Number(result[4]),
    serverTime: new Date(Number(result[5])),
    pollAfterSeconds: 30,
  };
}
export async function requireRoomAdmission(sessionId: string, userId: string) {
  const result = await redisCommand(['ZSCORE', roomPrefix(sessionId) + 'active', userId]);
  const clock = await redisCommand(['TIME']);
  if (
    !Array.isArray(clock) ||
    !result ||
    Number(result) <= Number(clock[0]) * 1000 + Math.floor(Number(clock[1]) / 1000)
  )
    throw new AppError(
      429,
      'WAITING_ROOM_REQUIRED',
      'Hãy vào phòng chờ và đợi lượt trước khi giữ ghế.',
    );
}
