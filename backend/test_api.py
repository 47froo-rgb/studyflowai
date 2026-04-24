import requests
import jwt
from datetime import datetime, timedelta

def test():
    # create token for admin
    token = jwt.encode({
        "sub": "admin@studyflow.ai",
        "exp": datetime.utcnow() + timedelta(hours=1)
    }, "a3f8c2d1e4b5f6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1", algorithm="HS256")
    
    res = requests.get("http://localhost:8001/api/documents", headers={"Authorization": f"Bearer {token}"})
    print(res.status_code, res.text)

test()
