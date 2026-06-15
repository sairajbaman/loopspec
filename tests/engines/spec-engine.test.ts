import { describe, it, expect } from 'vitest';
import { analyzeIdea } from '../../src/engines/spec-engine/analyzer.js';
import { generateQuestions } from '../../src/engines/spec-engine/questions.js';
import { loadStackPreset, listAvailableStacks } from '../../src/engines/spec-engine/stacks.js';

describe('Spec Engine Analyzer', () => {
  describe('industry detection (multi-signal)', () => {
    it('detects fintech from invoice keywords', () => {
      const result = analyzeIdea('build an app where freelancers can track invoices and get paid faster');
      expect(result.industry).toBe('fintech');
      expect(result.confidence.industry).toBeGreaterThan(0.3);
    });

    it('detects healthcare from patient/appointment keywords', () => {
      const result = analyzeIdea('a patient scheduling system for clinics with appointment booking');
      expect(result.industry).toBe('healthcare');
    });

    it('detects ecommerce from shop/cart keywords', () => {
      const result = analyzeIdea('online marketplace for handmade products with cart and checkout');
      expect(result.industry).toBe('ecommerce');
      expect(result.productType).toBe('marketplace');
    });

    it('detects education from course/student keywords', () => {
      const result = analyzeIdea('platform where students can enroll in courses and take quizzes');
      expect(result.industry).toBe('education');
    });

    it('ranks higher-weight keywords above lower ones', () => {
      // "invoice" is weight 3 for fintech, "money" is weight 1
      const result = analyzeIdea('help people manage money and track invoices');
      expect(result.industry).toBe('fintech');
    });

    it('defaults to saas for ambiguous input', () => {
      const result = analyzeIdea('build something cool');
      expect(result.industry).toBe('saas');
    });
  });

  describe('complexity estimation (multi-signal)', () => {
    it('simple for short ideas with no complexity signals', () => {
      const result = analyzeIdea('a todo app');
      expect(result.complexity).toBe('simple');
    });

    it('medium for ideas with some features', () => {
      const result = analyzeIdea('build a dashboard with auth and notifications for teams');
      expect(result.complexity).toBe('medium');
    });

    it('complex for ideas with high-complexity signals', () => {
      const result = analyzeIdea('real-time collaboration platform with multi-tenant role-based access, payment integration, oauth SSO, and microservice architecture');
      expect(result.complexity).toBe('complex');
      expect(result.confidence.complexity).toBeGreaterThan(0.5);
    });

    it('considers feature count not just word count', () => {
      // Long sentence but no complexity signals should not be complex
      const result = analyzeIdea('I want to create a very nice looking beautiful simple personal website that shows my portfolio of work and contact information');
      expect(result.complexity).not.toBe('complex');
    });
  });

  describe('product type detection', () => {
    it('detects marketplace from two-sided keywords', () => {
      const result = analyzeIdea('a two-sided marketplace connecting buyers and sellers');
      expect(result.productType).toBe('marketplace');
    });

    it('detects mobile-app from ios/android keywords', () => {
      const result = analyzeIdea('build a mobile ios app for fitness tracking');
      expect(result.productType).toBe('mobile-app');
    });

    it('detects api from backend/microservice keywords', () => {
      const result = analyzeIdea('build a REST api microservice for user management');
      expect(result.productType).toBe('api');
    });

    it('defaults to web-app', () => {
      const result = analyzeIdea('build a platform for managing tasks');
      expect(result.productType).toBe('web-app');
    });
  });

  describe('stack detection', () => {
    it('detects nextjs stack', () => {
      const result = analyzeIdea('build a nextjs dashboard for analytics');
      expect(result.impliedStack).toBe('nextjs-supabase-shadcn');
    });

    it('detects flutter stack', () => {
      const result = analyzeIdea('create a flutter app for expense tracking');
      expect(result.impliedStack).toBe('flutter-firebase');
    });

    it('detects python/fastapi stack', () => {
      const result = analyzeIdea('build a python fastapi backend for data processing');
      expect(result.impliedStack).toBe('python-fastapi');
    });

    it('returns null when no stack hints', () => {
      const result = analyzeIdea('build an app for managing invoices');
      expect(result.impliedStack).toBeNull();
    });
  });

  describe('feature extraction', () => {
    it('extracts features from "with" clauses', () => {
      const result = analyzeIdea('build an app with authentication, dashboard, and notifications');
      expect(result.features.length).toBeGreaterThan(0);
    });

    it('filters stop words from keywords', () => {
      const result = analyzeIdea('build the app with some features and more stuff');
      expect(result.keywords).not.toContain('with');
      expect(result.keywords).not.toContain('build');
      expect(result.keywords).not.toContain('some');
      expect(result.keywords).not.toContain('more');
    });
  });

  describe('target user extraction', () => {
    it('extracts user from "for X" pattern', () => {
      const result = analyzeIdea('a scheduling app for freelancers who manage multiple clients');
      expect(result.targetUser).toContain('freelancers');
    });

    it('defaults to general users when no pattern matches', () => {
      const result = analyzeIdea('build something');
      expect(result.targetUser).toBe('general users');
    });
  });
});

describe('Questions Engine', () => {
  it('generates 5 questions for vibe mode', () => {
    const analysis = analyzeIdea('invoice tracker');
    const questions = generateQuestions(analysis, 'vibe');
    expect(questions.length).toBe(5);
  });

  it('generates 10 questions for pro mode', () => {
    const analysis = analyzeIdea('invoice tracker');
    const questions = generateQuestions(analysis, 'pro');
    expect(questions.length).toBe(10);
  });

  it('generates 12 questions for team mode', () => {
    const analysis = analyzeIdea('invoice tracker');
    const questions = generateQuestions(analysis, 'team');
    expect(questions.length).toBe(12);
  });

  it('pre-fills implied stack in questions', () => {
    const analysis = analyzeIdea('nextjs dashboard');
    const questions = generateQuestions(analysis, 'pro');
    const stackQ = questions.find(q => q.id === 'stack');
    expect(stackQ?.default).toBe('nextjs-supabase-shadcn');
  });
});

describe('Stack Presets', () => {
  it('lists all 14 available stacks', () => {
    const stacks = listAvailableStacks();
    expect(stacks.length).toBe(14);
    expect(stacks).toContain('nextjs-supabase-shadcn');
    expect(stacks).toContain('t3-stack');
    expect(stacks).toContain('python-fastapi');
    expect(stacks).toContain('go-fiber');
    expect(stacks).toContain('rust-axum');
    expect(stacks).toContain('spring-boot');
  });

  it('loads nextjs-supabase-shadcn preset', () => {
    const preset = loadStackPreset('nextjs-supabase-shadcn');
    expect(preset).not.toBeNull();
    expect(preset!.framework).toContain('Next.js');
    expect(preset!.conventions.length).toBeGreaterThan(3);
    expect(preset!.anti_patterns.length).toBeGreaterThan(3);
  });

  it('returns null for unknown stack', () => {
    const preset = loadStackPreset('nonexistent-stack');
    expect(preset).toBeNull();
  });
});
