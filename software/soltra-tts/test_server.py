import sys
import logging

try:
    from fastapi.testclient import TestClient
    from server import app
except Exception as e:
    print(f"Import failed: {e}")
    sys.exit(1)

def run_tests():
    print("Initializing TestClient (this will load the model)...")
    try:
        with TestClient(app) as client:
            print("--- Testing /health ---")
            health_resp = client.get("/health")
            print(f"Status Code: {health_resp.status_code}")
            print(f"Response: {health_resp.json()}\n")
            
            print("--- Testing /profiles ---")
            profiles_resp = client.get("/profiles")
            print(f"Status Code: {profiles_resp.status_code}")
            profiles = profiles_resp.json()
            print(f"Found {len(profiles)} profiles.\n")
            
            if profiles:
                profile_id = profiles[0].get("id")
                if profile_id:
                    print(f"--- Testing /generate with profile {profile_id} ---")
                    generate_resp = client.post(
                        "/generate", 
                        data={
                            "text": "Hello, this is a test.", 
                            "profile_id": profile_id, 
                            "language": "en"
                        }
                    )
                    print(f"Status Code: {generate_resp.status_code}")
                    print(f"Content-Type: {generate_resp.headers.get('content-type')}")
                    audio_data = generate_resp.content
                    print(f"Received audio bytes: {len(audio_data)} bytes")
                    if len(audio_data) > 44:
                        print("✅ WAV Header and data received successfully!")
                    else:
                        print("❌ Received audio data is too short.")
                else:
                    print("Could not extract profile_id from profile metadata.")
            else:
                print("No profiles available to test generation.")
    except Exception as e:
        print(f"Test run failed: {e}")

if __name__ == "__main__":
    run_tests()
