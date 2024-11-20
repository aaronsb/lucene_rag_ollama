from typing import List
from fastapi import APIRouter, HTTPException
from models import (
    DocumentInput, DocumentOutput, QueryInput, QueryOutput,
    LuceneStats, ModelInfo, SearchConfig, LLMConfig
)

router = APIRouter()

# This will be set in main.py
rag = None

@router.post("/documents", response_model=DocumentOutput)
async def add_document(document: DocumentInput):
    try:
        if document.id == ".folder":
            rag.create_folder(document.folder_path)
        else:
            rag.index_document(document.content, document.id, document.folder_path)
        return document
    except Exception as e:
        print(f"Error in add_document endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents", response_model=List[DocumentOutput])
async def list_documents():
    try:
        return rag.get_all_documents()
    except Exception as e:
        print(f"Error in list_documents endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, folder_path: str = ""):
    try:
        if rag.delete_document(doc_id, folder_path):
            return {"message": f"Document {doc_id} deleted successfully"}
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
    except Exception as e:
        print(f"Error in delete_document endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query", response_model=QueryOutput)
async def query_documents(query: QueryInput):
    try:
        answer, sources = rag.query(query.question)
        return QueryOutput(answer=answer, sources=sources)
    except Exception as e:
        print(f"Error in query_documents endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=LuceneStats)
async def get_stats():
    try:
        return rag.get_stats()
    except Exception as e:
        print(f"Error in get_stats endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/model", response_model=ModelInfo)
async def get_model():
    try:
        return ModelInfo(model=rag.llm.model)
    except Exception as e:
        print(f"Error in get_model endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reindex")
async def reindex():
    try:
        rag.reindex()
        return {"message": "Index rebuilt successfully"}
    except Exception as e:
        print(f"Error in reindex endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search-config")
async def get_search_config():
    try:
        return SearchConfig(num_results=rag.num_results)
    except Exception as e:
        print(f"Error in get_search_config endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search-config")
async def update_search_config(config: SearchConfig):
    try:
        if config.num_results < 1:
            raise HTTPException(status_code=400, detail="Number of results must be at least 1")
        rag.num_results = config.num_results
        return {"message": "Search configuration updated successfully"}
    except Exception as e:
        print(f"Error in update_search_config endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/llm-config")
async def get_llm_config():
    try:
        return rag.get_llm_config()
    except Exception as e:
        print(f"Error in get_llm_config endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/llm-config")
async def update_llm_config(config: LLMConfig):
    try:
        rag.update_llm_config(config)
        return {"message": "LLM configuration updated successfully"}
    except Exception as e:
        print(f"Error in update_llm_config endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
