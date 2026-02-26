import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Check, RotateCcw, Download, Upload, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, User } from 'lucide-react';

const ArabicAnnotationTool = () => {
  const [sentences, setSentences] = useState([]);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const [selectedCharIdx, setSelectedCharIdx] = useState(0);
  const [corrections, setCorrections] = useState({});
  const [history, setHistory] = useState([]);
  const [annotatorName, setAnnotatorName] = useState('');
  const [inputFileName, setInputFileName] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);
  // A counter that increments on every correction to force re-render
  const [correctionVersion, setCorrectionVersion] = useState(0);
  const fileInputRef = useRef(null);
  const recoveryFileInputRef = useRef(null);

  // Use refs to always have current values in event handlers (avoids stale closures)
  const sentencesRef = useRef(sentences);
  const currentSentenceIdxRef = useRef(currentSentenceIdx);
  const selectedCharIdxRef = useRef(selectedCharIdx);
  const correctionsRef = useRef(corrections);
  const historyRef = useRef(history);

  useEffect(() => { sentencesRef.current = sentences; }, [sentences]);
  useEffect(() => { currentSentenceIdxRef.current = currentSentenceIdx; }, [currentSentenceIdx]);
  useEffect(() => { selectedCharIdxRef.current = selectedCharIdx; }, [selectedCharIdx]);
  useEffect(() => { correctionsRef.current = corrections; }, [corrections]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const diacritics = [
    { name: 'No Diacritic', symbol: '', key: '0' },
    { name: 'Fatha', symbol: '\u064E', key: '1' },
    { name: 'Damma', symbol: '\u064F', key: '2' },
    { name: 'Kasra', symbol: '\u0650', key: '3' },
    { name: 'Sukoon', symbol: '\u0652', key: '4' },
    { name: 'Shadda', symbol: '\u0651', key: '5' },
    { name: 'Sh+Fatha', symbol: '\u0651\u064E', key: '6' },
    { name: 'Sh+Damma', symbol: '\u0651\u064F', key: '7' },
    { name: 'Sh+Kasra', symbol: '\u0651\u0650', key: '8' },
    { name: 'Sh+Sukoon', symbol: '\u0651\u0652', key: '9' },
    { name: 'Fathatan', symbol: '\u064B', key: 'Q' },
    { name: 'Dammatan', symbol: '\u064C', key: 'W' },
    { name: 'Kasratan', symbol: '\u064D', key: 'E' },
    { name: 'Sh+Fathatan', symbol: '\u0651\u064B', key: 'R' },
    { name: 'Sh+Dammatan', symbol: '\u0651\u064C', key: 'T' },
    { name: 'Sh+Kasratan', symbol: '\u0651\u064D', key: 'Y' },
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

  const getCurrentChar = useCallback(() => {
    if (!sentences[currentSentenceIdx]) return null;
    const allChars = sentences[currentSentenceIdx].words.flat();
    return allChars[selectedCharIdx];
  }, [sentences, currentSentenceIdx, selectedCharIdx]);

  const getTotalCharsInSentence = useCallback(() => {
    if (!sentences[currentSentenceIdx]) return 0;
    return sentences[currentSentenceIdx].words.flat().length;
  }, [sentences, currentSentenceIdx]);

  // Helper that reads from refs (for use inside keydown handler)
  const getCurrentCharFromRef = () => {
    const sents = sentencesRef.current;
    const sIdx = currentSentenceIdxRef.current;
    const cIdx = selectedCharIdxRef.current;
    if (!sents[sIdx]) return null;
    const allChars = sents[sIdx].words.flat();
    return allChars[cIdx];
  };

  const getTotalCharsFromRef = () => {
    const sents = sentencesRef.current;
    const sIdx = currentSentenceIdxRef.current;
    if (!sents[sIdx]) return 0;
    return sents[sIdx].words.flat().length;
  };

  const updateDiacritic = useCallback((newDiacritic) => {
    const currentChar = getCurrentChar();
    if (!currentChar) return;

    const key = `${currentSentenceIdx}-${currentChar.globalIndex}`;
    const oldValue = corrections[key] !== undefined ? corrections[key] : currentChar.diacritic;
    
    setCorrections(prev => ({
      ...prev,
      [key]: newDiacritic
    }));
    // Force re-render by bumping version
    setCorrectionVersion(v => v + 1);

    setHistory(prev => [...prev, {
      sentenceIdx: currentSentenceIdx,
      charIdx: currentChar.globalIndex,
      char: currentChar.char,
      old: oldValue,
      new: newDiacritic,
      timestamp: new Date()
    }]);
  }, [getCurrentChar, currentSentenceIdx, corrections]);

  const navigateChar = useCallback((direction) => {
    const total = getTotalCharsInSentence();
    if (direction === 'next') {
      setSelectedCharIdx(prev => prev < total - 1 ? prev + 1 : prev);
    } else {
      setSelectedCharIdx(prev => prev > 0 ? prev - 1 : prev);
    }
  }, [getTotalCharsInSentence]);

  const navigateSentence = useCallback((direction) => {
    if (direction === 'next') {
      setSentences(s => {
        if (currentSentenceIdxRef.current < s.length - 1) {
          setCurrentSentenceIdx(prev => prev + 1);
          setSelectedCharIdx(0);
        }
        return s;
      });
    } else if (direction === 'prev') {
      if (currentSentenceIdxRef.current > 0) {
        setCurrentSentenceIdx(prev => prev - 1);
        setSelectedCharIdx(0);
      }
    }
  }, []);

  const undo = useCallback(() => {
    setHistory(prevHistory => {
      if (prevHistory.length === 0) return prevHistory;
      
      const last = prevHistory[prevHistory.length - 1];
      const key = `${last.sentenceIdx}-${last.charIdx}`;
      
      setCorrections(prevCorr => {
        const newCorrections = { ...prevCorr };
        if (last.old) {
          newCorrections[key] = last.old;
        } else {
          delete newCorrections[key];
        }
        return newCorrections;
      });
      setCorrectionVersion(v => v + 1);
      
      return prevHistory.slice(0, -1);
    });
  }, []);

  // Stable keydown handler using refs to avoid stale closures
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentSentenceIdxRef.current > 0) {
        setCurrentSentenceIdx(prev => prev - 1);
        setSelectedCharIdx(0);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentSentenceIdxRef.current < sentencesRef.current.length - 1) {
        setCurrentSentenceIdx(prev => prev + 1);
        setSelectedCharIdx(0);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedCharIdx(prev => prev > 0 ? prev - 1 : prev);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const total = getTotalCharsFromRef();
      setSelectedCharIdx(prev => prev < total - 1 ? prev + 1 : prev);
    }
    
    const diacriticMatch = diacritics.find(d => d.key === e.key || d.key === e.key.toUpperCase());
    if (diacriticMatch) {
      e.preventDefault();
      
      const currentChar = getCurrentCharFromRef();
      if (!currentChar) return;
      
      const sIdx = currentSentenceIdxRef.current;
      const corr = correctionsRef.current;
      const key = `${sIdx}-${currentChar.globalIndex}`;
      const oldValue = corr[key] !== undefined ? corr[key] : currentChar.diacritic;
      
      setCorrections(prev => ({
        ...prev,
        [key]: diacriticMatch.symbol
      }));
      // Force re-render
      setCorrectionVersion(v => v + 1);

      setHistory(prev => [...prev, {
        sentenceIdx: sIdx,
        charIdx: currentChar.globalIndex,
        char: currentChar.char,
        old: oldValue,
        new: diacriticMatch.symbol,
        timestamp: new Date()
      }]);

      // Auto-advance to next character
      const total = getTotalCharsFromRef();
      setSelectedCharIdx(prev => prev < total - 1 ? prev + 1 : prev);
    }
    
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      setHistory(prevHistory => {
        if (prevHistory.length === 0) return prevHistory;
        const last = prevHistory[prevHistory.length - 1];
        const key = `${last.sentenceIdx}-${last.charIdx}`;
        setCorrections(prevCorr => {
          const newCorrections = { ...prevCorr };
          if (last.old) {
            newCorrections[key] = last.old;
          } else {
            delete newCorrections[key];
          }
          return newCorrections;
        });
        setCorrectionVersion(v => v + 1);
        return prevHistory.slice(0, -1);
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  const getFileBaseName = (filename) => {
    return filename.replace(/\.[^/.]+$/, '');
  };

  const getTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  };

  const loadFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const newSentences = parseText(text);
      
      const currentText = sentences.map(s => s.original).join('\n');
      const newText = newSentences.map(s => s.original).join('\n');
      
      if (currentText !== newText) {
        if (sentences.length > 0) {
          const confirmLoad = window.confirm(
            'Loading a new file will replace your current work. Are you sure you want to continue?'
          );
          if (!confirmLoad) return;
        }
        
        setSentences(newSentences);
        setCurrentSentenceIdx(0);
        setSelectedCharIdx(0);
        setCorrections({});
        setHistory([]);
        setInputFileName(file.name);
        setCorrectionVersion(0);
      } else {
        alert('This file contains the same text as currently loaded.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const loadRecoveryFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const recoveryData = JSON.parse(event.target.result);
        
        if (!recoveryData.sentences || !Array.isArray(recoveryData.sentences)) {
          alert('Invalid recovery file format.');
          return;
        }

        if (sentences.length > 0) {
          const confirmLoad = window.confirm(
            'Loading this recovery file will replace your current work. Continue?'
          );
          if (!confirmLoad) return;
        }

        setSentences(recoveryData.sentences);
        setCurrentSentenceIdx(recoveryData.currentSentenceIdx || 0);
        setSelectedCharIdx(recoveryData.selectedCharIdx || 0);
        setCorrections(recoveryData.corrections || {});
        
        const restoredHistory = (recoveryData.history || []).map(item => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setHistory(restoredHistory);
        
        setAnnotatorName(recoveryData.annotatorName || '');
        setInputFileName(recoveryData.inputFileName || '');
        setCorrectionVersion(v => v + 1);
        
        alert('Recovery file loaded successfully!');
      } catch (error) {
        alert('Error loading recovery file: ' + error.message);
      }
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

    const timestamp = getTimestamp();
    const baseInputName = inputFileName ? getFileBaseName(inputFileName) : 'arabic_text';
    const filePrefix = `${baseInputName}_${annotatorName}_${timestamp}`;

    const report = {
      annotator: annotatorName,
      inputFileName: inputFileName,
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

    const recoveryData = {
      sentences,
      currentSentenceIdx,
      selectedCharIdx,
      corrections,
      history,
      annotatorName,
      inputFileName,
      exportDate: new Date().toISOString()
    };

    const textBlob = new Blob([correctedText], { type: 'text/plain;charset=utf-8' });
    const textUrl = URL.createObjectURL(textBlob);
    const textLink = document.createElement('a');
    textLink.href = textUrl;
    textLink.download = `${filePrefix}_vocalized.txt`;
    textLink.click();

    const reportBlob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const reportUrl = URL.createObjectURL(reportBlob);
    const reportLink = document.createElement('a');
    reportLink.href = reportUrl;
    reportLink.download = `${filePrefix}_report.json`;
    reportLink.click();

    const recoveryBlob = new Blob([JSON.stringify(recoveryData, null, 2)], { type: 'application/json' });
    const recoveryUrl = URL.createObjectURL(recoveryBlob);
    const recoveryLink = document.createElement('a');
    recoveryLink.href = recoveryUrl;
    recoveryLink.download = `${filePrefix}_recovery.json`;
    recoveryLink.click();

    alert(`Exported:\n- ${filePrefix}_vocalized.txt\n- ${filePrefix}_report.json\n- ${filePrefix}_recovery.json`);
  };

  const getDiacriticForChar = (charObj) => {
    const key = `${charObj.sentenceIdx}-${charObj.globalIndex}`;
    if (corrections[key] !== undefined) {
      return corrections[key]; // This can be '' for "No Diacritic"
    }
    return charObj.diacritic;
  };

  const isCharCorrected = (charObj) => {
    const key = `${charObj.sentenceIdx}-${charObj.globalIndex}`;
    return corrections[key] !== undefined;
  };

  // Generate a unique key for each character span that includes the current diacritic value
  // This forces React to remount the span when the diacritic changes (especially '' vs a combining char)
  const getCharRenderKey = (charObj) => {
    const diacritic = getDiacriticForChar(charObj);
    // Encode the diacritic codepoints so React sees a different key
    const diacriticCode = diacritic ? [...diacritic].map(c => c.charCodeAt(0).toString(16)).join('_') : 'none';
    return `${charObj.sentenceIdx}-${charObj.globalIndex}-${diacriticCode}`;
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
          <input
            ref={recoveryFileInputRef}
            type="file"
            accept=".json"
            onChange={loadRecoveryFile}
            className="hidden"
          />
          
          <div className="space-y-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
            >
              <Upload size={20} />
              Load Text File
            </button>
            
            <button
              onClick={() => recoveryFileInputRef.current?.click()}
              className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2"
            >
              <RotateCcw size={20} />
              Load Recovery File
            </button>
          </div>
          
          <p className="text-sm text-gray-500 mt-4">
            Supported formats: Plain text (.txt) or Recovery backup (.json)
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
                {inputFileName && <span className="ml-2">• File: <strong>{inputFileName}</strong></span>}
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
                title="Export vocalized text, annotation report, and recovery backup"
              >
                <Download size={16} />
                Export
              </button>
              <input
                ref={recoveryFileInputRef}
                type="file"
                accept=".json"
                onChange={loadRecoveryFile}
                className="hidden"
              />
              <button
                onClick={() => recoveryFileInputRef.current?.click()}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-2"
                title="Load a previously saved recovery backup"
              >
                <RotateCcw size={16} />
                Recover
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
            {/* Natural Reading Preview - uses unique keys to force DOM update */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-300 mb-4" dir="rtl">
              <h3 className="text-sm font-semibold text-green-800 mb-3 text-left" dir="ltr">
                📖 Natural Reading Preview
              </h3>
              <div className="text-3xl leading-relaxed text-gray-800" style={{ fontFamily: 'Amiri, Arial' }}>
                {currentSentence.words.map((word, wIdx) => (
                  <React.Fragment key={wIdx}>
                    {word.map((charObj) => {
                      const diacritic = getDiacriticForChar(charObj);
                      // Use a key that changes when the diacritic changes,
                      // forcing React to replace the DOM node entirely.
                      // This is critical for Arabic combining characters —
                      // when removing a diacritic (setting to ''), the browser
                      // may not re-render if React only updates textContent.
                      const renderKey = getCharRenderKey(charObj);
                      return (
                        <span key={renderKey}>
                          {charObj.char}{diacritic}
                        </span>
                      );
                    })}
                    {wIdx < currentSentence.words.length - 1 && ' '}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Annotation Area - also uses unique keys */}
            <div className="bg-amber-50 rounded-lg p-8 border-2 border-amber-200 mb-4">
              <div className="text-4xl leading-loose" style={{ fontFamily: 'Amiri, Arial', direction: 'rtl', textAlign: 'right' }}>
                {currentSentence.words.map((word, wIdx) => (
                  <React.Fragment key={wIdx}>
                    <span className="inline-flex bg-white rounded px-2 py-1 shadow-sm border border-amber-300">
                      {word.map((charObj) => {
                        const isSelected = charObj.globalIndex === selectedCharIdx;
                        const diacritic = getDiacriticForChar(charObj);
                        const isCorrected = isCharCorrected(charObj);
                        const renderKey = getCharRenderKey(charObj);
                        
                        return (
                          <span
                            key={renderKey}
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
                  <span className="text-4xl" style={{ fontFamily: 'Amiri' }} key={getCharRenderKey(currentChar)}>
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
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Diacritic (or press key)</h3>
              <div className="grid grid-cols-8 gap-2">
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
                      title={d.name}
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
              <h3 className="font-semibold text-gray-800 mb-3">📁 Input File</h3>
              <div className="text-sm">
                {inputFileName ? (
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="font-mono text-blue-700 break-all">{inputFileName}</div>
                  </div>
                ) : (
                  <div className="p-2 bg-gray-50 rounded border border-gray-200 text-gray-500">
                    No file loaded
                  </div>
                )}
              </div>
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
                {diacritics.slice(0, 10).map((d, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{d.name}</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">{d.key}</kbd>
                  </div>
                ))}
                <div className="pt-1 border-t border-gray-200 text-gray-500">
                  + {diacritics.length - 10} more (Q,W,E,R,T,Y...)
                </div>
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
            Press keys 0-9 and Q,W,E,R,T,Y to apply diacritics quickly.
          </p>
        </div>

        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-900">
            <strong>💾 Export Format:</strong> Files are named as <strong>{inputFileName ? getFileBaseName(inputFileName) : 'inputfile'}_annotatorname_timestamp</strong>. 
            Three files are exported: vocalized text (.txt), annotation report (.json), and recovery backup (.json).
          </p>
        </div>
      </div>
    </div>
  );
};

export default ArabicAnnotationTool;