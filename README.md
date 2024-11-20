# Document RAG API

## Overview

This full-stack application combines Apache Lucene for document indexing with a local Ollama LLM for Retrieval-Augmented Generation (RAG). The system includes a modern React frontend and runs entirely locally using Docker containers. It provides a seamless interface for document management, querying, and interactive chat-based document retrieval.

## Collaboration with Cline

This project is developed in collaboration with [Cline](https://github.com/cline/cline), an exceptional AI assistant code editor. Cline has been instrumental in enhancing the development process, providing intelligent code suggestions, and ensuring best practices are followed throughout the project.

## Goals

The primary goals of this project are:
- To gain a deeper understanding of RAG and graph search results.
- To improve skills in creating and managing Docker containers.
- To practice writing clean, maintainable code.
- To enhance documentation skills and maintain comprehensive project documentation.

This project is a work in progress, aimed at continuous learning and improvement in full-stack development and AI integration.

## Features

Backend:
- REST API endpoints for document management and querying
- Document indexing using Apache Lucene with BM25 similarity scoring
- Local LLM inference using Ollama
- RAG implementation combining Lucene search with LLM generation
- Containerized setup for isolation and reproducibility
- Source attribution for retrieved content
- Hierarchical folder structure support
- Persistent document organization

Frontend:
- Modern, responsive UI built with React and Tailwind CSS
- Markdown file upload and preview
- Hierarchical document organization with folders
- Interactive folder tree navigation
- Folder creation and deletion
- Document organization and management
- Interactive chat interface for querying documents
- Real-time document deletion
- Source attribution with clickable document links
- Automatic document preview when clicking source links

## Prerequisites

- Docker
- Docker Compose
- Ollama (running locally)
- llama2-3.2-vision model installed in Ollama (128k context window version)

## Setup and Running

1. Clone this repository
2. Build and run the containers:
   ```bash
   docker compose up --build
   ```

The services will:
1. Start the backend API on http://localhost:3333
2. Start the frontend application on http://localhost:3000
3. Connect to the Ollama service
4. Initialize the Lucene index
5. Provide both REST endpoints and web interface for document management and querying

## Using the Web Interface

1. **Document Organization**:
   - Create folders using the "New Root Folder" button
   - Create subfolders by selecting a folder and clicking the folder icon
   - Upload files directly into folders by selecting the target folder
   - Organize documents in a hierarchical structure
   - Delete folders and their contents using the trash icon
   - Navigate through the folder tree using expand/collapse controls

2. **Document Management**:
   - Click the upload icon (↑) in the Documents panel to upload markdown files
   - Upload files to specific folders by selecting the folder first
   - Click on a document in the list to preview its content
   - Use the trash icon to delete documents
   - Documents are automatically rendered with markdown formatting

3. **Chat Interface**:
   - Type your questions in the chat input at the bottom right
   - The system will use RAG to provide context-aware responses
   - Chat history is maintained during your session
   - Questions are answered using the context from your uploaded documents
   - Source documents are listed below each response
   - Click on source document names to preview their content

4. **Admin Panel**:
   - View current model and index statistics
   - Configure search parameters:
     - Number of results: Controls how many documents are retrieved for context
   - Configure LLM parameters:
     - Temperature (0-1): Controls response randomness. Lower values make responses more focused and deterministic
     - Context Window (1024-128000): Maximum tokens for context. Higher values allow more document context
     - Repeat Penalty (1-2): Controls repetition in responses. Higher values reduce repetition

## API Endpoints

### Add Document
```bash
POST /documents
Content-Type: application/json

{
    "id": "doc1",
    "content": "Your document content here",
    "folder_path": "path/to/folder"  # Optional folder path
}
```

### Create Folder
```bash
POST /documents
Content-Type: application/json

{
    "id": ".folder",
    "content": "",
    "folder_path": "path/to/folder"
}
```

### List Documents
```bash
GET /documents
```

### Delete Document
```bash
DELETE /documents/{doc_id}?folder_path=path/to/folder
```

### Delete Folder
```bash
DELETE /documents/.folder?folder_path=path/to/folder
```

### Query Documents
```bash
POST /query
Content-Type: application/json

{
    "question": "Your question here"
}

Response:
{
    "answer": "Generated response",
    "sources": ["path/to/doc1", "path/to/doc2"]  // List of source document paths
}
```

## How it Works

1. **Document Organization**: 
   - Documents are organized in a hierarchical folder structure
   - Folders can contain both documents and subfolders
   - Folder structure is persisted using special folder markers
   - Frontend provides an intuitive tree view for navigation

2. **Document Management**: 
   - Documents are added, listed, and deleted through REST endpoints or web interface
   - Each document is indexed using Apache Lucene with BM25 similarity scoring for optimal retrieval
   - Documents maintain their folder structure in the index
   - Frontend provides markdown rendering and organization

3. **RAG Process**:
   - When a question is received through the query endpoint or chat interface
   - Lucene searches the index using BM25 scoring to find the most relevant documents
   - Retrieved documents are used as context for the Ollama LLM
   - LLM generates an informed response based on the context
   - Source documents are tracked and returned with the response
   - Frontend displays sources with clickable links to preview documents

## Architecture

Backend:
- `main.py`: FastAPI application with RAG implementation
- `Dockerfile`: Sets up the Python environment with PyLucene
- `requirements.txt`: Python dependencies including FastAPI and uvicorn

Frontend:
- `frontend/`: React application directory
- `frontend/src/`: Source code for the React application
- `frontend/src/components/FolderTree.jsx`: Hierarchical folder view component
- `frontend/Dockerfile`: Frontend container configuration
- `frontend/nginx.conf`: Nginx configuration for production serving

Infrastructure:
- `docker-compose.yml`: Orchestrates the frontend, backend, and service connections
- Persistent volume for Lucene index storage

## API Documentation

Once the service is running, you can access:
- Interactive API documentation: http://localhost:3333/docs
- OpenAPI specification: http://localhost:3333/openapi.json

## Technical Details

Backend:
- Uses FastAPI for REST API implementation
- Java 21 for PyLucene compatibility
- Implements proper service dependency handling
- Includes automatic retry logic for Ollama service availability
- Persists documents and folder structure using Lucene index
- Uses host network mode to access Ollama service
- Tracks and returns source documents for responses
- Maintains hierarchical document organization
- Uses BM25 similarity scoring for improved search relevance

Frontend:
- Built with React and Vite for modern development experience
- Styled with Tailwind CSS for responsive design
- Interactive folder tree navigation
- Uses React Markdown for document rendering
- Axios for API communication
- Nginx for production-ready serving
- Interactive source links for document preview
- Seamless integration between chat and document preview

## Example Usage

1. Using the Web Interface:
   - Open http://localhost:3000 in your browser
   - Create folders to organize your documents
   - Upload markdown files to specific folders
   - Navigate the folder structure
   - Click on documents to preview them
   - Use the chat interface to ask questions about your documents
   - Click on source links below responses to view referenced documents

2. Using the API:
```bash
# Create a folder
curl -X POST http://localhost:3333/documents \
  -H "Content-Type: application/json" \
  -d '{"id": ".folder", "content": "", "folder_path": "docs/ai"}'

# Add a document to a folder
curl -X POST http://localhost:3333/documents \
  -H "Content-Type: application/json" \
  -d '{"id": "rag.md", "content": "RAG (Retrieval-Augmented Generation) is an AI framework that combines information retrieval with language model generation.", "folder_path": "docs/ai"}'

# Query the system
curl -X POST http://localhost:3333/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is RAG and how does it help?"}'
```

## Customization

Backend (`main.py`):
- Adjust the number of retrieved documents (n parameter in search method)
- Modify the prompt template
- Change the Ollama model (default is llama3.2-vision with 128k context window)
- Add additional API endpoints or functionality
- Customize source attribution format
- Modify folder structure handling
- Adjust BM25 similarity parameters for search tuning

Frontend (`frontend/src/App.jsx`, `frontend/src/components/FolderTree.jsx`):
- Customize the UI theme in Tailwind configuration
- Modify the chat interface behavior
- Add additional features or visualizations
- Adjust the document preview styling
- Customize source link appearance and behavior
- Modify folder tree appearance and behavior
