import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, MessageSquare, Heart, ShieldAlert, Meh, Smile, Frown, Flame, Ghost, History, Trash2, Loader2 } from 'lucide-react';

// Configuration
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

const App = () => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            setText(prev => prev + event.results[i][0].transcript + ' ');
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech Recognition Error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const analyzeSentiment = async (textToAnalyze) => {
    if (!textToAnalyze.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    const systemPrompt = `Eres un experto en análisis de sentimientos. Analiza el texto proporcionado y devuelve un objeto JSON estrictamente con la siguiente estructura: 
    { 
      "sentiment": "Feliz" | "Triste" | "Enojado" | "Neutral" | "Sorprendido" | "Ansioso" | "Amoroso",
      "confidence": número del 0 al 1,
      "explanation": "Una breve explicación de una frase sobre por qué tiene ese sentimiento",
      "color": "un código hex de color que represente la emoción"
    }`;

    const payload = {
      contents: [{ parts: [{ text: textToAnalyze }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { responseMimeType: "application/json" }
    };

    let retries = 0;
    const maxRetries = 5;

    const performFetch = async () => {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Error en la comunicación con la IA');

        const data = await response.json();
        const analysis = JSON.parse(data.candidates[0].content.parts[0].text);
        
        const resultWithId = { ...analysis, id: Date.now(), originalText: textToAnalyze };
        setResults(resultWithId);
        setHistory(prev => [resultWithId, ...prev].slice(0, 10));
        setIsAnalyzing(false);
      } catch (err) {
        if (retries < maxRetries) {
          retries++;
          setTimeout(performFetch, Math.pow(2, retries) * 1000);
        } else {
          setError("No pudimos analizar el sentimiento. Por favor, intenta de nuevo.");
          setIsAnalyzing(false);
        }
      }
    };

    performFetch();
  };

  const getEmoji = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'feliz': return <Smile size={48} className="text-yellow-400" />;
      case 'triste': return <Frown size={48} className="text-blue-400" />;
      case 'enojado': return <Flame size={48} className="text-red-500" />;
      case 'sorprendido': return <Ghost size={48} className="text-purple-400" />;
      case 'ansioso': return <ShieldAlert size={48} className="text-orange-400" />;
      case 'amoroso': return <Heart size={48} className="text-pink-400" />;
      default: return <Meh size={48} className="text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600 text-white rounded-2xl shadow-lg mb-4">
            <MessageSquare size={32} />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Sentia</h1>
          <p className="text-slate-500 mt-2">¿Cómo te sientes hoy? Escríbelo o dímelo en voz alta.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Input Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100 overflow-hidden relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe algo aquí o usa el micrófono..."
                className="w-full h-40 p-4 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 rounded-2xl resize-none text-lg transition-all"
              />
              
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={toggleListening}
                  className={`p-4 rounded-full transition-all transform active:scale-95 ${
                    isListening 
                      ? 'bg-red-100 text-red-600 animate-pulse shadow-red-200 shadow-lg' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={isListening ? "Detener grabación" : "Hablar"}
                >
                  {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={() => analyzeSentiment(text)}
                  disabled={!text.trim() || isAnalyzing}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Analizar Tono
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Analysis Result Display */}
            {results && (
              <div 
                className="bg-white rounded-3xl shadow-xl p-8 border-l-8 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ borderLeftColor: results.color }}
              >
                <div className="flex items-start gap-6">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    {getEmoji(results.sentiment)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-3xl font-bold text-slate-800">{results.sentiment}</h2>
                      <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-sm font-medium">
                        {(results.confidence * 100).toFixed(0)}% confianza
                      </span>
                    </div>
                    <p className="text-slate-600 text-lg leading-relaxed">{results.explanation}</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-center">
                {error}
              </div>
            )}
          </div>

          {/* Sidebar / History */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-slate-100 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <History size={18} />
                  Recientes
                </h3>
                <button 
                  onClick={() => setHistory([])}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                {history.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-10 italic">Tu historial aparecerá aquí.</p>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200 group"
                      onClick={() => {
                        setText(item.originalText);
                        setResults(item);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {item.sentiment}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 transition-opacity">
                          Click para ver
                        </div>
                      </div>
                      <p className="text-slate-700 text-sm line-clamp-2 mt-1 italic">
                        "{item.originalText}"
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <footer className="mt-12 text-center text-slate-400 text-sm">
          <p>© 2024 Sentia App • Creado con IA por Isa</p>
          <p className="mt-1">Nota: El reconocimiento de voz funciona mejor en navegadores basados en Chromium.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
