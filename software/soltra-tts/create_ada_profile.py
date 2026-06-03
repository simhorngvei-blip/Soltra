import sys
from pathlib import Path

try:
    from fastapi.testclient import TestClient
    from server import app
except Exception as e:
    print(f"Import failed: {e}")
    sys.exit(1)

def create_profile():
    print("Initializing server to clone Ada's voice profile...")
    wav_path = Path(r"d:\Soltra\Ada.wav")
    
    if not wav_path.exists():
        print(f"Wav file not found at {wav_path}")
        return

    try:
        with TestClient(app) as client:
            with open(wav_path, "rb") as f:
                files = {"audio": ("Ada.wav", f, "audio/wav")}
                data = {"name": "Ada", "reference_text": ""}
                
                print("Hitting /clone endpoint...")
                response = client.post("/clone", data=data, files=files)
                
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                print("✅ Profile successfully created!")
                print(f"Response: {response.json()}")
            else:
                print(f"❌ Failed. Output: {response.text}")
    except Exception as e:
        print(f"Exception occurred: {e}")

if __name__ == "__main__":
    create_profile()
