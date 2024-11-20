import React, { useState, useEffect } from 'react';
import { FiFolder, FiFile, FiChevronRight, FiChevronDown, FiTrash2, FiPlus, FiFolderPlus, FiCheck, FiX } from 'react-icons/fi';

const FolderTree = ({ documents, onSelectDocument, onDeleteDocument, onCreateFolder, onDeleteFolder, selectedPath, onSelectPath }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  useEffect(() => {
    console.log('FolderTree received documents:', JSON.stringify(documents, null, 2));
  }, [documents]);

  // Build folder structure from flat document list
  const buildFolderStructure = (docs) => {
    console.log('Building folder structure from documents:', JSON.stringify(docs, null, 2));
    const structure = { __files: [], __folders: {} };
    
    // First pass: create folders from .folder markers
    docs.forEach(doc => {
      if (doc.id === '.folder' && doc.folder_path) {
        console.log('Processing folder marker:', doc.folder_path);
        const parts = doc.folder_path.split('/').filter(Boolean);
        let current = structure;
        
        // Create folder path
        parts.forEach((part, index) => {
          if (!current.__folders[part]) {
            console.log(`Creating folder: ${part} in path: ${parts.slice(0, index).join('/')}`);
            current.__folders[part] = { __files: [], __folders: {} };
          }
          current = current.__folders[part];
        });
      }
    });
    
    // Second pass: add regular documents to their respective folders
    docs.forEach(doc => {
      if (doc.id === '.folder') return; // Skip folder markers in this pass
      
      // Handle files with folder paths
      if (doc.folder_path) {
        const parts = doc.folder_path.split('/').filter(Boolean);
        if (parts.length > 0) {
          let current = structure;
          // Navigate to the correct folder
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current.__folders[part]) {
              current.__folders[part] = { __files: [], __folders: {} };
            }
            if (i === parts.length - 1) {
              // Add file only to its designated folder
              console.log(`Adding file: ${doc.id} to folder: ${doc.folder_path}`);
              current.__folders[part].__files.push(doc);
            } else {
              current = current.__folders[part];
            }
          }
        }
      } else {
        // Only add to root if there's no folder path
        console.log(`Adding file: ${doc.id} to root (no folder path)`);
        structure.__files.push(doc);
      }
    });
    
    console.log('Final folder structure:', JSON.stringify(structure, null, 2));
    return structure;
  };

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = async (parentPath) => {
    if (!newFolderName.trim()) return;
    
    const fullPath = parentPath ? `${parentPath}/${newFolderName}` : newFolderName;
    console.log('Creating folder with path:', fullPath);
    setIsCreatingFolder(true);
    
    try {
      await onCreateFolder(fullPath);
      setNewFolderName('');
      setShowNewFolderInput(false);
      setExpandedFolders(new Set([...expandedFolders, parentPath].filter(Boolean)));
    } catch (error) {
      console.error('Error creating folder:', error);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleFolderClick = (path) => {
    console.log('Folder clicked:', path);
    onSelectPath(path);
    toggleFolder(path);
  };

  const renderFolder = (structure, path = '') => {
    return (
      <div className="ml-4">
        {/* New folder input */}
        {showNewFolderInput && selectedPath === path && (
          <div className="flex items-center p-1">
            <FiFolder className="mr-2 text-yellow-500" />
            <div className="flex items-center flex-1">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isCreatingFolder) {
                    handleCreateFolder(path);
                  }
                }}
                className="border rounded-l px-2 py-1 text-sm w-40"
                placeholder="Folder name"
                autoFocus
                disabled={isCreatingFolder}
              />
              <div className="flex">
                <button
                  onClick={() => handleCreateFolder(path)}
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="border border-l-0 px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                  title="Create folder"
                >
                  <FiCheck className="w-4 h-4 text-green-600" />
                </button>
                <button
                  onClick={() => {
                    setShowNewFolderInput(false);
                    setNewFolderName('');
                  }}
                  className="border border-l-0 rounded-r px-2 py-1 hover:bg-gray-100"
                  title="Cancel"
                >
                  <FiX className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Folders */}
        {Object.entries(structure.__folders).map(([folderName, content]) => {
          const folderPath = path ? `${path}/${folderName}` : folderName;
          const isExpanded = expandedFolders.has(folderPath);
          const isSelected = selectedPath === folderPath;
          
          return (
            <div key={folderPath}>
              <div
                className={`flex items-center p-1 hover:bg-gray-100 rounded cursor-pointer ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleFolderClick(folderPath)}
              >
                {isExpanded ? <FiChevronDown className="mr-1" /> : <FiChevronRight className="mr-1" />}
                <FiFolder className="mr-2 text-yellow-500" />
                <span className="flex-1">{folderName}</span>
                {isSelected && (
                  <div className="flex items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNewFolderInput(true);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Create subfolder"
                    >
                      <FiFolderPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(folderPath);
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-red-500"
                      title="Delete folder"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              {isExpanded && (
                <div className="ml-4">
                  {renderFolder(content, folderPath)}
                  {content.__files?.map(file => (
                    <div
                      key={`${folderPath}/${file.id}`}
                      className="flex items-center justify-between p-1 hover:bg-gray-100 rounded cursor-pointer group"
                      onClick={() => onSelectDocument(file)}
                    >
                      <div className="flex items-center">
                        <FiFile className="mr-2" />
                        <span className="truncate">{file.id}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDocument(file.id, file.folder_path);
                        }}
                        className="text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Root level files */}
        {path === '' && structure.__files?.map(file => (
          <div
            key={file.id}
            className="flex items-center justify-between p-1 hover:bg-gray-100 rounded cursor-pointer group"
            onClick={() => onSelectDocument(file)}
          >
            <div className="flex items-center">
              <FiFile className="mr-2" />
              <span className="truncate">{file.id}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteDocument(file.id, file.folder_path);
              }}
              className="text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100"
            >
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const folderStructure = buildFolderStructure(documents);
  
  return (
    <div className="h-full overflow-auto">
      <div className="mb-2 flex items-center">
        <button
          onClick={() => {
            onSelectPath('');
            setShowNewFolderInput(true);
          }}
          className="flex items-center text-sm text-blue-500 hover:text-blue-600"
        >
          <FiFolderPlus className="mr-1" />
          New Root Folder
        </button>
      </div>
      {renderFolder(folderStructure)}
    </div>
  );
};

export default FolderTree;
