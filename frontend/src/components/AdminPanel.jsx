import React, { useState } from 'react';
import { FiRefreshCw, FiDatabase, FiSearch } from 'react-icons/fi';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

function AdminPanel({ onReindex }) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [model, setModel] = useState(null);
  const [numResults, setNumResults] = useState(3);
  const [updating, setUpdating] = useState(false);

  const handleReindex = async () => {
    if (!window.confirm('Are you sure you want to delete the index and reindex all documents?')) {
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API_URL}/reindex`);
      if (onReindex) {
        await onReindex();
      }
    } catch (error) {
      console.error('Error reindexing:', error);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchModel = async () => {
    try {
      const response = await axios.get(`${API_URL}/model`);
      setModel(response.data.model);
    } catch (error) {
      console.error('Error fetching model:', error);
    }
  };

  const fetchSearchConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/search-config`);
      setNumResults(response.data.num_results);
    } catch (error) {
      console.error('Error fetching search config:', error);
    }
  };

  const updateSearchConfig = async (value) => {
    setUpdating(true);
    try {
      await axios.post(`${API_URL}/search-config`, {
        num_results: value
      });
      setNumResults(value);
    } catch (error) {
      console.error('Error updating search config:', error);
    }
    setUpdating(false);
  };

  const handleNumResultsChange = (e) => {
    const value = parseInt(e.target.value);
    if (value > 0) {
      updateSearchConfig(value);
    }
  };

  // Fetch stats, model info, and search config on mount
  React.useEffect(() => {
    fetchStats();
    fetchModel();
    fetchSearchConfig();
  }, []);

  return (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Admin Panel</h3>
        <button
          onClick={handleReindex}
          disabled={loading}
          className="btn btn-sm btn-outline flex items-center gap-1"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          Reindex
        </button>
      </div>
      
      <div className="text-sm space-y-2">
        <div className="flex items-center gap-1 text-gray-600">
          <FiDatabase className="w-3 h-3" />
          <span>Model: {model || 'Loading...'}</span>
        </div>
        
        {stats && (
          <>
            <div className="text-gray-600">
              Documents: {stats.num_docs}
            </div>
            <div className="text-gray-600">
              Index Size: {stats.index_size}
            </div>
          </>
        )}

        <div className="flex items-center gap-2 text-gray-600">
          <FiSearch className="w-3 h-3" />
          <label htmlFor="numResults" className="text-sm">Results per query:</label>
          <input
            id="numResults"
            type="number"
            min="1"
            value={numResults}
            onChange={handleNumResultsChange}
            disabled={updating}
            className="w-16 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
