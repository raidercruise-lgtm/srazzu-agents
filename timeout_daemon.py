import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
import redis.asyncio as aioredis

# Setup logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [TimeoutDaemon] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("WorkerTimeoutDaemon")

# Configuration from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Redis Keys (matching scheduler.py registry layout)
REGISTRY_SET_KEY = "active_workers"          # Set containing node_ids
HEARTBEAT_HASH_KEY = "worker_heartbeats"      # Hash mapping node_id -> timestamp ISO string
WORKER_METRICS_KEY = "worker_metrics"         # Hash mapping node_id -> JSON string metrics

# Operational Parameters
CHECK_INTERVAL = float(os.getenv("CHECK_INTERVAL_SECONDS", 5.0))
TIMEOUT_THRESHOLD = float(os.getenv("WORKER_TIMEOUT_SECONDS", 15.0))


async def monitor_heartbeats():
    redis_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
    logger.info(f"Connecting to Redis at {redis_url}...")
    
    redis_client = aioredis.from_url(redis_url, decode_responses=True)
    
    try:
        await redis_client.ping()
        logger.info(f"Connected to Redis. Monitoring active workers every {CHECK_INTERVAL}s (Timeout threshold: {TIMEOUT_THRESHOLD}s)")
        
        while True:
            try:
                # 1. Fetch all registered workers
                workers = await redis_client.smembers(REGISTRY_SET_KEY)
                
                if workers:
                    now = datetime.now(timezone.utc)
                    # 2. Batch fetch heartbeats
                    heartbeats = await redis_client.hmget(HEARTBEAT_HASH_KEY, list(workers))
                    
                    stale_workers = []
                    
                    for node_id, hb_raw in zip(workers, heartbeats):
                        if not hb_raw:
                            # Worker registered but no heartbeat recorded
                            stale_workers.append((node_id, "NO_HEARTBEAT"))
                            continue
                            
                        try:
                            hb_time = datetime.fromisoformat(hb_raw)
                            if hb_time.tzinfo is None:
                                hb_time = hb_time.replace(tzinfo=timezone.utc)
                                
                            elapsed = (now - hb_time).total_seconds()
                            
                            if elapsed > TIMEOUT_THRESHOLD:
                                stale_workers.append((node_id, f"EXPIRED ({elapsed:.1f}s ago)"))
                        except ValueError:
                            stale_workers.append((node_id, "INVALID_TIMESTAMP"))
                    
                    # 3. Purge stale workers from Redis
                    for node_id, reason in stale_workers:
                        logger.warning(f"Purging unresponsive worker '{node_id}' [Reason: {reason}]")
                        
                        # Atomic cleanup across registry set, heartbeat hash, and metrics
                        async with redis_client.pipeline(transaction=True) as pipe:
                            pipe.srem(REGISTRY_SET_KEY, node_id)
                            pipe.hdel(HEARTBEAT_HASH_KEY, node_id)
                            pipe.hdel(WORKER_METRICS_KEY, node_id)
                            await pipe.execute()
                            
                        logger.info(f"Successfully evicted worker node '{node_id}' from pool.")
                        
            except Exception as e:
                logger.error(f"Error during worker sweep iteration: {e}")
                
            await asyncio.sleep(CHECK_INTERVAL)
            
    except asyncio.CancelledError:
        logger.info("Shutdown signal received. Exiting timeout daemon cleanly.")
    except Exception as e:
        logger.critical(f"Fatal daemon failure: {e}")
    finally:
        await redis_client.close()


if __name__ == "__main__":
    try:
        asyncio.run(monitor_heartbeats())
    except KeyboardInterrupt:
        logger.info("Daemon stopped manually.")