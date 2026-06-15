import { describe, it, expect } from 'vitest';
import { generateSchemaPrompt } from '../../src/engines/spec-engine/templates/schema.js';
import { generateTrdPrompt } from '../../src/engines/spec-engine/templates/trd.js';
import { generateAppFlowPrompt } from '../../src/engines/spec-engine/templates/appflow.js';
import { generatePrdPrompt } from '../../src/engines/spec-engine/templates/prd.js';
import { analyzeIdea } from '../../src/engines/spec-engine/analyzer.js';

describe('Hybrid Spec Generation', () => {
  const fintechAnalysis = analyzeIdea('build an invoice tracking app for freelancers');
  const ecommerceAnalysis = analyzeIdea('online marketplace for handmade products with cart');
  const defaultAnswers = { auth: 'email/password', core_feature: 'invoice tracking', target_user: 'freelancers' };

  describe('Schema Template', () => {
    it('generates actual table definitions for fintech', () => {
      const output = generateSchemaPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('Table: `users`');
      expect(output).toContain('Table: `invoices`');
      expect(output).toContain('uuid');
      expect(output).toContain('FK → users.id');
    });

    it('generates CRUD API endpoints', () => {
      const output = generateSchemaPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('GET');
      expect(output).toContain('POST');
      expect(output).toContain('PATCH');
      expect(output).toContain('DELETE');
      expect(output).toContain('/api/invoices');
    });

    it('includes auth endpoints when auth is not none', () => {
      const output = generateSchemaPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('/api/auth/signup');
      expect(output).toContain('/api/auth/login');
    });

    it('skips auth endpoints when auth is none', () => {
      const output = generateSchemaPrompt(fintechAnalysis, { ...defaultAnswers, auth: 'none' });
      expect(output).not.toContain('/api/auth/signup');
    });

    it('generates ecommerce-specific tables', () => {
      const output = generateSchemaPrompt(ecommerceAnalysis, { auth: 'email/password', core_feature: 'shopping' });
      expect(output).toContain('Table: `products`');
      expect(output).toContain('Table: `orders`');
    });
  });

  describe('TRD Template', () => {
    it('generates file structure tree', () => {
      const output = generateTrdPrompt(fintechAnalysis, { ...defaultAnswers, stack: 'nextjs-supabase-shadcn' });
      expect(output).toContain('├──');
      expect(output).toContain('src/');
      expect(output).toContain('app/');
    });

    it('generates NFR table with targets', () => {
      const output = generateTrdPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('LCP');
      expect(output).toContain('JS Bundle');
      expect(output).toContain('API Response');
    });

    it('scales NFRs based on user count', () => {
      const smallOutput = generateTrdPrompt(fintechAnalysis, { ...defaultAnswers, scale: '< 100' });
      const largeOutput = generateTrdPrompt(fintechAnalysis, { ...defaultAnswers, scale: '10000+' });
      // Large scale should have stricter targets
      expect(largeOutput).toContain('1.5s');
      expect(smallOutput).toContain('2.5s');
    });
  });

  describe('AppFlow Template', () => {
    it('generates screen tables with states', () => {
      const output = generateAppFlowPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('| Screen | Route | Auth | States |');
      expect(output).toContain('loading');
      expect(output).toContain('protected');
    });

    it('includes auth flow when auth is needed', () => {
      const output = generateAppFlowPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('Login');
      expect(output).toContain('Signup');
    });

    it('includes industry-specific screens', () => {
      const output = generateAppFlowPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('Invoice');
      expect(output).toContain('Dashboard');
    });
  });

  describe('PRD Template', () => {
    it('generates user stories based on industry', () => {
      const output = generatePrdPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('As a freelancers');
      expect(output).toContain('invoices');
    });

    it('generates success metrics table', () => {
      const output = generatePrdPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('| Metric | Target');
      expect(output).toContain('Activation');
      expect(output).toContain('Retention');
    });

    it('includes non-goals section', () => {
      const output = generatePrdPrompt(fintechAnalysis, defaultAnswers);
      expect(output).toContain('Non-Goals');
      expect(output).toContain('will NOT include');
    });
  });
});
