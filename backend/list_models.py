import asyncio
from google import genai
client = genai.Client(api_key="AIzaSyBDeLuAW4NKs26hyVJnpp8d7imDn9NbYvg")
for m in client.models.list():
    print(m.name)
