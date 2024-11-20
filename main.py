import lucene
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from lucene_rag import LuceneRAG
from routes import router
from utils import wait_for_ollama

# Initialize Java VM for PyLucene
lucene.initVM()

# FastAPI app
app = FastAPI(title="Document RAG API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG system
rag = LuceneRAG()

# Set the rag instance in routes
import routes
routes.rag = rag

# Include routes
app.include_router(router)

@app.on_event("startup")
async def startup_event():
    wait_for_ollama()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3333)
