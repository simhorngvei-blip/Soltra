import sys
from pathlib import Path

try:
    from fastapi.testclient import TestClient
    from server import app
except Exception as e:
    print(f"Import failed: {e}")
    sys.exit(1)

def test_tts():
    print("Initializing server to generate speech...")
    profile_id = "f1373bc2-1eb1-4d30-a67c-7249bc88b35e"
    text = "Hello! I am Ada. This is a quick test of my cloned voice, running directly from the optimized Soltra server."
    
    try:
        with TestClient(app) as client:
            print(f"Hitting /generate endpoint with Ada's profile...")
            data = {"text": text, "profile_id": profile_id, "language": "en"}
            response = client.post("/generate", data=data)
            
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                output_path = Path(r"d:\Soltra\Ada_Test_Output.wav")
                output_path.write_bytes(response.content)
                print(f"✅ Audio successfully generated and saved to {output_path}!")
            else:
                print(f"❌ Failed. Output: {response.text}")
    except Exception as e:
        print(f"Exception occurred: {e}")

if __name__ == "__main__":
    test_tts()
