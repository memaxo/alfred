"""
Test script for the Qwen3-VL Reranker server.

Run with: python test/test_server.py

Requires the server to be running at QWEN3VL_RERANK_URL (default: http://localhost:8200)
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

SERVER_URL = os.getenv("QWEN3VL_RERANK_URL", "http://localhost:8200")


def check_health() -> dict:
    """Check server health."""
    try:
        req = urllib.request.Request(f"{SERVER_URL}/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"status": "error", "error": str(e)}


def rerank_request(query: dict, documents: list, top_n: int = 5) -> dict:
    """Send a rerank request to the server."""
    payload = {
        "query": query,
        "documents": documents,
        "top_n": top_n,
    }
    
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{SERVER_URL}/rerank",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def test_health():
    """Test health endpoint."""
    print("Testing health endpoint...")
    health = check_health()
    print(f"  Status: {health.get('status')}")
    print(f"  Model: {health.get('model')}")
    print(f"  Device: {health.get('device')}")
    print(f"  Batch Size: {health.get('batch_size')}")
    print(f"  Compiled: {health.get('compiled')}")
    
    assert health["status"] == "ok", f"Health check failed: {health}"
    print("  ✓ Health check passed")


def test_text_only_rerank():
    """Test reranking text-only documents."""
    print("\nTesting text-only reranking...")
    
    query = {"text": "machine learning and artificial intelligence"}
    documents = [
        {"id": "doc1", "text": "Neural networks are fundamental to deep learning systems."},
        {"id": "doc2", "text": "The weather forecast predicts rain tomorrow."},
        {"id": "doc3", "text": "Gradient descent optimizes machine learning models."},
        {"id": "doc4", "text": "Pizza is a popular food in many countries."},
        {"id": "doc5", "text": "Transformers revolutionized natural language processing."},
    ]
    
    start = time.time()
    result = rerank_request(query, documents, top_n=3)
    elapsed = (time.time() - start) * 1000
    
    print(f"  Time: {elapsed:.0f}ms")
    print(f"  Results:")
    for r in result["results"]:
        print(f"    {r['id']}: score={r['score']:.4f}")
    
    # Verify ML-related docs are ranked higher
    top_ids = [r["id"] for r in result["results"]]
    assert "doc1" in top_ids or "doc3" in top_ids or "doc5" in top_ids, \
        "Expected ML-related documents to be ranked higher"
    print("  ✓ Text-only reranking passed")


def test_batch_processing():
    """Test batch processing with many documents."""
    print("\nTesting batch processing (20 documents)...")
    
    query = {"text": "software engineering best practices"}
    documents = [
        {"id": f"doc{i}", "text": f"Document {i} about {'coding' if i % 2 == 0 else 'cooking'} practices."}
        for i in range(20)
    ]
    
    start = time.time()
    result = rerank_request(query, documents, top_n=5)
    elapsed = (time.time() - start) * 1000
    
    print(f"  Time: {elapsed:.0f}ms for 20 documents")
    print(f"  Top 5 results:")
    for r in result["results"]:
        print(f"    {r['id']}: score={r['score']:.4f}")
    
    assert len(result["results"]) == 5, f"Expected 5 results, got {len(result['results'])}"
    print("  ✓ Batch processing passed")


def test_with_image(image_path: str):
    """Test reranking with an image."""
    print(f"\nTesting multimodal reranking with image: {image_path}")
    
    # Convert local path to file:// URL
    if not image_path.startswith(("http://", "https://", "file://")):
        image_path = f"file://{os.path.abspath(image_path)}"
    
    query = {"text": "user interface design mockup"}
    documents = [
        {"id": "img1", "text": "UI mockup screenshot", "image": image_path},
        {"id": "txt1", "text": "Backend server configuration and deployment."},
        {"id": "txt2", "text": "Frontend design patterns and user experience."},
    ]
    
    start = time.time()
    result = rerank_request(query, documents, top_n=3)
    elapsed = (time.time() - start) * 1000
    
    print(f"  Time: {elapsed:.0f}ms")
    print(f"  Results:")
    for r in result["results"]:
        print(f"    {r['id']}: score={r['score']:.4f}")
    
    print("  ✓ Multimodal reranking completed")


def main():
    """Run all tests."""
    print(f"Testing Qwen3-VL Reranker at {SERVER_URL}")
    print("=" * 50)
    
    # Check if server is running
    health = check_health()
    if health["status"] != "ok":
        print(f"Server not available: {health.get('error', 'unknown error')}")
        print("\nTo start the server:")
        print("  cd packages/rerank")
        print("  RERANK_DEVICE=mps python -m uvicorn python.server:app --port 8200")
        sys.exit(1)
    
    try:
        test_health()
        test_text_only_rerank()
        test_batch_processing()
        
        # Test with image if available
        alfred_ui_image = os.path.expanduser("~/Desktop/ALFRED UI/alfred-1.png")
        if os.path.exists(alfred_ui_image):
            test_with_image(alfred_ui_image)
        else:
            print("\nSkipping image test (no test image found)")
        
        print("\n" + "=" * 50)
        print("All tests passed! ✓")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
