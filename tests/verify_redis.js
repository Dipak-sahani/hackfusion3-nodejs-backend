import { zadd } from '../src/services/redisService.js';
import redis from '../src/services/redisService.js';

async function testZadd() {
    const key = 'reminders_test';
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
        userId: "test_user_123",
        fcmToken: "test_token_abc",
        medicine: "Test Medicine",
        repeat: 3
    });

    console.log('Testing ZADD to Redis...');
    try {
        await zadd(key, timestamp, payload);
        console.log('ZADD successful.');

        console.log('Checking ZRANGE...');
        const results = await redis.zrange(key, 0, -1, 'WITHSCORES');
        console.log('Results:', results);

        if (results.includes(payload)) {
            console.log('VERIFICATION SUCCESS: Data found in Redis.');
        } else {
            console.log('VERIFICATION FAILED: Data not found in Redis.');
        }

        // Cleanup
        await redis.del(key);
        console.log('Cleanup: Deleted test key.');
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        process.exit(0);
    }
}

testZadd();
