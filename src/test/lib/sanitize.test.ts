import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeText } from '@/lib/sanitize';

describe('sanitizeHtml', () => {
  it('strips <script> tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Hello</p>');
  });

  it('strips <script> tags with src attribute', () => {
    const input = '<script src="https://evil.com/hack.js"></script>';
    const result = sanitizeHtml(input);
    expect(result).toBe('');
  });

  it('allows safe tags: <b>, <i>, <em>, <strong>', () => {
    const input = '<b>bold</b> <i>italic</i> <em>emphasis</em> <strong>strong</strong>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<b>bold</b>');
    expect(result).toContain('<i>italic</i>');
    expect(result).toContain('<em>emphasis</em>');
    expect(result).toContain('<strong>strong</strong>');
  });

  it('allows <a> tags with href, target, and rel attributes', () => {
    const input = '<a href="https://example.com" target="_blank" rel="noopener">link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener"');
  });

  it('allows list tags: <ul>, <ol>, <li>', () => {
    const input = '<ul><li>one</li><li>two</li></ul><ol><li>three</li></ol>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('<ol>');
  });

  it('allows <p> and <br> tags', () => {
    const input = '<p>paragraph</p><br>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<br');
  });

  it('allows <code> and <pre> tags', () => {
    const input = '<pre><code>const x = 1;</code></pre>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
  });

  it('strips event handlers: onerror', () => {
    const input = '<img onerror="alert(1)" src="x">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('strips event handlers: onclick', () => {
    const input = '<b onclick="alert(1)">click me</b>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('<b>click me</b>');
  });

  it('strips event handlers: onload', () => {
    const input = '<svg onload="alert(1)"></svg>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onload');
  });

  it('strips disallowed tags like <iframe>', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
  });

  it('strips disallowed tags like <form>', () => {
    const input = '<form action="/steal"><input type="text"></form>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
  });

  it('strips <style> tags', () => {
    const input = '<style>body { display: none; }</style><p>visible</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<style');
    expect(result).toContain('<p>visible</p>');
  });

  it('strips javascript: protocol in href', () => {
    const input = '<a href="javascript:alert(1)">xss</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles plain text (no HTML) safely', () => {
    const input = 'Hello World!';
    const result = sanitizeHtml(input);
    expect(result).toBe('Hello World!');
  });

  it('strips disallowed attributes from allowed tags', () => {
    const input = '<b style="color:red" class="evil">text</b>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('style');
    expect(result).not.toContain('class');
    expect(result).toContain('<b>text</b>');
  });
});

describe('sanitizeText', () => {
  it('strips ALL HTML tags', () => {
    const input = '<b>bold</b> <i>italic</i> <a href="#">link</a>';
    const result = sanitizeText(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toBe('bold italic link');
  });

  it('strips script tags and their content', () => {
    const input = 'Hello<script>alert("xss")</script> World';
    const result = sanitizeText(input);
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    const input = 'Just a normal string';
    expect(sanitizeText(input)).toBe('Just a normal string');
  });

  it('strips nested HTML', () => {
    const input = '<div><p><b>deep</b></p></div>';
    const result = sanitizeText(input);
    expect(result).toBe('deep');
  });

  it('handles HTML entities in text', () => {
    const input = '&lt;script&gt;alert(1)&lt;/script&gt;';
    const result = sanitizeText(input);
    expect(result).not.toContain('<script');
  });
});
