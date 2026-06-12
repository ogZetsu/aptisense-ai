import React, { useEffect, useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { aptitudeAPI } from "../services/api";
import { MainLayout } from "../layouts/MainLayout";
import { useTheme } from "../contexts/ThemeContext";
import { 
  Brain, 
  Clock, 
  Award, 
  Shield, 
  Lock, 
  Play, 
  Check,
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  BookOpen,
  Eye,
  RotateCcw
} from "lucide-react";

export default function AptitudeTest({ onNavigate, currentUser, onLogout }) {
  const { theme } = useTheme();
  
  // Proctoring refs
  const webcamRef = useRef(null);
  const cameraRef = useRef(null);
  const faceMeshRef = useRef(null);
  const lastStatsUpdateRef = useRef(0);

  // Selector state
  const [categoriesData, setCategoriesData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null); // category object
  const [selectedLevel, setSelectedLevel] = useState(1); // 1 = Basic, 2 = Intermediate, 3 = Advanced, 4 = Expert
  const [setsData, setSetsData] = useState(null); // sets lists
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Active Test state
  const [activeSetNumber, setActiveSetNumber] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // idx -> selected option
  const [markedForReview, setMarkedForReview] = useState([]); // list of indexes
  const [visitedQuestions, setVisitedQuestions] = useState([]); // list of indexes
  
  // Proctoring active metrics
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes default
  const [tabSwitches, setTabSwitches] = useState(0);
  const [attentionScore, setAttentionScore] = useState(100);
  const [faceDetected, setFaceDetected] = useState(true);
  const [eyeDirection, setEyeDirection] = useState("Center");
  const [suspiciousCount, setSuspiciousCount] = useState(0);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  
  // Post-submit result state
  const [completedReport, setCompletedReport] = useState(null);

  // System UI states
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // Fetch all categories and sets progress metadata
  const loadCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const res = await aptitudeAPI.getCategories();
      setCategoriesData(res.data || res);
      
      // If we already have a selected category, update its sets
      if (selectedCategory) {
        const updatedCat = (res.data || res).find(c => c.category_id === selectedCategory.category_id);
        if (updatedCat) {
          setSelectedCategory(updatedCat);
          const setsRes = await aptitudeAPI.getSets(updatedCat.category_id, selectedLevel);
          setSetsData(setsRes.data || setsRes);
        }
      }
    } catch (err) {
      console.error("Failed to load categories progress:", err);
      setLoadError("Failed to fetch practice details. Try refreshing.");
    } finally {
      setLoadingCategories(false);
    }
  }, [selectedCategory, selectedLevel]);

  useEffect(() => {
    if (currentUser?.user_id) {
      loadCategories();
    }
  }, [currentUser, selectedLevel]);

  // Handle Level Selection
  const handleLevelSelect = async (levelId) => {
    setSelectedLevel(levelId);
    if (selectedCategory) {
      try {
        const setsRes = await aptitudeAPI.getSets(selectedCategory.category_id, levelId);
        setSetsData(setsRes.data || setsRes);
      } catch (err) {
        console.error("Failed to fetch sets:", err);
      }
    }
  };

  // Handle Category Selection
  const handleCategorySelect = async (category) => {
    setSelectedCategory(category);
    try {
      const setsRes = await aptitudeAPI.getSets(category.category_id, selectedLevel);
      setSetsData(setsRes.data || setsRes);
    } catch (err) {
      console.error("Failed to fetch sets:", err);
    }
  };

  // Visibility (Tab Switch) Listener
  useEffect(() => {
    if (!activeSetNumber) return;

    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
        setSuspiciousCount(prev => prev + 1);
        setAttentionScore(prev => Math.max(prev - 10, 0));
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeSetNumber]);

  // Proctoring Camera Analytics (Mediapipe FaceMesh)
  useEffect(() => {
    if (!activeSetNumber || !cameraAvailable) return;

    let localCamera = null;
    let localFaceMesh = null;

    try {
      localFaceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
      });

      localFaceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      localFaceMesh.onResults((results) => {
        const now = Date.now();
        const shouldUpdate = now - lastStatsUpdateRef.current >= 1000;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          setFaceDetected(true);
          const landmarks = results.multiFaceLandmarks[0];
          const nose = landmarks[1];

          if (nose.x < 0.35) {
            setEyeDirection("Looking Left");
            if (shouldUpdate) {
              setSuspiciousCount(prev => prev + 1);
              setAttentionScore(prev => Math.max(prev - 2, 0));
              lastStatsUpdateRef.current = now;
            }
          } else if (nose.x > 0.65) {
            setEyeDirection("Looking Right");
            if (shouldUpdate) {
              setSuspiciousCount(prev => prev + 1);
              setAttentionScore(prev => Math.max(prev - 2, 0));
              lastStatsUpdateRef.current = now;
            }
          } else if (nose.y > 0.55) {
            setEyeDirection("Looking Down");
            if (shouldUpdate) {
              setSuspiciousCount(prev => prev + 1);
              setAttentionScore(prev => Math.max(prev - 3, 0));
              lastStatsUpdateRef.current = now;
            }
          } else {
            setEyeDirection("Center");
            if (shouldUpdate) {
              setAttentionScore(prev => Math.min(prev + 1, 100));
              lastStatsUpdateRef.current = now;
            }
          }
        } else {
          setFaceDetected(false);
          setEyeDirection("No Face");
          if (shouldUpdate) {
            setSuspiciousCount(prev => prev + 1);
            setAttentionScore(prev => Math.max(prev - 5, 0));
            lastStatsUpdateRef.current = now;
          }
        }
      });

      faceMeshRef.current = localFaceMesh;

      if (webcamRef.current?.video) {
        localCamera = new Camera(webcamRef.current.video, {
          onFrame: async () => {
            if (faceMeshRef.current) {
              await faceMeshRef.current.send({ image: webcamRef.current.video });
            }
          },
          width: 320,
          height: 240
        });
        localCamera.start();
        cameraRef.current = localCamera;
      }
    } catch (e) {
      console.warn("Mediapipe proctoring fails to start:", e);
    }

    return () => {
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (err) {}
      }
      if (faceMeshRef.current) {
        try {
          faceMeshRef.current.close();
        } catch (err) {}
      }
    };
  }, [activeSetNumber, cameraAvailable]);

  // Test Timer Tick
  useEffect(() => {
    if (!activeSetNumber || completedReport) return;

    if (timeLeft <= 0) {
      autoSubmitTest();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, activeSetNumber, completedReport]);



  // Auto-submit when timer hits zero
  const autoSubmitTest = () => {
    submitTest(true);
  };

  // Continue Practice Handler (Resumes from saved question index)
  const handleContinuePractice = async (catId, levelId) => {
    setLoadError("");
    setIsInitializing(true);
    try {
      const progressRes = await aptitudeAPI.getProgress(catId, levelId);
      const prog = progressRes.data || progressRes;
      
      const activeSet = prog.currentSet || 1;
      const activeQuestion = prog.currentQuestion || 0;
      const activeAnswers = prog.currentAnswers || {};

      // Fetch questions
      const qRes = await aptitudeAPI.getSetQuestions(catId, activeSet, levelId);
      const setQs = qRes.data?.questions || qRes.questions || [];

      if (setQs.length === 0) {
        throw new Error("No questions available in this set.");
      }

      setQuestions(setQs);
      setSelectedAnswers(activeAnswers);
      setCurrentQuestionIdx(activeQuestion);
      setVisitedQuestions([activeQuestion]);
      setMarkedForReview([]);
      setActiveSetNumber(activeSet);
      setTimeLeft(600); // Reset timer to 10 minutes for practice sets
      setTabSwitches(0);
      setAttentionScore(100);
      setSuspiciousCount(0);
      setEyeDirection("Center");
      setFaceDetected(true);
      lastStatsUpdateRef.current = 0;
    } catch (err) {
      setLoadError("Unable to resume practice. Set may have no questions.");
    } finally {
      setIsInitializing(false);
    }
  };

  // Start Set Handler
  const handleStartSet = async (setNumber) => {
    setLoadError("");
    setIsInitializing(true);
    try {
      const qRes = await aptitudeAPI.getSetQuestions(selectedCategory.category_id, setNumber, selectedLevel);
      const setQs = qRes.data?.questions || qRes.questions || [];

      if (setQs.length === 0) {
        throw new Error("No questions found.");
      }

      setQuestions(setQs);
      setSelectedAnswers({});
      setCurrentQuestionIdx(0);
      setVisitedQuestions([0]);
      setMarkedForReview([]);
      setActiveSetNumber(setNumber);
      setTimeLeft(600); // 10 minutes
      setTabSwitches(0);
      setAttentionScore(100);
      setSuspiciousCount(0);
      setEyeDirection("Center");
      setFaceDetected(true);
      lastStatsUpdateRef.current = 0;

      // Initialize progress entry on backend
      await savePracticeProgress(setNumber, 0, {});
    } catch (err) {
      setLoadError("Failed to initialize this question set. Try seeding questions first.");
    } finally {
      setIsInitializing(false);
    }
  };

  // Save Progress Endpoint Hook
  const savePracticeProgress = async (setNo, qIdx, answers) => {
    try {
      await aptitudeAPI.saveProgress({
        category: selectedCategory.category_id,
        level: selectedLevel,
        currentSet: setNo,
        currentQuestion: qIdx,
        currentAnswers: answers
      });
    } catch (e) {
      console.warn("Failed to save progress to cloud:", e);
    }
  };

  // Option Click Handler
  const handleSelectOption = (option) => {
    const updatedAnswers = {
      ...selectedAnswers,
      [currentQuestionIdx]: option
    };
    setSelectedAnswers(updatedAnswers);
    savePracticeProgress(activeSetNumber, currentQuestionIdx, updatedAnswers);
    
    // Clear from marked for review since the user has now answered the question
    if (markedForReview.includes(currentQuestionIdx)) {
      setMarkedForReview(prev => prev.filter(i => i !== currentQuestionIdx));
    }
  };

  // Save & Next Action
  const handleSaveAndNext = () => {
    // Double check to clear marked for review if the current question has an answer
    if (selectedAnswers[currentQuestionIdx] !== undefined && selectedAnswers[currentQuestionIdx] !== "") {
      setMarkedForReview(prev => prev.filter(i => i !== currentQuestionIdx));
    }

    const nextIdx = currentQuestionIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentQuestionIdx(nextIdx);
      if (!visitedQuestions.includes(nextIdx)) {
        setVisitedQuestions([...visitedQuestions, nextIdx]);
      }
      savePracticeProgress(activeSetNumber, nextIdx, selectedAnswers);
    }
  };

  // Previous Action
  const handlePrevious = () => {
    const prevIdx = currentQuestionIdx - 1;
    if (prevIdx >= 0) {
      setCurrentQuestionIdx(prevIdx);
      if (!visitedQuestions.includes(prevIdx)) {
        setVisitedQuestions([...visitedQuestions, prevIdx]);
      }
    }
  };

  // Mark for Review Action
  const handleMarkForReview = () => {
    if (markedForReview.includes(currentQuestionIdx)) {
      setMarkedForReview(markedForReview.filter(i => i !== currentQuestionIdx));
    } else {
      setMarkedForReview([...markedForReview, currentQuestionIdx]);
    }
    handleSaveAndNext();
  };

  // Submit Test Action
  const submitTest = async (isAuto = false) => {
    if (!isAuto && !window.confirm("Are you sure you want to submit your test answers?")) {
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        category: selectedCategory.category_id,
        level: selectedLevel,
        setNumber: activeSetNumber,
        score: 0, // Recalculated on backend
        totalQuestions: questions.length,
        timeTaken: 600 - timeLeft,
        attentionScore,
        suspiciousCount,
        tabSwitches,
        answers: selectedAnswers
      };

      const res = await aptitudeAPI.submitAttempt(payload);
      setCompletedReport(res.data?.attempt || res.data || res);
      
      // Stop proctoring camera
      if (cameraRef.current) {
        try { cameraRef.current.stop(); } catch (e) {}
      }
    } catch (err) {
      alert("Failed to submit test attempt.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const getPaletteStatus = (qIdx) => {
    const isMarked = markedForReview.includes(qIdx);
    const hasAnswer = selectedAnswers[qIdx] !== undefined && selectedAnswers[qIdx] !== "";
    const isVisited = visitedQuestions.includes(qIdx);

    if (isMarked) return "marked"; // Purple
    if (hasAnswer) return "answered"; // Green
    if (isVisited) return "unanswered"; // Red / Visited but empty
    return "not_visited"; // Gray
  };

  // Format Timer text
  const formatTime = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getLevelName = (lvl) => {
    switch (lvl) {
      case 1: return "Basic";
      case 2: return "Intermediate";
      case 3: return "Advanced";
      case 4: return "Expert";
      default: return "Basic";
    }
  };

  // Close completion report and return to sets page
  const handleReturnToSets = () => {
    setCompletedReport(null);
    setActiveSetNumber(null);
    setQuestions([]);
    setSelectedAnswers({});
    setMarkedForReview([]);
    setVisitedQuestions([]);
    loadCategories();
  };

  // AUTHENTICATION GUARD
  if (!currentUser?.user_id) {
    return (
      <MainLayout activeView="aptitude-test" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div className="pad-mobile" style={{ padding: "2.5rem 2rem", maxWidth: "1280px", margin: "0 auto", minHeight: "60vh", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{
            padding: "3rem 2rem",
            borderRadius: "1.75rem",
            border: `1px solid ${theme.colors.borderLight}`,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: "480px",
            width: "100%"
          }}>
            <Lock size={48} color={theme.colors.warning} style={{ marginBottom: "1.5rem" }} />
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: theme.colors.textPrimary, margin: 0 }}>Authentication Required</h2>
            <p style={{ color: theme.colors.textSecondary, margin: "0.75rem 0 1.5rem", fontSize: "0.95rem", lineHeight: "1.5" }}>
              Please sign in to access the Aptitude Assessment Platform and practice custom placement tests.
            </p>
            <button
              onClick={() => onNavigate?.("login")}
              style={{
                padding: "0.85rem 2rem",
                borderRadius: "99px",
                border: "none",
                background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.info})`,
                color: theme.colors.bgPrimary,
                fontWeight: "800",
                fontSize: "0.95rem",
                cursor: "pointer",
                boxShadow: `0 10px 20px -5px ${theme.colors.primary}40`,
                transition: "transform 150ms"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              Sign In to Continue
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // RENDER SELECTOR VIEW
  if (!activeSetNumber) {
    const activeLevelMeta = selectedCategory?.levels?.find(l => l.level_id === selectedLevel);
    
    return (
      <MainLayout activeView="aptitude-test" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div className="pad-mobile" style={{ padding: "2.5rem 2rem", maxWidth: "1280px", margin: "0 auto", minHeight: "100vh" }}>
          
          {/* Page Title & Desc */}
          <div style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "2.25rem", fontWeight: "900", margin: 0, letterSpacing: "-0.03em" }}>
                Aptitude Assessment Platform
              </h1>
              <p style={{ color: theme.colors.textSecondary, marginTop: "0.5rem", fontSize: "1rem" }}>
                Choose a placement topic, pick your experience level, and practice structured question sets.
              </p>
            </div>
            
            <button
              onClick={() => onNavigate?.("previous-attempts")}
              style={{
                padding: "0.65rem 1.25rem",
                borderRadius: "99px",
                border: `1px solid ${theme.colors.borderLight}`,
                backgroundColor: theme.colors.surfaceSecondary,
                color: theme.colors.textPrimary,
                fontWeight: "700",
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              <Eye size={15} />
              View Previous Attempts
            </button>
          </div>

          {loadError && (
            <div className="auth-alert auth-alert-error" style={{ marginBottom: "1.5rem" }}>
              <AlertCircle size={18} />
              {loadError}
            </div>
          )}

          {loadingCategories ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8rem 2rem", gap: "1rem" }}>
              <Loader2 size={36} className="spin-icon" color={theme.colors.primary} />
              <span style={{ color: theme.colors.textSecondary }}>Fetching practice topics...</span>
            </div>
          ) : (
            <div className="aptitude-category-grid" style={{ gap: "2rem", alignItems: "stretch" }}>
              
              {/* Category sidebar list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <h3 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: theme.colors.textTertiary, fontWeight: "700", marginBottom: "0.25rem" }}>
                  Assessment Topics
                </h3>
                {categoriesData.map((cat) => {
                  const isSelected = selectedCategory?.category_id === cat.category_id;
                  // Calculate category total sets completed
                  const setsDone = cat.levels?.reduce((acc, curr) => acc + curr.completed_sets_count, 0) || 0;
                  const totalSetsCat = cat.levels?.reduce((acc, curr) => acc + curr.total_sets, 0) || 0;

                  return (
                    <button
                      key={cat.category_id}
                      onClick={() => handleCategorySelect(cat)}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "1.25rem",
                        textAlign: "left",
                        border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.borderLight}`,
                        background: isSelected 
                          ? `linear-gradient(135deg, ${theme.colors.surfaceSecondary}, ${theme.colors.surfacePrimary})`
                          : theme.colors.surfacePrimary,
                        color: theme.colors.textPrimary,
                        cursor: "pointer",
                        boxShadow: isSelected ? `0 10px 30px -10px ${theme.colors.primary}30` : "none",
                        transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem"
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = `${theme.colors.primary}40`;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = theme.colors.borderLight;
                      }}
                    >
                      <span style={{ fontWeight: "800", fontSize: "1.05rem" }}>{cat.category_name}</span>
                      <span style={{ fontSize: "0.8rem", color: theme.colors.textSecondary }}>
                        {setsDone} of {totalSetsCat} sets finished
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Topic Level and Sets Selector Card */}
              {selectedCategory ? (
                <div className="glass-panel" style={{
                  padding: "2.5rem",
                  borderRadius: "1.75rem",
                  border: `1px solid ${theme.colors.borderLight}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "2.5rem"
                }}>
                  
                  {/* Category Title */}
                  <div>
                    <h2 style={{ fontSize: "1.75rem", fontWeight: "900", margin: 0 }}>
                      {selectedCategory.category_name}
                    </h2>
                    <p style={{ color: theme.colors.textTertiary, marginTop: "0.3rem" }}>
                      Practice adaptive question blocks aligned with recruitment exam criteria.
                    </p>
                  </div>

                  {/* Level Selector buttons */}
                  <div>
                    <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: theme.colors.textTertiary, fontWeight: "700", marginBottom: "0.85rem" }}>
                      Select Learning Level
                    </h4>
                    <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                      {[
                        { id: 1, name: "Basic" },
                        { id: 2, name: "Intermediate" },
                        { id: 3, name: "Advanced" },
                        { id: 4, name: "Expert" }
                      ].map((lvl) => {
                        const levelMeta = selectedCategory.levels?.find(l => l.level_id === lvl.id);
                        const isUnlocked = levelMeta?.unlocked ?? true;
                        const isSelected = selectedLevel === lvl.id;

                        return (
                          <button
                            key={lvl.id}
                            onClick={() => isUnlocked && handleLevelSelect(lvl.id)}
                            disabled={!isUnlocked}
                            style={{
                              padding: "0.75rem 1.25rem",
                              borderRadius: "99px",
                              border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.borderLight}`,
                              backgroundColor: isSelected ? `${theme.colors.primary}15` : isUnlocked ? theme.colors.surfaceSecondary : `${theme.colors.surfaceSecondary}50`,
                              color: isSelected ? theme.colors.primary : isUnlocked ? theme.colors.textSecondary : theme.colors.textTertiary,
                              cursor: isUnlocked ? "pointer" : "not-allowed",
                              fontWeight: "700",
                              fontSize: "0.85rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              transition: "all 200ms"
                            }}
                          >
                            {!isUnlocked && <Lock size={12} />}
                            {lvl.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Level Progress Stats Card */}
                  {activeLevelMeta && (
                    <div style={{
                      padding: "1.5rem",
                      borderRadius: "1.25rem",
                      backgroundColor: `${theme.colors.surfaceSecondary}40`,
                      border: `1px solid ${theme.colors.borderLight}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "1.5rem"
                    }}>
                      <div style={{ flex: "1", minWidth: "200px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                          <span style={{ fontWeight: "700", fontSize: "0.95rem" }}>Level Progress</span>
                          <span style={{ fontWeight: "800", color: theme.colors.primary, fontSize: "0.95rem" }}>
                            {activeLevelMeta.progress_percentage}%
                          </span>
                        </div>
                        <div style={{ width: "100%", height: "8px", borderRadius: "99px", backgroundColor: `${theme.colors.borderLight}`, overflow: "hidden" }}>
                          <div style={{
                            width: `${activeLevelMeta.progress_percentage}%`,
                            height: "100%",
                            background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.info})`,
                            borderRadius: "99px"
                          }} />
                        </div>
                        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: theme.colors.textSecondary }}>
                          {activeLevelMeta.completed_sets_count} of {activeLevelMeta.total_sets} sets completed ({activeLevelMeta.total_questions} questions)
                        </p>
                      </div>

                      {/* Continue Practice Resume Button */}
                      {activeLevelMeta.total_questions > 0 && (
                        <button
                          onClick={() => handleContinuePractice(selectedCategory.category_id, selectedLevel)}
                          disabled={isInitializing}
                          style={{
                            padding: "0.9rem 1.75rem",
                            borderRadius: "99px",
                            border: "none",
                            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.info})`,
                            color: theme.colors.bgPrimary,
                            fontWeight: "800",
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            boxShadow: `0 10px 20px -5px ${theme.colors.primary}40`,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            transition: "transform 150ms"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
                          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        >
                          {isInitializing ? (
                            <Loader2 size={16} className="spin-icon" />
                          ) : (
                            <Play size={16} fill="currentColor" />
                          )}
                          Continue Practice
                        </button>
                      )}
                    </div>
                  )}

                  {/* Sets Grid */}
                  <div>
                    <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: theme.colors.textTertiary, fontWeight: "700", marginBottom: "1rem" }}>
                      Practice Sets
                    </h4>

                    {setsData?.sets?.length > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
                        {setsData.sets.map((set) => {
                          const isCurrent = set.is_current;
                          const isCompleted = set.completed;
                          const isUnlocked = set.unlocked;

                          return (
                            <div
                              key={set.set_number}
                              style={{
                                padding: "1.25rem",
                                borderRadius: "1.25rem",
                                border: `1px solid ${isCurrent ? theme.colors.primary : isCompleted ? `${theme.colors.success}50` : theme.colors.borderLight}`,
                                backgroundColor: isCurrent 
                                  ? `${theme.colors.primary}05` 
                                  : isCompleted 
                                    ? `${theme.colors.success}02` 
                                    : !isUnlocked 
                                      ? `${theme.colors.surfaceSecondary}50`
                                      : theme.colors.surfacePrimary,
                                opacity: isUnlocked ? 1 : 0.65,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                minHeight: "120px"
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                  <span style={{ fontWeight: "800", fontSize: "1.1rem" }}>Set {set.set_number}</span>
                                  {!isUnlocked ? (
                                    <Lock size={14} color={theme.colors.textTertiary} />
                                  ) : isCompleted ? (
                                    <CheckCircle2 size={16} color={theme.colors.success} />
                                  ) : null}
                                </div>
                                <span style={{ fontSize: "0.8rem", color: theme.colors.textSecondary }}>
                                  {set.total_questions} Multiple Choice
                                </span>
                              </div>

                              <button
                                onClick={() => isUnlocked && handleStartSet(set.set_number)}
                                disabled={!isUnlocked || isInitializing}
                                style={{
                                  marginTop: "1rem",
                                  padding: "0.5rem",
                                  borderRadius: "8px",
                                  border: `1px solid ${isCurrent ? theme.colors.primary : isCompleted ? theme.colors.success : theme.colors.borderLight}`,
                                  backgroundColor: isCurrent ? theme.colors.primary : "transparent",
                                  color: isCurrent ? theme.colors.bgPrimary : isCompleted ? theme.colors.success : theme.colors.textSecondary,
                                  fontWeight: "700",
                                  fontSize: "0.8rem",
                                  cursor: isUnlocked ? "pointer" : "not-allowed",
                                  textAlign: "center",
                                  transition: "all 150ms"
                                }}
                              >
                                {isCompleted ? "Retake Set" : isCurrent ? "Resume Set" : "Start Set"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "3rem", color: theme.colors.textTertiary }}>
                        No questions uploaded for this category/level yet.
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="glass-panel" style={{
                  padding: "6rem 2rem",
                  borderRadius: "1.75rem",
                  border: `1px solid ${theme.colors.borderLight}`,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.colors.textSecondary
                }}>
                  <Brain size={48} style={{ opacity: 0.3, color: theme.colors.primary, marginBottom: "1.5rem" }} />
                  <h3 style={{ fontSize: "1.25rem", color: theme.colors.textPrimary, fontWeight: "700" }}>Select a Placement Topic</h3>
                  <p style={{ maxWidth: "340px", margin: "0.5rem 0 0" }}>Choose one of the skills from the left side panel to review sets and resume practice progress.</p>
                </div>
              )}

            </div>
          )}

        </div>
      </MainLayout>
    );
  }

  // RENDER POST-SUBMIT ASSESSMENT REPORT
  if (completedReport) {
    const scorePct = completedReport.accuracy;
    const analysis = completedReport.analysis || {};
    
    return (
      <MainLayout activeView="aptitude-test" onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
        <div className="pad-mobile" style={{ padding: "2.5rem 2rem", maxWidth: "1000px", margin: "0 auto", minHeight: "100vh" }}>
          
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ display: "inline-grid", placeItems: "center", width: 64, height: 64, borderRadius: "50%", backgroundColor: `${theme.colors.success}15`, color: theme.colors.success, marginBottom: "1rem" }}>
              <CheckCircle2 size={36} />
            </div>
            <h1 style={{ fontSize: "2.25rem", fontWeight: "900", margin: 0 }}>Practice Set Completed!</h1>
            <p style={{ color: theme.colors.textSecondary, marginTop: "0.5rem" }}>
              Your proctored test attempt has been securely logged to MongoDB Atlas.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: theme.colors.textTertiary, textTransform: "uppercase", fontWeight: "700" }}>Aptitude Score</span>
              <h2 style={{ margin: "0.5rem 0 0", fontSize: "2.5rem", fontWeight: "900", color: theme.colors.primary }}>
                {completedReport.score} / {completedReport.total_questions}
              </h2>
            </div>
            <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: theme.colors.textTertiary, textTransform: "uppercase", fontWeight: "700" }}>Set Accuracy</span>
              <h2 style={{ 
                margin: "0.5rem 0 0", 
                fontSize: "2.5rem", 
                fontWeight: "900",
                color: scorePct >= 75 ? theme.colors.success : scorePct >= 50 ? theme.colors.warning : theme.colors.danger 
              }}>
                {scorePct}%
              </h2>
            </div>
            <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: theme.colors.textTertiary, textTransform: "uppercase", fontWeight: "700" }}>Attention Index</span>
              <h2 style={{ margin: "0.5rem 0 0", fontSize: "2.5rem", fontWeight: "900", color: theme.colors.info }}>
                {completedReport.attention_score}%
              </h2>
            </div>
            <div className="glass-panel" style={{ padding: "1.5rem", borderRadius: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: theme.colors.textTertiary, textTransform: "uppercase", fontWeight: "700" }}>Flagged Events</span>
              <h2 style={{ margin: "0.5rem 0 0", fontSize: "2.5rem", fontWeight: "900", color: theme.colors.danger }}>
                {completedReport.suspicious_count}
              </h2>
            </div>
          </div>

          {/* Proctoring Summary & Gemini Analysis */}
          <div className="glass-panel" style={{ padding: "2rem", borderRadius: "1.5rem", marginBottom: "2rem", border: `1px solid ${theme.colors.borderLight}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: theme.colors.info, marginBottom: "1rem" }}>
              <Sparkles size={20} />
              <h3 style={{ margin: 0, fontWeight: "900", fontSize: "1.2rem" }}>Proctored Evaluation & Feedback</h3>
            </div>
            
            <p style={{ fontSize: "1.05rem", fontWeight: "700", lineHeight: "1.6", margin: "0 0 1.5rem", color: theme.colors.textPrimary }}>
              {analysis.overall_impression || "Attempt processed."}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", md: "1fr 1fr", gap: "1.5rem", fontSize: "0.95rem", color: theme.colors.textSecondary }}>
              <div>
                <strong style={{ color: theme.colors.textPrimary, display: "block", marginBottom: "0.5rem" }}>Strengths Observed</strong>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, display: "grid", gap: "0.35rem" }}>
                  {analysis.strengths?.map((item, idx) => <li key={idx}>{item}</li>)}
                </ul>
              </div>
              
              <div>
                <strong style={{ color: theme.colors.textPrimary, display: "block", marginBottom: "0.5rem" }}>Areas for Improvement</strong>
                <ul style={{ paddingLeft: "1.25rem", margin: 0, display: "grid", gap: "0.35rem" }}>
                  {analysis.areas_for_improvement?.map((item, idx) => <li key={idx}>{item}</li>)}
                </ul>
              </div>
            </div>

            {analysis.recommendation_text && (
              <div style={{ marginTop: "1.5rem", padding: "1rem 1.25rem", borderRadius: "8px", backgroundColor: `${theme.colors.surfaceSecondary}50`, borderLeft: `3px solid ${theme.colors.primary}`, fontSize: "0.95rem", lineHeight: "1.6" }}>
                <strong>Recommendation:</strong> {analysis.recommendation_text}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button
              onClick={() => onNavigate?.("previous-attempts")}
              style={{
                padding: "0.85rem 1.75rem",
                borderRadius: "99px",
                border: `1px solid ${theme.colors.borderLight}`,
                backgroundColor: theme.colors.surfaceSecondary,
                color: theme.colors.textPrimary,
                fontWeight: "700",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <Eye size={16} />
              Review Answers & Explanations
            </button>

            <button
              onClick={handleReturnToSets}
              className="nav-primary-btn"
              style={{
                padding: "0.85rem 1.75rem",
                borderRadius: "99px",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <RotateCcw size={16} />
              Back to Sets Selector
            </button>
          </div>

        </div>
      </MainLayout>
    );
  }

  // RENDER ACTIVE TEST BOARD (GATE SPLIT-VIEW PATTERN)
  const currentQuestion = questions[currentQuestionIdx];
  const selectedOption = selectedAnswers[currentQuestionIdx];


  return (
    <MainLayout activeView="aptitude-test" showSidebar={false} onNavigate={onNavigate} currentUser={currentUser} onLogout={onLogout}>
      <div className="aptitude-test-grid" style={{ minHeight: "100vh", backgroundColor: theme.colors.bgPrimary }}>
        
        {/* Left Section: Active Question Board */}
        <div style={{ padding: "2.5rem 2rem", display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: `1px solid ${theme.colors.borderLight}` }}>
          
          {/* Top Info Bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <span style={{
                  padding: "0.3rem 0.75rem",
                  borderRadius: "99px",
                  fontSize: "0.75rem",
                  fontWeight: "800",
                  backgroundColor: `${theme.colors.primary}15`,
                  color: theme.colors.primary,
                  textTransform: "uppercase"
                }}>
                  {selectedCategory?.category_name}
                </span>
                <span style={{
                  marginLeft: "0.5rem",
                  padding: "0.3rem 0.75rem",
                  borderRadius: "99px",
                  fontSize: "0.75rem",
                  fontWeight: "800",
                  backgroundColor: `${theme.colors.info}15`,
                  color: theme.colors.info,
                  textTransform: "uppercase"
                }}>
                  Level: {getLevelName(selectedLevel)}
                </span>
              </div>

              {/* Timer Block */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "99px", backgroundColor: `${theme.colors.warning}10`, border: `1px solid ${theme.colors.warning}30`, color: theme.colors.warning }}>
                <Clock size={16} />
                <span style={{ fontFamily: "monospace", fontWeight: "800", fontSize: "1.1rem" }}>{formatTime()}</span>
              </div>
            </div>

            {/* Test progress bar */}
            <div style={{ marginBottom: "2.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: theme.colors.textSecondary, marginBottom: "0.4rem" }}>
                <span>Question {currentQuestionIdx + 1} of {questions.length}</span>
                <span>{Math.round(((currentQuestionIdx + 1) / questions.length) * 100)}% Complete</span>
              </div>
              <div style={{ width: "100%", height: "6px", borderRadius: "99px", backgroundColor: `${theme.colors.borderLight}`, overflow: "hidden" }}>
                <div style={{
                  width: `${((currentQuestionIdx + 1) / questions.length) * 100}%`,
                  height: "100%",
                  backgroundColor: theme.colors.primary,
                  borderRadius: "99px",
                  transition: "width 200ms"
                }} />
              </div>
            </div>

            {/* Question Card */}
            {currentQuestion ? (
              <div className="glass-panel animate-fade-in" style={{ padding: "2.5rem", borderRadius: "1.5rem", border: `1px solid ${theme.colors.borderLight}`, marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1.35rem", fontWeight: "700", lineHeight: "1.6", margin: "0 0 2rem", color: theme.colors.textPrimary }}>
                  {currentQuestion.question}
                </h2>

                {/* Options List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedOption === option;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(option)}
                        style={{
                          padding: "1.1rem 1.5rem",
                          borderRadius: "1rem",
                          textAlign: "left",
                          border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.borderLight}`,
                          backgroundColor: isSelected ? `${theme.colors.primary}10` : `${theme.colors.surfaceSecondary}30`,
                          color: theme.colors.textPrimary,
                          cursor: "pointer",
                          fontSize: "1rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          transition: "all 150ms"
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = `${theme.colors.primary}40`;
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.borderColor = theme.colors.borderLight;
                        }}
                      >
                        <span style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "50%",
                          border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.textTertiary}`,
                          display: "grid",
                          placeItems: "center",
                          fontSize: "0.8rem",
                          fontWeight: "800",
                          color: isSelected ? theme.colors.primary : theme.colors.textTertiary,
                          backgroundColor: isSelected ? `${theme.colors.primary}15` : "transparent"
                        }}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ padding: "4rem", textAlign: "center", color: theme.colors.textSecondary }}>
                Loading question...
              </div>
            )}
          </div>

          {/* Action Bottom Nav Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginTop: "2rem" }}>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIdx === 0}
                style={{
                  padding: "0.75rem 1.25rem",
                  borderRadius: "99px",
                  border: `1px solid ${theme.colors.borderLight}`,
                  backgroundColor: theme.colors.surfaceSecondary,
                  color: theme.colors.textPrimary,
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  opacity: currentQuestionIdx === 0 ? 0.4 : 1
                }}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              
              <button
                onClick={handleMarkForReview}
                style={{
                  padding: "0.75rem 1.25rem",
                  borderRadius: "99px",
                  border: `1px solid ${theme.colors.borderLight}`,
                  backgroundColor: markedForReview.includes(currentQuestionIdx) ? "#8B5CF620" : theme.colors.surfaceSecondary,
                  color: markedForReview.includes(currentQuestionIdx) ? "#A78BFA" : theme.colors.textPrimary,
                  fontWeight: "700",
                  cursor: "pointer"
                }}
              >
                {markedForReview.includes(currentQuestionIdx) ? "Marked for Review" : "Mark for Review"}
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              {currentQuestionIdx < questions.length - 1 ? (
                <button
                  onClick={handleSaveAndNext}
                  disabled={!selectedOption}
                  style={{
                    padding: "0.75rem 1.5rem",
                    borderRadius: "99px",
                    border: "none",
                    background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.info})`,
                    color: theme.colors.bgPrimary,
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    opacity: !selectedOption ? 0.5 : 1
                  }}
                >
                  Save & Next
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => submitTest(false)}
                  disabled={submitLoading}
                  style={{
                    padding: "0.75rem 1.75rem",
                    borderRadius: "99px",
                    border: "none",
                    backgroundColor: theme.colors.success,
                    color: theme.colors.bgPrimary,
                    fontWeight: "800",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem"
                  }}
                >
                  {submitLoading ? <Loader2 size={16} className="spin-icon" /> : <Check size={16} />}
                  Submit Set
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Right Section: Question Palette & Monitor */}
        <div style={{ padding: "2.5rem 1.5rem", display: "flex", flexDirection: "column", gap: "2rem", backgroundColor: `${theme.colors.surfaceSecondary}20` }}>
          
          {/* Proctoring compact camera view */}
          <div className="glass-panel" style={{ padding: "1.25rem", borderRadius: "1.25rem", border: `1px solid ${theme.colors.borderLight}` }}>
            <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", aspectRatio: "4/3", backgroundColor: "#000", marginBottom: "1rem" }}>
              <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                screenshotFormat="image/jpeg"
                onUserMedia={() => setCameraAvailable(true)}
                onUserMediaError={() => setCameraAvailable(false)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              
              {/* Camera warning if face missing */}
              {cameraAvailable && !faceDetected && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(239, 68, 68, 0.4)",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  color: "#fff",
                  fontSize: "0.8rem",
                  fontWeight: "700"
                }}>
                  <AlertCircle size={24} />
                  <span>Face Missing / Not Detected</span>
                </div>
              )}

              {/* Camera warning if looking away */}
              {cameraAvailable && faceDetected && eyeDirection !== "Center" && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(245, 158, 11, 0.45)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  color: "#fff",
                  fontSize: "0.85rem",
                  fontWeight: "800",
                  padding: "1rem"
                }}>
                  <AlertTriangle size={26} style={{ marginBottom: "0.4rem" }} />
                  <span style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>Please Focus on the Test</span>
                  <span style={{ fontSize: "0.7rem", marginTop: "0.25rem", opacity: 0.9, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                    (Warning: {eyeDirection})
                  </span>
                </div>
              )}
            </div>

            <div style={{ fontSize: "0.8rem", display: "grid", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: theme.colors.textTertiary }}>Camera Proctoring:</span>
                <strong style={{ color: cameraAvailable ? theme.colors.success : theme.colors.danger }}>
                  {cameraAvailable ? "Active Monitoring" : "Camera Disabled"}
                </strong>
              </div>
              {cameraAvailable && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: theme.colors.textTertiary }}>Eye Direction:</span>
                    <strong style={{ color: eyeDirection === "Center" ? theme.colors.success : theme.colors.warning }}>{eyeDirection}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: theme.colors.textTertiary }}>Tab Switches:</span>
                    <strong style={{ color: tabSwitches > 0 ? theme.colors.danger : theme.colors.textPrimary }}>{tabSwitches}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: theme.colors.textTertiary }}>Cheating flags:</span>
                    <strong style={{ color: suspiciousCount > 5 ? theme.colors.danger : theme.colors.textPrimary }}>{suspiciousCount}</strong>
                  </div>
                </>
              )}
            </div>

            {/* Proctoring Alerts Box */}
            {(cameraAvailable && (!faceDetected || eyeDirection !== "Center" || tabSwitches > 0)) && (
              <div style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: `1px solid ${theme.colors.danger}`,
                color: theme.colors.danger,
                fontSize: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: "800" }}>
                  <AlertCircle size={14} />
                  <span>PROCTORING WARNINGS:</span>
                </div>
                <ul style={{ margin: "0 0 0 1rem", padding: 0 }}>
                  {!faceDetected && <li>No face detected in video feed</li>}
                  {faceDetected && eyeDirection !== "Center" && <li>Looking away from screen ({eyeDirection})</li>}
                  {tabSwitches > 0 && <li>Tab switches detected ({tabSwitches} switch{tabSwitches > 1 ? "es" : ""})</li>}
                </ul>
              </div>
            )}
          </div>

          {/* Question Palette Grid */}
          <div>
            <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: theme.colors.textTertiary, fontWeight: "700", marginBottom: "1rem" }}>
              Question Palette
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.65rem", marginBottom: "1.5rem" }}>
              {questions.map((_, qIdx) => {
                const status = getPaletteStatus(qIdx);
                const isSelected = currentQuestionIdx === qIdx;

                let borderStyle = `1px solid ${theme.colors.borderLight}`;
                let bgColor = theme.colors.surfaceSecondary;
                let color = theme.colors.textSecondary;

                if (status === "marked") {
                  bgColor = "#8B5CF6";
                  borderStyle = "1px solid #8B5CF6";
                  color = "#fff";
                } else if (status === "answered") {
                  bgColor = theme.colors.success;
                  borderStyle = `1px solid ${theme.colors.success}`;
                  color = theme.colors.bgPrimary;
                } else if (status === "unanswered") {
                  bgColor = theme.colors.danger;
                  borderStyle = `1px solid ${theme.colors.danger}`;
                  color = "#fff";
                }

                if (isSelected) {
                  borderStyle = `2px solid ${theme.colors.primary}`;
                }

                return (
                  <button
                    key={qIdx}
                    onClick={() => {
                      setCurrentQuestionIdx(qIdx);
                      if (!visitedQuestions.includes(qIdx)) {
                        setVisitedQuestions([...visitedQuestions, qIdx]);
                      }
                    }}
                    style={{
                      aspectRatio: "1/1",
                      borderRadius: "50%",
                      border: borderStyle,
                      backgroundColor: bgColor,
                      color: color,
                      fontWeight: "800",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      transition: "transform 150ms"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                  >
                    {qIdx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ fontSize: "0.8rem", display: "grid", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: theme.colors.success }} />
                <span>Answered</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: theme.colors.danger }} />
                <span>Unanswered (Visited)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#8B5CF6" }} />
                <span>Marked for Review</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: theme.colors.surfaceSecondary, border: `1px solid ${theme.colors.borderLight}` }} />
                <span>Not Visited</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </MainLayout>
  );
}