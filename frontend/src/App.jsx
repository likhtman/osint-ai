import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, User, MapPin, Bell, Download, ChevronDown, ChevronRight, Bot, AlertTriangle, Fingerprint, History, Clock } from 'lucide-react';
import './index.css';

function App() {
  const [queryText, setQueryText] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [entities, setEntities] = useState({});
  const [activeTab, setActiveTab] = useState('search');
  const [expanded, setExpanded] = useState({});
  const [history, setHistory] = useState([]);
  const [currentTaskId, setCurrentTaskId] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/history');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const loadScan = async (taskId) => {
    if (isAnalysing) return;
    setCurrentTaskId(taskId);
    setEntities({});
    setExpanded({});
    try {
      const response = await fetch(`http://localhost:8000/api/v1/scan/${taskId}`);
      const task = await response.json();
      
      const entitiesData = {};
      task.entities.forEach(entity => {
        const platforms = {};
        entity.responses.forEach(resp => {
           platforms[resp.platform] = { status: 'complete', text: resp.content };
        });
        
        entitiesData[entity.name] = {
          name: entity.name,
          hypotheses: entity.hypotheses || [],
          platforms: platforms,
          insight: 'Архивные данные',
          threatLevel: 'Moderate'
        };
      });
      setEntities(entitiesData);
    } catch (err) {
      console.error('Error loading scan:', err);
    }
  };

  const toggleRow = (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleAnalyze = async () => {
    if (!queryText.trim()) return;
    setIsAnalysing(true);
    setEntities({});
    setExpanded({});
    setCurrentTaskId(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryText })
      });
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('No reader available');
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const events = chunk.split('\n\n');
        
        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          
          try {
            const dataStr = event.replace('data: ', '');
            if (!dataStr.trim()) continue;
            
            const data = JSON.parse(dataStr);
            handleServerEvent(data);
          } catch (e) {
            console.error('Error parsing JSON event:', e);
          }
        }
      }
      fetchHistory(); // Обновляем историю после завершения
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalysing(false);
    }
  };

  const handleServerEvent = (data) => {
    if (data.type === 'entity_start') {
      setEntities(prev => ({
        ...prev,
        [data.entity]: { 
          name: data.entity, 
          hypotheses: [], 
          platforms: {},
          insight: 'Сканирование...',
          threatLevel: 'loading'
        }
      }));
    }
    else if (data.type === 'hypothesis_generated') {
      setEntities(prev => ({
        ...prev,
        [data.entity]: { ...prev[data.entity], hypotheses: data.hypotheses }
      }));
    }
    else if (data.type === 'platform_start') {
      setEntities(prev => ({
        ...prev,
        [data.entity]: {
          ...prev[data.entity],
          platforms: {
             ...prev[data.entity]?.platforms,
             [data.platform]: { status: 'loading', text: '' }
          }
        }
      }));
    }
    else if (data.type === 'platform_result') {
      setEntities(prev => {
        const currentEntity = prev[data.entity];
        if (!currentEntity) return prev;
        const pdData = Object.keys(currentEntity.platforms || {}).length;
        return {
          ...prev,
          [data.entity]: {
            ...currentEntity,
            platforms: {
               ...currentEntity.platforms,
               [data.platform]: { status: 'complete', text: data.result }
            },
            insight: pdData > 1 ? 'Data Aggregated' : 'Collecting...',
            threatLevel: pdData > 3 ? 'Moderate' : 'Low'
          }
        }
      });
    }
  };

  return (
    <>
      <div className="bg-glow-1"></div>
      <div className="bg-glow-2"></div>

      <div className="app-container">
        <nav className="navbar">
          <div className="nav-brand">
            <Fingerprint className="text-accent-blue" size={24} color="#3b82f6" />
            OSINT INTELLIGENCE <span>| AXON AI</span>
          </div>
          <div className="nav-links">
            <span className="nav-item active">Dashboard</span>
            <span className="nav-item">Investigation</span>
            <span className="nav-item">Sources</span>
          </div>
          <div className="nav-user">
            <Bell size={20} color="#8b949e" />
            <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="User" className="avatar" />
          </div>
        </nav>

        <div className="main-layout">
          {/* SIDEBAR */}
          <aside className="sidebar">
            <div className="sidebar-title">
              <History size={16} /> Recent Scans
            </div>
            <div className="history-list">
              {history.map(item => (
                <div 
                  key={item.id} 
                  className={`history-item ${currentTaskId === item.id ? 'active' : ''}`}
                  onClick={() => loadScan(item.id)}
                >
                  <div className="history-query">{item.query_text}</div>
                  <div className="history-date">
                    <Clock size={12} inline /> {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {history.length === 0 && <div style={{color: 'var(--text-secondary)', fontSize: '0.8rem'}}>No history yet</div>}
            </div>
          </aside>

          {/* CONTENT AREA */}
          <main className="content-area">
            <div className="search-section">
              <h1 className="search-title">Search Queries & Intelligence Targets...</h1>
              
              <div className="search-widget">
                <div className="search-tabs">
                  <button className={`search-tab ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}><Search size={20} /></button>
                  <button className={`search-tab ${activeTab === 'user' ? 'active' : ''}`} onClick={() => setActiveTab('user')}><User size={20} /></button>
                </div>
                
                <div className="search-input-group">
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="Enter Entity, Keyword, URL..."
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    disabled={isAnalysing}
                  />
                  <button className="analyze-btn" onClick={handleAnalyze} disabled={isAnalysing || !queryText.trim()}>
                    {isAnalysing ? 'Analyzing...' : 'Analyze'}
                  </button>
                </div>
              </div>
            </div>

            <div className="results-section">
              <div className="table-container">
                <div className="table-header">
                  <div>[ENTITY]</div>
                  <div>[QUESTION / OBJECTIVE]</div>
                  <div>[SEARCH RESULTS & SOURCES]</div>
                  <div>[AI INSIGHTS & THREATS]</div>
                  <div>[STATUS]</div>
                </div>

                <AnimatePresence>
                  {Object.values(entities).map((entityData, i) => (
                    <div key={entityData.name} className="table-row-group">
                      <motion.div 
                        className="table-row"
                        onClick={() => toggleRow(entityData.name)}
                        style={{ cursor: 'pointer' }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="row-accent" style={{ background: i % 2 === 0 ? 'var(--accent-cyan)' : 'var(--accent-purple)' }}></div>
                        
                        <div className="cell-entity">
                          <motion.div animate={{ rotate: expanded[entityData.name] ? 90 : 0 }}>
                            <ChevronRight size={18} color="#8b949e" />
                          </motion.div>
                          <div className="entity-icon"><User size={20} /></div>
                          <div>
                            {entityData.name}
                            {entityData.name !== queryText.trim() && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Variant)</div>}
                          </div>
                        </div>

                        <div className="cell-question">
                          {entityData.hypotheses.length > 0 ? (
                            <div style={{ fontSize: '0.85rem' }}>
                              {entityData.hypotheses.map((h, idx) => (
                                <div key={idx} style={{ marginBottom: "2px" }}>• {h}</div>
                              ))}
                            </div>
                          ) : (
                            <span style={{color: 'var(--text-secondary)'}}>Generating questions...</span>
                          )}
                        </div>

                        <div className="cell-sources">
                          {Object.keys(entityData.platforms || {}).length > 0 ? (
                            <>
                              <div className="source-count">{Object.keys(entityData.platforms).length}</div>
                              {Object.keys(entityData.platforms).slice(0,3).map(p => (
                                <div key={p} className="source-icon" title={p}><Bot size={16} /></div>
                              ))}
                            </>
                          ) : (
                            <span style={{color: 'var(--text-secondary)'}}>Waiting...</span>
                          )}
                        </div>

                        <div className="cell-insights">
                          {entityData.insight && (
                             <div className={`insight-badge ${entityData.threatLevel === 'High' ? 'red' : 'blue'}`}>
                              <Bot size={14}/> {entityData.insight}
                            </div>
                          )}
                        </div>

                        <div className="cell-status">
                           <span className="status-label">Risk:</span>
                           <span className={`status-value ${entityData.threatLevel?.toLowerCase()}`}>
                             {isAnalysing ? 'Loading...' : entityData.threatLevel || 'Scanning'}
                           </span>
                        </div>
                      </motion.div>

                      <AnimatePresence>
                        {expanded[entityData.name] && (
                          <motion.div 
                            className="expanded-details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                          >
                            <div className="details-content">
                              <h4 style={{marginTop: 0, color: 'var(--text-secondary)'}}>Собранное досье</h4>
                              <div className="details-grid">
                                {Object.entries(entityData.platforms || {}).map(([platform, data]) => (
                                   <div key={platform} className="platform-detail-card">
                                      <div className="platform-head"><Bot size={16}/> {platform}</div>
                                      <div className="platform-body">
                                        {data.status === 'loading' ? '⏳ Поиск...' : data.text}
                                      </div>
                                   </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
