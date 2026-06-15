
import asyncio, asyncpg, httpx, json

DB_CONFIG = {
    "user": "icoastline",
    "password": "icoastline",
    "host": "192.168.2.121",
    "port": 31102,
    "database": "icoastline",
}

DIFY_CONFIG = {
    "base_url": "http://192.168.2.121",
    "api_key": "dataset-FPexjNsYAVV1aQZC9l5XMqtp",
    "dataset_id": "3e5d361a-f33d-495b-947d-92e0e5962b7b",
}

async def main():
    conn = await asyncpg.connect(**DB_CONFIG)
    rows = await conn.fetch(
        "SELECT id, file_name, dify_document_id, status "
        "FROM sourcewriter.uploaded_file "
        "WHERE deleted_at IS NULL AND dify_document_id IS NOT NULL "
        "ORDER BY created_at DESC"
    )
    print(f"Found {len(rows)} files")

    headers = {"Authorization": f"Bearer {DIFY_CONFIG['api_key']}"}
    updated = 0
    for row in rows:
        url = f"{DIFY_CONFIG['base_url']}/v1/datasets/{DIFY_CONFIG['dataset_id']}/documents/{row['dify_document_id']}"
        async with httpx.AsyncClient() as c:
            r = await c.get(url, headers=headers)
            if r.status_code == 200:
                dify_status = r.json().get("indexing_status")
                if dify_status and dify_status != row["status"]:
                    await conn.execute(
                        "UPDATE sourcewriter.uploaded_file SET status = $1 WHERE id = $2",
                        dify_status, row["id"]
                    )
                    print(f"  {row['file_name']}: {row['status']} -> {dify_status}")
                    updated += 1
            else:
                print(f"  {row['file_name']}: Dify error {r.status_code}")

    print(f"\nUpdated {updated}/{len(rows)} files")
    await conn.close()

asyncio.run(main())
