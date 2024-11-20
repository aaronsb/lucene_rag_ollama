from typing import List
from pydantic import BaseModel

class DocumentInput(BaseModel):
    content: str
    id: str
    folder_path: str = ""

class DocumentOutput(BaseModel):
    id: str
    content: str
    folder_path: str = ""

class QueryInput(BaseModel):
    question: str

class SourceWithScore(BaseModel):
    path: str
    score: float

class QueryOutput(BaseModel):
    answer: str
    sources: List[SourceWithScore]

class LuceneStats(BaseModel):
    num_docs: int
    index_size: str

class ModelInfo(BaseModel):
    model: str

class SearchConfig(BaseModel):
    num_results: int

class LLMConfig(BaseModel):
    temperature: float
    num_ctx: int
    repeat_penalty: float
