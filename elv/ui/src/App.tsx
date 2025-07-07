import { useState, useEffect } from 'react';
import './App.css';

interface VSCodeMessage {
  command: 'analyzeCode' | 'analysisResult';
  code?: string;
  result?: string;
}

declare global {
  function acquireVsCodeApi(): {
    postMessage: (message: VSCodeMessage) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
  };
}

const vscode = acquireVsCodeApi();

function App() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<VSCodeMessage>) => {
      const message = event.data;
      if (message.command === 'analysisResult') {
        setResult(message.result ?? 'No result provided');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const analyzeCode = () => {
    if (!code.trim()) {
      setResult('⚠️ Please paste Python code before analyzing.');
      return;
    }

    vscode.postMessage({
      command: 'analyzeCode',
      code,
    });
  };

  return (
    <div className="container">
      <h1>ELEVATE: Python Code Analyzer</h1>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={12}
        cols={70}
        placeholder="Paste your Python code here..."
        style={{ fontFamily: 'monospace', fontSize: '14px', width: '100%' }}
      />

      <br />
      <button onClick={analyzeCode} style={{ marginTop: '10px' }}>
        Analyze Code
      </button>

    {result && (() => {
      try {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          return (
            <div style={{ marginTop: '20px' }}>
              <h2>LLM Analysis Result:</h2>
              {parsed.length === 0 ? (
                <p>No issues found 🎉</p>
              ) : (
                <ul>
                  {parsed.map((item, index) => (
                    <li key={index} style={{ marginBottom: '10px' }}>
                      On <strong>line {item.line}</strong>, the LLM reported a <strong>{item.severity}</strong>:
                      <br />
                      <em>{item.message}</em>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        } else {
          return <p>{result}</p>; // fallback for unexpected format
        }
      } catch {
        return <p>{result}</p>; // fallback if JSON parsing fails
      }
    })()}
    </div>
  );
}

export default App;
