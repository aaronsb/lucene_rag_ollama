import React, { useState } from 'react';
import { FiFolder, FiFile, FiChevronRight, FiChevronDown, FiTrash2, FiPlus, FiFolderPlus, FiCheck, FiX } from 'react-icons/fi';

const FolderTree = ({ documents, onSelectDocument, onDeleteDocument, onCreateFolder, onDeleteFolder, selectedPath, onSelectPath }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Build folder structure from flat document list
  const buildFolderStructure = (docs) => {
    const structure = { __files: [], __folders: {} };
    
    // First pass: create folders from .folder markers
    docs.forEach(doc => {
      if (doc.id === '.folder' && doc.folder_path) {
        const parts = doc.folder_path.split('/').filter(Boolean);
        let current = structure;
        
        // Create folder path
        parts.forEach(part => {
          if (!current.__folders[part]) {
            current.__folders[part] = { __files: [], __folders: {} };
          }
          current = current.__folders[part];
        });
      }
    });
    
    // Second pass: add regular documents to their respective folders
    docs.forEach(doc => {
      if (doc.id === '.folder') return;
      
      if (doc.folder_path) {
        const parts = doc.folder_path.split('/').filter(Boolean);
        if (parts.length > 0) {
          let current = structure;
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current.__folders[part]) {
              current.__folders[part] = { __files: [], __folders: {} };
            }
            if (i === parts.length - 1) {
              current.__folders[part].__files.push(doc);
            } else {
              current = current.__folders[part];
            }
          }
        }
      } else {
        structure.__files.push(doc);
      }
    });
    
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
    onSelectPath(path);
    toggleFolder(path);
  };

  const renderFolder = (structure, path = '') => {
    return (
      <div className="ml-1.5 sm:ml-4">
        {/* New folder input */}
        {showNewFolderInput && selectedPath === path && (
          <div className="flex items-center p-1 min-w-0 gap-1">
            <FiFolder className="flex-shrink-0 text-yellow-500" />
            <div className="flex items-center flex-1 min-w-0">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isCreatingFolder) {
                    handleCreateFolder(path);
                  }
                }}
                className="border rounded-l px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs sm:text-sm flex-1 min-w-0"
                placeholder="Folder name"
                autoFocus
                disabled={isCreatingFolder}
              />
              <div className="flex flex-shrink-0">
                <button
                  onClick={() => handleCreateFolder(path)}
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="border border-l-0 px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-gray-100 disabled:opacity-50"
                  title="Create folder"
                >
                  <FiCheck className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                </button>
                <button
                  onClick={() => {
                    setShowNewFolderInput(false);
                    setNewFolderName('');
                  }}
                  className="border border-l-0 rounded-r px-1.5 sm:px-2 py-0.5 sm:py-1 hover:bg-gray-100"
                  title="Cancel"
                >
                  <FiX className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
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
            <div key={folderPath} className="min-w-0">
              <div
                className={`flex items-center p-1 hover:bg-gray-100 rounded cursor-pointer ${
                  isSelected ? 'bg-blue-50' : ''
                } group`}
                onClick={() => handleFolderClick(folderPath)}
              >
                <div className="flex items-center flex-shrink-0 gap-0.5 sm:gap-1">
                  {isExpanded ? <FiChevronDown className="w-3 h-3 sm:w-4 sm:h-4" /> : <FiChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />}
                  <FiFolder className="text-yellow-500 w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <span className="flex-1 truncate ml-0.5 sm:ml-1 text-sm">{folderName}</span>
                {isSelected && (
                  <div className="flex items-center flex-shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNewFolderInput(true);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Create subfolder"
                    >
                      <FiFolderPlus className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(folderPath);
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-red-500"
                      title="Delete folder"
                    >
                      <FiTrash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              {isExpanded && (
                <div className="ml-2 sm:ml-4">
                  {renderFolder(content, folderPath)}
                  {content.__files?.map(file => (
                    <div
                      key={`${folderPath}/${file.id}`}
                      className="flex items-center justify-between p-1 hover:bg-gray-100 rounded cursor-pointer group min-w-0"
                      onClick={() => onSelectDocument(file)}
                    >
                      <div className="flex items-center min-w-0 flex-1 gap-0.5 sm:gap-1">
                        <FiFile className="flex-shrink-0 w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="truncate text-sm">{file.id}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDocument(file.id, file.folder_path);
                        }}
                        className="text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 flex-shrink-0 p-1"
                      >
                        <FiTrash2 className="w-3 h-3 sm:w-4 sm:h-4" />
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
            className="flex items-center justify-between p-1 hover:bg-gray-100 rounded cursor-pointer group min-w-0"
            onClick={() => onSelectDocument(file)}
          >
            <div className="flex items-center min-w-0 flex-1 gap-0.5 sm:gap-1">
              <FiFile className="flex-shrink-0 w-3 h-3 sm:w-4 sm:h-4" />
              <span className="truncate text-sm">{file.id}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteDocument(file.id, file.folder_path);
              }}
              className="text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 flex-shrink-0 p-1"
            >
              <FiTrash2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const folderStructure = buildFolderStructure(documents);
  
  return (
    <div className="h-full overflow-auto">
      <div className="mb-2 flex items-center px-1">
        <button
          onClick={() => {
            onSelectPath('');
            setShowNewFolderInput(true);
          }}
          className="flex items-center text-xs sm:text-sm text-blue-500 hover:text-blue-600 gap-0.5 sm:gap-1"
        >
          <FiFolderPlus className="w-3 h-3 sm:w-4 sm:h-4" />
          New Root Folder
        </button>
      </div>
      {renderFolder(folderStructure)}
    </div>
  );
};

export default FolderTree;
