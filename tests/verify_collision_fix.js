import { zadd } from '../src/services/redisService.js';
import redis from '../src/services/redisService.js';

async function testCollisionFix() {
    const key = 'reminders_collision_test';
    const timestamp = Math.floor(Date.now() / 1000);
    const userId = "test_user_collision";
    const fcmToken = "test_token_collision";
    const medicine = "Collision Test Medicine";

    // Simulating two different times for the same medicine
    const time1 = "08:00 AM";
    const time2 = "08:00 PM";

    const payload1 = JSON.stringify({
        userId,
        fcmToken,
        medicine,
        time: time1,
        repeat: 1
    });

    const payload2 = JSON.stringify({
        userId,
        fcmToken,
        medicine,
        time: time2,
        repeat: 1
    });

    console.log('Testing Collision Fix (adding two reminders for same medicine)...');
    try {
        await zadd(key, timestamp, payload1);
        await zadd(key, timestamp, payload2);
        console.log('ZADD calls completed.');

        const results = await redis.zrange(key, 0, -1);
        console.log('Redis results count:', results.length);
        console.log('Results:', results);

        if (results.length === 2 && results.includes(payload1) && results.includes(payload2)) {
            console.log('VERIFICATION SUCCESS: Collision fix works. Both reminders stored.');
        } else {
            console.log('VERIFICATION FAILED: Collision still occurring or wrong data count.');
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

testCollisionFix();
