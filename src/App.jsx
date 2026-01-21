import React, { useState, useEffect, useRef } from 'react';
import { Check, RotateCcw, Download, Upload, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, User } from 'lucide-react';

const ArabicAnnotationTool = () => {
  const [sentences, setSentences] = useState([]);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const [selectedCharIdx, setSelectedCharIdx] = useState(0);
  const [corrections, setCorrections] = useState({});
  const [history, setHistory] = useState([]);
  const [annotatorName, setAnnotatorName] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const fileInputRef = useRef(null);

  const diacritics = [
    { name: 'Fatha', symbol: '\u064E', key: '1' },
    { name: 'Damma', symbol: '\u064F', key: '2' },
    { name: 'Kasra', symbol: '\u0650', key: '3' },
    { name: 'Sukun', symbol: '\u0652', key: '4' },
    { name: 'Shadda', symbol: '\u0651', key: '5' },
    { name: 'Tanwin F', symbol: '\u064B', key: '6' },
    { name: 'Tanwin D', symbol: '\u064C', key: '7' },
    { name: 'Tanwin K', symbol: '\u064D', key: '8' },
    { name: 'Sh+Fatha', symbol: '\u0651\u064E', key: '9' },
    { name: 'Sh+Damma', symbol: '\u0651\u064F', key: 'Q' },
    { name: 'Sh+Kasra', symbol: '\u0651\u0650', key: 'W' },
    { name: 'Remove', symbol: '', key: '0' },
  ];

  const parseText = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map((line, lineIdx) => {
      const words = [];
      let currentWord = [];
      let charIndexInSentence = 0;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === ' ') {
          if (currentWord.length > 0) {
            words.push([...currentWord]);
            currentWord = [];
          }
        } else {
          const isDiacritic = char.charCodeAt(0) >= 0x064B && char.charCodeAt(0) <= 0x0652;
          
          if (isDiacritic) {
            if (currentWord.length > 0) {
              currentWord[currentWord.length - 1].diacritic += char;
            }
          } else {
            currentWord.push({
              char: char,
              diacritic: '',
              globalIndex: charIndexInSentence++,
              sentenceIdx: lineIdx
            });
          }
        }
      }
      
      if (currentWord.length > 0) {
        words.push([...currentWord]);
      }
      
      return {
        original: line,
        words: words,
        lineIdx: lineIdx
      };
    });
  };

  const getCurrentChar = () => {
    if (!sentences[currentSentenceIdx]) return null;
    const allChars = sentences[currentSentenceIdx].words.flat();
    return allChars[selectedCharIdx];
  };

  const getTotalCharsInSentence = () => {
    if (!sentences[currentSentenceIdx]) return 0;
    return sentences[currentSentenceIdx].words.flat().length;
  };

  const updateDiacritic = (newDiacritic) => {
    const currentChar = getCurrentChar();
    if (!currentChar) return;

    const key = `${currentSentenceIdx}-${currentChar.globalIndex}`;
    const oldValue = corrections[key] || currentChar.diacritic;
    
    setCorrections({
      ...corrections,
      [key]: newDiacritic
    });

    setHistory([...history, {
      sentenceIdx: currentSentenceIdx,
      charIdx: currentChar.globalIndex,
      char: currentChar.char,
      old: oldValue,
      new: newDiacritic,
      timestamp: new Date()
    }]);
  };

  const navigateChar = (direction) => {
    const total = getTotalCharsInSentence();
    if (direction === 'next') {
      if (selectedCharIdx < total - 1) {
        setSelectedCharIdx(selectedCharIdx + 1);
      }
    } else {
      if (selectedCharIdx > 0) {
        setSelectedCharIdx(selectedCharIdx - 1);
      }
    }
  };

  const navigateSentence = (direction) => {
    if (direction === 'next' && currentSentenceIdx < sentences.length - 1) {
      setCurrentSentenceIdx(currentSentenceIdx + 1);
      setSelectedCharIdx(0);
    } else if (direction === 'prev' && currentSentenceIdx > 0) {
      setCurrentSentenceIdx(currentSentenceIdx - 1);
      setSelectedCharIdx(0);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateSentence('prev');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateSentence('next');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateChar('prev');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateChar('next');
    }
    
    const diacritic = diacritics.find(d => d.key === e.key);
    if (diacritic) {
      e.preventDefault();
      updateDiacritic(diacritic.symbol);
      navigateChar('next');
    }
    
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCharIdx, currentSentenceIdx, corrections, sentences]);

  const undo = () => {
    if (history.length === 0) return;
    
    const last = history[history.length - 1];
    const key = `${last.sentenceIdx}-${last.charIdx}`;
    const newCorrections = { ...corrections };
    
    if (last.old) {
      newCorrections[key] = last.old;
    } else {
      delete newCorrections[key];
    }
    
    setCorrections(newCorrections);
    setHistory(history.slice(0, -1));
  };

  const loadFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setSentences(parseText(text));
      setCurrentSentenceIdx(0);
      setSelectedCharIdx(0);
      setCorrections({});
      setHistory([]);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const exportResults = () => {
    if (!annotatorName.trim()) {
      setShowNameDialog(true);
      return;
    }

    const correctedText = sentences.map((sentence, sIdx) => {
      return sentence.words.map(word => {
        return word.map(charObj => {
          const key = `${sIdx}-${charObj.globalIndex}`;
          const diacritic = corrections[key] !== undefined ? corrections[key] : charObj.diacritic;
          return charObj.char + diacritic;
        }).join('');
      }).join(' ');
    }).join('\n');

    const report = {
      annotator: annotatorName,
      exportDate: new Date().toISOString(),
      totalSentences: sentences.length,
      totalCorrections: history.length,
      corrections: history.map(h => ({
        sentence: h.sentenceIdx + 1,
        character: h.char,
        position: h.charIdx + 1,
        oldDiacritic: h.old || 'none',
        newDiacritic: h.new || 'none',
        timestamp: h.timestamp.toISOString()
      }))
    };

    const textBlob = new Blob([correctedText], { type: 'text/plain;charset=utf-8' });
    const textUrl = URL.createObjectURL(textBlob);
    const textLink = document.createElement('a');
    textLink.href = textUrl;
    textLink.download = `${annotatorName}_vocalized_output.txt`;
    textLink.click();

    const reportBlob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const reportUrl = URL.createObjectURL(reportBlob);
    const reportLink = document.createElement('a');
    reportLink.href = reportUrl;
    reportLink.download = `${annotatorName}_annotation_report.json`;
    reportLink.click();

    alert(`Exported:\n- ${annotatorName}_vocalized_output.txt\n- ${annotatorName}_annotation_report.json`);
  };

  const getDiacriticForChar = (charObj) => {
    const key = `${charObj.sentenceIdx}-${charObj.globalIndex}`;
    return corrections[key] !== undefined ? corrections[key] : charObj.diacritic;
  };

  const isCharCorrected = (charObj) => {
    const key = `${charObj.sentenceIdx}-${charObj.globalIndex}`;
    return corrections[key] !== undefined;
  };

  if (sentences.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Arabic Vocalization Tool</h1>
          <p className="text-gray-600 mb-6">Load a text file to begin annotation</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={loadFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 mx-auto"
          >
            <Upload size={20} />
            Load Text File
          </button>
          <p className="text-sm text-gray-500 mt-4">
            Supported format: Plain text (.txt) with Arabic text
          </p>
        </div>
      </div>
    );
  }

  const currentSentence = sentences[currentSentenceIdx];
  const currentChar = getCurrentChar();
  const totalChars = getTotalCharsInSentence();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {showNameDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Enter Your Name</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your name will be used to label the output files
              </p>
              <input
                type="text"
                value={annotatorName}
                onChange={(e) => setAnnotatorName(e.target.value)}
                placeholder="e.g., Ahmed_Ali"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded focus:border-blue-500 focus:outline-none mb-4"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && annotatorName.trim()) {
                    setShowNameDialog(false);
                    exportResults();
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNameDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (annotatorName.trim()) {
                      setShowNameDialog(false);
                      exportResults();
                    }
                  }}
                  disabled={!annotatorName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Arabic Vocalization Tool</h1>
              <p className="text-sm text-gray-600">
                Sentence {currentSentenceIdx + 1}/{sentences.length} • 
                Char {selectedCharIdx + 1}/{totalChars} • 
                {history.length} corrections
                {annotatorName && <span className="ml-2">• Annotator: <strong>{annotatorName}</strong></span>}
              </p>
            </div>
            <div className="flex gap-2">
              {!annotatorName && (
                <button
                  onClick={() => setShowNameDialog(true)}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-2"
                >
                  <User size={16} />
                  Set Name
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={loadFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                <Upload size={16} />
                Load File
              </button>
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Undo
              </button>
              <button
                onClick={exportResults}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateSentence('prev')}
              disabled={currentSentenceIdx === 0}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 bg-gray-100 rounded px-3 py-1 text-sm text-center">
              Sentence Navigation (↑/↓)
            </div>
            <button
              onClick={() => navigateSentence('next')}
              disabled={currentSentenceIdx === sentences.length - 1}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-300 mb-4" dir="rtl">
              <h3 className="text-sm font-semibold text-green-800 mb-3 text-left" dir="ltr">
                📖 Natural Reading Preview
              </h3>
              <div className="text-3xl leading-relaxed text-gray-800" style={{ fontFamily: 'Amiri, Arial' }}>
                {currentSentence.words.map((word, wIdx) => (
                  <React.Fragment key={wIdx}>
                    {word.map((charObj, cIdx) => {
                      const diacritic = getDiacriticForChar(charObj);
                      return (
                        <span key={cIdx}>
                          {charObj.char}{diacritic}
                        </span>
                      );
                    })}
                    {wIdx < currentSentence.words.length - 1 && ' '}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-8 border-2 border-amber-200 mb-4" dir="rtl">
              <div className="text-4xl leading-loose flex flex-wrap items-center justify-end gap-2" style={{ fontFamily: 'Amiri, Arial', direction: 'rtl' }}>
                {currentSentence.words.map((word, wIdx) => (
                  <React.Fragment key={wIdx}>
                    <span className="inline-flex bg-white rounded px-2 py-1 shadow-sm border border-amber-300">
                      {word.map((charObj, cIdx) => {
                        const isSelected = charObj.globalIndex === selectedCharIdx;
                        const diacritic = getDiacriticForChar(charObj);
                        const isCorrected = isCharCorrected(charObj);
                        
                        return (
                          <span
                            key={cIdx}
                            onClick={() => setSelectedCharIdx(charObj.globalIndex)}
                            className={`
                              relative inline-block px-0.5 cursor-pointer rounded transition-all
                              ${isSelected ? 'bg-blue-300 ring-4 ring-blue-500 scale-125 z-10' : ''}
                              ${isCorrected && !isSelected ? 'bg-orange-100' : ''}
                              ${!isSelected ? 'hover:bg-blue-100' : ''}
                            `}
                          >
                            {charObj.char}{diacritic}
                            {isCorrected && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
                            )}
                          </span>
                        );
                      })}
                    </span>
                    {wIdx < currentSentence.words.length - 1 && (
                      <span className="inline-block w-0.5 h-8 bg-amber-300 opacity-40 mx-1"></span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => navigateChar('prev')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                <ArrowRight size={16} />
                Previous (→)
              </button>
              <div className="flex-1 text-center bg-blue-50 rounded py-2 border border-blue-200">
                {currentChar && (
                  <span className="text-4xl" style={{ fontFamily: 'Amiri' }}>
                    {currentChar.char}{getDiacriticForChar(currentChar)}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigateChar('next')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                Next (←)
                <ArrowLeft size={16} />
              </button>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Diacritic (or press number key)</h3>
              <div className="grid grid-cols-6 gap-2">
                {diacritics.map((d, idx) => {
                  const currentDiacritic = currentChar ? getDiacriticForChar(currentChar) : '';
                  const isActive = currentDiacritic === d.symbol;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        updateDiacritic(d.symbol);
                        navigateChar('next');
                      }}
                      className={`
                        p-3 rounded border-2 transition-all hover:scale-105
                        ${isActive 
                          ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-400' 
                          : 'bg-white border-gray-300 hover:border-blue-400'}
                      `}
                    >
                      <div className="text-2xl mb-1" style={{ fontFamily: 'Amiri' }}>
                        {currentChar ? currentChar.char : 'ل'}{d.symbol}
                      </div>
                      <div className="text-xs font-mono">{d.key}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <User size={16} />
                Annotator
              </h3>
              {annotatorName ? (
                <div className="text-sm">
                  <div className="p-2 bg-purple-50 rounded border border-purple-200">
                    <div className="font-mono text-purple-700">{annotatorName}</div>
                  </div>
                  <button
                    onClick={() => setShowNameDialog(true)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Change name
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNameDialog(true)}
                  className="w-full px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm"
                >
                  Set your name
                </button>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-3">⌨️ Navigation</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Next char</span>
                  <kbd className="px-2 py-1 bg-gray-200 rounded">←</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Prev char</span>
                  <kbd className="px-2 py-1 bg-gray-200 rounded">→</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Next phrase</span>
                  <kbd className="px-2 py-1 bg-gray-200 rounded">↓</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Prev phrase</span>
                  <kbd className="px-2 py-1 bg-gray-200 rounded">↑</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Undo</span>
                  <kbd className="px-2 py-1 bg-gray-200 rounded">Ctrl+Z</kbd>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Diacritics</h3>
              <div className="space-y-1 text-xs">
                {diacritics.slice(0, 8).map((d, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{d.name}</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">{d.key}</kbd>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-3">📊 Progress</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total sentences</span>
                  <span className="font-bold">{sentences.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Corrections</span>
                  <span className="font-bold text-orange-600">{history.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current line</span>
                  <span className="font-bold text-blue-600">{currentSentenceIdx + 1}</span>
                </div>
              </div>
            </div>

            {history.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Recent</h3>
                <div className="space-y-1 text-xs max-h-40 overflow-y-auto">
                  {history.slice(-8).reverse().map((item, idx) => (
                    <div key={idx} className="p-2 bg-orange-50 rounded">
                      <div className="font-mono">
                        L{item.sentenceIdx + 1}: {item.char}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900">
            <strong>💡 Quick Start:</strong> Words are separated by light bars for clarity while maintaining natural Arabic flow. 
            Use left/right arrows (← →) to navigate characters within the current phrase. 
            Use up/down arrows (↑ ↓) to switch between phrases. 
            Press number keys 1-9 to apply diacritics. Set your name to export files as <strong>YourName_vocalized_output.txt</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ArabicAnnotationTool;