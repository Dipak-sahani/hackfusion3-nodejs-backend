import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();


const REDIS_URL = process.env.REDIS_URL || 'rediss://default:AV3UAAIncDFlZjFkMTdlNGVmODM0ZTBjOTc0ZDEyMjdhY2QwMTY1ZXAxMjQwMjA@learning-boa-24020.upstash.io:6379';
const redis = new Redis(REDIS_URL, {
    tls: {}
});

redis.on('connect', () => {
    console.log('Redis connected');
});

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

export const addMessage = async (userId, message) => {
    const key = `chat:${userId}`;
    try {
        await redis.rpush(key, JSON.stringify(message));
        await redis.ltrim(key, -10, -1);
    } catch (error) {
        console.error('Error adding message to Redis:', error);
    }
};

export const getRecentMessages = async (userId) => {
    const key = `chat:${userId}`;
    try {
        const messages = await redis.lrange(key, 0, -1);
        return messages.map(msg => JSON.parse(msg));
    } catch (error) {
        console.error('Error fetching messages from Redis:', error);
        return [];
    }
};

export const zadd = async (key, score, value) => {
    try {
        await redis.zadd(key, score, value);
    } catch (error) {
        console.error('Error in Redis ZADD:', error);
    }
};

export const zrangebyscore = async (key, min, max) => {
    try {
        return await redis.zrangebyscore(key, min, max);
    } catch (error) {
        console.error('Error in Redis ZRANGEBYSCORE:', error);
        return [];
    }
};

export const zrem = async (key, value) => {
    try {
        await redis.zrem(key, value);
    } catch (error) {
        console.error('Error in Redis ZREM:', error);
    }
};

export const zrange = async (key, start, stop) => {
    try {
        return await redis.zrange(key, start, stop);
    } catch (error) {
        console.error('Error in Redis ZRANGE:', error);
        return [];
    }
};

export default redis;
