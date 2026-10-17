/**
 * main.ts — Entry point
 * Boots the AccessLens application.
 */

import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { createApp } from './app';

const root = document.getElementById('app');
if (!root) throw new Error('Root #app element not found');

// ── Skip-to-content link ────────────────────────────────────────────────────
const skipLink = document.createElement('a');
skipLink.href = '#main-content';
skipLink.textContent = 'Skip to main content';
skipLink.style.cssText = `
  position: fixed;
  top: -50px;
  left: 0;
  z-index: 9999;
  background: var(--color-accent);
  color: #fff;
  padding: 8px 16px;
  font-weight: 600;
  font-size: var(--text-sm);
  border-radius: 0 0 var(--radius-md) 0;
  text-decoration: none;
  transition: top var(--duration-fast) var(--ease-out);
  outline: none;
`;
skipLink.addEventListener('focus', () => { skipLink.style.top = '0'; });
skipLink.addEventListener('blur',  () => { skipLink.style.top = '-50px'; });
document.body.prepend(skipLink);

// ── Boot app ────────────────────────────────────────────────────────────────
createApp(root);
