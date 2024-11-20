import time
import requests

def wait_for_ollama():
    """Wait for Ollama service to be ready"""
    max_retries = 30
    retry_delay = 2

    for i in range(max_retries):
        try:
            response = requests.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                print("Ollama service is ready!")
                return True
        except requests.exceptions.RequestException:
            print(f"Waiting for Ollama service... ({i+1}/{max_retries})")
            time.sleep(retry_delay)
    
    raise Exception("Ollama service not available after maximum retries")
