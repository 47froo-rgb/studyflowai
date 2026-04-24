import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import json_util

async def get_docs():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.studyflowai
    docs = await db.documents.find().to_list(100)
    print(json_util.dumps(docs, indent=2))

asyncio.run(get_docs())
