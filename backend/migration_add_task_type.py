"""Migration: add task_type_id column to session table."""
import asyncio
import asyncpg

DSN = "postgresql://icoastline:icoastline@192.168.2.121:31102/icoastline"

async def migrate():
    conn = await asyncpg.connect(dsn=DSN)
    try:
        await conn.execute("""
            ALTER TABLE sourcewriter.session 
            ADD COLUMN IF NOT EXISTS task_type_id UUID 
            REFERENCES sourcewriter.task_type(id)
        """)
        print("OK: task_type_id column added to session table")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        await conn.close()

asyncio.run(migrate())
