import asyncio
import aiosqlite
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import DB_PATH

async def main():
    print(f"DB_PATH: {DB_PATH}")
    print(f"DB exists: {Path(DB_PATH).exists()}")
    
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    
    async with conn.cursor() as cur:
        await cur.execute("SELECT application_no, status, queue, current_handler, created_by, version, sync_status FROM exhibitor_applications ORDER BY id")
        rows = await cur.fetchall()
        print("\n=== exhibitor_applications ===")
        for row in rows:
            print(f"  {dict(row)}")
        
        await cur.execute("SELECT id, username, role, name FROM users ORDER BY id")
        rows = await cur.fetchall()
        print("\n=== users ===")
        for row in rows:
            print(f"  {dict(row)}")
    
    await conn.close()

asyncio.run(main())
