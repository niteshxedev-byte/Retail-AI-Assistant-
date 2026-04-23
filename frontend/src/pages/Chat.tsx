import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus,
  Mic,
  Menu,
  X,
  Settings,
  LogOut,
  Send,
  Loader2,
  Wrench,
  ChevronDown,
  Brain,
  Play
} from 'lucide-react';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';

const Chat: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [messages, setMessages] = useState<any[]>([
    { text: "Hey—what's up?", sender: "ai", timestamp: new Date() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [testQueue, setTestQueue] = useState<string[]>([]);
  const [toolCalls, setToolCalls] = useState<{name: string, input: string}[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<{type: string, name?: string, input?: string, result?: string}[]>([]);
  const [liveAnalysis, setLiveAnalysis] = useState<string>('');
  const socketRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, thinkingSteps]);

  useEffect(() => {
    // Auth check
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));

    // Socket Setup
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const socketUrl = apiUrl.endsWith('/api') ? apiUrl.replace('/api', '') : apiUrl;
    socketRef.current = io(socketUrl);

    socketRef.current.on('agent-response', (data: any) => {
      setMessages(prev => {
        // Attach the thinking trace to this AI message
        return [...prev, { ...data, thinkingTrace: [...thinkingStepsRef.current] }];
      });
    });

    socketRef.current.on('agent-status', (status: string) => {
      setIsTyping(status === 'thinking');
      if (status === 'thinking') {
        setThinkingSteps([]);
        setToolCalls([]);
        thinkingStepsRef.current = [];
        setLiveAnalysis('');
      }
      if (status === 'idle') {
        setToolCalls([]);
      }
    });

    socketRef.current.on('agent-tool-call', (data: {name: string, input: string}) => {
      setToolCalls(prev => [...prev, data]);
      const step = { type: 'call' as const, name: data.name, input: data.input };
      setThinkingSteps(prev => [...prev, step]);
      thinkingStepsRef.current.push(step);
    });

    socketRef.current.on('agent-tool-result', (result: string) => {
      const step = { type: 'result' as const, result };
      setThinkingSteps(prev => [...prev, step]);
      thinkingStepsRef.current.push(step);
      setLiveAnalysis(prev => prev ? prev + '\n\n✓ Data retrieved. Formatting final response...' : '✓ Data retrieved. Formatting final response...');
    });

    socketRef.current.on('agent-thought', (thought: string) => {
      if (thought.trim()) {
        const step = { type: 'thought' as const, thought };
        setThinkingSteps(prev => [...prev, step]);
        thinkingStepsRef.current.push(step);
      }
    });

    socketRef.current.on('agent-analysis-chunk', (chunk: string) => {
      setLiveAnalysis(prev => prev + chunk);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [navigate]);

  const thinkingStepsRef = useRef<any[]>([]);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    const originalInput = inputValue;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setInputValue((originalInput ? originalInput + ' ' : '') + currentTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = {
      text: inputValue,
      sender: "user" as const,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    setThinkingSteps([]);
    setLiveAnalysis('');
    
    // Send to backend
    socketRef.current?.emit('user-message', {
      message: userMessage.text,
      history: messages.map(m => [m.sender === 'user' ? 'human' : 'ai', m.text])
    });
  };

  const startAutomatedTests = () => {
    setTestQueue([
      "I need a modest evening gown under $300 in size 8. I prefer something on sale.", // Shopping Scenario 1
      "Do you have any fitted bridal dresses around $400 in size 12?", // Shopping Scenario 2
      "What are your highest rated quinceanera dresses?", // Shopping Scenario 3 (tests bestseller score)
      "Can you give me the details for order O0045?", // Support Scenario 1
      "Order O0016 — I bought this dress recently. It doesn't fit. Can I return it?", // Support Scenario 2
      "What is your return policy for clearance items?", // Support Scenario 3 (general policy)
      "Order 1043 — I bought this dress last week. It doesn't fit. Can I return it?", // Edge Case (Invalid Order)
      "Do you sell any men's tuxedos?", // Edge Case (Hallucination Check)
      "What is the weather like today?", // Out of Context 1
      "Can you write a Python script for me?" // Out of Context 2
    ]);
  };
   
  useEffect(() => {
    if (testQueue.length > 0 && !isTyping) {
      const nextQuery = testQueue[0];
      setTestQueue(prev => prev.slice(1));
      
      const userMessage = {
        text: nextQuery,
        sender: "user" as const,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, userMessage]);
      setIsTyping(true);
      setThinkingSteps([]);
      setLiveAnalysis('');
      
      socketRef.current?.emit('user-message', {
        message: nextQuery,
        history: messages.map(m => [m.sender === 'user' ? 'human' : 'ai', m.text])
      });
    }
  }, [testQueue, isTyping]);

  return (
    <div className="relative flex flex-col h-screen bg-slate-50 font-sans selection:bg-indigo-500/30 overflow-hidden">
      
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-white/90 backdrop-blur-2xl border-r border-slate-200 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        
        {/* Sidebar Header (User Info) */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <h3 className="font-semibold text-slate-800 truncate">{user?.name || 'User'}</h3>
              <p className="text-xs text-slate-500 truncate">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto p-4">
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <Settings className="w-4 h-4 text-slate-400" />
            Settings
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            Log Out
          </button>
        </div>
      </div>

      {/* Light Mode Dynamic Background Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-200/40 rounded-full mix-blend-multiply filter blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-200/40 rounded-full mix-blend-multiply filter blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] z-0"></div>

      {/* Header */}
      <header className="relative z-10 flex items-center px-4 py-3 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center gap-1.5 p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold text-slate-800">
              Retail AI Assistant
            </span>
          </div>
          <button
            onClick={startAutomatedTests}
            disabled={isTyping || testQueue.length > 0}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 sm:gap-2 transition-all ${
              isTyping || testQueue.length > 0 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 active:scale-95 shadow-sm'
            }`}
          >
            {testQueue.length > 0 ? (
              <><Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> Running ({testQueue.length} left)</>
            ) : (
              <><Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Run Tests</>
            )}
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 pb-36">
        <div className="max-w-3xl mx-auto flex flex-col gap-6 pt-8">

          {/* Tools Overview Card */}
          {messages.length <= 1 && (
            <div className="bg-white/70 backdrop-blur-md border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Brain className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-base">Available Tools</h3>
              </div>
              <p className="text-sm text-slate-500">I use these tools to answer your questions with real data — no guessing.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: "search_products", desc: "Find dresses by price, size, style & more", example: "\"Show me modest gowns under $200 in size 8\"" },
                  { name: "get_product", desc: "Get full details on any product", example: "\"Tell me about P0001\"" },
                  { name: "get_order", desc: "Look up any order by ID", example: "\"What's in order O0001?\"" },
                  { name: "evaluate_return", desc: "Check if an order is returnable", example: "\"Can I return order O0001?\"" },
                ].map((tool, i) => (
                  <button
                    key={i}
                    onClick={() => setInputValue(tool.example.replace(/"/g, ''))}
                    className="text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl p-3.5 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-bold text-indigo-600">{tool.name}</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-1.5">{tool.desc}</p>
                    <p className="text-[11px] text-slate-400 italic group-hover:text-indigo-400 transition-colors">Try: {tool.example}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} w-full`}>
              <div className={`px-5 py-3.5 rounded-2xl shadow-sm max-w-[85%] text-[15px] leading-relaxed ${
                msg.sender === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-sm whitespace-pre-wrap' 
                : 'bg-white/80 backdrop-blur-md border border-slate-200 text-slate-800 rounded-tl-sm'
              }`}>
                {msg.sender === 'ai' ? (
                  <div className="prose prose-sm prose-slate max-w-none [&_strong]:text-indigo-700 [&_strong]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:mt-1 [&_ul]:mb-1 [&_li]:my-0.5 [&_p]:my-1 [&_hr]:my-3 [&_hr]:border-slate-200">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>

              {/* Collapsible thinking trace for AI messages */}
              {msg.sender === 'ai' && msg.thinkingTrace && msg.thinkingTrace.length > 0 && (
                <details className="mt-2 max-w-[85%] w-full">
                  <summary className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 cursor-pointer select-none transition-colors py-1">
                    <Brain className="w-3.5 h-3.5" />
                    <span>View thinking ({msg.thinkingTrace.filter((s: any) => s.type === 'call').length} tool calls)</span>
                    <ChevronDown className="w-3 h-3 ml-auto" />
                  </summary>
                  <div className="mt-1 pl-3 border-l-2 border-indigo-200 space-y-2 py-2">
                    {msg.thinkingTrace.map((step: any, si: number) => (
                      <div key={si}>
                        {step.type === 'thought' && (
                          <p className="text-xs text-slate-500 italic leading-relaxed bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            💭 {step.thought}
                          </p>
                        )}
                        {step.type === 'call' && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-semibold">
                              <Wrench className="w-3 h-3" />
                              {step.name}
                            </span>
                            <span className="text-slate-400 truncate max-w-[200px]" title={step.input}>{step.input}</span>
                          </div>
                        )}
                        {step.type === 'result' && (
                          <pre className="text-slate-500 bg-slate-50 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed max-h-48 overflow-y-auto border border-slate-100 whitespace-pre-wrap">
                            {(() => {
                              try {
                                return step.result ? JSON.stringify(JSON.parse(step.result), null, 2) : '';
                              } catch (e) {
                                return step.result || '';
                              }
                            })()}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}

          {/* Live thinking panel while processing */}
          {isTyping && (
            <div className="flex justify-start w-full">
              <div className="bg-white/80 backdrop-blur-md border border-slate-200 px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm space-y-3 max-w-[85%] w-full">
                
                {/* Live thinking steps */}
                {thinkingSteps.length > 0 && (
                  <div className="pl-3 border-l-2 border-indigo-200 space-y-2">
                    {thinkingSteps.map((step, i) => (
                      <div key={i}>
                        {step.type === 'thought' && (
                          <p className="text-xs text-slate-500 italic bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                            💭 {(step as any).thought}
                          </p>
                        )}
                        {step.type === 'call' && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full font-semibold">
                              <Wrench className="w-3 h-3" />
                              {step.name}
                            </span>
                            <span className="text-slate-400 truncate max-w-[200px]" title={step.input}>{step.input}</span>
                          </div>
                        )}
                        {step.type === 'result' && (
                          <pre className="text-slate-500 bg-slate-50 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed max-h-48 overflow-y-auto border border-slate-100 whitespace-pre-wrap">
                            {(() => {
                              try {
                                return step.result ? JSON.stringify(JSON.parse(step.result), null, 2) : '';
                              } catch (e) {
                                return step.result || '';
                              }
                            })()}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Live Analysis Stream */}
                {liveAnalysis && (
                  <div className="pl-3 border-l-2 border-indigo-200">
                    <p className="text-xs text-slate-500 italic bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">
                      🧠 {liveAnalysis}
                      <span className="animate-pulse font-bold text-indigo-500 ml-1">|</span>
                    </p>
                  </div>
                )}

                {/* Spinner */}
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium italic">
                    {toolCalls.length > 0 ? `Using ${toolCalls[toolCalls.length - 1].name}...` : 'Assistant is thinking...'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="fixed bottom-0 w-full z-20 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent pt-8 pb-6 px-4">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={handleSendMessage}
            className="relative flex items-center bg-white/90 backdrop-blur-xl border border-slate-200 rounded-full p-2 pr-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-shadow focus-within:shadow-[0_8px_40px_rgb(99,102,241,0.15)] focus-within:border-indigo-300"
          >
            <button type="button" className="p-2.5 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors shrink-0">
              <Plus className="w-5 h-5" />
            </button>
            
            <input 
              type="text" 
              placeholder="Ask me about products or returns..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 px-3 py-3 text-[15px] font-medium"
            />
            
            <button 
              type="button" 
              onClick={toggleListening}
              className={`p-2.5 rounded-full transition-colors shrink-0 mr-1 ${
                isListening 
                  ? 'text-red-500 bg-red-50 hover:bg-red-100' 
                  : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              {isListening ? (
                <div className="relative">
                  <Mic className="w-5 h-5 relative z-10 animate-pulse" />
                  <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-20"></span>
                </div>
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            
            <button 
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className={`w-11 h-11 flex items-center justify-center rounded-full transition-all shrink-0 shadow-md ${
                !inputValue.trim() || isTyping 
                ? 'bg-slate-100 text-slate-400' 
                : 'bg-slate-900 text-white hover:bg-indigo-600 hover:scale-105 active:scale-95'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          
          <div className="text-center mt-4 text-xs font-medium text-slate-500">
           AI Agent can make mistakes. Check important info.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Chat;
