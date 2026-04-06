import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, Bot, Info } from 'lucide-react';
import './index.css';

function App() {
  const [queryText, setQueryText] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [entities, setEntities] = useState({});
  const [statusMsg, setStatusMsg] = useState('');
  
  const handleAnalyze = async () => {
    if (!queryText.trim()) return;
    
    setIsAnalysing(true);
    setEntities({});
    setStatusMsg('Инициализация соединений...');
    
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
    } catch (err) {
      console.error(err);
      setStatusMsg('Произошла ошибка при анализе.');
    } finally {
      setIsAnalysing(false);
      setStatusMsg('');
    }
  };

  const handleServerEvent = (data) => {
    if (data.type === 'status') {
      setStatusMsg(data.message);
    } 
    else if (data.type === 'entity_start') {
      setEntities(prev => ({
        ...prev,
        [data.entity]: { name: data.entity, hypotheses: [], platforms: {} }
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
      setEntities(prev => ({
        ...prev,
        [data.entity]: {
          ...prev[data.entity],
          platforms: {
             ...prev[data.entity]?.platforms,
             [data.platform]: { status: 'complete', text: data.result }
          }
        }
      }));
    }
    else if (data.type === 'complete') {
      setStatusMsg('Анализ завершен!');
    }
  };

  return (
    <>
      <main>
        <motion.div 
          className="glass-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="title">AI OSINT Explorer</h1>
          <p className="subtitle">Автоматизированный сбор досье из главных ИИ-источников</p>
          
          <textarea
            className="textarea-input"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Введите имена или названия для расследования (через пробел, запятую или с новой строки)..."
            disabled={isAnalysing}
          />
          
          <button 
            className="glow-btn flex items-center justify-center gap-2"
            onClick={handleAnalyze}
            disabled={isAnalysing || !queryText.trim()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isAnalysing ? (
              <><Loader2 className="animate-spin" size={20} /> Анализируем...</>
            ) : (
              <><Search size={20} /> Запустить расследование</>
            )}
          </button>
          
          <AnimatePresence>
            {statusMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                {statusMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="results-container">
          <AnimatePresence>
            {Object.values(entities).map((entityData, idx) => (
              <motion.div 
                key={entityData.name}
                className="entity-section"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="entity-header">
                  <span>{entityData.name}</span>
                </div>
                
                {entityData.hypotheses?.length > 0 && (
                  <div className="hypothesis-box">
                    <div className="hypothesis-title">Сгенерированные вопросы (Гипотезы):</div>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {entityData.hypotheses.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </div>
                )}
                
                <div className="platform-grid">
                  {Object.entries(entityData.platforms || {}).map(([platform, pData]) => (
                    <motion.div 
                      key={platform} 
                      className="platform-card"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="platform-name">
                        <Bot size={18} className="icon" /> {platform}
                      </div>
                      
                      {pData.status === 'loading' ? (
                        <div className="loading-pulse">Сбор информации...</div>
                      ) : (
                        <div className="platform-result">{pData.text}</div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}

export default App;
