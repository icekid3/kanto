// views/auth.js — login & signup forms.
import { escapeHtml } from '../lib/format.js';

export function loginView({ error, next = '' } = {}) {
  const body = `
    <div class="auth-wrap">
      <h1>Log in</h1>
      <p class="sub">Demo accounts — host@demo.app / Demo1234! and guest@demo.app / Demo1234!</p>
      ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/login">
        <input type="hidden" name="next" value="${escapeHtml(next)}">
        <label>Email<input type="email" name="email" required autofocus></label>
        <label>Password<input type="password" name="password" required></label>
        <button class="btn btn-primary btn-block" type="submit">Log in</button>
      </form>
      <p class="foot-link">No account yet? <a href="/signup">Sign up</a></p>
    </div>
  `;
  return { title: 'Log in', body };
}

export function signupView({ error, values = {} } = {}) {
  const body = `
    <div class="auth-wrap">
      <h1>Create an account</h1>
      <p class="sub">Sign up as a guest to book, or a host to list a stay, lease, or space.</p>
      ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/signup">
        <label>Full name<input type="text" name="name" value="${escapeHtml(values.name || '')}" required></label>
        <label>Email<input type="email" name="email" value="${escapeHtml(values.email || '')}" required></label>
        <label>Password<input type="password" name="password" minlength="8" required></label>
        <div class="role-pick">
          <label><input type="radio" name="role" value="guest" ${values.role !== 'host' ? 'checked' : ''}><span>I'm a guest</span></label>
          <label><input type="radio" name="role" value="host" ${values.role === 'host' ? 'checked' : ''}><span>I'm a host</span></label>
        </div>
        <label class="agree-terms"><input type="checkbox" name="agree_terms" value="1" ${values.agree_terms ? 'checked' : ''} required><span>I agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a></span></label>
        <button class="btn btn-primary btn-block" type="submit">Create account</button>
      </form>
      <p class="foot-link">Already have an account? <a href="/login">Log in</a></p>
    </div>
  `;
  return { title: 'Sign up', body };
}
