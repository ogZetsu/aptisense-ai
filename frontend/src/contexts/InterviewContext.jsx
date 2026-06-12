import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const InterviewContext = createContext();

export function InterviewProvider({ children }) {
  const aptiSenseStorageKeys = [
    'aptisense_session_id',
    'aptisense_interview_state',
    'aptisense_active_interview_session',
    'aptisense_pending_session',
    'aptisense_session_warning',
  ];

  const clearAptiSenseStorage = useCallback(() => {
    try {
      aptiSenseStorageKeys.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      // ignore storage errors
    }
  }, []);

  const [sessionId, setSessionId] = useState(() => {
    try {
      return localStorage.getItem('aptisense_session_id') || null;
    } catch (e) {
      return null;
    }
  });

  const [interviewState, setInterviewState] = useState(() => {
    try {
      const stored = localStorage.getItem('aptisense_interview_state');
      return stored ? JSON.parse(stored) : {
        status: 'idle', // idle, starting, in_progress, paused, completed
        currentQuestion: null,
        questionIndex: 0,
        totalQuestions: 0,
        answers: [],
        startTime: null,
        endTime: null,
        report: null,
      };
    } catch (e) {
      return {
        status: 'idle',
        currentQuestion: null,
        questionIndex: 0,
        totalQuestions: 0,
        answers: [],
        startTime: null,
        endTime: null,
        report: null,
      };
    }
  });

  useEffect(() => {
    // Do not clear persisted interview state on mount.
    // Previously this hook wiped localStorage aggressively which prevented
    // restoring active sessions. Keep mount side-effects passive so callers
    // can decide when to clear stored sessions explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = useCallback((newSessionId) => {
    clearAptiSenseStorage();
    setSessionId(newSessionId);
    setInterviewState(prev => ({
      ...prev,
      status: 'in_progress',
      startTime: new Date(),
    }));
  }, [clearAptiSenseStorage]);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem('aptisense_session_id', sessionId || '');
      localStorage.setItem('aptisense_interview_state', JSON.stringify(interviewState || {}));
    } catch (e) {
      // ignore storage errors
    }
  }, [sessionId, interviewState]);

  const updateQuestion = useCallback((question, index, total) => {
    setInterviewState(prev => ({
      ...prev,
      currentQuestion: question,
      questionIndex: index,
      totalQuestions: total,
    }));
  }, []);

  const recordAnswer = useCallback((question, answer, analysis) => {
    setInterviewState(prev => ({
      ...prev,
      answers: [...prev.answers, { question, answer, analysis }],
    }));
  }, []);

  const endSession = useCallback((report) => {
    clearAptiSenseStorage();
    setInterviewState(prev => ({
      ...prev,
      status: 'completed',
      endTime: new Date(),
      report,
    }));
  }, [clearAptiSenseStorage]);

  const resetSession = useCallback(() => {
    clearAptiSenseStorage();
    setSessionId(null);
    setInterviewState({
      status: 'idle',
      currentQuestion: null,
      questionIndex: 0,
      totalQuestions: 0,
      answers: [],
      startTime: null,
      endTime: null,
      report: null,
    });
  }, [clearAptiSenseStorage]);

  const pauseSession = useCallback(() => {
    setInterviewState(prev => ({
      ...prev,
      status: 'paused',
    }));
  }, []);

  const resumeSession = useCallback(() => {
    setInterviewState(prev => ({
      ...prev,
      status: 'in_progress',
    }));
  }, []);

  const value = {
    sessionId,
    interviewState,
    startSession,
    updateQuestion,
    recordAnswer,
    endSession,
    resetSession,
    pauseSession,
    resumeSession,
  };

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within InterviewProvider');
  }
  return context;
}
