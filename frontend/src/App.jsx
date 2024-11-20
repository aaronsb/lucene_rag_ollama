import React, { useState, useEffect, useRef } from 'react';
import { FiUpload, FiMessageSquare, FiFile, FiFolderPlus } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import FolderTree from './components/FolderTree';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState('');
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  
  // Add state for column widths
  const [sidebarWidth, setSidebarWidth] = useState(256); // 16rem = 256px
  const [chatWidth, setChatWidth] = useState(384); // 24rem = 384px
  
  // Refs for resize handling
  const sidebarResizing = useRef(false);
  const chatResizing = useRef(false);
  const initialX = useRef(0);
  const initialSidebarWidth = useRef(0);
  const initialChatWidth = useRef(0);

  useEffect(() => {
    fetchDocuments();

    // Add mouse event listeners for resizing
    const handleMouseMove = (e) => {
      if (sidebarResizing.current) {
        const diff = e.clientX - initialX.current;
        const newWidth = Math.max(200, Math.min(500, initialSidebarWidth.current + diff));
        setSidebarWidth(newWidth);
      }
      if (chatResizing.current) {
        const diff = initialX.current - e.clientX;
        const newWidth = Math.max(300, Math.min(600, initialChatWidth.current + diff));
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      sidebarResizing.current = false;
      chatResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startSidebarResize = (e) => {
    sidebarResizing.current = true;
    initialX.current = e.clientX;
    initialSidebarWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startChatResize = (e) => {
    chatResizing.current = true;
    initialX.current = e.clientX;
    initialChatWidth.current = chatWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_URL}/documents`);
      const allDocs = response.data;
      
      // Log the raw documents data
      console.log('Raw documents data:', JSON.stringify(allDocs, null, 2));
      
      // Log folder markers specifically
      const folderMarkers = allDocs.filter(doc => doc.id === '.folder');
      console.log('Folder markers:', JSON.stringify(folderMarkers, null, 2));
      
      // Sort documents to ensure folder markers come first
      const sortedDocs = [...allDocs].sort((a, b) => {
        if (a.id === '.folder' && b.id !== '.folder') return -1;
        if (a.id !== '.folder' && b.id === '.folder') return 1;
        return 0;
      });
      
      setDocuments(sortedDocs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleFileUpload = async (event, isDirectory = false) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          let folderPath = selectedPath;
          let fileName = file.name;

          if (isDirectory && file.webkitRelativePath) {
            const pathParts = file.webkitRelativePath.split('/');
            pathParts.pop(); // Remove filename
            const relativePath = pathParts.join('/');
            folderPath = selectedPath
              ? `${selectedPath}/${relativePath}`
              : relativePath;
          }

          await axios.post(`${API_URL}/documents`, {
            id: fileName,
            content: e.target.result,
            folder_path: folderPath
          });
        } catch (error) {
          console.error('Error uploading document:', error);
        }
      };
      reader.readAsText(file);
    }

    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';

    // Refresh document list after all uploads
    setTimeout(fetchDocuments, 500);
  };

  const handleCreateFolder = async (folderPath) => {
    try {
      console.log('Creating folder:', folderPath);
      const response = await axios.post(`${API_URL}/documents`, {
        id: '.folder',
        content: '',
        folder_path: folderPath
      });
      console.log('Folder creation response:', JSON.stringify(response.data, null, 2));
      
      // Immediately fetch updated documents
      await fetchDocuments();
      
      // Select the newly created folder
      setSelectedPath(folderPath);
    } catch (error) {
      console.error('Error creating folder:', error.response?.data || error.message);
    }
  };

  const handleDeleteFolder = async (folderPath) => {
    try {
      await axios.delete(`${API_URL}/documents/.folder?folder_path=${encodeURIComponent(folderPath)}`);
      if (selectedPath === folderPath) {
        setSelectedPath('');
      }
      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const handleDeleteDocument = async (docId, folderPath = "") => {
    try {
      await axios.delete(`${API_URL}/documents/${docId}?folder_path=${encodeURIComponent(folderPath)}`);
      await fetchDocuments();
      if (selectedDoc?.id === docId && selectedDoc?.folder_path === folderPath) {
        setSelectedDoc(null);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/query`, {
        question: chatMessage
      });
      
      setChatHistory(prev => [...prev, 
        { type: 'user', content: chatMessage },
        { 
          type: 'assistant', 
          content: response.data.answer,
          sources: response.data.sources 
        }
      ]);
      setChatMessage('');
    } catch (error) {
      console.error('Error querying documents:', error);
    }
    setLoading(false);
  };

  const handleSourceClick = (sourcePath) => {
    // Extract folder path and file name from the full path
    const parts = sourcePath.split('/');
    const fileName = parts.pop();
    const folderPath = parts.join('/');
    
    const doc = documents.find(d => d.id === fileName && d.folder_path === folderPath);
    if (doc) {
      setSelectedDoc(doc);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar with Folder Tree */}
      <div 
        style={{ 
          width: sidebarWidth + 'px',
          transition: 'width 0.1s ease-out'
        }} 
        className="bg-white shadow-md p-4 flex flex-col"
      >
        <div className="flex flex-col gap-2 mb-4">
          <h2 className="text-xl font-bold">Documents</h2>
          <div className="flex gap-2">
            <label className="flex-1">
              <div className="btn btn-sm btn-outline w-full flex items-center justify-center gap-2">
                <FiFile className="w-4 h-4" />
                <span>Upload File</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".md,.txt"
                onChange={(e) => handleFileUpload(e, false)}
              />
            </label>
            <label className="flex-1">
              <div className="btn btn-sm btn-outline w-full flex items-center justify-center gap-2">
                <FiFolderPlus className="w-4 h-4" />
                <span>Upload Folder</span>
              </div>
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                accept=".md,.txt"
                webkitdirectory="true"
                directory="true"
                onChange={(e) => handleFileUpload(e, true)}
              />
            </label>
          </div>
        </div>
        <FolderTree
          documents={documents}
          onSelectDocument={doc => doc.id !== '.folder' && setSelectedDoc(doc)}
          onDeleteDocument={handleDeleteDocument}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          selectedPath={selectedPath}
          onSelectPath={setSelectedPath}
        />
      </div>

      {/* Resize handle for sidebar */}
      <div
        className="w-1.5 bg-gray-300 hover:bg-blue-500 cursor-col-resize active:bg-blue-600 transition-colors"
        onMouseDown={startSidebarResize}
      />

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Document Preview */}
        <div className="flex-1 p-6 overflow-auto">
          {selectedDoc ? (
            <div className="card">
              <div className="text-sm text-gray-500 mb-2">
                {selectedDoc.folder_path ? `${selectedDoc.folder_path}/` : ''}{selectedDoc.id}
              </div>
              <div className="prose max-w-none">
                <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a document to preview
            </div>
          )}
        </div>

        {/* Resize handle for chat */}
        <div
          className="w-1.5 bg-gray-300 hover:bg-blue-500 cursor-col-resize active:bg-blue-600 transition-colors"
          onMouseDown={startChatResize}
        />

        {/* Chat Interface */}
        <div 
          style={{ 
            width: chatWidth + 'px',
            transition: 'width 0.1s ease-out'
          }} 
          className="bg-white shadow-md p-4 flex flex-col"
        >
          <h2 className="text-xl font-bold mb-4">Chat</h2>
          <div className="flex-1 overflow-auto mb-4 space-y-4">
            {chatHistory.map((msg, index) => (
              <div key={index}>
                <div
                  className={`p-3 rounded-lg ${
                    msg.type === 'user'
                      ? 'bg-blue-100 ml-auto'
                      : 'bg-gray-100'
                  } max-w-[80%]`}
                >
                  {msg.content}
                </div>
                {msg.type === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 text-sm text-gray-500 pl-3">
                    Sources:
                    <ul className="list-disc pl-5">
                      {msg.sources.map((source, idx) => (
                        <li key={idx}>
                          <button
                            onClick={() => handleSourceClick(source)}
                            className="text-blue-500 hover:text-blue-700 hover:underline focus:outline-none"
                          >
                            {source}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleChat()}
              placeholder="Ask about your documents..."
              className="input flex-1"
              disabled={loading}
            />
            <button
              onClick={handleChat}
              disabled={loading}
              className="btn btn-primary"
            >
              <FiMessageSquare />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
