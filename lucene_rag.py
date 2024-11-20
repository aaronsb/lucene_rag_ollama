import os
import re
import shutil
from typing import List, Optional, Tuple
import lucene
from java.nio.file import Paths
from org.apache.lucene.analysis.standard import StandardAnalyzer
from org.apache.lucene.document import Document, Field, TextField, StringField
from org.apache.lucene.index import IndexWriter, IndexWriterConfig, DirectoryReader, Term
from org.apache.lucene.store import FSDirectory
from org.apache.lucene.search import IndexSearcher, BooleanQuery, BooleanClause, TermQuery
from org.apache.lucene.queryparser.classic import QueryParser
from org.apache.lucene.search.similarities import BM25Similarity
from langchain.prompts import PromptTemplate
from langchain_community.llms import Ollama

from models import DocumentOutput, SourceWithScore, LuceneStats, LLMConfig

class LuceneRAG:
    def __init__(self, index_dir="index"):
        self.index_dir = index_dir
        self.num_results = 3  # Default number of results
        if not os.path.exists(index_dir):
            os.makedirs(index_dir)
        
        # Initialize Lucene components
        self.store = FSDirectory.open(Paths.get(index_dir))
        self.analyzer = StandardAnalyzer()
        
        # Initialize writer with auto-commit and BM25 similarity
        config = IndexWriterConfig(self.analyzer)
        config.setSimilarity(BM25Similarity())
        config.setCommitOnClose(True)
        self.writer = IndexWriter(self.store, config)
        
        # Initialize Ollama with optimized parameters
        self.llm = Ollama(
            base_url="http://localhost:11434",
            model="llama3.2-vision",
            temperature=0.1,
            num_ctx=128000,  # Increased context window to 128k
            repeat_penalty=1.1
        )
        
        # RAG prompt template
        self.prompt_template = PromptTemplate(
            input_variables=["context", "question"],
            template="""You are a helpful AI assistant. Your task is to provide a clear and complete answer to the question using only the information from the context below.

Context:
{context}

Question: {question}

Instructions:
1. Use ONLY the information provided in the context
2. Include ALL relevant information from the context, especially lists and bullet points
3. Maintain the structure and organization of lists from the context
4. Do not summarize or abbreviate lists
5. Do not add any information beyond what's in the context
6. Start your response directly with the answer

Answer:"""
        )

    def create_folder(self, folder_path: str):
        """Create a folder marker in the index."""
        try:
            print(f"Creating folder marker for: {folder_path}")
            doc = Document()
            doc.add(Field("content", "", TextField.TYPE_STORED))
            doc.add(Field("id", ".folder", StringField.TYPE_STORED))
            doc.add(Field("folder_path", folder_path, StringField.TYPE_STORED))
            
            query = BooleanQuery.Builder()
            query.add(TermQuery(Term("id", ".folder")), BooleanClause.Occur.MUST)
            query.add(TermQuery(Term("folder_path", folder_path)), BooleanClause.Occur.MUST)
            
            self.writer.deleteDocuments(query.build())
            self.writer.addDocument(doc)
            self.writer.commit()
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
                total_hits = hits.totalHits.value
                reader.close()
                return total_hits > 0
            return False
        except Exception as e:
            print(f"Error checking folder existence: {str(e)}")
            return False

    def index_document(self, content: str, doc_id: str, folder_path: str = ""):
        """Index a single document."""
        try:
            print(f"Indexing document: {doc_id} in folder: {folder_path}")
            if doc_id != ".folder" and folder_path and not self.folder_exists(folder_path):
                print(f"Creating parent folder: {folder_path}")
                self.create_folder(folder_path)

            doc = Document()
            doc.add(Field("content", content, TextField.TYPE_STORED))
            doc.add(Field("id", doc_id, StringField.TYPE_STORED))
            doc.add(Field("folder_path", folder_path or "", StringField.TYPE_STORED))
            
            query = BooleanQuery.Builder()
            query.add(TermQuery(Term("id", doc_id)), BooleanClause.Occur.MUST)
            query.add(TermQuery(Term("folder_path", folder_path or "")), BooleanClause.Occur.MUST)
            
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
            query = BooleanQuery.Builder()
            query.add(TermQuery(Term("id", doc_id)), BooleanClause.Occur.MUST)
            query.add(TermQuery(Term("folder_path", folder_path or "")), BooleanClause.Occur.MUST)
            
            self.writer.deleteDocuments(query.build())
            
            if doc_id == ".folder" and DirectoryReader.indexExists(self.store):
                reader = DirectoryReader.open(self.store)
                searcher = IndexSearcher(reader)
                folder_query = TermQuery(Term("folder_path", folder_path))
                hits = searcher.search(folder_query, 1000)
                
                docs_to_delete = []
                for hit in hits.scoreDocs:
                    doc = searcher.storedFields().document(hit.doc)
                    docs_to_delete.append((doc.get("id"), doc.get("folder_path")))
                
                reader.close()
                
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
                return []
                
            reader = DirectoryReader.open(self.store)
            searcher = IndexSearcher(reader)
            
            docs = []
            for i in range(reader.maxDoc()):
                doc = searcher.storedFields().document(i)
                doc_output = DocumentOutput(
                    id=doc.get("id"),
                    content=doc.get("content"),
                    folder_path=doc.get("folder_path") or ""
                )
                docs.append(doc_output)
                print(f"Found document: {doc_output.id} in folder: {doc_output.folder_path}")
            
            reader.close()
            return docs
        except Exception as e:
            print(f"Error getting documents: {str(e)}")
            raise

    def clean_query(self, query_str: str) -> str:
        """Clean and prepare query string for Lucene."""
        try:
            query_str = query_str.lower()
            stop_words = {'tell', 'me', 'what', 'how', 'is', 'are', 'the'}
            words = query_str.split()
            words = [w for w in words if w not in stop_words]
            
            query_str = ' '.join(words)
            query_str = re.sub(r'[^\w\s+\-*"()]', '', query_str)
            
            words = query_str.split()
            terms = []
            for word in words:
                if len(word) > 3:
                    terms.append(f"{word}~1")
                else:
                    terms.append(word)
            
            query_str = ' OR '.join(terms)
            print(f"Cleaned query: {query_str}")
            return query_str
        except Exception as e:
            print(f"Error cleaning query: {str(e)}")
            return query_str

    def search(self, query_str: str, n: Optional[int] = None):
        """Search the index and return top N results."""
        try:
            if not DirectoryReader.indexExists(self.store):
                return []
                
            reader = DirectoryReader.open(self.store)
            searcher = IndexSearcher(reader)
            searcher.setSimilarity(BM25Similarity())
            
            cleaned_query = self.clean_query(query_str)
            parser = QueryParser("content", self.analyzer)
            parser.setAllowLeadingWildcard(True)
            query = parser.parse(cleaned_query)
            
            n = n if n is not None else self.num_results
            hits = searcher.search(query, n)
            
            results = []
            for hit in hits.scoreDocs:
                doc = searcher.storedFields().document(hit.doc)
                folder_path = doc.get("folder_path") or ""
                doc_id = doc.get("id")
                content = doc.get("content")
                
                if doc_id == ".folder":
                    continue
                
                print(f"\nMatched document: {doc_id}")
                print(f"Score: {hit.score}")
                print(f"Content preview: {content[:500] if content else 'No content'}\n")
                    
                full_path = os.path.join(folder_path, doc_id) if folder_path else doc_id
                results.append({
                    'id': doc_id,
                    'content': content,
                    'folder_path': folder_path,
                    'full_path': full_path,
                    'score': hit.score
                })
            reader.close()
            # Sort results by score in descending order
            results.sort(key=lambda x: x['score'], reverse=True)
            return results
        except Exception as e:
            print(f"Error searching documents: {str(e)}")
            raise

    def clean_response(self, response: str) -> str:
        """Clean and validate the response."""
        try:
            # Remove any meta-text patterns
            response = re.sub(r'Based on .*?:', '', response)
            response = re.sub(r'According to .*?:', '', response)
            
            # Remove excessive whitespace and newlines while preserving list structure
            lines = response.split('\n')
            cleaned_lines = []
            for line in lines:
                line = line.strip()
                if line:
                    cleaned_lines.append(line)
            
            response = '\n'.join(cleaned_lines)
            
            if not response:
                return "I don't have enough information to answer that question."
                
            return response
        except Exception as e:
            print(f"Error cleaning response: {str(e)}")
            return response

    def query(self, question: str) -> Tuple[str, List[SourceWithScore]]:
        """Perform RAG query using Lucene and Ollama."""
        try:
            results = self.search(question)
            if not results:
                return "I don't have enough information to answer that question.", []
            
            # Format context with clear document separation
            context_parts = []
            for i, r in enumerate(results, 1):
                content = r['content'].strip()
                if content:  # Only include non-empty content
                    context_parts.append(f"Document {i}:\n{content}")
            
            context = "\n\n---\n\n".join(context_parts)
            sources = [SourceWithScore(path=r['full_path'], score=r['score']) for r in results]
            
            prompt = self.prompt_template.format(
                context=context,
                question=question
            )
            
            response = self.llm.invoke(prompt)
            cleaned_response = self.clean_response(response)
            
            return cleaned_response, sources
        except Exception as e:
            print(f"Error querying documents: {str(e)}")
            raise

    def get_stats(self) -> LuceneStats:
        """Get Lucene index statistics."""
        try:
            if not DirectoryReader.indexExists(self.store):
                return LuceneStats(num_docs=0, index_size="0 KB")
            
            reader = DirectoryReader.open(self.store)
            num_docs = reader.numDocs()
            reader.close()
            
            # Calculate index size
            total_size = 0
            for root, dirs, files in os.walk(self.index_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    total_size += os.path.getsize(file_path)
            
            # Convert to human-readable format
            for unit in ['B', 'KB', 'MB', 'GB']:
                if total_size < 1024:
                    break
                total_size /= 1024
            index_size = f"{total_size:.2f} {unit}"
            
            return LuceneStats(num_docs=num_docs, index_size=index_size)
        except Exception as e:
            print(f"Error getting stats: {str(e)}")
            raise

    def reindex(self):
        """Delete and recreate the index."""
        try:
            # Get all documents first
            docs = self.get_all_documents()
            
            # Close writer
            self.writer.close()
            
            # Delete index directory
            shutil.rmtree(self.index_dir)
            os.makedirs(self.index_dir)
            
            # Reinitialize components
            self.store = FSDirectory.open(Paths.get(self.index_dir))
            config = IndexWriterConfig(self.analyzer)
            config.setSimilarity(BM25Similarity())
            config.setCommitOnClose(True)
            self.writer = IndexWriter(self.store, config)
            
            # Reindex all documents
            for doc in docs:
                if doc.id != ".folder":  # Skip folder markers, they'll be recreated
                    self.index_document(doc.content, doc.id, doc.folder_path)
            
            return True
        except Exception as e:
            print(f"Error reindexing: {str(e)}")
            raise

    def get_llm_config(self) -> LLMConfig:
        """Get current LLM configuration."""
        return LLMConfig(
            temperature=self.llm.temperature,
            num_ctx=self.llm.num_ctx,
            repeat_penalty=self.llm.repeat_penalty
        )

    def update_llm_config(self, config: LLMConfig):
        """Update LLM configuration."""
        self.llm.temperature = config.temperature
        self.llm.num_ctx = config.num_ctx
        self.llm.repeat_penalty = config.repeat_penalty

    def __del__(self):
        """Cleanup resources."""
        try:
            if hasattr(self, 'writer'):
                self.writer.close()
        except:
            pass
