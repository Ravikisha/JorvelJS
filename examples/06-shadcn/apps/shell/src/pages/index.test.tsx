import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './index.js';

describe('shell — HomePage', () => {
  it('renders the starter heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /it works/i })).toBeInTheDocument();
  });

  it('the counter button is interactive', async () => {
    render(<HomePage />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent(/clicked 0 times/i);
  });
});
