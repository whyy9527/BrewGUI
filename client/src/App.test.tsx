import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock axios to avoid ES module issues in test environment
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { formulae: [], casks: [] } })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  delete: jest.fn(() => Promise.resolve({ data: {} })),
}));

test('renders BrewGUI header', () => {
  render(<App />);
  const headerElement = screen.getByText(/BrewGUI/i);
  expect(headerElement).toBeInTheDocument();
});
