import requests
import jwt
from datetime import datetime, timedelta, timezone

def test():
    # create token for admin using backend's EXACT same method
    payload = {
        "sub": "213ed1da-6078-43d9-95e2-228cfba08d44", # Let's get the real user ID
        "email": "admin@studyflow.ai",
        "role": "admin",
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
    }
    import os
    from dotenv import load_dotenv
    load_dotenv('.env')
    secret = os.environ.get("JWT_SECRET")
    
    # We need the user_id from DB
    import pymongo
    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client.studyflow_db
    user = db.users.find_one({"email": "admin@studyflow.ai"})
    if not user:
        print("no user")
        return
    payload["sub"] = user["id"]

    token = jwt.encode(payload, secret, algorithm="HS256")
    
    res = requests.get("http://localhost:8001/api/documents", headers={"Authorization": f"Bearer {token}"})
    print(res.status_code, res.text)

test()
