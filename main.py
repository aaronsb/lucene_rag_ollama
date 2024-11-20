import os
import time
import lucene
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from java.nio.file import Paths
from org.apache.lucene.analysis.standard import StandardAnalyzer
from org.apache.lucene.document import Document, Field, TextField, StringField
from org.apache.lucene.index import IndexWriter, IndexWriterConfig, DirectoryReader, Term
from org.apache.lucene.store import FSDirectory
from org.apache.lucene.search import IndexSearcher, BooleanQuery, BooleanClause, TermQuery
from org.apache.lucene.queryparser.classic import QueryParser

from langchain_community.llms import Ollama
from langchain.prompts import PromptTemplate

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

# Pydantic models
class DocumentInput(BaseModel):
    content: str
    id: str
    folder_path: str = ""

class DocumentOutput(BaseModel):
    id: str
    content: str
    folder_path: str = ""  # Set default empty string

class QueryInput(BaseModel):
    question: str

class QueryOutput(BaseModel):
    answer: str
    sources: List[str]

class LuceneRAG:
    def __init__(self, index_dir="index"):  # Changed to use relative path
        self.index_dir = index_dir
        if not os.path.exists(index_dir):
            os.makedirs(index_dir)
        
        # Initialize Lucene components
        self.store = FSDirectory.open(Paths.get(index_dir))
        self.analyzer = StandardAnalyzer()
        
        # Initialize writer with auto-commit
        config = IndexWriterConfig(self.analyzer)
        config.setCommitOnClose(True)
        self.writer = IndexWriter(self.store, config)
        
        # Initialize Ollama with host connection and specified model
        self.llm = Ollama(base_url="http://localhost:11434", model="llama2")
        
        # RAG prompt template
        self.prompt_template = PromptTemplate(
            input_variables=["context", "question", "sources"],
            template="""You are an AI assistant focused on explaining technical concepts in software and AI.

Use the following retrieved context to answer the question. If you cannot answer based on the context, say "I don't have enough information to answer that."

Context: {context}

Question: {question}

Please provide your answer, and I will append the source information: {sources}

Answer: """
        )

    def create_folder(self, folder_path: str):
        """Create a folder marker in the index."""
        try:
            print(f"Creating folder marker for: {folder_path}")
            
            doc = Document()
            doc.add(Field("content", "", TextField.TYPE_STORED))
            doc.add(Field("id", ".folder", StringField.TYPE_STORED))
            doc.add(Field("folder_path", folder_path, StringField.TYPE_STORED))
            
            # Create BooleanQuery for exact matching
            query = BooleanQuery.Builder()
            query.add(TermQuery(Term("id", ".folder")), BooleanClause.Occur.MUST)
            query.add(TermQuery(Term("folder_path", folder_path)), BooleanClause.Occur.MUST)
            
            # Delete any existing folder marker
            self.writer.deleteDocuments(query.build())
            self.writer.addDocument(doc)
            self.writer.commit()
            print(f"Successfully created folder marker for: {folder_path}")
            return True
        except Exception as e:
            print(f"Error creating folder: {str(e)}")
            raise

    def folder_exists(self, folder_path: str) -> bool:
        """Check if a folder exists in the index."""
        try:
            if DirectoryReader.indexExists(self.store):
                reader = DirectoryReader.open(self.store)
                searcher = IndexSearcher(reader)
                
                query = BooleanQuery.Builder()
                query.add(TermQuery(Term("id", ".folder")), BooleanClause.Occur.MUST)
                query.add(TermQuery(Term("folder_path", folder_path)), BooleanClause.Occur.MUST)
                
                hits = searcher.search(query.build(), 1)
                exists = hits.totalHits.value > 0
                reader.close()
                return exists
            return False
        except Exception as e:
            print(f"Error checking folder existence: {str(e)}")
            return False

    def index_document(self, content: str, doc_id: str, folder_path: str = ""):
        """Index a single document."""
        try:
            print(f"Indexing document: {doc_id} in folder: {folder_path}")
            if doc_id != ".folder" and folder_path and not self.folder_exists(folder_path):
                # Create parent folder if it doesn't exist
                print(f"Creating parent folder: {folder_path}")
                self.create_folder(folder_path)

            doc = Document()
            doc.add(Field("content", content, TextField.TYPE_STORED))
            doc.add(Field("id", doc_id, StringField.TYPE_STORED))
            doc.add(Field("folder_path", folder_path or "", StringField.TYPE_STORED))
            
            # Create BooleanQuery for exact matching
            query = BooleanQuery.Builder()
            query.add(TermQuery(Term("id", doc_id)), BooleanClause.Occur.MUST)
            query.add(TermQuery(Term("folder_path", folder_path or "")), BooleanClause.Occur.MUST)
            
            # Delete any existing document with the same ID and folder path
            self.writer.deleteDocuments(query.build())
            self.writer.addDocument(doc)
            self.writer.commit()
            print(f"Successfully indexed document: {doc_id}")
        except Exception as e:
            print(f"Error indexing document: {str(e)}")
            raise

    def delete_document(self, doc_id: str, folder_path: str = "") -> bool:
        """Delete a document by ID and folder path."""
        try:
            # Create BooleanQuery for exact matching
            query = BooleanQuery.Builder()
            query.add(TermQuery(Term("id", doc_id)), BooleanClause.Occur.MUST)
            query.add(TermQuery(Term("folder_path", folder_path or "")), BooleanClause.Occur.MUST)
            
            # Delete the specific document
            self.writer.deleteDocuments(query.build())
            
            # If this is a folder being deleted, also delete all documents in this folder
            if doc_id == ".folder" and DirectoryReader.indexExists(self.store):
                reader = DirectoryReader.open(self.store)
                searcher = IndexSearcher(reader)
                folder_query = TermQuery(Term("folder_path", folder_path))
                hits = searcher.search(folder_query, 1000)
                
                # Collect documents to delete
                docs_to_delete = []
                for hit in hits.scoreDocs:
                    doc = searcher.storedFields().document(hit.doc)
                    docs_to_delete.append((doc.get("id"), doc.get("folder_path")))
                
                reader.close()
                
                # Delete all documents in the folder
                for doc_id, doc_folder in docs_to_delete:
                    query = BooleanQuery.Builder()
                    query.add(TermQuery(Term("id", doc_id)), BooleanClause.Occur.MUST)
                    query.add(TermQuery(Term("folder_path", doc_folder or "")), BooleanClause.Occur.MUST)
                    self.writer.deleteDocuments(query.build())
            
            self.writer.commit()
            return True
        except Exception as e:
            print(f"Error deleting document: {str(e)}")
            raise

    def get_all_documents(self) -> List[DocumentOutput]:
        """Retrieve all documents."""
        try:
            print("Getting all documents")
            if not DirectoryReader.indexExists(self.store):
                print("Index doesn't exist yet, returning empty list")
                return []
                
            reader = DirectoryReader.open(self.store)
            searcher = IndexSearcher(reader)
            
            # Get all documents
            docs = []
            for i in range(reader.maxDoc()):
                doc = searcher.storedFields().document(i)
                doc_output = DocumentOutput(
                    id=doc.get("id"),
                    content=doc.get("content"),
                    folder_path=doc.get("folder_path") or ""  # Ensure empty string if None
                )
                docs.append(doc_output)
                print(f"Found document: {doc_output.id} in folder: {doc_output.folder_path}")
            
            reader.close()
            print(f"Found {len(docs)} documents")
            print("Documents:", [{"id": d.id, "folder_path": d.folder_path} for d in docs])
            return docs
        except Exception as e:
            print(f"Error getting documents: {str(e)}")
            raise

    def search(self, query_str: str, n: int = 3):
        """Search the index and return top N results."""
        try:
            if not DirectoryReader.indexExists(self.store):
                return []
                
            reader = DirectoryReader.open(self.store)
            searcher = IndexSearcher(reader)
            query = QueryParser("content", self.analyzer).parse(query_str)
            hits = searcher.search(query, n)
            
            results = []
            for hit in hits.scoreDocs:
                doc = searcher.storedFields().document(hit.doc)
                folder_path = doc.get("folder_path") or ""  # Ensure empty string if None
                doc_id = doc.get("id")
                
                # Skip .folder markers in search results
                if doc_id == ".folder":
                    continue
                    
                full_path = os.path.join(folder_path, doc_id) if folder_path else doc_id
                results.append({
                    'id': doc_id,
                    'content': doc.get("content"),
                    'folder_path': folder_path,
                    'full_path': full_path,
                    'score': hit.score
                })
            reader.close()
            return results
        except Exception as e:
            print(f"Error searching documents: {str(e)}")
            raise

    def query(self, question: str) -> tuple[str, List[str]]:
        """Perform RAG query using Lucene and Ollama."""
        try:
            results = self.search(question)
            if not results:
                return "No relevant documents found to answer the question.", []
            
            context = "\n".join([r['content'] for r in results])
            sources = [r['full_path'] for r in results]
            sources_text = "\n".join([f"[{i+1}] {source}" for i, source in enumerate(sources)])
            
            prompt = self.prompt_template.format(
                context=context,
                question=question,
                sources=sources_text
            )
            response = self.llm.invoke(prompt)
            return response, sources
        except Exception as e:
            print(f"Error querying documents: {str(e)}")
            raise

    def __del__(self):
        """Cleanup resources."""
        try:
            if hasattr(self, 'writer'):
                self.writer.close()
        except:
            pass

# Initialize RAG system
rag = LuceneRAG()

def wait_for_ollama():
    """Wait for Ollama service to be ready"""
    import requests
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

# FastAPI endpoints
@app.on_event("startup")
async def startup_event():
    wait_for_ollama()

@app.post("/documents", response_model=DocumentOutput)
async def add_document(document: DocumentInput):
    try:
        print(f"Adding document: {document.id} in folder: {document.folder_path}")
        # Special handling for folder creation
        if document.id == ".folder":
            rag.create_folder(document.folder_path)
        else:
            rag.index_document(document.content, document.id, document.folder_path)
        return document
    except Exception as e:
        print(f"Error in add_document endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents", response_model=List[DocumentOutput])
async def list_documents():
    try:
        return rag.get_all_documents()
    except Exception as e:
        print(f"Error in list_documents endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, folder_path: str = ""):
    try:
        if rag.delete_document(doc_id, folder_path):
            return {"message": f"Document {doc_id} deleted successfully"}
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
    except Exception as e:
        print(f"Error in delete_document endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryOutput)
async def query_documents(query: QueryInput):
    try:
        answer, sources = rag.query(query.question)
        return QueryOutput(answer=answer, sources=sources)
    except Exception as e:
        print(f"Error in query_documents endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3333)
