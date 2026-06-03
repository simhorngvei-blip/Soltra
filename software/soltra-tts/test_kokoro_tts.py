import os
import io
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_kokoro_tts():
    print("Testing Kokoro engine...")
    response = client.post(
        "/generate",
        data={
            "text": "Hello! I am the Kokoro text to speech engine. This is a test.",
            "profile_id": "af_bella",
            "language": "en"
        }
    )
    
    if response.status_code == 200:
        print("Success!")
        with open("Kokoro_Test_Output.wav", "wb") as f:
            for chunk in response.iter_bytes():
                f.write(chunk)
        print("Saved to Kokoro_Test_Output.wav")
        print("Engine used:", response.headers.get("x-tts-engine"))
    else:
        print(f"Failed: {response.status_code}")
        print(response.json())

if __name__ == "__main__":
    test_kokoro_tts()
