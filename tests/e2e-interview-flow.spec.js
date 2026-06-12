/**
 * Playwright E2E Test Suite: Complete Interview Flow
 * Tests all critical session management and interview flows
 * 
 * Run with: npx playwright test tests/e2e-interview-flow.spec.js
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:8000/api/v1';

test.describe('AptiSense AI - Complete Interview Flow E2E Tests', () => {
  
  test.beforeEach(async ({ page, context }) => {
    // Clear localStorage and cookies before each test
    await context.clearCookies();
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
  });

  // =======================
  // FLOW 1: HR Round Interview
  // =======================
  test('FLOW-1: Complete HR Round interview start to end', async ({ page }) => {
    // Navigate to interview types
    await page.goto(`${BASE_URL}?page=interview-types`);
    
    // Wait for interview track buttons to load
    await page.waitForSelector('button:has-text("HR Round")', { timeout: 10000 });
    
    // Click HR Round
    await page.click('button:has-text("HR Round")');
    
    // Wait for page transition to interview page
    await page.waitForSelector('text=Start Interview', { timeout: 10000 });
    
    // Verify session was created
    const sessionData = await page.evaluate(() => localStorage.getItem('aptisense_pending_session'));
    expect(sessionData).toBeTruthy();
    const session = JSON.parse(sessionData);
    expect(session.session_id).toBeTruthy();
    expect(session.interview_type).toBe('hr');
    
    // Verify first question appears
    await page.waitForSelector('text=Question', { timeout: 10000 });
    
    console.log('✓ HR Round session created successfully');
  });

  test('FLOW-2: Technical Round with answer submission', async ({ page }) => {
    // Start technical interview
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("Technical Round")');
    await page.click('button:has-text("Technical Round")');
    
    // Wait for interview page to load
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    // Submit an answer
    const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
    await textarea.fill('I solved this by implementing a binary search tree with O(log n) performance characteristics. We used it to optimize our database indexing strategy.');
    
    // Click submit
    await page.click('button:has-text("Submit Answer")');
    
    // Wait for next question to appear
    await page.waitForSelector('text=Question', { timeout: 15000 });
    
    console.log('✓ Technical Round answer submitted successfully');
  });

  test('FLOW-3: Behavioral Round complete flow', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("Behavioral Round")');
    await page.click('button:has-text("Behavioral Round")');
    
    // Wait for question
    await page.waitForSelector('text=Question', { timeout: 10000 });
    
    // Submit multiple answers
    for (let i = 0; i < 2; i++) {
      const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
      await textarea.fill(`This is my behavioral response number ${i + 1}. I handled conflict by communicating clearly with stakeholders.`);
      
      await page.click('button:has-text("Submit Answer")');
      
      // Wait for next state
      await page.waitForTimeout(2000);
    }
    
    console.log('✓ Behavioral Round with multiple answers successful');
  });

  test('FLOW-4: Communication Round', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("Communication Round")');
    await page.click('button:has-text("Communication Round")');
    
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
    await textarea.fill('To explain this to a non-technical person, I would break it down into simple concepts: APIs are like waiters that take orders and bring responses back.');
    
    await page.click('button:has-text("Submit Answer")');
    await page.waitForTimeout(2000);
    
    console.log('✓ Communication Round started successfully');
  });

  // =======================
  // FLOW 5: Reload Page Session Restoration
  // =======================
  test('FLOW-5: Session restoration after page reload', async ({ page }) => {
    // Start interview
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("Technical Round")');
    await page.click('button:has-text("Technical Round")');
    
    // Wait for question and submit answer
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
    await textarea.fill('My technical answer before reload');
    
    // Get session info before reload
    const sessionBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('aptisense_active_interview_session')));
    
    // Reload page
    await page.reload();
    
    // Wait for session to restore
    await page.waitForSelector('text=Question', { timeout: 10000 });
    
    // Verify session data restored
    const sessionAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('aptisense_active_interview_session')));
    expect(sessionAfter.sessionId).toBe(sessionBefore.sessionId);
    
    console.log('✓ Session restoration after reload successful');
  });

  // =======================
  // FLOW 6: End Session Button
  // =======================
  test('FLOW-6: End Session button clears state properly', async ({ page }) => {
    // Start interview
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("HR Round")');
    await page.click('button:has-text("HR Round")');
    
    // Wait for interview
    await page.waitForSelector('button:has-text("End Interview Session")', { timeout: 10000 });
    
    // Verify session exists
    let sessionData = await page.evaluate(() => localStorage.getItem('aptisense_active_interview_session'));
    expect(sessionData).toBeTruthy();
    
    // Click End Interview Session
    await page.click('button:has-text("End Interview Session")');
    
    // Wait for completion screen
    await page.waitForSelector('text=Interview Completed', { timeout: 10000 });
    
    // Verify session state cleared
    sessionData = await page.evaluate(() => localStorage.getItem('aptisense_active_interview_session'));
    expect(sessionData).toBeNull();
    
    console.log('✓ End Session button properly clears state');
  });

  // =======================
  // FLOW 7: Session Switching
  // =======================
  test('FLOW-7: Session switching with user confirmation', async ({ page }) => {
    // Start first interview
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("HR Round")');
    await page.click('button:has-text("HR Round")');
    
    // Wait for interview
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    // Store session ID
    const session1 = await page.evaluate(() => JSON.parse(localStorage.getItem('aptisense_active_interview_session')));
    const sessionId1 = session1.sessionId;
    
    // Try to start different interview (should trigger confirmation)
    await page.goto(`${BASE_URL}?page=interview-types`);
    
    // Wait for confirmation dialog
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('active');
      await dialog.accept();
    });
    
    await page.waitForSelector('button:has-text("Technical Round")');
    await page.click('button:has-text("Technical Round")');
    
    // Wait for new interview to start
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    // Verify new session
    const session2 = await page.evaluate(() => JSON.parse(localStorage.getItem('aptisense_active_interview_session')));
    const sessionId2 = session2.sessionId;
    
    expect(sessionId2).not.toBe(sessionId1);
    
    console.log('✓ Session switching with confirmation works correctly');
  });

  // =======================
  // FLOW 8: Invalid Session Handling
  // =======================
  test('FLOW-8: Invalid session handling and recovery', async ({ page, context }) => {
    // Start a valid session
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("HR Round")');
    await page.click('button:has-text("HR Round")');
    
    // Wait for interview
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    // Corrupt the session ID in localStorage
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('aptisense_active_interview_session'));
      session.sessionId = 'invalid-session-id-12345';
      localStorage.setItem('aptisense_active_interview_session', JSON.stringify(session));
    });
    
    // Try to submit answer
    const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
    await textarea.fill('This should fail due to invalid session');
    
    await page.click('button:has-text("Submit Answer")');
    
    // Wait for error message and recovery
    await page.waitForSelector('text=Session expired', { timeout: 10000 });
    
    // Should redirect after showing error
    await page.waitForTimeout(3000);
    
    console.log('✓ Invalid session handled and recovery initiated');
  });

  // =======================
  // FLOW 9: Backend Timeout Handling
  // =======================
  test('FLOW-9: Backend timeout graceful handling', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("Technical Round")');
    await page.click('button:has-text("Technical Round")');
    
    // Wait for interview
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    // Submit a very long answer to potentially trigger timeout
    const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
    const longAnswer = 'In depth technical answer: ' + 'Lorem ipsum dolor sit amet '.repeat(100);
    await textarea.fill(longAnswer);
    
    // Click submit
    await page.click('button:has-text("Submit Answer")');
    
    // Should handle timeout gracefully
    const errorMessages = await page.locator('text=/timed out|retry|error/i').count();
    
    // Even if there's an error, the UI should be responsive
    expect(await page.locator('textarea').isVisible()).toBeTruthy();
    
    console.log('✓ Backend timeout handled gracefully');
  });

  // =======================
  // FLOW 10: Complete Interview Lifecycle
  // =======================
  test('FLOW-10: Complete interview lifecycle - HR to Results', async ({ page }) => {
    // Start HR interview
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("HR Round")');
    await page.click('button:has-text("HR Round")');
    
    // Answer questions
    let questionCount = 0;
    while (questionCount < 3) {
      await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
      
      const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
      await textarea.fill(`Answer ${questionCount + 1}: This is a comprehensive response to the HR question about my background and motivation.`);
      
      const submitBtn = await page.locator('button:has-text("Submit Answer")');
      
      // Check if this is the last question
      const questionsAnswered = questionCount + 1;
      if (questionsAnswered >= 3) {
        // Might be the last one
        await submitBtn.click();
        
        // Wait to see if we get completion screen or another question
        const completionScreenVisible = await page.waitForSelector('text=Interview Completed', { timeout: 5000 }).catch(() => null);
        if (completionScreenVisible) {
          questionCount = 3;
          break;
        } else {
          questionCount++;
        }
      } else {
        await submitBtn.click();
        questionCount++;
        await page.waitForTimeout(1000);
      }
    }
    
    // Verify completion
    const completionMsg = await page.locator('text=Interview Completed').isVisible();
    expect(completionMsg).toBeTruthy();
    
    console.log('✓ Complete interview lifecycle successful');
  });

  // =======================
  // VALIDATION TESTS
  // =======================
  test('VALIDATION-1: Session persistence across navigation', async ({ page }) => {
    // Start interview
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("Behavioral Round")');
    await page.click('button:has-text("Behavioral Round")');
    
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    // Get session
    const session1 = await page.evaluate(() => JSON.parse(localStorage.getItem('aptisense_active_interview_session')));
    
    // Navigate back
    await page.click('button:has-text("← Return to Interview Types")');
    
    await page.waitForTimeout(2000);
    
    // Navigate back to interview
    await page.goto(`${BASE_URL}?page=interview`);
    
    // Verify session still exists
    const session2 = await page.evaluate(() => JSON.parse(localStorage.getItem('aptisense_active_interview_session')));
    
    expect(session2.sessionId).toBe(session1.sessionId);
    
    console.log('✓ Session persistence across navigation verified');
  });

  test('VALIDATION-2: Interview state consistency', async ({ page }) => {
    // Start interview
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("Communication Round")');
    await page.click('button:has-text("Communication Round")');
    
    // Wait and capture initial state
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    const initialState = await page.evaluate(() => ({
      sessionId: JSON.parse(localStorage.getItem('aptisense_active_interview_session')).sessionId,
      hasQuestion: !!document.querySelector('text=Question'),
      hasAnswerBox: !!document.querySelector('textarea'),
    }));
    
    expect(initialState.sessionId).toBeTruthy();
    expect(initialState.hasQuestion).toBeTruthy();
    expect(initialState.hasAnswerBox).toBeTruthy();
    
    console.log('✓ Interview state consistency validated');
  });

  test('VALIDATION-3: Error recovery and UI responsiveness', async ({ page }) => {
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("Technical Round")');
    await page.click('button:has-text("Technical Round")');
    
    // Wait for interview
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    // Try to submit empty answer (should show error)
    await page.click('button:has-text("Submit Answer")');
    
    // Should show validation error
    const validationError = await page.locator('text=Please provide an answer').isVisible();
    expect(validationError).toBeTruthy();
    
    // UI should remain responsive
    const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
    expect(await textarea.isEnabled()).toBeTruthy();
    
    console.log('✓ Error recovery and UI responsiveness validated');
  });

});

test.describe('Session Management Edge Cases', () => {
  
  test('EDGE-1: Multiple rapid interview starts', async ({ page, context }) => {
    await page.goto(BASE_URL);
    
    // Try to rapidly click start interviews
    for (let i = 0; i < 2; i++) {
      await page.goto(`${BASE_URL}?page=interview-types`);
      await page.waitForSelector('button:has-text("HR Round")');
      
      await page.click('button:has-text("HR Round")');
      
      // Should show dialog if session exists
      const dialogHandler = page.once('dialog', async dialog => {
        if (dialog.type() === 'confirm') {
          await dialog.accept();
        }
      });
      
      await page.waitForTimeout(1000);
    }
    
    console.log('✓ Multiple rapid interview starts handled');
  });

  test('EDGE-2: Session recovery after extended idle', async ({ page }) => {
    // Start interview
    await page.goto(`${BASE_URL}?page=interview-types`);
    await page.waitForSelector('button:has-text("HR Round")');
    await page.click('button:has-text("HR Round")');
    
    await page.waitForSelector('textarea[placeholder*="Type your answer"]', { timeout: 10000 });
    
    // Simulate idle - just wait
    await page.waitForTimeout(5000);
    
    // Try to continue
    const textarea = await page.locator('textarea[placeholder*="Type your answer"]');
    expect(await textarea.isVisible()).toBeTruthy();
    
    // Should still be able to type
    await textarea.fill('After extended idle');
    
    const text = await textarea.inputValue();
    expect(text).toBe('After extended idle');
    
    console.log('✓ Session recovery after idle successful');
  });

});
