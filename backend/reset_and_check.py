import os
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import DB_PATH

print(f"DB_PATH: {DB_PATH}")
print(f"Before delete - exists: {Path(DB_PATH).exists()}")

if Path(DB_PATH).exists():
    os.remove(DB_PATH)
    print(f"Deleted old DB")

print(f"After delete - exists: {Path(DB_PATH).exists()}")

from app.init_db import main as init_db_main
asyncio.run(init_db_main())

import aiosqlite
async def check():
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    
    async with conn.cursor() as cur:
        await cur.execute("SELECT application_no, status, queue, current_handler, created_by, version, sync_status FROM exhibitor_applications ORDER BY id")
        rows = await cur.fetchall()
        print("\n=== After init - exhibitor_applications ===")
        for row in rows:
            print(f"  {dict(row)}")
    
    await conn.close()

asyncio.run(check())
